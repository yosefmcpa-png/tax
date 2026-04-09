import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db/sqlite'

// ============================================================
// GET /api/search?q=QUERY&type=companies|court_cases|...&limit=20
// Standalone — queries local SQLite (no Supabase)
// ============================================================

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const q     = (searchParams.get('q') ?? '').trim()
  const type  = searchParams.get('type') ?? 'all'
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20'), 50)

  if (!q) return NextResponse.json({ results: [], total: 0 })

  const db = getDb()
  const like = `%${q}%`

  try {
    if (type === 'companies') {
      const rows = db.prepare(`
        SELECT id, name, status, type, registered
        FROM scraped_companies
        WHERE name LIKE ? OR id LIKE ?
        ORDER BY name LIMIT ?
      `).all(like, like, limit)
      return NextResponse.json({ results: rows, total: rows.length, type: 'companies' })
    }

    if (type === 'court_cases') {
      const rows = db.prepare(`
        SELECT id, title, court, decision_date, summary, source_url
        FROM scraped_court_cases
        WHERE title LIKE ? OR summary LIKE ?
        ORDER BY decision_date DESC LIMIT ?
      `).all(like, like, limit)
      return NextResponse.json({ results: rows, total: rows.length, type: 'court_cases' })
    }

    if (type === 'legislation') {
      const rows = db.prepare(`
        SELECT id, title, type, status, summary, source_url, published_at
        FROM scraped_legislation
        WHERE title LIKE ? OR summary LIKE ?
        ORDER BY published_at DESC LIMIT ?
      `).all(like, like, limit)
      return NextResponse.json({ results: rows, total: rows.length, type: 'legislation' })
    }

    if (type === 'tax_rulings') {
      const rows = db.prepare(`
        SELECT id, title, category, date_issued, summary
        FROM scraped_tax_rulings
        WHERE title LIKE ? OR summary LIKE ? OR category LIKE ?
        ORDER BY date_issued DESC LIMIT ?
      `).all(like, like, like, limit)
      return NextResponse.json({ results: rows, total: rows.length, type: 'tax_rulings' })
    }

    // type === 'all' — search across all tables
    const perTable = Math.ceil(limit / 4)

    const companies = db.prepare(`
      SELECT 'company' as kind, id, name as title, status, NULL as summary, NULL as date
      FROM scraped_companies WHERE name LIKE ? LIMIT ?
    `).all(like, perTable)

    const cases = db.prepare(`
      SELECT 'court_case' as kind, id, title, court as status, summary,
             decision_date as date
      FROM scraped_court_cases WHERE title LIKE ? OR summary LIKE ? LIMIT ?
    `).all(like, like, perTable)

    const legislation = db.prepare(`
      SELECT 'legislation' as kind, id, title, status, summary,
             published_at as date
      FROM scraped_legislation WHERE title LIKE ? OR summary LIKE ? LIMIT ?
    `).all(like, like, perTable)

    const rulings = db.prepare(`
      SELECT 'tax_ruling' as kind, id, title, category as status, summary,
             date_issued as date
      FROM scraped_tax_rulings WHERE title LIKE ? OR summary LIKE ? LIMIT ?
    `).all(like, like, perTable)

    const results = [...companies, ...cases, ...legislation, ...rulings]
    return NextResponse.json({ results, total: results.length, type: 'all' })

  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
