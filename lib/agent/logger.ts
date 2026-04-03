import { createAdminSupabaseClient } from '@/lib/supabase/server'

// ============================================================
// Audit Logger — כל פעולת AI נרשמת
// ============================================================

interface LogEntry {
  userId: string
  caseId?: string
  actionType: string
  inputTokens?: number
  outputTokens?: number
  success: boolean
  errorMessage?: string
  ipAddress?: string
}

export async function logAgentAction(entry: LogEntry): Promise<void> {
  try {
    const adminClient = createAdminSupabaseClient()
    await adminClient.from('audit_logs').insert({
      user_id:       entry.userId,
      case_id:       entry.caseId ?? null,
      action_type:   entry.actionType,
      input_tokens:  entry.inputTokens ?? null,
      output_tokens: entry.outputTokens ?? null,
      success:       entry.success,
      error_message: entry.errorMessage ?? null,
      ip_address:    entry.ipAddress ?? null,
    })
  } catch (err) {
    // לוגר לא צריך לשבור את הזרימה הראשית
    console.error('[AuditLogger] Failed to log:', err)
  }
}
