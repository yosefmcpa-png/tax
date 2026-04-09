'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { getLocalSession, clearLocalSession } from '@/lib/auth/local-session'
import { useRouter } from 'next/navigation'

export default function TopBar() {
  const [userName, setUserName] = useState<string | null>(null)
  const [isLocal,  setIsLocal]  = useState(false)
  const router = useRouter()

  useEffect(() => {
    const local = getLocalSession()
    if (local) { setUserName(local.name); setIsLocal(true); return }
    // Supabase user
    import('@/lib/supabase/client').then(({ createClient }) => {
      createClient().auth.getUser().then(({ data }) => {
        if (data.user) setUserName(data.user.email?.split('@')[0] ?? 'משתמש')
      })
    })
  }, [])

  const handleLogout = () => {
    if (isLocal) {
      clearLocalSession()
      router.push('/login')
    } else {
      import('@/lib/supabase/client').then(({ createClient }) => {
        createClient().auth.signOut().then(() => router.push('/login'))
      })
    }
  }

  return (
    <header className="flex-shrink-0 flex items-center justify-between px-5 py-2.5
                       border-b border-slate-700/50 backdrop-blur-xl z-10"
            style={{ background: 'rgba(10,15,30,0.7)' }}>

      {/* Left: branding + status */}
      <div className="flex items-center gap-3">
        <Link href="/demo" className="flex items-center gap-2 group">
          <div className="w-6 h-6 rounded-md flex items-center justify-center text-sm flex-shrink-0"
               style={{ background: 'linear-gradient(135deg,#0d9488,#2dd4bf)' }}>⚖️</div>
          <span className="text-sm font-bold text-teal-400 group-hover:text-teal-300 transition hidden sm:block">
            Tax Solver
          </span>
        </Link>
        <div className="h-3 w-px bg-slate-700/60" />
        <div className="flex items-center gap-1.5 text-xs text-emerald-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="hidden sm:inline">מחובר</span>
        </div>
      </div>

      {/* Center: nav */}
      <nav className="hidden md:flex items-center gap-1">
        {[
          { href: '/',         label: '💬 צ\'אט' },
          { href: '/demo',     label: '⚡ Pipeline' },
          { href: '/history',    label: '📂 היסטוריה' },
          { href: '/calculator', label: '🧮 מחשבון' },
          { href: '/dashboard',  label: '📊 Dashboard' },
        ].map(n => (
          <Link key={n.href} href={n.href}
            className="text-xs px-3 py-1.5 rounded-lg text-slate-400 hover:text-slate-200
                       hover:bg-slate-700/40 transition">
            {n.label}
          </Link>
        ))}
      </nav>

      {/* Right: user + logout */}
      <div className="flex items-center gap-2">
        {isLocal && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-500">
            Local
          </span>
        )}
        {userName && (
          <span className="text-xs text-slate-500 hidden sm:inline">{userName}</span>
        )}
        <button onClick={handleLogout}
          className="text-xs px-3 py-1.5 rounded-lg border border-slate-700 text-slate-500
                     hover:text-slate-300 hover:border-slate-600 transition">
          יציאה
        </button>
      </div>
    </header>
  )
}
