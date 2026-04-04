import Anthropic from '@anthropic-ai/sdk'
import { anthropic, CLAUDE_MODEL, DB_TOOLS, ClaudeTextResult } from './client'
import { createAdminSupabaseClient } from '@/lib/supabase/server'

// ============================================================
// Claude Agentic Loop — סוכן עם כלי DB
// Claude קורא לכלים, מקבל נתונים, ועונה בהתבסס על מאגר מקומי
// ============================================================

interface AgentParams {
  systemInstruction: string
  userMessage: string
  history?: Array<{ role: 'user' | 'assistant'; content: string }>
  useThinking?: boolean
  maxToolCalls?: number
}

// מבצע כלי DB ומחזיר תוצאות
async function executeDbTool(
  toolName: string,
  input: Record<string, unknown>
): Promise<string> {
  const supabase = createAdminSupabaseClient()
  const limit = (input.limit as number) ?? 10

  try {
    switch (toolName) {

      case 'search_companies': {
        const { data } = await supabase
          .from('scraped_companies')
          .select('company_number, name, status, registered_at, directors, address')
          .or(`name.ilike.%${input.query}%,company_number.eq.${input.query}`)
          .eq(input.status && input.status !== 'all' ? 'status' : 'id', input.status && input.status !== 'all' ? input.status : '')
          .limit(limit)
        if (!data?.length) return 'לא נמצאו חברות תואמות.'
        return JSON.stringify(data, null, 2)
      }

      case 'search_tax_rulings': {
        let query = supabase
          .from('scraped_tax_rulings')
          .select('ruling_number, title, summary, date_issued, category')
          .textSearch('title', input.query as string, { type: 'websearch' })
          .limit(limit)
        if (input.year_from) query = query.gte('date_issued', `${input.year_from}-01-01`)
        if (input.year_to)   query = query.lte('date_issued', `${input.year_to}-12-31`)
        const { data } = await query
        if (!data?.length) return 'לא נמצאו פסיקות תואמות.'
        return JSON.stringify(data, null, 2)
      }

      case 'search_legislation': {
        const typeFilter = input.type && input.type !== 'all' ? (input.type as string) : null
        let query = supabase
          .from('scraped_legislation')
          .select('law_id, title, type, status, published_at, summary')
          .textSearch('title', input.query as string, { type: 'websearch' })
          .limit(limit)
        if (typeFilter) query = query.eq('type', typeFilter)
        const { data } = await query
        if (!data?.length) return 'לא נמצאה חקיקה תואמת.'
        return JSON.stringify(data, null, 2)
      }

      case 'search_court_cases': {
        let query = supabase
          .from('scraped_court_cases')
          .select('case_number, title, court, decision_date, summary, outcome')
          .textSearch('summary', input.query as string, { type: 'websearch' })
          .limit(limit)
        if (input.court) query = query.ilike('court', `%${input.court}%`)
        const { data } = await query
        if (!data?.length) return 'לא נמצאו פסקי דין תואמים.'
        return JSON.stringify(data, null, 2)
      }

      default:
        return `כלי לא מוכר: ${toolName}`
    }
  } catch (err) {
    return `שגיאה בחיפוש: ${(err as Error).message}`
  }
}

// ---- לולאת Agentic עם Tool Use ----
export async function runClaudeAgent(params: AgentParams): Promise<ClaudeTextResult> {
  const {
    systemInstruction,
    userMessage,
    history = [],
    useThinking  = true,
    maxToolCalls = 10,
  } = params

  const messages: Anthropic.MessageParam[] = [
    ...history.map(h => ({ role: h.role as 'user' | 'assistant', content: h.content })),
    { role: 'user', content: userMessage },
  ]

  let toolCallCount = 0
  let inputTokens   = 0
  let outputTokens  = 0
  let finalText     = ''

  while (true) {
    const response = await anthropic.messages.create({
      model:      CLAUDE_MODEL,
      max_tokens: 16000,
      system:     systemInstruction,
      messages,
      tools:      DB_TOOLS,
      thinking:   useThinking ? { type: 'adaptive' } : undefined,
    } as Anthropic.MessageCreateParamsNonStreaming)

    inputTokens  += response.usage?.input_tokens  ?? 0
    outputTokens += response.usage?.output_tokens ?? 0

    // אסוף טקסט
    for (const block of response.content) {
      if (block.type === 'text') finalText = block.text
    }

    // Claude סיים — אין tool calls
    if (response.stop_reason === 'end_turn' || response.stop_reason === 'max_tokens') break

    // Claude רוצה לקרוא לכלים
    if (response.stop_reason === 'tool_use') {
      if (toolCallCount >= maxToolCalls) break

      // הוסף תגובת Claude להיסטוריה
      messages.push({ role: 'assistant', content: response.content })

      // הכן tool_results
      const toolResults: Anthropic.ToolResultBlockParam[] = []

      for (const block of response.content) {
        if (block.type === 'tool_use') {
          toolCallCount++
          const result = await executeDbTool(
            block.name,
            block.input as Record<string, unknown>
          )
          toolResults.push({
            type:       'tool_result',
            tool_use_id: block.id,
            content:    result,
          })
        }
      }

      // הוסף תוצאות לhיסטוריה
      messages.push({ role: 'user', content: toolResults })
      continue
    }

    break
  }

  return { text: finalText, sources: [], inputTokens, outputTokens }
}

// ---- Streaming Agent (for real-time UI) ----
export async function* runClaudeAgentStream(
  params: AgentParams
): AsyncGenerator<{ text?: string; toolCall?: string; done?: boolean; inputTokens?: number; outputTokens?: number }> {
  const {
    systemInstruction,
    userMessage,
    history = [],
    useThinking  = true,
    maxToolCalls = 10,
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
      tools:      DB_TOOLS,
      thinking:   useThinking ? { type: 'adaptive' } : undefined,
    } as Parameters<typeof anthropic.messages.stream>[0])

    let hasToolUse = false
    const currentContent: Anthropic.ContentBlock[] = []

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield { text: event.delta.text }
      }
      if (event.type === 'content_block_start' && event.content_block.type === 'tool_use') {
        hasToolUse = true
        yield { toolCall: `🔍 מחפש: ${event.content_block.name}...` }
      }
    }

    const finalMsg = await stream.finalMessage()
    totalInput  += finalMsg.usage?.input_tokens  ?? 0
    totalOutput += finalMsg.usage?.output_tokens ?? 0

    for (const block of finalMsg.content) currentContent.push(block)

    if (!hasToolUse || toolCallCount >= maxToolCalls) break

    messages.push({ role: 'assistant', content: currentContent })

    const toolResults: Anthropic.ToolResultBlockParam[] = []
    for (const block of finalMsg.content) {
      if (block.type === 'tool_use') {
        toolCallCount++
        const result = await executeDbTool(block.name, block.input as Record<string, unknown>)
        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result })
      }
    }

    messages.push({ role: 'user', content: toolResults })
  }

  yield { done: true, inputTokens: totalInput, outputTokens: totalOutput }
}
