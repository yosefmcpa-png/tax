import { createAdminSupabaseClient } from '@/lib/supabase/server'

// ============================================================
// Scraper — חקיקה ישראלית (API הכנסת)
// https://main.knesset.gov.il/Activity/Legislation
// ============================================================

const KNESSET_API = 'https://knesset.gov.il/Odata/ParliamentInfo.svc'

interface KnessetBill {
  BillID:           number
  Name:             string
  SubTypeDesc:      string
  StatusDesc:       string
  LastUpdatedDate:  string
  SummaryLaw:       string | null
  PrivateName:      string | null
}

interface ScrapedLegislation {
  law_id:        string
  title:         string
  type:          string
  status:        string
  published_at:  string | null
  summary:       string | null
  source_url:    string
  scraped_at:    string
}

export async function scrapeLegislation(limit = 200): Promise<{ inserted: number; errors: number }> {
  const supabase = createAdminSupabaseClient()
  let inserted = 0
  let errors   = 0

  try {
    // הצעות חוק מהכנסת
    const url = `${KNESSET_API}/KNS_Bill?$top=${limit}&$orderby=LastUpdatedDate desc&$format=json`
    const res = await fetch(url, {
      headers: {
        'Accept':     'application/json',
        'User-Agent': 'TaxSolver/2.0 (Research Tool)',
      },
    })

    if (!res.ok) throw new Error(`Knesset API error: ${res.status}`)

    const json = await res.json()
    const records: KnessetBill[] = json?.value ?? []

    const legislation: ScrapedLegislation[] = records
      .filter(r => r.Name && r.BillID)
      .map(r => ({
        law_id:       `knesset-${r.BillID}`,
        title:        r.Name,
        type:         mapBillType(r.SubTypeDesc ?? ''),
        status:       r.StatusDesc ?? 'unknown',
        published_at: parseODataDate(r.LastUpdatedDate),
        summary:      r.SummaryLaw ?? r.PrivateName ?? null,
        source_url:   `https://knesset.gov.il/bill/heb/bill_info.aspx?law_id=${r.BillID}`,
        scraped_at:   new Date().toISOString(),
      }))

    const { error } = await supabase
      .from('scraped_legislation')
      .upsert(legislation, { onConflict: 'law_id', ignoreDuplicates: false })

    if (error) {
      console.error('[Legislation Scraper] DB error:', error.message)
      errors++
    } else {
      inserted = legislation.length
    }

    // גם חוקי מס ספציפיים מ-data.gov.il
    await scrapeIsraeliTaxLaws(supabase)

    await supabase.from('scraper_logs').insert({
      scraper:     'legislation',
      status:      errors > 0 ? 'partial' : 'success',
      records:     inserted,
      error_count: errors,
    })

    console.log(`[Legislation Scraper] inserted=${inserted}, errors=${errors}`)
    return { inserted, errors }

  } catch (err) {
    console.error('[Legislation Scraper] Fatal:', err)
    await supabase.from('scraper_logs').insert({
      scraper:     'legislation',
      status:      'error',
      records:     0,
      error_count: 1,
      error_msg:   (err as Error).message,
    })
    return { inserted, errors: errors + 1 }
  }
}

// חוקי מס עיקריים — רשימה קבועה עם קישורים לנוסח המלא
async function scrapeIsraeliTaxLaws(supabase: ReturnType<typeof createAdminSupabaseClient>) {
  const TAX_LAWS: ScrapedLegislation[] = [
    {
      law_id:       'income-tax-ordinance',
      title:        'פקודת מס הכנסה [נוסח חדש]',
      type:         'law',
      status:       'active',
      published_at: '1961-01-01',
      summary:      'הפקודה המרכזית המסדירה את מס הכנסה בישראל',
      source_url:   'https://www.nevo.co.il/law_html/law01/p221_001.htm',
      scraped_at:   new Date().toISOString(),
    },
    {
      law_id:       'vat-law-1975',
      title:        'חוק מס ערך מוסף, תשל"ו-1975',
      type:         'law',
      status:       'active',
      published_at: '1975-01-01',
      summary:      'חוק המסדיר את מס ערך מוסף בישראל',
      source_url:   'https://www.nevo.co.il/law_html/law01/p062_001.htm',
      scraped_at:   new Date().toISOString(),
    },
    {
      law_id:       'real-estate-taxation-1963',
      title:        'חוק מיסוי מקרקעין (שבח ורכישה), תשכ"ג-1963',
      type:         'law',
      status:       'active',
      published_at: '1963-01-01',
      summary:      'חוק המסדיר מס שבח ומס רכישה במקרקעין',
      source_url:   'https://www.nevo.co.il/law_html/law01/p213_001.htm',
      scraped_at:   new Date().toISOString(),
    },
    {
      law_id:       'companies-ordinance',
      title:        'חוק החברות, תשנ"ט-1999',
      type:         'law',
      status:       'active',
      published_at: '1999-01-01',
      summary:      'החוק המסדיר הקמה, ניהול ופירוק חברות בישראל',
      source_url:   'https://www.nevo.co.il/law_html/law01/L225_001.htm',
      scraped_at:   new Date().toISOString(),
    },
    {
      law_id:       'customs-ordinance',
      title:        'פקודת המכס [נוסח חדש]',
      type:         'law',
      status:       'active',
      published_at: '1937-01-01',
      summary:      'הפקודה המסדירה את מס יבוא וייצוא',
      source_url:   'https://www.nevo.co.il/law_html/law01/p054_001.htm',
      scraped_at:   new Date().toISOString(),
    },
  ]

  await supabase
    .from('scraped_legislation')
    .upsert(TAX_LAWS, { onConflict: 'law_id', ignoreDuplicates: false })
}

function mapBillType(subType: string): 'law' | 'regulation' | 'bill' {
  if (subType.includes('תקנה') || subType.includes('צו')) return 'regulation'
  if (subType.includes('הצעת')) return 'bill'
  return 'law'
}

function parseODataDate(dateStr: string | undefined): string | null {
  if (!dateStr) return null
  // OData format: /Date(1234567890000)/
  const match = dateStr.match(/\/Date\((\d+)\)\//)
  if (match) return new Date(parseInt(match[1])).toISOString().split('T')[0]
  return dateStr
}
