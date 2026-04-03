import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase/server'
import { callGemini } from '@/lib/gemini/client'
import { ACTION_PROMPTS } from '@/lib/gemini/prompts'
import { processDocument } from '@/lib/gemini/chunker'
import { logAgentAction } from '@/lib/agent/logger'
import { agentRatelimit } from '@/lib/agent/ratelimit'
import { ALLOWED_ACTIONS, type AgentRequest, type AgentResponse } from '@/types'

// ============================================================
// POST /api/agent — נקודת הכניסה המרכזית לסוכן ה-AI
// כל הקריאות ל-Gemini עוברות דרך כאן — API Key מוגן
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

    // ── 4. Authorization — בדיקת בעלות על התיק ──────────────
    const adminClient = createAdminSupabaseClient()

    if (reqCaseId) {
      const { data: caseData, error: caseError } = await adminClient
        .from('cases')
        .select('id')
        .eq('id', reqCaseId)
        .eq('user_id', userId)
        .single()

      if (caseError || !caseData) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      caseId = reqCaseId
    } else {
      // יצירת תיק חדש אוטומטית
      const title = query.substring(0, 80).trim() || 'תיק חדש'
      const { data: newCase, error: createError } = await adminClient
        .from('cases')
        .insert({
          user_id:   userId,
          title,
          status:    'open',
          case_type: actionType === 'analyze' ? 'document' : actionType === 'simulation' ? 'simulation' : 'research',
        })
        .select('id')
        .single()

      if (createError || !newCase) {
        throw new Error('שגיאה ביצירת תיק חדש')
      }
      caseId = newCase.id
    }

    // ── 5. Smart Chunking למסמכים ארוכים ────────────────────
    let processedQuery = query
    let chunkCount = 1

    if (actionType === 'analyze' && query.split(/\s+/).length > 5000) {
      const { processedText, chunkCount: chunks } = await processDocument(query)
      processedQuery = processedText
      chunkCount = chunks
      console.log(`[Agent] Document processed: ${chunks} chunks`)
    }

    // ── 6. Build Prompt ──────────────────────────────────────
    const promptConfig = ACTION_PROMPTS[actionType]
    const userMessage = promptConfig.buildUserMessage(processedQuery, query)

    // המרת היסטוריה לפורמט Gemini
    const geminiHistory = history.map(msg => ({
      role: msg.role,
      parts: [{ text: msg.content }],
    }))

    // ── 7. Call Gemini API ───────────────────────────────────
    const { text, sources, inputTokens, outputTokens } = await callGemini({
      systemInstruction: promptConfig.system,
      userMessage,
      history: actionType === 'followup' ? geminiHistory : [],
      grounded: promptConfig.grounded,
      jsonMode: promptConfig.jsonMode,
    })

    // ── 8. Save to DB ────────────────────────────────────────
    await Promise.all([
      // שמור הודעת משתמש
      adminClient.from('conversations').insert({
        case_id:     caseId,
        role:        'user',
        content:     query.substring(0, 10000), // לא שומרים PDFs מלאים
        sources:     [],
        action_type: actionType,
        token_count: inputTokens,
      }),
      // שמור תגובת הסוכן
      adminClient.from('conversations').insert({
        case_id:     caseId,
        role:        'model',
        content:     text,
        sources,
        action_type: actionType,
        token_count: outputTokens,
      }),
      // עדכן updated_at בתיק
      adminClient.from('cases').update({ updated_at: new Date().toISOString() }).eq('id', caseId),
    ])

    // ── 9. Audit Log ─────────────────────────────────────────
    await logAgentAction({
      userId,
      caseId,
      actionType,
      inputTokens,
      outputTokens,
      success: true,
      ipAddress: ip,
    })

    const response: AgentResponse = {
      text,
      sources,
      caseId,
      conversationId: '',   // מוחזר לצד הלקוח לאחר שמירה
      tokenCount: inputTokens + outputTokens,
    }

    // הוסף מידע על chunking אם רלוונטי
    if (chunkCount > 1) {
      response.text = `> 📄 *המסמך עובד ב-${chunkCount} חלקים בשל גודלו.*\n\n${text}`
    }

    return NextResponse.json(response)

  } catch (err: unknown) {
    const error = err as Error
    console.error('[Agent API] Error:', error.message)

    // Audit log לשגיאה
    if (userId) {
      await logAgentAction({
        userId,
        caseId: caseId || undefined,
        actionType: 'unknown',
        success: false,
        errorMessage: error.message,
        ipAddress: ip,
      })
    }

    return NextResponse.json(
      { error: error.message || 'שגיאת שרת פנימית' },
      { status: 500 }
    )
  }
}
