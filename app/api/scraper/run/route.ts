import { NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/db/sqlite'
import { runAllStandaloneScrapers } from '@/lib/scrapers/standalone'

// POST /api/scraper/run — trigger all standalone scrapers (SSE streaming)
export async function POST(req: Request) {
  // Rate limit: 3 runs per 10 minutes
  const ip = req.headers.get('x-forwarded-for') ?? 'local'
  if (!checkRateLimit(`scraper:${ip}`, 3, 600_000)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      function send(data: object) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      try {
        send({ step: 'start', message: 'מתחיל סריקה...' })

        send({ step: 'knesset', message: 'סורק חקיקת כנסת...' })
        const { scrapeKnessetLegislation } = await import('@/lib/scrapers/standalone')
        const leg = await scrapeKnessetLegislation(100)
        send({ step: 'knesset', done: true, ...leg, message: `חקיקה: ${leg.inserted} רשומות` })

        send({ step: 'companies', message: 'סורק חברות (data.gov.il)...' })
        const { scrapeCompaniesLocal } = await import('@/lib/scrapers/standalone')
        const comp = await scrapeCompaniesLocal(200)
        send({ step: 'companies', done: true, ...comp, message: `חברות: ${comp.inserted} רשומות` })

        send({ step: 'rulings', message: 'מוסיף חוזרי מס...' })
        const { seedTaxRulings } = await import('@/lib/scrapers/standalone')
        const rulings = await seedTaxRulings()
        send({ step: 'rulings', done: true, ...rulings, message: `חוזרי מס: ${rulings.inserted} רשומות` })

        send({ step: 'cases', message: 'מוסיף פסקי דין...' })
        const { seedCourtCases } = await import('@/lib/scrapers/standalone')
        const cases = await seedCourtCases()
        send({ step: 'cases', done: true, ...cases, message: `פסקי דין: ${cases.inserted} רשומות` })

        send({
          step: 'complete',
          message: 'סריקה הושלמה בהצלחה',
          totals: {
            legislation: leg.inserted,
            companies: comp.inserted,
            taxRulings: rulings.inserted,
            courtCases: cases.inserted,
          },
        })
      } catch (err) {
        send({ step: 'error', message: (err as Error).message })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}

// GET /api/scraper/run — quick non-streaming trigger (for cron)
export async function GET() {
  try {
    const results = await runAllStandaloneScrapers()
    return NextResponse.json({ ok: true, results })
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
