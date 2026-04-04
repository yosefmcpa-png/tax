import Anthropic from '@anthropic-ai/sdk'
import { anthropic, CLAUDE_MODEL, ClaudeTextResult } from './client'
import { createAdminSupabaseClient } from '@/lib/supabase/server'
import { duckduckgoSearch, israeliTaxSearch, fetchAndParse } from '@/lib/tools/web-search'
import { Source } from '@/types'

// ============================================================
// Claude Agentic Loop — סוכן אוטונומי מלא
//
// כלים זמינים לסוכן:
//  1. web_search       — DuckDuckGo חינם, ללא API key
//  2. fetch_page       — קורא כל URL ברשת
//  3. search_tax_sites — חיפוש ממוקד באתרי מס ישראליים
//  4. search_companies — רשם החברות (DB מקומי)
//  5. search_tax_rulings   — חוזרי מס (DB מקומי)
//  6. search_legislation   — חקיקה (DB מקומי)
//  7. search_court_cases   — פסקי דין (DB מקומי)
// ============================================================

export interface AgentParams {
  systemInstruction: string
  userMessage:       string
  history?:          Array<{ role: 'user' | 'assistant'; content: string }>
  useThinking?:      boolean
  maxToolCalls?:     number
}

// ── כלי Web Search + DB ────────────────────────────────────
const ALL_TOOLS: Anthropic.Tool[] = [

  // ---- רשת ----
  {
    name: 'web_search',
    description: `חפש מידע עדכני בכל האינטרנט.
השתמש בכלי זה:
- כשנדרש מידע עדכני (פסיקה חדשה, שינויי חוק, שיעורי מס עדכניים)
- כשהDB המקומי לא מחזיר תוצאות
- לחיפוש מידע שלא נמצא עדיין במאגר שלנו
מחזיר: כותרות, קישורים, ותמצית מהדפים.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        query:      { type: 'string', description: 'שאילתת חיפוש בעברית או אנגלית' },
        focus_tax:  { type: 'boolean', description: 'true = הגבל לאתרי מס ישראליים בלבד (taxes.gov.il, psakdin.co.il, knesset.gov.il)' },
      },
      required: ['query'],
    },
  },

  {
    name: 'fetch_page',
    description: `קרא את התוכן המלא של דף אינטרנט ספציפי.
השתמש בכלי זה אחרי web_search כשרוצים לקרוא את המסמך המלא (פסק דין, חוזר מס, חוק).
מחזיר: טקסט מלא של הדף.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        url:    { type: 'string', description: 'כתובת ה-URL לקריאה' },
        reason: { type: 'string', description: 'מדוע אתה קורא דף זה' },
      },
      required: ['url'],
    },
  },

  // ---- DB מקומי ----
  {
    name: 'search_companies',
    description: 'חפש חברות במאגר רשם החברות המקומי (נתונים מ-data.gov.il).',
    input_schema: {
      type: 'object' as const,
      properties: {
        query:  { type: 'string', description: 'שם חברה או מספר ח.פ' },
        status: { type: 'string', enum: ['active', 'dissolved', 'all'] },
        limit:  { type: 'number' },
      },
      required: ['query'],
    },
  },

  {
    name: 'search_tax_rulings',
    description: 'חפש חוזרי מס ופסיקות מנהליות (רשות המיסים) במאגר המקומי.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query:     { type: 'string' },
        year_from: { type: 'number' },
        year_to:   { type: 'number' },
        limit:     { type: 'number' },
      },
      required: ['query'],
    },
  },

  {
    name: 'search_legislation',
    description: 'חפש חקיקה ישראלית (חוקים, תקנות, הצעות חוק) במאגר המקומי.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string' },
        type:  { type: 'string', enum: ['law', 'regulation', 'bill', 'all'] },
        limit: { type: 'number' },
      },
      required: ['query'],
    },
  },

  {
    name: 'search_court_cases',
    description: 'חפש פסקי דין במאגר פסקי הדין המקומי.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string' },
        court: { type: 'string' },
        limit: { type: 'number' },
      },
      required: ['query'],
    },
  },
]

