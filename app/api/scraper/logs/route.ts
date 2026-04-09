import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db/sqlite'

export async function GET() {
  try {
    const db = getDb()

    const logs = db.prepare(`
      SELECT source, status, records, error, created_at
      FROM scraper_logs
      ORDER BY created_at DESC
      LIMIT 40
    `).all() as Array<{ source: string; status: string; records: number; error: string | null; created_at: string }>

    // Keep latest per source
    const seen = new Set<string>()
    const latest = logs.filter(r => {
      if (seen.has(r.source)) return false
      seen.add(r.source)
      return true
    })

    // Add DB counts
    const counts = {
      legislation: (db.prepare('SELECT COUNT(*) as n FROM scraped_legislation').get() as { n: number }).n,
      companies:   (db.prepare('SELECT COUNT(*) as n FROM scraped_companies').get() as { n: number }).n,
      court_cases: (db.prepare('SELECT COUNT(*) as n FROM scraped_court_cases').get() as { n: number }).n,
      tax_rulings: (db.prepare('SELECT COUNT(*) as n FROM scraped_tax_rulings').get() as { n: number }).n,
    }

    return NextResponse.json({ logs: latest, counts })
  } catch (err) {
    return NextResponse.json({ logs: [], counts: {}, error: (err as Error).message })
  }
}
