/**
 * Local session — works without Supabase
 * מאחסן session ב-cookie פשוט לצרכי dev/standalone
 */

const SESSION_COOKIE = 'tax_local_session'

export interface LocalUser {
  id:    string
  email: string
  name:  string
  mode:  'local'
}

export function setLocalSession(user: LocalUser) {
  if (typeof document === 'undefined') return
  const val = btoa(JSON.stringify(user))
  document.cookie = `${SESSION_COOKIE}=${val}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`
}

export function getLocalSession(): LocalUser | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`))
  if (!match) return null
  try { return JSON.parse(atob(match[1])) as LocalUser } catch { return null }
}

export function clearLocalSession() {
  if (typeof document === 'undefined') return
  document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0`
}

export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
  return url.includes('.supabase.co') && key.length > 20 && !url.includes('placeholder')
}
