'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import TopBar from '@/components/layout/TopBar'
import Sidebar from '@/components/layout/Sidebar'
import { getLocalSession } from '@/lib/auth/local-session'

const WormholeCanvas = dynamic(() => import('@/components/canvas/WormholeCanvas'), { ssr: false })
const ChatInterface  = dynamic(() => import('@/components/chat/ChatInterface'),    { ssr: false })

const TOOLS = [
  { href: '/demo',       icon: '⚡', title: 'Pipeline AI',      desc: '4 סוכנים: מחקר → ניתוח → סיכונים → דוח',    color: 'teal'   },
  { href: '/calculator', icon: '🧮', title: 'מחשבון מס 2024',  desc: 'מס הכנסה, ביטוח לאומי, מע"מ — חישוב מיידי', color: 'purple' },
  { href: '/deadlines',  icon: '📅', title: 'מועדים קריטיים', desc: 'לוח מועדי הגשה ותשלום לכל השנה',             color: 'amber'  },
  { href: '/history',    icon: '📂', title: 'היסטוריה',        desc: 'כל החיפושים שמורים ב-SQLite מקומי',          color: 'slate'  },
]

export default function HomeClient() {
  const [isLocal, setIsLocal] = useState(false)

  useEffect(() => { setIsLocal(!!getLocalSession()) }, [])

  // Local session → show dashboard home (no Supabase chat)
  if (isLocal) return <StandaloneHome />

  // Supabase session → full chat UI
  return (
    <div className="relative h-screen flex flex-col overflow-hidden">
      <WormholeCanvas />
      <TopBar />
      <div className="flex flex-1 overflow-hidden relative z-10">
        <Sidebar />
        <main className="flex-1 flex flex-col overflow-hidden">
          <ChatInterface />
        </main>
      </div>
    </div>
  )
}

function StandaloneHome() {
  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden">
      <WormholeCanvas />
      <div className="relative z-10 flex flex-col min-h-screen">
        <TopBar />
        <main className="flex-1 flex flex-col items-center justify-center p-6" dir="rtl">

          {/* Hero */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 shadow-xl shadow-teal-500/20"
                 style={{ background: 'linear-gradient(135deg,#0d9488,#2dd4bf)' }}>
              <span className="text-3xl">⚖️</span>
            </div>
            <h1 className="text-3xl font-black text-white mb-2"
                style={{ textShadow: '0 0 30px rgba(45,212,191,0.3)' }}>
              Tax Solver AI
            </h1>
            <p className="text-slate-400 text-base max-w-md mx-auto">
              פלטפורמת מחקר מס ישראלי — סוכנים אוטונומיים, מחשבון מס, מועדי הגשה
            </p>
            <div className="flex items-center justify-center gap-2 mt-3">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs text-slate-500">Standalone Mode — ללא API keys</span>
            </div>
          </div>

          {/* Quick ask */}
          <div className="w-full max-w-xl mb-8">
            <QuickAsk />
          </div>

          {/* Tools grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full max-w-3xl">
            {TOOLS.map(t => {
              const colors: Record<string, string> = {
                teal:   'border-teal-500/30 hover:border-teal-500/50 hover:bg-teal-500/5',
                purple: 'border-purple-500/30 hover:border-purple-500/50 hover:bg-purple-500/5',
                amber:  'border-amber-500/30 hover:border-amber-500/50 hover:bg-amber-500/5',
                slate:  'border-slate-600/40 hover:border-slate-500/60 hover:bg-slate-700/20',
              }
              return (
                <Link key={t.href} href={t.href}
                  className={`rounded-xl border p-4 transition-all text-right bg-slate-900/40 backdrop-blur-sm ${colors[t.color]}`}>
                  <div className="text-2xl mb-2">{t.icon}</div>
                  <div className="text-sm font-semibold text-slate-200">{t.title}</div>
                  <div className="text-xs text-slate-500 mt-1 leading-relaxed">{t.desc}</div>
                </Link>
              )
            })}
          </div>

        </main>
      </div>
    </div>
  )
}

function QuickAsk() {
  const [q, setQ]           = useState('')
  const [loading, setLoading] = useState(false)
  const [answer, setAnswer]   = useState('')
  const [error, setError]     = useState('')

  const ask = async () => {
    if (!q.trim() || loading) return
    setLoading(true); setAnswer(''); setError('')
    try {
      const res = await fetch('/api/agent/standalone', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
      })
      if (!res.ok || !res.body) throw new Error('שגיאת שרת')
      const reader = res.body.getReader()
      const dec = new TextDecoder()
      let buf = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })
        const lines = buf.split('\n'); buf = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const ev = JSON.parse(line.slice(6))
            if (ev.text) setAnswer(p => p + ev.text)
            if (ev.error) setError(ev.error)
          } catch { /* skip */ }
        }
      }
    } catch (e: unknown) { setError((e as Error).message) }
    finally { setLoading(false) }
  }

  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-900/60 backdrop-blur-sm overflow-hidden">
      <div className="flex gap-0">
        <input value={q} onChange={e => setQ(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && ask()}
          placeholder="שאל שאלת מס — הסוכן יענה מיידית..."
          className="flex-1 bg-transparent px-4 py-3 text-sm text-slate-200 placeholder-slate-500
                     focus:outline-none border-l border-slate-700/50" />
        <button onClick={ask} disabled={loading || !q.trim()}
          className="px-4 py-3 text-sm font-medium text-teal-300 hover:bg-teal-500/10
                     transition disabled:opacity-40 whitespace-nowrap">
          {loading ? '⏳' : '→ שאל'}
        </button>
      </div>
      {(answer || error) && (
        <div className="border-t border-slate-700/50 px-4 py-3 max-h-52 overflow-y-auto">
          {error
            ? <p className="text-xs text-rose-400">{error}</p>
            : <pre className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed font-sans">{answer}</pre>
          }
        </div>
      )}
    </div>
  )
}
