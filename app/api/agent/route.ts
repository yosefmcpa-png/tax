import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase/server'
import { runClaudeAgent } from '@/lib/claude/agent'
import { ACTION_PROMPTS } from '@/lib/claude/prompts'
import { processDocument } from '@/lib/claude/chunker'
import { logAgentAction } from '@/lib/agent/logger'
import { agentRatelimit } from '@/lib/agent/ratelimit'
import { ALLOWED_ACTIONS, type AgentRequest, type AgentResponse } from '@/types'

// ============================================================
// POST /api/agent — נקודת הכניסה המרכזית לסוכן ה-AI
// Claude opus-4-6 עם tool use לחיפוש DB מקומי
// ============================================================

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
  let userId = ''
  let caseId = ''

  try {
    // ── 1. Authentication ────────────────────────────────────
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    userId = user.id

    // ── 2. Rate Limiting ─────────────────────────────────────
    const { success: rateLimitOk } = await agentRatelimit.limit(userId)
    if (!rateLimitOk) {
      return NextResponse.json(
        { error: 'יותר מדי בקשות. נסה שוב בעוד דקה.' },
        { status: 429 }
      )
    }

    // ── 3. Input Validation ──────────────────────────────────
    const body: AgentRequest = await req.json()
    const { query, actionType, caseId: reqCaseId, history = [] } = body

    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'שאילתה חסרה או לא תקינה' }, { status: 400 })
    }
    if (query.length > 60000) {
      return NextResponse.json({ error: 'הטקסט ארוך מדי (מקסימום 60,000 תווים)' }, { status: 400 })
    }
    if (!ALLOWED_ACTIONS.includes(actionType)) {
      return NextResponse.json({ error: 'סוג פעולה לא מורשה' }, { status: 400 })
    }

    // ── 4. Authorization ─────────────────────────────────────
    const adminClient = createAdminSupabaseClient()

    if (reqCaseId) {
      const { data: caseData } = await adminClient
        .from('cases').select('id')
        .eq('id', reqCaseId).eq('user_id', userId).single()
      if (!caseData) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      caseId = reqCaseId
    } else {
      const { data: newCase } = await adminClient
        .from('cases')
        .insert({
          user_id:   userId,
          title:     query.substring(0, 80).trim() || 'תיק חדש',
          status:    'open',
          case_type: actionType === 'analyze' ? 'document' : actionType === 'simulation' ? 'simulation' : 'research',
        })
        .select('id').single()
      if (!newCase) throw new Error('שגיאה ביצירת תיק חדש')
      caseId = newCase.id
    }

    // ── 5. Smart Chunking למסמכים ארוכים ────────────────────
    let processedQuery = query
    let chunkCount = 1

    if (actionType === 'analyze' && query.split(/\s+/).length > 5000) {
      const result = await processDocument(query)
      processedQuery = result.processedText
      chunkCount = result.chunkCount
    }

    // ── 6. Build Prompt ──────────────────────────────────────
    const promptConfig = ACTION_PROMPTS[actionType]
    const userMessage  = promptConfig.buildUserMessage(processedQuery, query)

    // המרת היסטוריה לפורמט Claude
    const claudeHistory = history.map(msg => ({
      role:    msg.role === 'model' ? 'assistant' as const : 'user' as const,
      content: msg.content,
    }))

    // ── 7. Call Claude Agent (עם tool use לDB) ───────────────
    const { text, sources, inputTokens, outputTokens } = await runClaudeAgent({
      systemInstruction: promptConfig.system,
      userMessage,
      history:     actionType === 'followup' ? claudeHistory : [],
      useThinking: promptConfig.useThinking,
    })

    // ── 8. Save to DB ────────────────────────────────────────
    await Promise.all([
      adminClient.from('conversations').insert({
        case_id:     caseId,
        role:        'user',
        content:     query.substring(0, 10000),
        sources:     [],
        action_type: actionType,
        token_count: inputTokens,
      }),
      adminClient.from('conversations').insert({
        case_id:     caseId,
        role:        'model',
        content:     text,
        sources,
        action_type: actionType,
        token_count: outputTokens,
      }),
      adminClient.from('cases').update({ updated_at: new Date().toISOString() }).eq('id', caseId),
    ])

    // ── 9. Audit Log ─────────────────────────────────────────
    await logAgentAction({ userId, caseId, actionType, inputTokens, outputTokens, success: true, ipAddress: ip })

    const response: AgentResponse = {
      text: chunkCount > 1 ? `> 📄 *המסמך עובד ב-${chunkCount} חלקים.*\n\n${text}` : text,
      sources,
      caseId,
      conversationId: '',
      tokenCount: inputTokens + outputTokens,
    }

    return NextResponse.json(response)

  } catch (err: unknown) {
    const error = err as Error
    console.error('[Agent API] Error:', error.message)
    if (userId) await logAgentAction({ userId, caseId: caseId || undefined, actionType: 'unknown', success: false, errorMessage: error.message, ipAddress: ip })
    return NextResponse.json({ error: error.message || 'שגיאת שרת פנימית' }, { status: 500 })
  }
}
