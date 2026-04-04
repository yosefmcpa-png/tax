export { scrapeCompanies }  from './companies'
export { scrapeLegislation } from './legislation'
export { scrapeCourtCases }  from './court-cases'
export { scrapeTaxRulings }  from './tax-rulings'

// ---- הרצת כל הסוכנים ----
export async function runAllScrapers(): Promise<void> {
  const { scrapeCompanies }  = await import('./companies')
  const { scrapeLegislation } = await import('./legislation')
  const { scrapeCourtCases }  = await import('./court-cases')
  const { scrapeTaxRulings }  = await import('./tax-rulings')

  console.log('[Scrapers] Starting full sync...')

  const [companies, legislation, cases, rulings] = await Promise.allSettled([
    scrapeCompanies(500),
    scrapeLegislation(200),
    scrapeCourtCases(),
    scrapeTaxRulings(),
  ])

  console.log('[Scrapers] Done.', {
    companies:   companies.status === 'fulfilled' ? companies.value : 'ERROR',
    legislation: legislation.status === 'fulfilled' ? legislation.value : 'ERROR',
    cases:       cases.status === 'fulfilled' ? cases.value : 'ERROR',
    rulings:     rulings.status === 'fulfilled' ? rulings.value : 'ERROR',
  })
}