// ── ביצוע כלים ─────────────────────────────────────────────
async function executeTool(
  name:  string,
  input: Record<string, unknown>
): Promise<{ result: string; sources?: Source[] }> {
  const sources: Source[] = []

  try {
    switch (name) {

      // ── Web Search ────────────────────────────────────────
      case 'web_search': {
        const query     = input.query as string
        const focusTax  = input.focus_tax as boolean ?? false

        const results = focusTax
          ? await israeliTaxSearch(query)
          : await duckduckgoSearch(query, 8)

        if (!results.length) return { result: 'לא נמצאו תוצאות לחיפוש זה.' }

        // בנה מקורות
        results.forEach(r => sources.push({ uri: r.url, title: r.title }))

        const formatted = results
          .map((r, i) =>
            `[${i + 1}] **${r.title}**\nכתובת: ${r.url}\nמקור: ${r.source}\n${r.snippet}`
          )
          .join('\n\n')

        return {
          result: `נמצאו ${results.length} תוצאות:\n\n${formatted}`,
          sources,
        }
      }

      // ── Fetch Page ────────────────────────────────────────
      case 'fetch_page': {
        const url = input.url as string
        const { title, content } = await fetchAndParse(url)
        sources.push({ uri: url, title })
        return {
          result: `**${title}**\nמקור: ${url}\n\n${content}`,
          sources,
        }
      }

      // ── DB Tools ──────────────────────────────────────────
      default:
        return { result: await executeDbTool(name, input) }
    }
  } catch (err) {
    return { result: `שגיאה בהרצת הכלי ${name}: ${(err as Error).message}` }
  }
}

// ── DB Tool Execution ───────────────────────────────────────
async function executeDbTool(
  toolName: string,
  input:    Record<string, unknown>
): Promise<string> {
  const supabase = createAdminSupabaseClient()
  const limit    = (input.limit as number) ?? 10

  switch (toolName) {

    case 'search_companies': {
      const q = input.query as string
      const { data } = await supabase
        .from('scraped_companies')
        .select('company_number, name, status, registered_at, address')
        .or(`name.ilike.%${q}%,company_number.eq.${q}`)
        .limit(limit)
      return data?.length
        ? JSON.stringify(data, null, 2)
        : `לא נמצאו חברות עבור "${q}" — נסה web_search.`
    }

    case 'search_tax_rulings': {
      const q = input.query as string
      let query = supabase
        .from('scraped_tax_rulings')
        .select('ruling_number, title, summary, date_issued, category')
        .ilike('title', `%${q}%`)
        .limit(limit)
      if (input.year_from) query = query.gte('date_issued', `${input.year_from}-01-01`)
      if (input.year_to)   query = query.lte('date_issued', `${input.year_to}-12-31`)
      const { data } = await query
      return data?.length
        ? JSON.stringify(data, null, 2)
        : `לא נמצאו חוזרי מס עבור "${q}" — נסה web_search עם focus_tax: true.`
    }

    case 'search_legislation': {
      const q = input.query as string
      const typeFilter = input.type && input.type !== 'all' ? (input.type as string) : null
      let query = supabase
        .from('scraped_legislation')
        .select('law_id, title, type, status, published_at, summary, source_url')
        .ilike('title', `%${q}%`)
        .limit(limit)
      if (typeFilter) query = query.eq('type', typeFilter)
      const { data } = await query
      return data?.length
        ? JSON.stringify(data, null, 2)
        : `לא נמצאה חקיקה עבור "${q}" — נסה web_search עם focus_tax: true.`
    }

    case 'search_court_cases': {
      const q = input.query as string
      let query = supabase
        .from('scraped_court_cases')
        .select('case_number, title, court, decision_date, summary, outcome, source_url')
        .ilike('summary', `%${q}%`)
        .limit(limit)
      if (input.court) query = query.ilike('court', `%${input.court}%`)
      const { data } = await query
      return data?.length
        ? JSON.stringify(data, null, 2)
        : `לא נמצאו פסקי דין עבור "${q}" — נסה web_search.`
    }

    default:
      return `כלי לא מוכר: ${toolName}`
  }
}

// ── Agentic Loop ────────────────────────────────────────────
export async function runClaudeAgent(params: AgentParams): Promise<ClaudeTextResult> {
  const {
    systemInstruction,
    userMessage,
    history      = [],
    useThinking  = true,
    maxToolCalls = 15,
  } = params

  const messages: Anthropic.MessageParam[] = [
    ...history.map(h => ({ role: h.role as 'user' | 'assistant', content: h.content })),
    { role: 'user', content: userMessage },
  ]

  let toolCallCount = 0
  let inputTokens   = 0
  let outputTokens  = 0
  let finalText     = ''
  const allSources: Source[] = []

  while (true) {
    const response = await anthropic.messages.create({
      model:      CLAUDE_MODEL,
      max_tokens: 16000,
      system:     systemInstruction,
      messages,
      tools:      ALL_TOOLS,
      thinking:   useThinking ? { type: 'adaptive' } : undefined,
    } as Anthropic.MessageCreateParamsNonStreaming)

    inputTokens  += response.usage?.input_tokens  ?? 0
    outputTokens += response.usage?.output_tokens ?? 0

    for (const block of response.content) {
      if (block.type === 'text') finalText = block.text
    }

    if (response.stop_reason === 'end_turn' || response.stop_reason === 'max_tokens') break
    if (response.stop_reason !== 'tool_use' || toolCallCount >= maxToolCalls) break

    messages.push({ role: 'assistant', content: response.content })

    const toolResults: Anthropic.ToolResultBlockParam[] = []
    for (const block of response.content) {
      if (block.type === 'tool_use') {
        toolCallCount++
        const { result, sources } = await executeTool(
          block.name,
          block.input as Record<string, unknown>
        )
        if (sources) allSources.push(...sources)
        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result })
      }
    }

    messages.push({ role: 'user', content: toolResults })
  }

  return {
    text:         finalText,
    sources:      dedupeSources(allSources),
    inputTokens,
    outputTokens,
  }
}

