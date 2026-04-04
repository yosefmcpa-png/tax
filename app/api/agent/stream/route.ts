import { NextRequest } from 'next/server'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase/server'
import { callGeminiStream } from '@/lib/gemini/client'
import { ACTION_PROMPTS } from '@/lib/gemini/prompts'
import { processDocument } from '@/lib/gemini/chunker'
import { logAgentAction } from '@/lib/agent/logger'
import { agentRatelimit } from '@/lib/agent/ratelimit'
import { ALLOWED_ACTIONS, type AgentRequest, type Source } from '@/types'

// ============================================================
// POST /api/agent/stream — Streaming SSE endpoint
// מחזיר Server-Sent Events: תוכן מגיע בזמן אמת תוך כדי כתיבה
// ============================================================

const enc = new TextEncoder()

function sseEvent(data: object): Uint8Array {
  return enc.encode(`data: ${JSON.stringify(data)}\n\n`)
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
  let userId = ''
  let caseId = ''

  // ── ReadableStream — הלב של SSE ──────────────────────────
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        try { controller.enqueue(sseEvent(data)) } catch { /* client disconnected */ }
      }

      try {
        // ── 1. Auth ────────────────────────────────────────
        const supabase = await createServerSupabaseClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
          send({ error: 'Unauthorized', done: true })
          controller.close()
          return
        }
        userId = user.id

        // ── 2. Rate Limit ──────────────────────────────────
        const { success } = await agentRatelimit.limit(userId)
        if (!success) {
          send({ error: 'יותר מדי בקשות. נסה שוב בעוד דקה.', done: true })
          controller.close()
          return
        }

        // ── 3. Validate Input ──────────────────────────────
        const body: AgentRequest = await req.json()
        const { query, actionType, caseId: reqCaseId, history = [] } = body

        if (!query || typeof query !== 'string' || query.length > 60000) {
          send({ error: 'שאילתה לא תקינה', done: true })
          controller.close()
          return
        }
        if (!ALLOWED_ACTIONS.includes(actionType)) {
          send({ error: 'סוג פעולה לא מורשה', done: true })
          controller.close()
          return
        }

        // ── 4. Authorization ───────────────────────────────
        const adminClient = createAdminSupabaseClient()

        if (reqCaseId) {
          const { data: caseData } = await adminClient
            .from('cases').select('id')
            .eq('id', reqCaseId).eq('user_id', userId).single()
          if (!caseData) {
            send({ error: 'Forbidden', done: true })
            controller.close()
            return
          }
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
          if (!newCase) { send({ error: 'שגיאה ביצירת תיק', done: true }); controller.close(); return }
          caseId = newCase.id
          // שלח את ה-caseId לצד הלקוח מיד
          send({ caseId })
        }

        // ── 5. Chunking למסמכים ארוכים ────────────────────
        let processedQuery = query
        if (actionType === 'analyze' && query.split(/\s+/).length > 5000) {
          send({ status: 'מפצל מסמך גדול לחלקים...' })
          const { processedText, chunkCount } = await processDocument(query)
          processedQuery = processedText
          send({ status: `המסמך עובד ב-${chunkCount} חלקים. מנתח...` })
        }

        // ── 6. Build Prompt ────────────────────────────────
        const promptConfig = ACTION_PROMPTS[actionType]
        const userMessage  = promptConfig.buildUserMessage(processedQuery, query)
        const geminiHistory = history.map(m => ({
          role: m.role,
          parts: [{ text: m.content }],
        }))

        // ── 7. Stream from Gemini ──────────────────────────
        let fullText   = ''
        let sources:    Source[] = []
        let inputTokens  = 0
        let outputTokens = 0

        send({ status: 'מקבל תגובה...' })

        for await (const chunk of callGeminiStream({
          systemInstruction: promptConfig.system,
          userMessage,
          history: actionType === 'followup' ? geminiHistory : [],
          grounded: promptConfig.grounded && !promptConfig.jsonMode,
        })) {
          if (chunk.error) {
            send({ error: chunk.error, done: true })
            controller.close()
            return
          }

          if (chunk.text) {
            fullText += chunk.text
            send({ text: chunk.text })   // כל fragment נשלח מיד
          }

          if (chunk.done) {
            sources      = chunk.sources      ?? []
            inputTokens  = chunk.inputTokens  ?? 0
            outputTokens = chunk.outputTokens ?? 0
          }
        }

        // ── 8. Save to DB (async, after stream) ───────────
        await Promise.all([
          adminClient.from('conversations').insert({
            case_id: caseId, role: 'user',
            content: query.substring(0, 10000), sources: [],
            action_type: actionType, token_count: inputTokens,
          }),
          adminClient.from('conversations').insert({
            case_id: caseId, role: 'model',
            content: fullText, sources,
            action_type: actionType, token_count: outputTokens,
          }),
          adminClient.from('cases')
            .update({ updated_at: new Date().toISOString() }).eq('id', caseId),
        ])

        // ── 9. Audit Log ───────────────────────────────────
        await logAgentAction({
          userId, caseId, actionType,
          inputTokens, outputTokens,
          success: true, ipAddress: ip,
        })

        // ── 10. Final event with metadata ─────────────────
        send({ done: true, sources, caseId, inputTokens, outputTokens })
        controller.close()

      } catch (err: unknown) {
        const error = err as Error
        console.error('[Stream API] Error:', error.message)
        if (userId) {
          await logAgentAction({
            userId, caseId: caseId || undefined,
            actionType: 'unknown', success: false,
            errorMessage: error.message, ipAddress: ip,
          })
        }
        try {
          controller.enqueue(sseEvent({ error: error.message || 'שגיאת שרת', done: true }))
          controller.close()
        } catch { /* already closed */ }
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type':                'text/event-stream',
      'Cache-Control':               'no-cache, no-transform',
      'Connection':                  'keep-alive',
      'X-Accel-Buffering':           'no',   // מונע buffering ב-nginx
      'Access-Control-Allow-Origin': process.env.NEXT_PUBLIC_APP_URL ?? '*',
    },
  })
}
