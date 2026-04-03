'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [message, setMessage]   = useState<{ text: string; error: boolean } | null>(null)

  const supabase = createClient()
  const router   = useRouter()

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
      const error = err as Error
      setMessage({ text: error.message || 'שגיאה בהתחברות', error: true })
    } finally {
      setLoading(false)
    }
  }

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
          <p className="text-slate-400 text-sm">פלטפורמת מחקר מס מקצועית</p>
        </div>

        {/* Card */}
        <div className="rounded-xl border border-teal-500/20 backdrop-blur-xl p-8"
             style={{ background: 'rgba(15,23,42,0.8)' }}>
          <h2 className="text-xl font-semibold text-slate-200 mb-6 text-center">
            {isSignUp ? 'יצירת חשבון חדש' : 'כניסה למערכת'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">אימייל</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="your@email.com"
                className="w-full bg-slate-800/60 border border-slate-600 rounded-lg px-4 py-2.5 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/50 transition"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">סיסמה</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={8}
                placeholder="מינימום 8 תווים"
                className="w-full bg-slate-800/60 border border-slate-600 rounded-lg px-4 py-2.5 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/50 transition"
              />
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

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg font-bold text-slate-900 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ background: loading ? '#334155' : 'linear-gradient(45deg, #2dd4bf, #5eead4)' }}
            >
              {loading ? 'מתחבר...' : isSignUp ? 'צור חשבון' : 'כניסה'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => { setIsSignUp(!isSignUp); setMessage(null) }}
              className="text-sm text-teal-400 hover:text-teal-300 transition"
            >
              {isSignUp ? 'כבר יש לך חשבון? כנס כאן' : 'אין חשבון? הירשם'}
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-slate-600 mt-6">
          מידע המוזן במערכת מוצפן ומאובטח
        </p>
      </div>
    </div>
  )
}
