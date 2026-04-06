'use client'

import { useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import TopBar from '@/components/layout/TopBar'
import Sidebar from '@/components/layout/Sidebar'

const WormholeCanvas = dynamic(() => import('@/components/canvas/WormholeCanvas'), { ssr: false })

type Tab = 'companies' | 'court_cases' | 'legislation' | 'tax_rulings'

const TAB_LABELS: Record<Tab, string> = {
  companies:   '🏢 חברות',
  court_cases: '🏛️ פסיקה',
  legislation: '⚖️ חקיקה',
  tax_rulings: '📋 חוזרי מס',
}

interface Result {
  [key: string]: string | number | null
}

export default function SearchClient() {
  const [tab,     setTab]     = useState<Tab>('companies')
  const [query,   setQuery]   = useState('')
  const [results, setResults] = useState<Result[]>([])
  const [loading, setLoading] = useState(false)
  const [total,   setTotal]   = useState(0)

  const search = useCallback(async (q: string, t: Tab) => {
    if (!q.trim()) { setResults([]); return }
    setLoading(true)
    try {
      const res  = await fetch(`/api/search?q=${encodeURIComponent(q)}&type=${t}&limit=20`)
      const data = await res.json()
      setResults(data.results ?? [])
      setTotal(data.total ?? 0)
    } catch { setResults([]) }
    finally   { setLoading(false) }
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    search(query, tab)
  }

  const switchTab = (t: Tab) => {
    setTab(t)
    setResults([])
    if (query.trim()) search(query, t)
  }

  return (
    <div className="relative h-screen flex flex-col overflow-hidden">
      <WormholeCanvas />
      <TopBar />
      <div className="flex flex-1 overflow-hidden relative z-10">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto">

            {/* Header */}
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-slate-100">חיפוש במאגרי נתונים</h1>
              <p className="text-sm text-slate-500 mt-1">
                חפש ברשם החברות, פסקי דין, חקיקה וחוזרי מס — הכל ממאגר מקומי מסונכרן
              </p>
            </div>

            {/* Search bar */}
            <form onSubmit={handleSubmit} className="mb-5">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder={
                    tab === 'companies'   ? 'שם חברה או מספר ח.פ...' :
                    tab === 'court_cases' ? 'מילת מפתח בפסק דין...' :
                    tab === 'legislation' ? 'שם חוק או נושא...' :
                    'נושא חוזר מס...'
                  }
                  className="flex-1 bg-slate-800/60 border border-slate-600/60 rounded-xl px-4 py-3
                             text-sm text-slate-200 placeholder-slate-500 focus:outline-none
                             focus:border-teal-500/50 transition"
                />
                <button type="submit" disabled={loading}
                  className="px-5 py-3 rounded-xl bg-teal-500/20 border border-teal-500/40
                             text-teal-300 text-sm font-medium hover:bg-teal-500/30 transition
                             disabled:opacity-40 whitespace-nowrap">
                  {loading ? '⏳' : '🔍 חפש'}
                </button>
              </div>
            </form>

            {/* Tabs */}
            <div className="flex gap-1 mb-5 border-b border-slate-700/50">
              {(Object.keys(TAB_LABELS) as Tab[]).map(t => (
                <button key={t} onClick={() => switchTab(t)}
                  className={`px-4 py-2 text-sm font-medium rounded-t-lg transition border-b-2 -mb-px ${
                    tab === t
                      ? 'border-teal-400 text-teal-300'
                      : 'border-transparent text-slate-500 hover:text-slate-300'
                  }`}>
                  {TAB_LABELS[t]}
                </button>
              ))}
            </div>

            {/* Results */}
            {results.length > 0 && (
              <p className="text-xs text-slate-500 mb-3">
                נמצאו {total.toLocaleString()} תוצאות
              </p>
            )}

            <div className="space-y-3">
              {loading && (
                <div className="flex justify-center py-12">
                  <div className="animate-spin h-8 w-8 border-2 border-teal-400 border-t-transparent rounded-full" />
                </div>
              )}

              {!loading && results.length === 0 && query && (
                <div className="text-center py-12 text-slate-600">
                  <div className="text-3xl mb-2">🔍</div>
                  <p className="text-sm">לא נמצאו תוצאות עבור "{query}"</p>
                  <p className="text-xs mt-1 text-slate-700">נסה לסנכרן את המאגר בDashboard → מאגר נתונים</p>
                </div>
              )}

              {!loading && results.map((r, i) => (
                <ResultCard key={i} result={r} type={tab} />
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

function ResultCard({ result, type }: { result: Result; type: Tab }) {
  const title = (
    result.name || result.title || result.ruling_number || result.case_number || '—'
  ) as string

  const sub = (
    type === 'companies'   ? `ח.פ ${result.company_number} • ${result.status}` :
    type === 'court_cases' ? `${result.court} • ${result.decision_date ?? ''}` :
    type === 'legislation' ? `${result.type} • ${result.status}` :
    `${result.category} • ${result.date_issued ?? ''}`
  ) as string

  const body = (
    result.summary || result.address || ''
  ) as string

  const url = result.source_url as string | undefined

  return (
    <div className="rounded-xl border border-slate-700/50 p-4 hover:border-slate-600 transition"
         style={{ background: 'rgba(15,23,42,0.5)' }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-slate-200 truncate">{title}</h3>
          <p className="text-xs text-slate-500 mt-0.5">{sub}</p>
          {body && (
            <p className="text-xs text-slate-400 mt-2 line-clamp-2 leading-relaxed">{body}</p>
          )}
        </div>
        {url && (
          <a href={url} target="_blank" rel="noopener noreferrer"
             className="flex-shrink-0 text-xs px-2 py-1 rounded border border-teal-500/30
                        text-teal-400 hover:bg-teal-500/10 transition">
            פתח ↗
          </a>
        )}
      </div>
    </div>
  )
}
