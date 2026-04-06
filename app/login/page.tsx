'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { setLocalSession, isSupabaseConfigured } from '@/lib/auth/local-session'

export default function LoginPage() {
  const [email,         setEmail]         = useState('')
  const [password,      setPassword]      = useState('')
  const [isSignUp,      setIsSignUp]      = useState(false)
  const [loading,       setLoading]       = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [message,       setMessage]       = useState<{ text: string; error: boolean } | null>(null)
  const [supabaseReady, setSupabaseReady] = useState(true)

  const router = useRouter()

  useEffect(() => {
    setSupabaseReady(isSupabaseConfigured())
  }, [])

  // ── Google OAuth ──────────────────────────────────────────
  async function handleGoogle() {
    if (!supabaseReady) {
      setMessage({ text: 'כניסה עם Google דורשת הגדרת Supabase — השתמש בכניסה מהירה למטה', error: true })
      return
    }
    setGoogleLoading(true)
    setMessage(null)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithOAuth({
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
    if (!supabaseReady) {
      setMessage({ text: 'Supabase לא מוגדר — השתמש בכניסה מהירה למטה', error: true })
      return
    }
    setLoading(true)
    setMessage(null)
    try {
      const supabase = createClient()
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: `${window.location.origin}/api/auth/callback` },
        })
        if (error) throw error
        setMessage({ text: 'נשלח מייל אימות — בדוק את תיבת הדואר שלך', error: false })
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

  // ── Local / Demo login ────────────────────────────────────
  function handleDemoLogin() {
    setLocalSession({
      id:    'local-user-' + Date.now(),
      email: email.trim() || 'demo@local.dev',
      name:  email.trim() ? email.split('@')[0] : 'משתמש Demo',
      mode:  'local',
    })
    router.push('/demo')
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" dir="rtl"
         style={{ background: 'radial-gradient(ellipse at 60% 40%, #0f2027 0%, #090a0f 100%)' }}>

      {/* Glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2
                        w-[500px] h-[500px] rounded-full opacity-[0.07]"
             style={{ background: 'radial-gradient(circle, #2dd4bf, transparent 70%)' }} />
      </div>

      <div className="w-full max-w-sm relative z-10">

        {/* Logo */}
        <div className="text-center mb-7">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-3 shadow-lg"
               style={{ background: 'linear-gradient(135deg,#0d9488,#2dd4bf)' }}>
            <span className="text-2xl">⚖️</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Tax Solver AI</h1>
          <p className="text-slate-400 text-sm mt-1">סוכן מחקר מס ישראלי אוטונומי</p>
        </div>

        {/* "Supabase not configured" banner */}
        {!supabaseReady && (
          <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
            <p className="font-semibold mb-1">⚠️ Supabase לא מוגדר</p>
            <p className="text-amber-400/70">
              כניסה עם Google ומייל דורשת הגדרת Supabase.<br/>
              השתמש ב<strong className="text-amber-300">כניסה מהירה</strong> למטה לגישה מיידית.
            </p>
          </div>
        )}

        {/* Card */}
        <div className="rounded-2xl border border-white/10 p-6 shadow-2xl"
             style={{ background: 'rgba(15,23,42,0.90)', backdropFilter: 'blur(20px)' }}>

          <h2 className="text-base font-semibold text-slate-200 mb-5 text-center">
            {isSignUp ? 'צור חשבון חדש' : 'כניסה למערכת'}
          </h2>

          {/* Google */}
          <button onClick={handleGoogle} disabled={googleLoading}
            className={`w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-xl
                       border text-sm font-medium transition-all mb-3
                       ${supabaseReady
                         ? 'border-slate-600 bg-slate-800/60 text-slate-200 hover:bg-slate-700/60 hover:border-slate-500'
                         : 'border-slate-700 bg-slate-800/30 text-slate-500 cursor-not-allowed'
                       } disabled:opacity-50`}>
            {googleLoading ? (
              <svg className="animate-spin h-4 w-4 text-teal-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
            ) : (
              <svg className="h-4 w-4 flex-shrink-0" viewBox="0 0 24 24">
                <path fill={supabaseReady ? '#4285F4' : '#64748b'} d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill={supabaseReady ? '#34A853' : '#64748b'} d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill={supabaseReady ? '#FBBC05' : '#64748b'} d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                <path fill={supabaseReady ? '#EA4335' : '#64748b'} d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            )}
            {googleLoading ? 'מתחבר...' : 'המשך עם Google'}
            {!supabaseReady && <span className="text-xs text-slate-600 mr-auto">דורש Supabase</span>}
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-3">
            <div className="flex-1 h-px bg-slate-700/60" />
            <span className="text-xs text-slate-600">או עם מייל</span>
            <div className="flex-1 h-px bg-slate-700/60" />
          </div>

          {/* Email form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              required placeholder="your@email.com" dir="ltr"
              className="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-3 py-2.5
                         text-sm text-slate-200 placeholder-slate-500 focus:outline-none
                         focus:border-teal-500/70 focus:ring-1 focus:ring-teal-500/20 transition" />
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              required minLength={6} placeholder="סיסמה (מינימום 6 תווים)"
              className="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-3 py-2.5
                         text-sm text-slate-200 placeholder-slate-500 focus:outline-none
                         focus:border-teal-500/70 focus:ring-1 focus:ring-teal-500/20 transition" />

            {message && (
              <div className={`rounded-xl p-3 text-xs ${
                message.error
                  ? 'bg-rose-500/10 border border-rose-500/25 text-rose-300'
                  : 'bg-teal-500/10 border border-teal-500/25 text-teal-300'
              }`}>
                {message.text}
              </div>
            )}

            <button type="submit" disabled={loading || !supabaseReady}
              className="w-full py-2.5 rounded-xl font-bold text-sm text-slate-900
                         transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: (loading || !supabaseReady) ? '#334155' : 'linear-gradient(90deg,#0d9488,#2dd4bf)' }}>
              {loading ? '...' : isSignUp ? 'צור חשבון' : 'כניסה'}
            </button>
          </form>

          <button onClick={() => { setIsSignUp(!isSignUp); setMessage(null) }}
            className="w-full mt-3 text-xs text-teal-500 hover:text-teal-300 transition text-center">
            {isSignUp ? 'כבר יש לך חשבון? כנס כאן' : 'אין חשבון? הירשם'}
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-slate-700/60" />
            <span className="text-xs text-slate-600">כניסה מהירה</span>
            <div className="flex-1 h-px bg-slate-700/60" />
          </div>

          {/* Demo / Local login — always works */}
          <button onClick={handleDemoLogin}
            className="w-full py-2.5 rounded-xl font-semibold text-sm border border-teal-500/30
                       text-teal-400 hover:bg-teal-500/10 hover:border-teal-500/50 transition-all
                       flex items-center justify-center gap-2">
            <span>⚡</span>
            כניסה מהירה ללא הרשמה
          </button>
          <p className="text-center text-xs text-slate-600 mt-2">
            גישה מלאה לכל הכלים — ללא API keys
          </p>
        </div>

        <p className="text-center text-xs text-slate-700 mt-5">
          מאובטח · מוצפן · פרטיות מלאה
        </p>
      </div>
    </div>
  )
}
