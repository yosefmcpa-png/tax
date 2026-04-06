import { NextRequest } from 'next/server'
import { runStandalonePipeline } from '@/lib/automation/standalone-runner'
import { checkRateLimit, createCase, saveConversation } from '@/lib/db/sqlite'
import { WORKFLOW_TEMPLATES, Workflow } from '@/lib/automation/types'

/**
 * POST /api/automation/demo
 * ========================
 * מצב standalone — ללא Supabase, ללא Redis, ללא Anthropic API
 * עובד מיד עם npm run dev
 */

const enc = new TextEncoder()
const sse = (data: object) => enc.encode(`data: ${JSON.stringify(data)}\n\n`)

export async function POST(req: NextRequest) {
  const stream = new ReadableStream({
    async start(controller) {
      const send = (d: object) => { try { controller.enqueue(sse(d)) } catch { /* closed */ } }

      try {
        // Rate limit — in-memory
        const ip = req.headers.get('x-forwarded-for') ?? 'local'
        if (!checkRateLimit(`demo:${ip}`, 20, 60_000)) {
          send({ error: 'Rate limit — נסה שוב בעוד דקה', done: true })
          controller.close(); return
        }

        const { query, templateIndex = 0 }: { query: string; templateIndex?: number } =
          await req.json()

        if (!query?.trim()) {
          send({ error: 'חסר קלט', done: true }); controller.close(); return
        }

        // Build workflow from template
        const tmpl = WORKFLOW_TEMPLATES[templateIndex] ?? WORKFLOW_TEMPLATES[0]
        const workflow: Workflow = {
          ...tmpl,
          id:        crypto.randomUUID(),
          userId:    'local',
          createdAt: new Date().toISOString(),
        }

        // Save to local SQLite
        const { id: caseId } = createCase(query.substring(0, 80), 'research')

        send({ status: 'starting', workflowName: workflow.name, caseId })

        // Run pipeline — streams live step updates
        const run = await runStandalonePipeline({
          query,
          workflow,
          onUpdate: (updatedRun) => send({ run: updatedRun }),
        })

        // Persist final output to SQLite
        const finalOutput = run.steps
          .filter(s => s.status === 'success' && s.output)
          .map(s => `## ${s.label}\n\n${s.output}`)
          .join('\n\n---\n\n')

        if (finalOutput) {
          saveConversation({
            caseId,
            role:       'model',
            content:    finalOutput,
            actionType: `standalone:${workflow.name}`,
          })
        }

        send({ done: true, run, caseId })
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
