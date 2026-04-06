import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase/server'

// ============================================================
// GET /api/search?q=QUERY&type=companies|court_cases|...&limit=20
// ============================================================

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const q     = (searchParams.get('q') ?? '').trim()
  const type  = searchParams.get('type') ?? 'companies'
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20'), 50)

  if (!q) return NextResponse.json({ results: [], total: 0 })

  const admin = createAdminSupabaseClient()

  try {
    switch (type) {

      case 'companies': {
        const { data, count } = await admin
          .from('scraped_companies')
          .select('company_number, name, status, registered_at, address', { count: 'estimated' })
          .or(`name.ilike.%${q}%,company_number.eq.${q}`)
          .order('name')
          .limit(limit)
        return NextResponse.json({ results: data ?? [], total: count ?? 0 })
      }

      case 'court_cases': {
        const { data, count } = await admin
          .from('scraped_court_cases')
          .select('case_number, title, court, decision_date, summary, outcome, source_url', { count: 'estimated' })
          .or(`title.ilike.%${q}%,summary.ilike.%${q}%`)
          .order('decision_date', { ascending: false, nullsFirst: false })
          .limit(limit)
        return NextResponse.json({ results: data ?? [], total: count ?? 0 })
      }

      case 'legislation': {
        const { data, count } = await admin
          .from('scraped_legislation')
          .select('law_id, title, type, status, published_at, summary, source_url', { count: 'estimated' })
          .or(`title.ilike.%${q}%,summary.ilike.%${q}%`)
          .order('published_at', { ascending: false, nullsFirst: false })
          .limit(limit)
        return NextResponse.json({ results: data ?? [], total: count ?? 0 })
      }

      case 'tax_rulings': {
        const { data, count } = await admin
          .from('scraped_tax_rulings')
          .select('ruling_number, title, summary, date_issued, category, source_url', { count: 'estimated' })
          .or(`title.ilike.%${q}%,summary.ilike.%${q}%`)
          .order('date_issued', { ascending: false, nullsFirst: false })
          .limit(limit)
        return NextResponse.json({ results: data ?? [], total: count ?? 0 })
      }

      default:
        return NextResponse.json({ error: 'Unknown type' }, { status: 400 })
    }
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
