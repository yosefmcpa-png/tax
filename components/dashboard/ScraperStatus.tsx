'use client'

import { useEffect, useState } from 'react'

interface HealthData {
  ready:  boolean
  checks: Record<string, { ok: boolean; msg: string }>
  db:     Record<string, number>
}

interface ScraperLog {
  scraper:     string
  status:      string
  records:     number
  error_count: number
  created_at:  string
}

const SCRAPER_LABELS: Record<string, string> = {
  companies:   '🏢 רשם החברות',
  legislation: '⚖️  חקיקה',
  court_cases: '🏛️  פסיקה',
  tax_rulings: '📋 חוזרי מס',
}

const DB_LABELS: Record<string, string> = {
  companies:   'חברות',
  legislation: 'חוקים',
  court_cases: 'פסקי דין',
  tax_rulings: 'חוזרי מס',
}

export default function ScraperStatus() {
  const [health,  setHealth]  = useState<HealthData | null>(null)
  const [logs,    setLogs]    = useState<ScraperLog[]>([])
  const [syncing, setSyncing] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchHealth = async () => {
    try {
      const res  = await fetch('/api/health')
      const data = await res.json()
      setHealth(data)
    } catch { /* ignore */ }
    setLoading(false)
  }

  const fetchLogs = async () => {
    try {
      const res  = await fetch('/api/scraper/logs')
      if (res.ok) setLogs(await res.json())
    } catch { /* ignore */ }
  }

  useEffect(() => {
    fetchHealth()
    fetchLogs()
    const interval = setInterval(fetchHealth, 30_000)
    return () => clearInterval(interval)
  }, [])

  const triggerSync = async (scraper: string) => {
    setSyncing(scraper)
    try {
      const res = await fetch(`/api/cron/sync?scraper=${scraper}`)
      await res.json()
      await Promise.all([fetchHealth(), fetchLogs()])
    } finally {
      setSyncing(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-500 text-sm">
        <span className="animate-pulse">בודק חיבורים...</span>
      </div>
    )
  }

  return (
    <div className="space-y-5">

      {/* Services status */}
      <div className="rounded-xl border border-slate-700/50 overflow-hidden"
           style={{ background: 'rgba(15,23,42,0.6)' }}>
        <div className="px-5 py-3 border-b border-slate-700/50 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-300">מצב שירותים</h3>
          <span className={`text-xs px-2 py-0.5 rounded-full border ${
            health?.ready
              ? 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10'
              : 'border-rose-500/40 text-rose-400 bg-rose-500/10'
          }`}>
            {health?.ready ? '✓ מוכן לעבודה' : '⚠ הגדרה נדרשת'}
          </span>
        </div>
        <div className="divide-y divide-slate-700/20">
          {Object.entries(health?.checks ?? {}).map(([key, val]) => (
            <div key={key} className="px-5 py-3 flex items-center justify-between">
              <span className="text-sm text-slate-300">
                {{ claude: '🤖 Claude API', supabase: '🗄️ Supabase', redis: '⚡ Redis', whatsapp: '💬 WhatsApp' }[key] ?? key}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">{val.msg}</span>
                <span className={`h-2 w-2 rounded-full ${val.ok ? 'bg-emerald-400' : 'bg-rose-400'}`} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* DB Counts */}
      {Object.keys(health?.db ?? {}).length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(health?.db ?? {}).map(([key, count]) => (
            <div key={key} className="rounded-xl border border-slate-700/50 p-4 text-center"
                 style={{ background: 'rgba(15,23,42,0.6)' }}>
              <div className="text-2xl font-bold text-teal-300">
                {count.toLocaleString()}
              </div>
              <div className="text-xs text-slate-500 mt-1">{DB_LABELS[key] ?? key}</div>
            </div>
          ))}
        </div>
      )}

      {/* Scrapers + manual trigger */}
      <div className="rounded-xl border border-slate-700/50 overflow-hidden"
           style={{ background: 'rgba(15,23,42,0.6)' }}>
        <div className="px-5 py-3 border-b border-slate-700/50 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-300">סוכני Scraping</h3>
          <button
            onClick={() => triggerSync('all')}
            disabled={!!syncing}
            className="text-xs px-3 py-1.5 rounded-lg border border-teal-500/30 text-teal-400
                       hover:bg-teal-500/10 transition disabled:opacity-40">
            {syncing === 'all' ? '⏳ מסנכרן...' : '🔄 סנכרן הכל'}
          </button>
        </div>
        <div className="divide-y divide-slate-700/20">
          {Object.entries(SCRAPER_LABELS).map(([key, label]) => {
            const lastLog = logs.find(l => l.scraper === key)
            return (
              <div key={key} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <div className="text-sm text-slate-300">{label}</div>
                  {lastLog && (
                    <div className="text-xs text-slate-500 mt-0.5">
                      {lastLog.records.toLocaleString()} רשומות •{' '}
                      {new Date(lastLog.created_at).toLocaleString('he-IL')}
                    </div>
                  )}
                  {!lastLog && <div className="text-xs text-slate-600">טרם הורץ</div>}
                </div>
                <div className="flex items-center gap-3">
                  {lastLog && (
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${
                      lastLog.status === 'success'
                        ? 'border-emerald-500/30 text-emerald-400'
                        : lastLog.status === 'partial'
                        ? 'border-amber-500/30 text-amber-400'
                        : 'border-rose-500/30 text-rose-400'
                    }`}>
                      {lastLog.status}
                    </span>
                  )}
                  <button
                    onClick={() => triggerSync(key)}
                    disabled={!!syncing}
                    className="text-xs px-2 py-1 rounded border border-slate-600 text-slate-400
                               hover:border-teal-500/30 hover:text-teal-400 transition disabled:opacity-40">
                    {syncing === key ? '⏳' : '▶'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

    </div>
  )
}
