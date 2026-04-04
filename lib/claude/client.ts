import Anthropic from '@anthropic-ai/sdk'
import { Source } from '@/types'

// ============================================================
// Claude API Client — SERVER SIDE ONLY
// claude-opus-4-6 עם adaptive thinking + streaming
// ============================================================

if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error('ANTHROPIC_API_KEY is not set in environment variables')
}

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export const CLAUDE_MODEL = 'claude-opus-4-6'

export interface ClaudeTextResult {
  text: string
  sources: Source[]       // מקורות מ-web_search tool
  inputTokens: number
  outputTokens: number
}

// ---- Retry עם exponential backoff ----
async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 4,
  delayMs = 1000
): Promise<T> {
  try {
    return await fn()
  } catch (err: unknown) {
    const error = err as { status?: number; message?: string }
    if (retries > 0 && (error?.status === 429 || error?.status === 529)) {
      await new Promise(r => setTimeout(r, delayMs))
      return withRetry(fn, retries - 1, delayMs * 2)
    }
    throw err
  }
}

// ---- קריאת טקסט רגילה ----
export async function callClaude(params: {
  systemInstruction: string
  userMessage: string
  history?: Array<{ role: 'user' | 'assistant'; content: string }>
  useWebSearch?: boolean   // web_search tool אם צריך מידע עדכני
  useThinking?: boolean    // adaptive thinking לשאלות מורכבות
}): Promise<ClaudeTextResult> {
  const {
    systemInstruction,
    userMessage,
    history = [],
    useWebSearch = false,
    useThinking  = true,
  } = params

  const tools: Anthropic.Tool[] = useWebSearch
    ? [{ type: 'web_search_20250305' as never, name: 'web_search', max_uses: 5 } as never]
    : []

  const messages: Anthropic.MessageParam[] = [
    ...history.map(h => ({ role: h.role, content: h.content })),
    { role: 'user', content: userMessage },
  ]

  const response = await withRetry(() =>
    anthropic.messages.create({
      model:      CLAUDE_MODEL,
      max_tokens: 16000,
      system:     systemInstruction,
      messages,
      thinking:   useThinking ? { type: 'adaptive' } : undefined,
      ...(tools.length > 0 ? { tools } : {}),
    } as Anthropic.MessageCreateParamsNonStreaming)
  )

  // חילוץ טקסט מתוכן המורכב
  let text = ''
  const sources: Source[] = []

  for (const block of response.content) {
    if (block.type === 'text') {
      text += block.text
    } else if (block.type === 'tool_use' && block.name === 'web_search') {
      // web_search תוצאות יגיעו כ-tool_result בתגובה — Claude מטפל בזה פנימית
    }
  }

  // חיפוש מקורות ב-tool_result blocks (אם השתמש ב-web_search)
  if (useWebSearch && response.stop_reason === 'tool_use') {
    // Claude ימשיך בלולאה, כאן נאסוף מה שיש
    // המקורות מגיעים כ-citations בתוך הטקסט
  }

  const inputTokens  = response.usage?.input_tokens  ?? 0
  const outputTokens = response.usage?.output_tokens ?? 0

  return { text, sources, inputTokens, outputTokens }
}

// ---- Streaming — מחזיר AsyncGenerator לשימוש ב-SSE ----
export interface StreamChunk {
  text?:         string
  sources?:      Source[]
  inputTokens?:  number
  outputTokens?: number
  error?:        string
  done?:         boolean
}

export async function* callClaudeStream(params: {
  systemInstruction: string
  userMessage: string
  history?: Array<{ role: 'user' | 'assistant'; content: string }>
  useWebSearch?: boolean
  useThinking?: boolean
}): AsyncGenerator<StreamChunk> {
  const {
    systemInstruction,
    userMessage,
    history = [],
    useWebSearch = false,
    useThinking  = true,
  } = params

  const tools: Anthropic.Tool[] = useWebSearch
    ? [{ type: 'web_search_20250305' as never, name: 'web_search', max_uses: 5 } as never]
    : []

  const messages: Anthropic.MessageParam[] = [
    ...history.map(h => ({ role: h.role, content: h.content })),
    { role: 'user', content: userMessage },
  ]

  const stream = anthropic.messages.stream({
    model:      CLAUDE_MODEL,
    max_tokens: 16000,
    system:     systemInstruction,
    messages,
    thinking:   useThinking ? { type: 'adaptive' } : undefined,
    ...(tools.length > 0 ? { tools } : {}),
  } as Parameters<typeof anthropic.messages.stream>[0])

  for await (const event of stream) {
    if (
      event.type === 'content_block_delta' &&
      event.delta.type === 'text_delta'
    ) {
      yield { text: event.delta.text }
    }
  }

  const finalMsg = await stream.finalMessage()
  const inputTokens  = finalMsg.usage?.input_tokens  ?? 0
  const outputTokens = finalMsg.usage?.output_tokens ?? 0

  // חילוץ מקורות מתוצאות web_search
  const sources: Source[] = []
  for (const block of finalMsg.content) {
    if (block.type === 'tool_use' && block.name === 'web_search') {
      const input = block.input as { query?: string }
      if (input.query) {
        sources.push({ uri: `https://www.google.com/search?q=${encodeURIComponent(input.query)}`, title: input.query })
      }
    }
  }

  yield { done: true, sources, inputTokens, outputTokens }
}

// ============================================================
// Tool Use — Claude כסוכן עם כלי DB
// ============================================================

export interface DbSearchResult {
  companies?:    unknown[]
  rulings?:      unknown[]
  legislation?:  unknown[]
  courtCases?:   unknown[]
}

// הגדרת הכלים שClaudeיכול לקרוא
export const DB_TOOLS: Anthropic.Tool[] = [
  {
    name: 'search_companies',
    description: 'חפש חברות במאגר רשם החברות. מחזיר רשימת חברות עם פרטים מלאים.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query:      { type: 'string', description: 'שם חברה, מספר ח.פ, או מילת מפתח' },
        status:     { type: 'string', enum: ['active', 'dissolved', 'all'], description: 'סטטוס החברה' },
        limit:      { type: 'number', description: 'מספר תוצאות מקסימלי (ברירת מחדל: 10)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'search_tax_rulings',
    description: 'חפש פסיקות ותקנות מס ישראליות במאגר המקומי.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query:     { type: 'string', description: 'תיאור הסוגיה המשפטית' },
        year_from: { type: 'number', description: 'משנת' },
        year_to:   { type: 'number', description: 'עד שנת' },
        limit:     { type: 'number' },
      },
      required: ['query'],
    },
  },
  {
    name: 'search_legislation',
    description: 'חפש חקיקה ישראלית (חוקים, תקנות, הצעות חוק) במאגר.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query:   { type: 'string', description: 'נושא החיפוש' },
        type:    { type: 'string', enum: ['law', 'regulation', 'bill', 'all'] },
        limit:   { type: 'number' },
      },
      required: ['query'],
    },
  },
  {
    name: 'search_court_cases',
    description: 'חפש פסקי דין ממאגר פסקדין המקומי.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query:  { type: 'string', description: 'עובדות התיק או מילות מפתח' },
        court:  { type: 'string', description: 'ערכאה (עליון, מחוזי, שלום, בית המשפט לעניינים מינהליים)' },
        limit:  { type: 'number' },
      },
      required: ['query'],
    },
  },
]
