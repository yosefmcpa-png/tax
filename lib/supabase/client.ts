import { createBrowserClient } from '@supabase/ssr'

// Client-side Supabase — משתמש ב-anon key בלבד (בטוח לחשיפה)
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
