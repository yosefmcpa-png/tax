'use client'

import { useEffect } from 'react'
import { useCaseStore } from '@/store/caseStore'
import { createClient } from '@/lib/supabase/client'
import { CaseWithPreview } from '@/types'

export default function Sidebar() {
  const { cases, setCases, activeCaseId, setActiveCaseId, setMessages, clearMessages } = useCaseStore()

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

      {/* New case */}
      <div className="px-3 py-3">
        <button
          onClick={clearMessages}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold text-teal-400 border border-teal-500/30 hover:bg-teal-500/10 transition"
        >
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
