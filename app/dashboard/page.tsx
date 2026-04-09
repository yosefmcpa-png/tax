import DashboardWrapper from '@/components/dashboard/DashboardWrapper'
import { getDb } from '@/lib/db/sqlite'

async function getLocalStats() {
  try {
    const db = getDb()
    const cases = db.prepare(`SELECT id, title, status, case_type, created_at, created_at as updated_at FROM cases ORDER BY created_at DESC LIMIT 100`).all() as Array<{
      id: string; title: string; status: string; case_type: string; created_at: string; updated_at: string
    }>
    const convs = db.prepare(`SELECT id, case_id, role, created_at FROM conversations LIMIT 1000`).all() as Array<{
      id: string; case_id: string; role: string; created_at: string
    }>
    const logs = db.prepare(`SELECT action_type, success, input_tokens, output_tokens, created_at FROM agent_logs ORDER BY created_at DESC LIMIT 200`).all() as Array<{
      action_type: string; success: number; input_tokens: number; output_tokens: number; created_at: string
    }>

    const totalTokens = logs.reduce((s, l) => s + (l.input_tokens ?? 0) + (l.output_tokens ?? 0), 0)
    const actionCounts: Record<string, number> = {}
    logs.forEach(l => { actionCounts[l.action_type] = (actionCounts[l.action_type] ?? 0) + 1 })

    return {
      totalCases:    cases.length,
      openCases:     cases.filter(c => c.status === 'open').length,
      totalMessages: convs.length,
      totalTokens,
      successRate:   logs.length ? Math.round(logs.filter(l => l.success).length / logs.length * 100) : 100,
      actionCounts,
      recentCases:   cases.slice(0, 8),
      recentLogs:    logs.slice(0, 20).map(l => ({ ...l, success: !!l.success })),
    }
  } catch {
    return { totalCases: 0, openCases: 0, totalMessages: 0, totalTokens: 0, successRate: 100, actionCounts: {}, recentCases: [], recentLogs: [] }
  }
}

export default async function DashboardPage() {
  const stats = await getLocalStats()
  return <DashboardWrapper stats={stats} userId="local" />
}
