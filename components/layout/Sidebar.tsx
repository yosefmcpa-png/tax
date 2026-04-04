'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCaseStore } from '@/store/caseStore'
import { createClient } from '@/lib/supabase/client'
import { CaseWithPreview } from '@/types'

export default function Sidebar() {
  const { cases, setCases, activeCaseId, setActiveCaseId, setMessages, clearMessages } = useCaseStore()
  const pathname = usePathname()

  useEffect(() => {
    async function loadCases() {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const res = await fetch('/api/cases', {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      })
      const data = await res.json()
      if (data.cases) setCases(data.cases)
    }
    loadCases()
  }, [setCases])

  async function handleSelectCase(c: CaseWithPreview) {
    setActiveCaseId(c.id)
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const res = await fetch(`/api/cases/${c.id}`, {
      headers: { 'Authorization': `Bearer ${session.access_token}` },
    })
    const data = await res.json()
    if (data.conversations) {
      setMessages(
        data.conversations.map((conv: {
          id: string; role: 'user' | 'model'; content: string; sources: unknown[]; created_at: string
        }) => ({
          id:        conv.id,
          role:      conv.role,
          content:   conv.content,
          sources:   conv.sources ?? [],
          timestamp: new Date(conv.created_at),
        }))
      )
    }
  }

  async function handleDeleteCase(caseId: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm('האם למחוק את התיק? פעולה זו בלתי הפיכה.')) return
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    await fetch(`/api/cases?id=${caseId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${session.access_token}` },
    })
    setCases(cases.filter(c => c.id !== caseId))
    if (activeCaseId === caseId) clearMessages()
  }

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <aside className="w-64 flex-shrink-0 flex flex-col border-l border-slate-700/50 backdrop-blur-xl"
           style={{ background: 'rgba(10,15,30,0.7)' }}>

      {/* Logo */}
      <div className="px-4 py-5 border-b border-slate-700/50">
        <h1 className="text-lg font-bold text-teal-400"
            style={{ textShadow: '0 0 12px rgba(45,212,191,0.4)' }}>
          Tax Solver
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">סוכן מחקר מס</p>
      </div>

      {/* Nav */}
      <div className="px-3 py-3 space-y-1">
        <Link href="/"
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition ${
            pathname === '/'
              ? 'bg-teal-500/15 text-teal-300 border border-teal-500/30'
              : 'text-slate-400 hover:bg-slate-700/30 hover:text-slate-200 border border-transparent'
          }`}>
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
          </svg>
          צ׳אט
        </Link>
        <Link href="/dashboard"
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition ${
            pathname === '/dashboard'
              ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30'
              : 'text-slate-400 hover:bg-slate-700/30 hover:text-slate-200 border border-transparent'
          }`}>
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
          </svg>
          Dashboard
        </Link>
        <button onClick={clearMessages}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold text-teal-400 border border-teal-500/30 hover:bg-teal-500/10 transition">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
          </svg>
          תיק חדש
        </button>
      </div>

      {/* Cases list */}
      <div className="flex-grow overflow-y-auto px-2">
        {cases.length === 0 ? (
          <p className="text-xs text-slate-600 text-center py-6">אין תיקים עדיין</p>
        ) : (
          <div className="space-y-1">
            {cases.map(c => (
              <div
                key={c.id}
                onClick={() => handleSelectCase(c)}
                className={`group flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition ${
                  activeCaseId === c.id
                    ? 'bg-teal-500/15 border border-teal-500/30'
                    : 'hover:bg-slate-700/30 border border-transparent'
                }`}
              >
                <div className="min-w-0 flex-grow">
                  <p className="text-xs font-semibold text-slate-300 truncate">{c.title}</p>
                  <p className="text-xs text-slate-600 mt-0.5">
                    {new Date(c.updated_at).toLocaleDateString('he-IL')}
                  </p>
                </div>
                <button
                  onClick={e => handleDeleteCase(c.id, e)}
                  className="opacity-0 group-hover:opacity-100 ml-2 text-slate-600 hover:text-rose-400 transition text-lg leading-none"
                  title="מחק תיק"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sign out */}
      <div className="px-3 py-4 border-t border-slate-700/50">
        <button
          onClick={handleSignOut}
          className="w-full text-xs text-slate-500 hover:text-slate-300 transition text-right py-1"
        >
          יציאה מהמערכת
        </button>
      </div>
    </aside>
  )
}
