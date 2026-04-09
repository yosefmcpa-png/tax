'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface HistoryItem {
  id: string
  title: string
  created_at: string
  messages: number
}

export default function HistoryPage() {
  const [items, setItems]   = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/history')
      .then(r => r.json())
      .then(d => { setItems(d.cases ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6" dir="rtl">
      <div className="max-w-3xl mx-auto">

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-white">היסטוריית חיפושים</h1>
            <p className="text-slate-500 text-sm mt-0.5">שמור מקומית ב-SQLite</p>
          </div>
          <Link href="/demo"
            className="text-sm px-4 py-2 rounded-lg border border-teal-500/30 text-teal-400
                       hover:bg-teal-500/10 transition">
            + חיפוש חדש
          </Link>
        </div>

        {loading && (
          <div className="text-center text-slate-600 py-20">טוען...</div>
        )}

        {!loading && items.length === 0 && (
          <div className="text-center py-20 text-slate-600">
            <div className="text-4xl mb-3">📂</div>
            <p>אין היסטוריה עדיין</p>
            <Link href="/demo" className="text-teal-500 text-sm mt-2 block hover:text-teal-400">
              התחל חיפוש ראשון →
            </Link>
          </div>
        )}

        <div className="space-y-2">
          {items.map(item => (
            <div key={item.id}
              className="rounded-xl border border-slate-700/50 bg-slate-900/50 p-4
                         hover:bg-slate-800/50 transition">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-200 truncate">{item.title}</p>
                  <p className="text-xs text-slate-600 mt-0.5">
                    {new Date(item.created_at).toLocaleString('he-IL')} · {item.messages} הודעות
                  </p>
                </div>
                <span className="text-xs text-slate-700 font-mono flex-shrink-0">
                  {item.id.slice(0, 8)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