// ── Streaming Agentic Loop ──────────────────────────────────
export async function* runClaudeAgentStream(
  params: AgentParams
): AsyncGenerator<{
  text?:         string
  toolCall?:     string
  done?:         boolean
  inputTokens?:  number
  outputTokens?: number
}> {
  const {
    systemInstruction,
    userMessage,
    history      = [],
    useThinking  = true,
    maxToolCalls = 15,
  } = params

  const messages: Anthropic.MessageParam[] = [
    ...history.map(h => ({ role: h.role as 'user' | 'assistant', content: h.content })),
    { role: 'user', content: userMessage },
  ]

  let toolCallCount = 0
  let totalInput    = 0
  let totalOutput   = 0

  while (true) {
    const stream = anthropic.messages.stream({
      model:      CLAUDE_MODEL,
      max_tokens: 16000,
      system:     systemInstruction,
      messages,
      tools:      ALL_TOOLS,
      thinking:   useThinking ? { type: 'adaptive' } : undefined,
    } as Parameters<typeof anthropic.messages.stream>[0])

    // שמור tool_use blocks לביצוע
    const pendingToolUses: Array<{ id: string; name: string; inputJson: string }> = []
    let currentToolId   = ''
    let currentToolName = ''
    let inputBuffer     = ''
    let hasToolUse      = false

    for await (const event of stream) {
      switch (event.type) {
        case 'content_block_start':
          if (event.content_block.type === 'tool_use') {
            hasToolUse      = true
            currentToolId   = event.content_block.id
            currentToolName = event.content_block.name
            inputBuffer     = ''
            // הצג הודעה למשתמש
            yield { toolCall: toolCallLabel(currentToolName) }
          }
          break

        case 'content_block_delta':
          if (event.delta.type === 'text_delta') {
            yield { text: event.delta.text }
          }
          if (event.delta.type === 'input_json_delta') {
            inputBuffer += event.delta.partial_json
          }
          break

        case 'content_block_stop':
          if (currentToolId && currentToolName) {
            pendingToolUses.push({
              id:        currentToolId,
              name:      currentToolName,
              inputJson: inputBuffer,
            })
            currentToolId   = ''
            currentToolName = ''
          }
          break
      }
    }

    const finalMsg = await stream.finalMessage()
    totalInput  += finalMsg.usage?.input_tokens  ?? 0
    totalOutput += finalMsg.usage?.output_tokens ?? 0

    if (!hasToolUse || toolCallCount >= maxToolCalls) break

    messages.push({ role: 'assistant', content: finalMsg.content })

    const toolResults: Anthropic.ToolResultBlockParam[] = []
    for (const tu of pendingToolUses) {
      toolCallCount++
      let toolInput: Record<string, unknown> = {}
      try { toolInput = JSON.parse(tu.inputJson) } catch { /* empty input */ }

      const { result } = await executeTool(tu.name, toolInput)
      toolResults.push({ type: 'tool_result', tool_use_id: tu.id, content: result })
    }

    messages.push({ role: 'user', content: toolResults })
  }

  yield { done: true, inputTokens: totalInput, outputTokens: totalOutput }
}

// ── Helpers ──────────────────────────────────────────────────
function toolCallLabel(toolName: string): string {
  const labels: Record<string, string> = {
    web_search:           '🌐 מחפש ברשת...',
    fetch_page:           '📄 קורא מסמך...',
    search_companies:     '🏢 מחפש חברות...',
    search_tax_rulings:   '📋 מחפש חוזרי מס...',
    search_legislation:   '⚖️ מחפש חקיקה...',
    search_court_cases:   '🏛️ מחפש פסיקה...',
  }
  return labels[toolName] ?? `🔍 ${toolName}...`
}

function dedupeSources(sources: Source[]): Source[] {
  const seen = new Set<string>()
  return sources.filter(s => {
    if (seen.has(s.uri)) return false
    seen.add(s.uri)
    return true
  })
}
