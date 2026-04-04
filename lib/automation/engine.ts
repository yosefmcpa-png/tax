import { callClaude } from '@/lib/claude/client'
import { ACTION_PROMPTS } from '@/lib/claude/prompts'
import { logAgentAction } from '@/lib/agent/logger'
import {
  Workflow, WorkflowRun, WorkflowStepResult,
  AiActionConfig, NotifyConfig,
} from './types'

// ============================================================
// Automation Engine — מריץ Workflow צעד אחר צעד
// Claude opus-4-6 עם adaptive thinking
// ============================================================

export type StepUpdateCallback = (run: WorkflowRun) => void

export async function executeWorkflow(
  workflow:   Workflow,
  inputText:  string,
  userId:     string,
  caseId:     string,
  onUpdate?:  StepUpdateCallback
): Promise<WorkflowRun> {

  const run: WorkflowRun = {
    id:         crypto.randomUUID(),
    workflowId: workflow.id,
    userId,
    status:     'running',
    startedAt:  new Date().toISOString(),
    steps:      workflow.steps.map(s => ({
      stepId:  s.id,
      label:   s.label,
      status:  'pending',
    })),
  }

  onUpdate?.(run)

  let context = inputText
  let currentStepId = workflow.steps[0]?.id

  while (currentStepId) {
    const step = workflow.steps.find(s => s.id === currentStepId)
    if (!step) break

    updateStep(run, step.id, { status: 'running', startedAt: new Date().toISOString() })
    onUpdate?.(run)

    try {
      let output = ''

      switch (step.type) {

        case 'ai_action': {
          const cfg = step.config as AiActionConfig
          const promptCfg    = ACTION_PROMPTS[cfg.actionType]
          const queryContext = cfg.useContext ? context : inputText

          const { text, inputTokens, outputTokens } = await callClaude({
            systemInstruction: promptCfg.system,
            userMessage:       promptCfg.buildUserMessage(queryContext),
            useWebSearch:      false,
            useThinking:       promptCfg.useThinking,
          })

          await logAgentAction({
            userId, caseId,
            actionType:   `workflow:${cfg.actionType}`,
            inputTokens, outputTokens,
            success: true,
          })

          output = text
          break
        }

        case 'condition': {
          output = context
          break
        }

        case 'notify': {
          const cfg = step.config as NotifyConfig
          output = `📢 התראה: ${cfg.message}`
          break
        }

        case 'export': {
          output = context
          break
        }
      }

      context = output
      updateStep(run, step.id, { status: 'success', output, endedAt: new Date().toISOString() })
      onUpdate?.(run)

      currentStepId = step.onSuccess ?? null

    } catch (err: unknown) {
      const error = err as Error
      updateStep(run, step.id, { status: 'error', error: error.message, endedAt: new Date().toISOString() })

      await logAgentAction({
        userId, caseId,
        actionType:   'workflow:error',
        success:      false,
        errorMessage: error.message,
      })

      onUpdate?.(run)
      currentStepId = step.onError ?? null
      if (!step.onError) break
    }
  }

  run.steps
    .filter(s => s.status === 'pending')
    .forEach(s => { s.status = 'skipped' })

  const hasError = run.steps.some(s => s.status === 'error')
  run.status  = hasError ? 'error' : 'success'
  run.endedAt = new Date().toISOString()

  onUpdate?.(run)
  return run
}

function updateStep(run: WorkflowRun, stepId: string, updates: Partial<WorkflowStepResult>) {
  const idx = run.steps.findIndex(s => s.stepId === stepId)
  if (idx !== -1) run.steps[idx] = { ...run.steps[idx], ...updates }
}
