import { createAdminSupabaseClient } from '@/lib/supabase/server'

// ============================================================
// Scraper — רשם החברות (data.gov.il + ica.justice.gov.il)
// API ציבורי, ללא scraping, מותר לשימוש
// ============================================================

const DATA_GOV_API = 'https://data.gov.il/api/3/action/datastore_search'

// מזהה הרשומה של רשם החברות ב-data.gov.il
const COMPANIES_RESOURCE_ID = 'f004176c-b85f-4542-8901-7b3176f9a054'

interface RawCompany {
  'מספר חברה':          string
  'שם חברה':            string
  'סטטוס חברה':         string
  'תאריך רישום':        string
  'כתובת':              string | null
  'עיר':                string | null
}

interface ScrapedCompany {
  company_number: string
  name:           string
  status:         string
  registered_at:  string | null
  address:        string | null
  directors:      string[]
  source_url:     string
  scraped_at:     string
}

export async function scrapeCompanies(limit = 500): Promise<{ inserted: number; errors: number }> {
  const supabase = createAdminSupabaseClient()
  let inserted = 0
  let errors   = 0
  let offset   = 0

  try {
    while (offset < limit) {
      const batchSize = Math.min(100, limit - offset)
      const url = `${DATA_GOV_API}?resource_id=${COMPANIES_RESOURCE_ID}&limit=${batchSize}&offset=${offset}`
      const res = await fetch(url, { headers: { 'User-Agent': 'TaxSolver/2.0 (Research Tool)' } })

      if (!res.ok) throw new Error(`data.gov.il API error: ${res.status}`)

      const json = await res.json()
      const records: RawCompany[] = json?.result?.records ?? []

      if (records.length === 0) break

      const companies: ScrapedCompany[] = records.map(r => ({
        company_number: r['מספר חברה']?.toString() ?? '',
        name:           r['שם חברה'] ?? '',
        status:         normalizeStatus(r['סטטוס חברה'] ?? ''),
        registered_at:  parseDate(r['תאריך רישום']),
        address:        [r['כתובת'], r['עיר']].filter(Boolean).join(', ') || null,
        directors:      [],
        source_url:     `https://ica.justice.gov.il/GenericCorporarionInfo/SearchCorporation`,
        scraped_at:     new Date().toISOString(),
      })).filter(c => c.company_number && c.name)

      const { error } = await supabase
        .from('scraped_companies')
        .upsert(companies, { onConflict: 'company_number', ignoreDuplicates: false })

      if (error) {
        console.error('[Companies Scraper] DB error:', error.message)
        errors++
      } else {
        inserted += companies.length
      }

      offset += batchSize
      if (records.length < batchSize) break

      // throttle — לא להעמיס על ה-API
      await new Promise(r => setTimeout(r, 200))
    }

    // עדכן לוג סנכרון
    await supabase.from('scraper_logs').insert({
      scraper:    'companies',
      status:     errors > 0 ? 'partial' : 'success',
      records:    inserted,
      error_count: errors,
    })

    console.log(`[Companies Scraper] inserted=${inserted}, errors=${errors}`)
    return { inserted, errors }

  } catch (err) {
    console.error('[Companies Scraper] Fatal:', err)
    await supabase.from('scraper_logs').insert({
      scraper:     'companies',
      status:      'error',
      records:     0,
      error_count: 1,
      error_msg:   (err as Error).message,
    })
    return { inserted, errors: errors + 1 }
  }
}

function normalizeStatus(status: string): string {
  if (status.includes('פעיל') || status.includes('רשום')) return 'active'
  if (status.includes('מחוק') || status.includes('פסול')) return 'dissolved'
  return status || 'unknown'
}

function parseDate(dateStr: string | undefined): string | null {
  if (!dateStr) return null
  // פורמטים: DD/MM/YYYY או YYYY-MM-DD
  const parts = dateStr.split('/')
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`
  }
  return dateStr
}
