import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DashboardWrapper from '@/components/dashboard/DashboardWrapper'

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch stats server-side
  const { createAdminSupabaseClient } = await import('@/lib/supabase/server')
  const admin = createAdminSupabaseClient()

  const casesRes = await admin
    .from('cases').select('id, title, status, case_type, created_at, updated_at')
    .eq('user_id', user.id).order('updated_at', { ascending: false }).limit(100)

  const caseIds = (casesRes.data ?? []).map((c: { id: string }) => c.id)

  const [logsRes, convsRes] = await Promise.all([
    admin.from('audit_logs').select('action_type, success, input_tokens, output_tokens, created_at')
      .eq('user_id', user.id).order('created_at', { ascending: false }).limit(500),
    caseIds.length
      ? admin.from('conversations').select('case_id, role, token_count, created_at')
          .in('case_id', caseIds).limit(1000)
      : Promise.resolve({ data: [] }),
  ])

  const cases        = casesRes.data  ?? []
  const logs         = logsRes.data   ?? []
  const convs        = convsRes.data  ?? []

  // Aggregate stats
  const totalTokens = logs.reduce((s: number, l: { input_tokens?: number; output_tokens?: number }) =>
    s + (l.input_tokens ?? 0) + (l.output_tokens ?? 0), 0)

  const actionCounts: Record<string, number> = {}
  logs.forEach((l: { action_type: string }) => {
    actionCounts[l.action_type] = (actionCounts[l.action_type] ?? 0) + 1
  })

  const stats = {
    totalCases:    cases.length,
    openCases:     cases.filter((c: { status: string }) => c.status === 'open').length,
    totalMessages: convs.length,
    totalTokens,
    successRate:   logs.length
      ? Math.round(logs.filter((l: { success: boolean }) => l.success).length / logs.length * 100)
      : 100,
    actionCounts,
    recentCases: cases.slice(0, 8),
    recentLogs:  logs.slice(0, 20),
  }

  return <DashboardWrapper stats={stats} userId={user.id} />
}
