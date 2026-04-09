'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { setLocalSession, isSupabaseConfigured } from '@/lib/auth/local-session'

export default function LoginPage() {
  const [supabaseReady, setSupabaseReady] = useState(false)
  const [showAdvanced,  setShowAdvanced]  = useState(false)
  const [email,         setEmail]         = useState('')
  const [password,      setPassword]      = useState('')
  const [isSignUp,      setIsSignUp]      = useState(false)
  const [loading,       setLoading]       = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [message,       setMessage]       = useState<{ text: string; error: boolean } | null>(null)
  const [entering,      setEntering]      = useState(false)
  const router = useRouter()

  useEffect(() => { setSupabaseReady(isSupabaseConfigured()) }, [])

  // ── Quick / Local login — always works ───────────────────
  function handleQuickLogin() {
    setEntering(true)
    setLocalSession({
      id:    'local-user-' + Date.now(),
      email: 'demo@local.dev',
      name:  'משתמש',
      mode:  'local',
    })
    setTimeout(() => router.push('/demo'), 400)
  }

  // ── Google OAuth ──────────────────────────────────────────
  async function handleGoogle() {
    setGoogleLoading(true)
    setMessage(null)
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const { error } = await createClient().auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/api/auth/callback`,
          queryParams: { access_type: 'offline', prompt: 'consent' },
        },
      })
      if (error) throw error
    } catch (err: unknown) {
      setMessage({ text: (err as Error).message || 'שגיאה בהתחברות עם Google', error: true })
      setGoogleLoading(false)
    }
  }

  // ── Email / Password ──────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage(null)
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: `${window.location.origin}/api/auth/callback` },
        })
        if (error) throw error
        setMessage({ text: '✅ נשלח מייל אימות — בדוק את תיבת הדואר', error: false })
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

  const FEATURES = [
    { icon: '🤖', label: '4 סוכני AI' },
    { icon: '🧮', label: 'מחשבון מס' },
    { icon: '📅', label: 'מועדי הגשה' },
    { icon: '🔑', label: 'ללא API keys' },
  ]

  return (
    <div className="min-h-screen flex items-center justify-center p-4 overflow-hidden" dir="rtl"
         style={{ background: 'linear-gradient(135deg, #050810 0%, #0a0f1e 50%, #050d14 100%)' }}>

      {/* ── Animated background orbs ─────────────────────── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 -right-32 w-[600px] h-[600px] rounded-full opacity-[0.12] animate-pulse"
             style={{ background: 'radial-gradient(circle, #2dd4bf 0%, transparent 65%)', animationDuration: '4s' }} />
        <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full opacity-[0.08] animate-pulse"
             style={{ background: 'radial-gradient(circle, #6366f1 0%, transparent 65%)', animationDuration: '6s', animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[300px] rounded-full opacity-[0.04] animate-pulse"
             style={{ background: 'radial-gradient(ellipse, #0d9488 0%, transparent 70%)', animationDuration: '8s', animationDelay: '2s' }} />
        {/* Grid lines */}
        <div className="absolute inset-0 opacity-[0.03]"
             style={{ backgroundImage: 'linear-gradient(rgba(45,212,191,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(45,212,191,0.5) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
      </div>

      <div className={`w-full max-w-md relative z-10 transition-all duration-500 ${entering ? 'scale-95 opacity-0' : 'scale-100 opacity-100'}`}>

        {/* ── Header ────────────────────────────────────────── */}
        <div className="text-center mb-8">
          <div className="relative inline-block mb-4">
            <div className="absolute inset-0 rounded-2xl blur-xl opacity-60"
                 style={{ background: 'linear-gradient(135deg,#0d9488,#2dd4bf)' }} />
            <div className="relative inline-flex items-center justify-center w-20 h-20 rounded-2xl shadow-2xl"
                 style={{ background: 'linear-gradient(135deg,#0d9488,#2dd4bf)' }}>
              <span className="text-4xl">⚖️</span>
            </div>
          </div>
          <h1 className="text-4xl font-black text-white tracking-tight"
              style={{ textShadow: '0 0 40px rgba(45,212,191,0.4)' }}>
            Tax Solver AI
          </h1>
          <p className="text-slate-400 mt-2 text-base">
            פלטפורמת מחקר מס ישראלי — חכמה, מהירה, חינמית
          </p>

          {/* Feature badges */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
            {FEATURES.map(f => (
              <span key={f.label}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium
                           border border-teal-500/25 bg-teal-500/8 text-teal-300">
                <span>{f.icon}</span>{f.label}
              </span>
            ))}
          </div>
        </div>

        {/* ── Main card ─────────────────────────────────────── */}
        <div className="rounded-3xl border border-white/10 shadow-2xl overflow-hidden"
             style={{ background: 'rgba(10, 15, 30, 0.85)', backdropFilter: 'blur(24px)', boxShadow: '0 0 60px rgba(13,148,136,0.1), 0 25px 50px rgba(0,0,0,0.5)' }}>

          <div className="p-8">

            {/* ── PRIMARY CTA ─────────────────────────────── */}
            <div className="mb-6">
              <button onClick={handleQuickLogin}
                className="group relative w-full py-4 rounded-2xl font-bold text-lg text-white
                           overflow-hidden transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                style={{ background: 'linear-gradient(135deg, #0d9488 0%, #2dd4bf 50%, #0891b2 100%)', boxShadow: '0 0 30px rgba(45,212,191,0.35), 0 8px 32px rgba(0,0,0,0.3)' }}>
                {/* Shine effect */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                     style={{ background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.15) 50%, transparent 60%)' }} />
                <span className="relative flex items-center justify-center gap-3">
                  <span className="text-2xl">⚡</span>
                  <span>כנס עכשיו — בחינם לגמרי</span>
                </span>
              </button>
              <p className="text-center text-xs text-slate-500 mt-2">
                גישה מיידית · ללא הרשמה · ללא API keys
              </p>
            </div>

            {/* ── Supabase advanced options ────────────────── */}
            {supabaseReady ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-slate-700/60" />
                  <span className="text-xs text-slate-600">או התחבר עם חשבון</span>
                  <div className="flex-1 h-px bg-slate-700/60" />
                </div>

                {/* Google */}
                <button onClick={handleGoogle} disabled={googleLoading}
                  className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl
                             border border-slate-600 bg-slate-800/50 text-slate-200 text-sm font-medium
                             hover:bg-slate-700/60 hover:border-slate-500 transition-all disabled:opacity-50">
                  {googleLoading
                    ? <svg className="animate-spin h-4 w-4 text-teal-400" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                    : <svg className="h-4 w-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                  }
                  {googleLoading ? 'מתחבר...' : 'המשך עם Google'}
                </button>

                {/* Email toggle */}
                <button onClick={() => setShowAdvanced(p => !p)}
                  className="w-full text-xs text-slate-600 hover:text-slate-400 transition text-center py-1">
                  {showAdvanced ? '▲ הסתר' : '▼ כניסה עם מייל וסיסמה'}
                </button>

                {showAdvanced && (
                  <form onSubmit={handleSubmit} className="space-y-3 pt-1">
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                      required placeholder="your@email.com" dir="ltr"
                      className="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-3 py-2.5
                                 text-sm text-slate-200 placeholder-slate-500 focus:outline-none
                                 focus:border-teal-500/70 transition" />
                    <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                      required minLength={6} placeholder="סיסמה"
                      className="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-3 py-2.5
                                 text-sm text-slate-200 placeholder-slate-500 focus:outline-none
                                 focus:border-teal-500/70 transition" />
                    {message && (
                      <div className={`rounded-xl p-3 text-xs ${message.error ? 'bg-rose-500/10 border border-rose-500/25 text-rose-300' : 'bg-teal-500/10 border border-teal-500/25 text-teal-300'}`}>
                        {message.text}
                      </div>
                    )}
                    <button type="submit" disabled={loading}
                      className="w-full py-2.5 rounded-xl font-semibold text-sm text-white transition disabled:opacity-50"
                      style={{ background: 'linear-gradient(90deg,#0d9488,#2dd4bf)' }}>
                      {loading ? '...' : isSignUp ? 'צור חשבון' : 'כניסה'}
                    </button>
                    <button type="button" onClick={() => { setIsSignUp(!isSignUp); setMessage(null) }}
                      className="w-full text-xs text-teal-500 hover:text-teal-300 transition text-center">
                      {isSignUp ? 'כבר יש חשבון? כנס' : 'אין חשבון? הירשם'}
                    </button>
                  </form>
                )}
              </div>
            ) : (
              /* No Supabase — just show what they're missing */
              <div className="text-center">
                <p className="text-xs text-slate-600">
                  לכניסה עם Google / מייל —{' '}
                  <a href="https://supabase.com" target="_blank" rel="noreferrer"
                     className="text-teal-600 hover:text-teal-500 underline underline-offset-2">
                    הגדר Supabase
                  </a>
                </p>
              </div>
            )}
          </div>

          {/* ── Bottom stats strip ───────────────────────── */}
          <div className="border-t border-white/5 px-8 py-4 flex items-center justify-center gap-6"
               style={{ background: 'rgba(45,212,191,0.03)' }}>
            {[
              { n: '10+', label: 'נושאי מס' },
              { n: '8', label: 'חוזרי מס' },
              { n: '6', label: 'פסקי דין' },
              { n: '4', label: 'סוכני AI' },
            ].map(s => (
              <div key={s.label} className="text-center">
                <div className="text-base font-bold text-teal-400">{s.n}</div>
                <div className="text-xs text-slate-600">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-center text-xs text-slate-700 mt-5">
          מאובטח · נתונים מקומיים בלבד · פרטיות מלאה
        </p>
      </div>
    </div>
  )
}
