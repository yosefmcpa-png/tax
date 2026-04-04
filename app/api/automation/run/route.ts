import { NextRequest } from 'next/server'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase/server'
import { executeWorkflow } from '@/lib/automation/engine'
import { agentRatelimit } from '@/lib/agent/ratelimit'
import { Workflow } from '@/lib/automation/types'

// ============================================================
// POST /api/automation/run — מריץ Workflow ומחזיר SSE
// ============================================================

const enc = new TextEncoder()
const sse = (data: object) => enc.encode(`data: ${JSON.stringify(data)}\n\n`)

export async function POST(req: NextRequest) {
  const stream = new ReadableStream({
    async start(controller) {
      const send = (d: object) => { try { controller.enqueue(sse(d)) } catch { /* closed */ } }

      try {
        // ── Auth ──────────────────────────────────────────
        const supabase = await createServerSupabaseClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { send({ error: 'Unauthorized', done: true }); controller.close(); return }

        // ── Rate limit ────────────────────────────────────
        const { success } = await agentRatelimit.limit(`workflow:${user.id}`)
        if (!success) { send({ error: 'Rate limit exceeded', done: true }); controller.close(); return }

        // ── Input ─────────────────────────────────────────
        const { workflow, inputText, caseId }: {
          workflow:  Workflow
          inputText: string
          caseId:    string
        } = await req.json()

        if (!workflow?.steps?.length || !inputText) {
          send({ error: 'נתונים חסרים', done: true }); controller.close(); return
        }

        // ── Authorization: verify caseId ownership ────────
        const admin = createAdminSupabaseClient()
        const { data: caseData } = await admin.from('cases').select('id')
          .eq('id', caseId).eq('user_id', user.id).single()
        if (!caseData) { send({ error: 'Forbidden', done: true }); controller.close(); return }

        // ── Run ───────────────────────────────────────────
        send({ status: 'starting', workflowName: workflow.name })

        const run = await executeWorkflow(
          workflow, inputText, user.id, caseId,
          (updatedRun) => send({ run: updatedRun })    // live step updates
        )

        // ── Save run summary to DB ────────────────────────
        // שמור את התוצאה הסופית כשיחה בתיק
        const finalOutput = run.steps
          .filter(s => s.status === 'success' && s.output)
          .map(s => `## ${s.label}\n\n${s.output}`)
          .join('\n\n---\n\n')

        if (finalOutput) {
          await admin.from('conversations').insert({
            case_id:     caseId,
            role:        'model',
            content:     finalOutput,
            sources:     [],
            action_type: `workflow:${workflow.name}`,
            token_count: null,
          })
          await admin.from('cases')
            .update({ updated_at: new Date().toISOString() }).eq('id', caseId)
        }

        send({ done: true, run })
        controller.close()

      } catch (err: unknown) {
        const error = err as Error
        send({ error: error.message, done: true })
        controller.close()
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
