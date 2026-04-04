import cron from 'node-cron'

// ============================================================
// Cron Scheduler — סנכרון אוטומטי עם מאגרי הממשלה
//
// לשימוש ב-Node.js standalone server בלבד!
// ב-Vercel — השתמש ב-Vercel Cron Jobs (vercel.json)
// ============================================================

let isInitialized = false

export function startScheduler() {
  if (isInitialized) return
  isInitialized = true

  console.log('[Cron] Scheduler starting...')

  // ──────────────────────────────────────────
  // כל שעה: רשם החברות (500 רשומות)
  // ──────────────────────────────────────────
  cron.schedule('0 * * * *', async () => {
    console.log('[Cron] ⏰ Running companies sync...')
    const { scrapeCompanies } = await import('@/lib/scrapers/companies')
    await scrapeCompanies(500)
  }, { timezone: 'Asia/Jerusalem' })

  // ──────────────────────────────────────────
  // כל 6 שעות: חקיקה + פסיקות מס
  // ──────────────────────────────────────────
  cron.schedule('0 */6 * * *', async () => {
    console.log('[Cron] ⏰ Running legislation + rulings sync...')
    const { scrapeLegislation } = await import('@/lib/scrapers/legislation')
    const { scrapeTaxRulings }  = await import('@/lib/scrapers/tax-rulings')
    await Promise.all([scrapeLegislation(200), scrapeTaxRulings()])
  }, { timezone: 'Asia/Jerusalem' })

  // ──────────────────────────────────────────
  // כל יום בחצות: פסקי דין + ניקוי ישן
  // ──────────────────────────────────────────
  cron.schedule('0 0 * * *', async () => {
    console.log('[Cron] ⏰ Running court cases sync + cleanup...')
    const { scrapeCourtCases } = await import('@/lib/scrapers/court-cases')
    await scrapeCourtCases()
    await cleanupOldLogs()
  }, { timezone: 'Asia/Jerusalem' })

  // ──────────────────────────────────────────
  // כל יום ב-07:00: סנכרון מלא
  // ──────────────────────────────────────────
  cron.schedule('0 7 * * *', async () => {
    console.log('[Cron] ⏰ Running full sync...')
    const { runAllScrapers } = await import('@/lib/scrapers')
    await runAllScrapers()
  }, { timezone: 'Asia/Jerusalem' })

  console.log('[Cron] ✅ Scheduler initialized. Next runs:')
  console.log('  - Companies:   כל שעה')
  console.log('  - Legislation: כל 6 שעות')
  console.log('  - Court cases: כל יום חצות')
  console.log('  - Full sync:   כל יום 07:00')
}

async function cleanupOldLogs() {
  const { createAdminSupabaseClient } = await import('@/lib/supabase/server')
  const supabase = createAdminSupabaseClient()

  // מחק לוגי scraper ישנים מעל 30 יום
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 30)

  await supabase
    .from('scraper_logs')
    .delete()
    .lt('created_at', cutoff.toISOString())

  console.log('[Cron] Cleanup done')
}
