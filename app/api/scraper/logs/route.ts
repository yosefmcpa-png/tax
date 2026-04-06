import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json([], { status: 401 })

  const admin = createAdminSupabaseClient()
  // Most recent log per scraper
  const { data } = await admin
    .from('scraper_logs')
    .select('scraper, status, records, error_count, created_at')
    .order('created_at', { ascending: false })
    .limit(40)

  // Dedupe — keep latest per scraper
  const seen = new Set<string>()
  const latest = (data ?? []).filter((r: { scraper: string }) => {
    if (seen.has(r.scraper)) return false
    seen.add(r.scraper)
    return true
  })

  return NextResponse.json(latest)
}
