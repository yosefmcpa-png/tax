import { NextRequest } from 'next/server'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase/server'
import { runPipeline } from '@/lib/claude/pipeline'
import { agentRatelimit } from '@/lib/agent/ratelimit'
import { logAgentAction } from '@/lib/agent/logger'

// ============================================================
// POST /api/agent/pipeline — 4-Agent Pipeline SSE
// Research → Analysis → Risk → Report
// ============================================================

const enc = new TextEncoder()
const sse = (d: object) => enc.encode(`data: ${JSON.stringify(d)}\n\n`)

export async function POST(req: NextRequest) {
  const stream = new ReadableStream({
    async start(ctrl) {
      const send = (d: object) => { try { ctrl.enqueue(sse(d)) } catch {} }

      try {
        // Auth
        const supabase = await createServerSupabaseClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { send({ error: 'Unauthorized', done: true }); ctrl.close(); return }

        // Rate limit
        const { success } = await agentRatelimit.limit(`pipeline:${user.id}`)
        if (!success) { send({ error: 'יותר מדי בקשות', done: true }); ctrl.close(); return }

        // Input
        const { input, caseId: reqCaseId } = await req.json()
        if (!input?.trim()) { send({ error: 'קלט חסר', done: true }); ctrl.close(); return }

        // Case
        const admin = createAdminSupabaseClient()
        let caseId = reqCaseId

        if (!caseId) {
          const { data: newCase } = await admin
            .from('cases')
            .insert({
              user_id:   user.id,
              title:     input.substring(0, 80).trim(),
              status:    'open',
              case_type: 'research',
            })
            .select('id').single()
          caseId = newCase?.id
        } else {
          const { data: c } = await admin.from('cases').select('id')
            .eq('id', caseId).eq('user_id', user.id).single()
          if (!c) { send({ error: 'Forbidden', done: true }); ctrl.close(); return }
        }

        send({ caseId, status: 'starting' })

        // Run pipeline — stream each stage update
        const run = await runPipeline(input, (updatedRun) => {
          send({ run: updatedRun })
        })

        // Save report to DB
        if (run.report) {
          await admin.from('conversations').insert({
            case_id:     caseId,
            role:        'model',
            content:     run.report,
            sources:     run.sources,
            action_type: 'pipeline',
            token_count: null,
          })
          await admin.from('cases')
            .update({ updated_at: new Date().toISOString() }).eq('id', caseId)
        }

        await logAgentAction({
          userId:     user.id,
          caseId,
          actionType: 'pipeline',
          success:    run.status === 'done',
        })

        send({ done: true, run, caseId })
        ctrl.close()

      } catch (err) {
        send({ error: (err as Error).message, done: true })
        ctrl.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type':      'text/event-stream',
      'Cache-Control':     'no-cache, no-transform',
      'Connection':        'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
