'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [message,  setMessage]  = useState<{ text: string; error: boolean } | null>(null)
  const [health,   setHealth]   = useState<{ ready: boolean; checks: Record<string, { ok: boolean; msg: string }> } | null>(null)

  const supabase = createClient()
  const router   = useRouter()

  useEffect(() => {
    fetch('/api/health').then(r => r.json()).then(setHealth).catch(() => null)
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage(null)
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: `${window.location.origin}/api/auth/callback` },
        })
        if (error) throw error
        setMessage({ text: 'נשלח מייל אימות. בדוק את תיבת הדואר שלך.', error: false })
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        router.push('/')
        router.refresh()
      }
    } catch (err: unknown) {
      setMessage({ text: (err as Error).message || 'שגיאה בהתחברות', error: true })
    } finally {
      setLoading(false)
    }
  }

  const missingServices = health
    ? Object.entries(health.checks).filter(([k, v]) => !v.ok && k !== 'whatsapp')
    : []

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
         style={{ background: 'radial-gradient(ellipse at bottom, #1b2735 0%, #090a0f 100%)' }}>
      <div className="w-full max-w-md">

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-teal-400 mb-2"
              style={{ textShadow: '0 0 20px rgba(45,212,191,0.5)' }}>
            Tax Solver
          </h1>
          <p className="text-slate-400 text-sm">סוכן מחקר מס אוטונומי</p>

          {/* Status dots */}
          {health && (
            <div className="flex items-center justify-center gap-3 mt-3">
              {Object.entries(health.checks).map(([key, val]) => (
                <div key={key} className="flex items-center gap-1">
                  <span className={`h-1.5 w-1.5 rounded-full ${val.ok ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                  <span className="text-xs text-slate-600">
                    {{ claude: 'AI', supabase: 'DB', redis: 'Cache', whatsapp: 'WA' }[key] ?? key}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Setup warning */}
        {missingServices.length > 0 && (
          <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
            <p className="text-sm font-semibold text-amber-300 mb-2">⚠️ הגדרה נדרשת:</p>
            {missingServices.map(([key, val]) => (
              <p key={key} className="text-xs text-amber-400/80">• {val.msg}</p>
            ))}
            <p className="text-xs text-amber-500/60 mt-2">
              מלא את .env.local והפעל מחדש
            </p>
          </div>
        )}

        {/* Card */}
        <div className="rounded-xl border border-teal-500/20 backdrop-blur-xl p-8"
             style={{ background: 'rgba(15,23,42,0.85)' }}>
          <h2 className="text-xl font-semibold text-slate-200 mb-6 text-center">
            {isSignUp ? 'יצירת חשבון חדש' : 'כניסה למערכת'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">אימייל</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                required placeholder="your@email.com"
                className="w-full bg-slate-800/60 border border-slate-600 rounded-lg px-4 py-2.5
                           text-slate-200 placeholder-slate-500 focus:outline-none
                           focus:border-teal-500 focus:ring-1 focus:ring-teal-500/50 transition" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">סיסמה</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                required minLength={8} placeholder="מינימום 8 תווים"
                className="w-full bg-slate-800/60 border border-slate-600 rounded-lg px-4 py-2.5
                           text-slate-200 placeholder-slate-500 focus:outline-none
                           focus:border-teal-500 focus:ring-1 focus:ring-teal-500/50 transition" />
            </div>

            {message && (
              <div className={`rounded-lg p-3 text-sm font-medium ${
                message.error
                  ? 'bg-rose-500/20 border border-rose-500/40 text-rose-300'
                  : 'bg-teal-500/20 border border-teal-500/40 text-teal-300'
              }`}>
                {message.text}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full py-3 rounded-lg font-bold text-slate-900 transition-all
                         disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ background: loading ? '#334155' : 'linear-gradient(45deg,#2dd4bf,#5eead4)' }}>
              {loading ? '...' : isSignUp ? 'צור חשבון' : 'כניסה'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button onClick={() => { setIsSignUp(!isSignUp); setMessage(null) }}
              className="text-sm text-teal-400 hover:text-teal-300 transition">
              {isSignUp ? 'כבר יש לך חשבון? כנס כאן' : 'אין חשבון? הירשם'}
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-slate-600 mt-6">
          Claude opus-4-6 · Supabase · Encrypted
        </p>
      </div>
    </div>
  )
}
