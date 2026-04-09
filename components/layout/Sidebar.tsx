'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCaseStore } from '@/store/caseStore'
import { getLocalSession, clearLocalSession } from '@/lib/auth/local-session'

export default function Sidebar() {
  const { cases, setCases, activeCaseId, setActiveCaseId, setMessages, clearMessages } = useCaseStore()
  const pathname = usePathname()

  useEffect(() => {
    const local = getLocalSession()
    if (local) {
      // Load from local SQLite via /api/history
      fetch('/api/history').then(r => r.json()).then(d => {
        if (d.cases) setCases(d.cases.map((c: { id: string; title: string; created_at: string }) => ({
          id: c.id, title: c.title, status: 'open',
          case_type: 'research', created_at: c.created_at, updated_at: c.created_at,
        })))
      }).catch(() => null)
      return
    }
    // Supabase session
    import('@/lib/supabase/client').then(({ createClient }) => {
      createClient().auth.getSession().then(({ data: { session } }) => {
        if (!session) return
        fetch('/api/cases', { headers: { Authorization: `Bearer ${session.access_token}` } })
          .then(r => r.json()).then(d => { if (d.cases) setCases(d.cases) })
      })
    })
  }, [setCases])

  async function handleSelectCase(caseId: string, title: string) {
    setActiveCaseId(caseId)
    const local = getLocalSession()
    if (local) {
      // Load from local SQLite
      fetch(`/api/history/${caseId}`).then(r => r.json()).then(d => {
        if (d.conversations) setMessages(
          d.conversations.map((c: { id: string; role: 'user'|'model'; content: string; created_at: string }) => ({
            id: c.id, role: c.role, content: c.content, sources: [], timestamp: new Date(c.created_at),
          }))
        )
      }).catch(() => null)
      return
    }
    import('@/lib/supabase/client').then(({ createClient }) => {
      createClient().auth.getSession().then(({ data: { session } }) => {
        if (!session) return
        fetch(`/api/cases/${caseId}`, { headers: { Authorization: `Bearer ${session.access_token}` } })
          .then(r => r.json()).then(d => {
            if (d.conversations) setMessages(d.conversations.map((conv: {
              id: string; role: 'user'|'model'; content: string; sources: unknown[]; created_at: string
            }) => ({ id: conv.id, role: conv.role, content: conv.content, sources: conv.sources ?? [], timestamp: new Date(conv.created_at) })))
          })
      })
    })
    void title
  }

  function handleSignOut() {
    const local = getLocalSession()
    if (local) { clearLocalSession(); window.location.href = '/login'; return }
    import('@/lib/supabase/client').then(({ createClient }) => {
      createClient().auth.signOut().then(() => { window.location.href = '/login' })
    })
  }

  const NAV = [
    { href: '/',          label: 'צ\'אט',         icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z', color: 'teal' },
    { href: '/demo',      label: '⚡ Pipeline',    icon: 'M13 10V3L4 14h7v7l9-11h-7z',                                                                                                                                        color: 'teal' },
    { href: '/history',   label: 'היסטוריה',       icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',                                                                                                                      color: 'slate' },
    { href: '/dashboard', label: 'Dashboard',      icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z', color: 'indigo' },
    { href: '/calculator', label: '🧮 מחשבון מס',    icon: 'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M4 19h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z', color: 'purple' },
    { href: '/deadlines',  label: '📅 מועדים',       icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',                                                         color: 'amber'  },
    { href: '/search',    label: 'חיפוש מאגר',     icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',                                                                                                                      color: 'amber' },
  ]

  return (
    <aside className="w-60 flex-shrink-0 flex flex-col border-l border-slate-700/50 backdrop-blur-xl"
           style={{ background: 'rgba(10,15,30,0.7)' }}>

      <div className="px-4 py-4 border-b border-slate-700/50">
        <h1 className="text-base font-bold text-teal-400" style={{ textShadow: '0 0 12px rgba(45,212,191,0.4)' }}>
          Tax Solver AI
        </h1>
        <p className="text-xs text-slate-600 mt-0.5">סוכן מחקר מס אוטונומי</p>
      </div>

      <div className="px-2 py-2 space-y-0.5">
        {NAV.map(n => (
          <Link key={n.href} href={n.href}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition border ${
              pathname === n.href
                ? `bg-${n.color}-500/15 text-${n.color}-300 border-${n.color}-500/30`
                : 'text-slate-400 hover:bg-slate-700/30 hover:text-slate-200 border-transparent'
            }`}>
            <svg className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={n.icon}/>
            </svg>
            {n.label}
          </Link>
        ))}
        <button onClick={clearMessages}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium
                     text-teal-400 border border-teal-500/25 hover:bg-teal-500/10 transition mt-1">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
          </svg>
          תיק חדש
        </button>
      </div>

      <div className="flex-grow overflow-y-auto px-2 pt-2">
        {cases.length === 0 ? (
          <p className="text-xs text-slate-700 text-center py-4">אין תיקים עדיין</p>
        ) : (
          <div className="space-y-0.5">
            {cases.map(c => (
              <div key={c.id} onClick={() => handleSelectCase(c.id, c.title)}
                className={`group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition border ${
                  activeCaseId === c.id
                    ? 'bg-teal-500/15 border-teal-500/30'
                    : 'hover:bg-slate-700/30 border-transparent'
                }`}>
                <div className="min-w-0 flex-grow">
                  <p className="text-xs font-medium text-slate-300 truncate">{c.title}</p>
                  <p className="text-xs text-slate-600">
                    {new Date(c.updated_at).toLocaleDateString('he-IL')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="px-3 py-3 border-t border-slate-700/50">
        <button onClick={handleSignOut}
          className="w-full text-xs text-slate-600 hover:text-slate-400 transition text-right py-1">
          יציאה מהמערכת
        </button>
      </div>
    </aside>
  )
}
