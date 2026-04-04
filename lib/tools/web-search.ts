import * as cheerio from 'cheerio'

// ============================================================
// Web Search — DuckDuckGo HTML (חינם, ללא API key)
// + חיפוש ממוקד באתרי ממשלה ישראליים
// ============================================================

export interface SearchResult {
  title:   string
  url:     string
  snippet: string
  source:  string
}

// ---- DuckDuckGo HTML Search (ללא API) ----
export async function duckduckgoSearch(
  query: string,
  maxResults = 8
): Promise<SearchResult[]> {
  const encoded = encodeURIComponent(query)
  const url = `https://html.duckduckgo.com/html/?q=${encoded}&kl=il-he`

  const res = await fetch(url, {
    headers: {
      'User-Agent':      'Mozilla/5.0 (compatible; TaxSolver/2.0)',
      'Accept-Language': 'he-IL,he;q=0.9,en;q=0.8',
      'Accept':          'text/html',
    },
    signal: AbortSignal.timeout(10000),
  })

  if (!res.ok) return []

  const html = await res.text()
  const $    = cheerio.load(html)
  const results: SearchResult[] = []

  // DuckDuckGo HTML structure
  $('div.result, div.results_links').each((_, el) => {
    if (results.length >= maxResults) return false

    const titleEl   = $(el).find('a.result__a, h2 a').first()
    const snippetEl = $(el).find('a.result__snippet, div.result__snippet').first()

    const title   = titleEl.text().trim()
    const href    = titleEl.attr('href') ?? ''
    const snippet = snippetEl.text().trim()

    if (!title || !href || href.startsWith('javascript')) return

    // נקה URL של DuckDuckGo redirect
    const cleanUrl = extractRealUrl(href)
    if (!cleanUrl) return

    results.push({
      title,
      url:    cleanUrl,
      snippet,
      source: extractDomain(cleanUrl),
    })
  })

  return results
}

// ---- חיפוש ממוקד באתרי מס ישראליים ----
export async function israeliTaxSearch(query: string): Promise<SearchResult[]> {
  const sites = [
    'site:taxes.gov.il',
    'site:psakdin.co.il',
    'site:knesset.gov.il',
    'site:ica.justice.gov.il',
    'site:nevo.co.il',
  ]

  // חפש ב-DuckDuckGo עם הגבלת אתר
  const allResults: SearchResult[] = []

  for (const site of sites.slice(0, 3)) {  // 3 ראשונים לחסכון
    const results = await duckduckgoSearch(`${query} ${site}`, 3)
    allResults.push(...results)
    if (allResults.length >= 6) break
    await new Promise(r => setTimeout(r, 300))  // throttle
  }

  return allResults
}

// ---- fetch + parse דף ספציפי ----
export async function fetchAndParse(url: string): Promise<{
  title:   string
  content: string
  url:     string
}> {
  const res = await fetch(url, {
    headers: {
      'User-Agent':      'Mozilla/5.0 (compatible; TaxSolver/2.0)',
      'Accept-Language': 'he-IL,he;q=0.9',
    },
    signal: AbortSignal.timeout(12000),
  })

  if (!res.ok) throw new Error(`HTTP ${res.status}`)

  const html = await res.text()
  const $    = cheerio.load(html)

  // הסר תגיות לא רצויות
  $('script, style, nav, footer, header, .menu, .sidebar, [class*="cookie"], [class*="banner"], [class*="popup"]').remove()

  const title   = $('title').text().trim() || $('h1').first().text().trim()

  // נסה למצוא תוכן עיקרי
  const contentEl =
    $('main, article, .content, #content, .main-content, [role="main"]').first()

  const rawText = (contentEl.length ? contentEl : $('body'))
    .text()
    .replace(/\s{3,}/g, '\n\n')
    .replace(/\n{4,}/g, '\n\n')
    .trim()

  // הגבל ל-8000 תווים
  const content = rawText.length > 8000
    ? rawText.substring(0, 8000) + '\n\n[... נחתך]'
    : rawText

  return { title, content, url }
}

// ---- Helpers ----
function extractRealUrl(href: string): string {
  // DuckDuckGo wraps URLs: /l/?uddg=ENCODED_URL
  const match = href.match(/[?&]uddg=([^&]+)/)
  if (match) {
    try { return decodeURIComponent(match[1]) } catch { return '' }
  }
  if (href.startsWith('http')) return href
  return ''
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '')
  } catch {
    return url
  }
}
