import { NextRequest, NextResponse } from 'next/server'
import { runAllScrapers } from '@/lib/scrapers'

// ============================================================
// GET /api/cron/sync — Vercel Cron Job endpoint
// מוגדר ב-vercel.json לריצה כל שעה
// ============================================================

export async function GET(req: NextRequest) {
  // אבטח עם Cron Secret
  const authHeader = req.headers.get('Authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const scraper = req.nextUrl.searchParams.get('scraper') ?? 'all'

  try {
    if (scraper === 'all') {
      await runAllScrapers()
      return NextResponse.json({ success: true, message: 'Full sync complete' })
    }

    const { scrapeCompanies }  = await import('@/lib/scrapers/companies')
    const { scrapeLegislation } = await import('@/lib/scrapers/legislation')
    const { scrapeCourtCases }  = await import('@/lib/scrapers/court-cases')
    const { scrapeTaxRulings }  = await import('@/lib/scrapers/tax-rulings')

    const scrapers: Record<string, () => Promise<{ inserted: number; errors: number }>> = {
      companies:   () => scrapeCompanies(500),
      legislation: () => scrapeLegislation(200),
      court_cases: scrapeCourtCases,
      tax_rulings: scrapeTaxRulings,
    }

    const fn = scrapers[scraper]
    if (!fn) return NextResponse.json({ error: 'Unknown scraper' }, { status: 400 })

    const result = await fn()
    return NextResponse.json({ success: true, ...result })

  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
