'use client'

import { useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import AutomationPanel from './AutomationPanel'

const PipelineRunner = dynamic(() => import('@/components/pipeline/PipelineRunner'), { ssr: false })
const ScraperStatus  = dynamic(() => import('./ScraperStatus'), { ssr: false })

interface Stats {
  totalCases:    number
  openCases:     number
  totalMessages: number
  totalTokens:   number
  successRate:   number
  actionCounts:  Record<string, number>
  recentCases:   Array<{
    id: string; title: string; status: string
    case_type: string; updated_at: string
  }>
  recentLogs: Array<{
    action_type: string; success: boolean
    input_tokens?: number; output_tokens?: number; created_at: string
  }>
}

const ACTION_LABELS: Record<string, string> = {
  research: 'מחקר', analyze: 'ניתוח מסמך', summarize: 'סיכום',
  explain: 'הסבר', email: 'מייל', risk: 'סיכונים',
  appeal: 'ערעור', planning: 'תכנון מס', compare: 'פסיקה',
  checklist: 'צ׳קליסט', predict: 'חיזוי', extract: 'חילוץ',
  simulation: 'סימולציה', followup: 'המשך שיחה',
}

const STATUS_BADGE: Record<string, string> = {
  open:    'bg-teal-500/20 text-teal-300 border-teal-500/30',
  closed:  'bg-slate-700/40 text-slate-400 border-slate-600',
  pending: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
}
const STATUS_LABEL: Record<string, string> = {
  open: 'פתוח', closed: 'סגור', pending: 'ממתין',
}
const TYPE_ICON: Record<string, string> = {
  research: '🔍', document: '📄', simulation: '⚔️',
}

export default function DashboardClient({ stats, userId }: { stats: Stats; userId: string }) {
  const [activeTab, setActiveTab] = useState<'overview' | 'pipeline' | 'automation' | 'db' | 'logs'>('overview')

  const topActions = Object.entries(stats.actionCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6)

  const maxAction = topActions[0]?.[1] ?? 1

  return (
    <div className="p-6 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">לוח בקרה</h1>
          <p className="text-sm text-slate-500 mt-0.5">סקירה כללית + אוטומציות</p>
        </div>
        <Link href="/"
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-teal-500/30
                     text-teal-400 hover:bg-teal-500/10 transition text-sm font-semibold">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
          </svg>
          פתח צ׳אט
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <KpiCard label="תיקים" value={stats.totalCases} icon="📁" color="teal" />
        <KpiCard label="פתוחים" value={stats.openCases} icon="🟢" color="green" />
        <KpiCard label="הודעות" value={stats.totalMessages} icon="💬" color="blue" />
        <KpiCard label="אלפי טוקנים" value={Math.round(stats.totalTokens / 1000)} icon="⚡" color="amber" />
        <KpiCard label="הצלחה %" value={`${stats.successRate}%`} icon="✅" color="emerald" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b border-slate-700/50 overflow-x-auto">
        {(['overview', 'pipeline', 'automation', 'db', 'logs'] as const).map(tab => (
          <button key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-semibold rounded-t-lg transition border-b-2 -mb-px whitespace-nowrap ${
              activeTab === tab
                ? 'border-teal-400 text-teal-300'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            {{ overview: 'סקירה', pipeline: '🤖 Pipeline', automation: '⚙️ תהליכים', db: '🗄️ מאגר נתונים', logs: 'לוג' }[tab]}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Recent Cases */}
          <div className="rounded-xl border border-slate-700/50 overflow-hidden"
               style={{ background: 'rgba(15,23,42,0.6)' }}>
            <div className="px-5 py-3 border-b border-slate-700/50">
              <h2 className="text-sm font-semibold text-slate-300">תיקים אחרונים</h2>
            </div>
            <div className="divide-y divide-slate-700/30">
              {stats.recentCases.length === 0 && (
                <p className="px-5 py-8 text-center text-xs text-slate-600">אין תיקים עדיין</p>
              )}
              {stats.recentCases.map(c => (
                <div key={c.id} className="px-5 py-3 flex items-center gap-3 hover:bg-slate-700/20 transition">
                  <span className="text-lg flex-shrink-0">{TYPE_ICON[c.case_type] ?? '📋'}</span>
                  <div className="flex-grow min-w-0">
                    <p className="text-sm text-slate-200 truncate font-medium">{c.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {new Date(c.updated_at).toLocaleDateString('he-IL')}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full border flex-shrink-0 ${STATUS_BADGE[c.status] ?? STATUS_BADGE.open}`}>
                    {STATUS_LABEL[c.status] ?? c.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Action breakdown */}
          <div className="rounded-xl border border-slate-700/50 overflow-hidden"
               style={{ background: 'rgba(15,23,42,0.6)' }}>
            <div className="px-5 py-3 border-b border-slate-700/50">
              <h2 className="text-sm font-semibold text-slate-300">פעולות נפוצות</h2>
            </div>
            <div className="px-5 py-4 space-y-3">
              {topActions.length === 0 && (
                <p className="text-center text-xs text-slate-600 py-6">אין נתונים עדיין</p>
              )}
              {topActions.map(([action, count]) => (
                <div key={action}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300">{ACTION_LABELS[action] ?? action}</span>
                    <span className="text-slate-500">{count}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-700/50">
                    <div
                      className="h-full rounded-full bg-gradient-to-l from-teal-400 to-teal-600 transition-all"
                      style={{ width: `${(count / maxAction) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Pipeline Tab — 4 AI agents */}
      {activeTab === 'pipeline' && <PipelineRunner />}

      {/* DB / Scraper Status */}
      {activeTab === 'db' && <ScraperStatus />}

      {/* Automation Tab */}
      {activeTab === 'automation' && (
        <AutomationPanel userId={userId} />
      )}

      {/* Logs Tab */}
      {activeTab === 'logs' && (
        <div className="rounded-xl border border-slate-700/50 overflow-hidden"
             style={{ background: 'rgba(15,23,42,0.6)' }}>
          <div className="px-5 py-3 border-b border-slate-700/50">
            <h2 className="text-sm font-semibold text-slate-300">לוג פעולות אחרונות</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-700/50 text-slate-500">
                  <th className="px-4 py-2 text-right font-medium">פעולה</th>
                  <th className="px-4 py-2 text-right font-medium">סטטוס</th>
                  <th className="px-4 py-2 text-right font-medium">טוקנים</th>
                  <th className="px-4 py-2 text-right font-medium">זמן</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/20">
                {stats.recentLogs.map((log, i) => (
                  <tr key={i} className="hover:bg-slate-700/20 transition">
                    <td className="px-4 py-2 text-slate-300">
                      {ACTION_LABELS[log.action_type] ?? log.action_type}
                    </td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 rounded-full border text-xs ${
                        log.success
                          ? 'bg-teal-500/10 text-teal-400 border-teal-500/20'
                          : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                      }`}>
                        {log.success ? '✓' : '✗'}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-slate-500">
                      {((log.input_tokens ?? 0) + (log.output_tokens ?? 0)).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-slate-500">
                      {new Date(log.created_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
                {stats.recentLogs.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-600">אין נתונים</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function KpiCard({
  label, value, icon, color,
}: { label: string; value: number | string; icon: string; color: string }) {
  const border: Record<string, string> = {
    teal: 'border-teal-500/20', green: 'border-green-500/20',
    blue: 'border-blue-500/20', amber: 'border-amber-500/20', emerald: 'border-emerald-500/20',
  }
  const text: Record<string, string> = {
    teal: 'text-teal-300', green: 'text-green-300',
    blue: 'text-blue-300', amber: 'text-amber-300', emerald: 'text-emerald-300',
  }
  return (
    <div className={`rounded-xl border p-4 ${border[color]}`}
         style={{ background: 'rgba(15,23,42,0.6)' }}>
      <div className="text-xl mb-1">{icon}</div>
      <div className={`text-2xl font-bold ${text[color]}`}>{value.toLocaleString()}</div>
      <div className="text-xs text-slate-500 mt-0.5">{label}</div>
    </div>
  )
}
