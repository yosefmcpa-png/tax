import { NextRequest } from 'next/server'
import { israeliTaxSearch, duckduckgoSearch, fetchAndParse } from '@/lib/tools/web-search'
import { checkRateLimit, saveConversation, createCase } from '@/lib/db/sqlite'
import { searchKnowledge } from '@/lib/tax/knowledge'

/**
 * POST /api/agent/standalone
 * ===========================
 * Chat endpoint — ללא Supabase, ללא Redis, ללא Claude API
 * מחפש ברשת (DuckDuckGo) ומחזיר תגובה מבוססת-נתונים
 */

const enc = new TextEncoder()
const sse = (d: object) => enc.encode(`data: ${JSON.stringify(d)}\n\n`)

export async function POST(req: NextRequest) {
  const stream = new ReadableStream({
    async start(ctrl) {
      const send = (d: object) => { try { ctrl.enqueue(sse(d)) } catch { /* closed */ } }

      try {
        const ip = req.headers.get('x-forwarded-for') ?? 'local'
        if (!checkRateLimit(`chat:${ip}`, 30, 60_000)) {
          send({ error: 'Rate limit — נסה בעוד דקה', done: true })
          ctrl.close(); return
        }

        const { query, caseId: existingCaseId } = await req.json() as {
          query: string
          caseId?: string
        }
        if (!query?.trim()) {
          send({ error: 'חסר קלט', done: true }); ctrl.close(); return
        }

        // Create/reuse local case
        const caseId = existingCaseId ?? createCase(query.substring(0, 80)).id
        send({ caseId })

        // Step 1 — local knowledge base (instant, no network)
        send({ toolCall: '📚 בודק מאגר ידע מקומי...' })
        const knowledgeHits = searchKnowledge(query)

        // Step 2 — web search
        send({ toolCall: '🌐 מחפש ברשת...' })
        let results: Array<{ title: string; url: string; snippet: string }> = []
        try {
          results = await israeliTaxSearch(query)
          if (results.length === 0) results = await duckduckgoSearch(query + ' מס ישראל')
        } catch { /* no network */ }

        // Step 3 — fetch top result
        let fullPageText = ''
        if (results[0]?.url) {
          send({ toolCall: `📄 קורא: ${results[0].title.substring(0, 50)}...` })
          try {
            const parsed = await fetchAndParse(results[0].url)
            fullPageText = parsed.content
          } catch { /* skip */ }
        }

        send({ toolCall: '🧠 מנתח ומעבד...' })

        // Step 4 — build answer (knowledge base + web results)
        const answer = buildAnswer(query, results, fullPageText, knowledgeHits)

        // Emit token-by-token for smooth UX
        const words = answer.split(' ')
        for (let i = 0; i < words.length; i += 6) {
          const chunk = words.slice(i, i + 6).join(' ') + ' '
          send({ text: chunk })
          await sleep(25)
        }

        // Save to SQLite
        saveConversation({ caseId, role: 'user', content: query })
        saveConversation({
          caseId,
          role: 'model',
          content: answer,
          actionType: 'standalone:chat',
        })

        send({
          done: true,
          sources: results.slice(0, 5),
          caseId,
        })
        ctrl.close()

      } catch (err: unknown) {
        send({ error: (err as Error).message, done: true })
        ctrl.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type':      'text/event-stream',
      'Cache-Control':     'no-cache, no-transform',
      'Connection':        'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}

// ── Answer builder ──────────────────────────────────────────

function buildAnswer(
  query: string,
  results: Array<{ title: string; url: string; snippet: string }>,
  fullPage: string,
  knowledgeHits: import('@/lib/tax/knowledge').KnowledgeEntry[] = [],
): string {

  const sections: string[] = []
  sections.push(`## ${query}\n`)

  // Local knowledge base — always first, most reliable
  if (knowledgeHits.length > 0) {
    const top = knowledgeHits[0]
    sections.push(`### ${top.title}\n${top.content}\n\n*מקור: ${top.source}*\n`)
    if (knowledgeHits.length > 1) {
      sections.push('### נושאים קשורים\n')
      knowledgeHits.slice(1, 3).forEach(h => {
        sections.push(`**${h.title}**\n${h.content.split('\n')[0]}\n`)
      })
    }
  }

  // Nothing found anywhere
  if (results.length === 0 && !fullPage && knowledgeHits.length === 0) {
    sections.push('לא נמצא מידע ספציפי לשאלה זו.\n\n**המלצה:** נסח מחדש את השאלה עם מילות מפתח כמו: מס שבח, מס הכנסה, מע"מ, עצמאי, שומה.\n\nלניתוח מעמיק יותר: /demo → Pipeline מלא.')
    return sections.join('\n')
  }

  // From full page
  if (fullPage && fullPage.length > 200) {
    const excerpt = fullPage.substring(0, 800).trim()
    sections.push(`\n### מהמקור ברשת\n${excerpt}...\n`)
  }

  // From search snippets
  if (results.length > 0) {
    sections.push('\n### מקורות מהרשת\n')
    for (const r of results.slice(0, 4)) {
      sections.push(`**${r.title}**\n${r.snippet}\n`)
    }
  }

  // Tax-specific insight
  const insight = generateInsight(query)
  if (insight) sections.push(`\n### ניתוח מקצועי\n${insight}`)

  sections.push('\n---\n*מידע זה נאסף ברשת בזמן אמת. מומלץ לאמת מול רואה חשבון מוסמך.*')
  return sections.join('\n')
}

function generateInsight(query: string): string {
  if (/מס שבח|מכירת דירה/.test(query))
    return 'מכירת דירת מגורים עשויה להיות פטורה ממס שבח בתנאים מסוימים (סעיף 49ב לחוק מיסוי מקרקעין). הפטור מותנה בכך שהדירה שימשה מגורים וכי לא מכרת דירה אחרת בפטור בארבע השנים האחרונות.'
  if (/מע"מ|מס ערך מוסף/.test(query))
    return 'שיעור מע"מ בישראל הוא 17%. עסק שמחזורו עולה על 120,000 ₪ בשנה חייב ברישום כעוסק מורשה. ניתן לנכות מס תשומות על רכישות לצורכי העסק.'
  if (/מס הכנסה|שומה|פקיד/.test(query))
    return 'ניתן לערער על שומה שהוציא פקיד השומה בתוך 30 יום מיום קבלתה. הערעור מוגש לפקיד השומה עצמו תחילה (השגה), ולאחר מכן לבית המשפט המחוזי.'
  if (/עצמאי|עסק עצמאי/.test(query))
    return 'עצמאי רשאי לנכות הוצאות עסקיות מוכרות: משרד, רכב, ביטוח מקצועי, הוצאות שיווק ועוד. חשוב לשמור קבלות ותיעוד. הפקדה לפנסיה מוכרת עד 16% מההכנסה החייבת.'
  if (/חברה|בע"מ|דיבידנד/.test(query))
    return 'מס חברות בישראל עומד על 23%. חלוקת דיבידנד לבעל מניות מהותי חייבת ב-30% מס (בעל שליטה). יש לבחון את מבנה השכר מול הדיבידנד לאופטימיזציה.'
  if (/ביטוח לאומי/.test(query))
    return 'עצמאים משלמים ביטוח לאומי בשני מסלולים: 9.82% עד מחצית השכר הממוצע ו-16.5% מעל. ניתן לתבוע גמלאות נכות, אמהות ואבהות כעצמאים.'
  return ''
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
