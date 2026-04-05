import { anthropic, CLAUDE_MODEL } from './client'
import { duckduckgoSearch, israeliTaxSearch, fetchAndParse } from '@/lib/tools/web-search'
import { createAdminSupabaseClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

// ============================================================
// Multi-Agent Pipeline — 4 סוכנים בסדרה
//
// 1. RESEARCHER  — מחפש רשת + DB, אוסף עובדות גולמיות
// 2. ANALYST     — מנתח ממצאים, מזהה סוגיות משפטיות
// 3. RISK        — מעריך סיכונים ומדרג אותם
// 4. REPORTER    — כותב דוח מקצועי מלא
// ============================================================

export interface PipelineStage {
  id:        'research' | 'analysis' | 'risk' | 'report'
  label:     string
  status:    'pending' | 'running' | 'done' | 'error'
  output?:   string
  startedAt?: string
  endedAt?:   string
  error?:    string
  toolCalls: string[]   // לוג של כלים שנקראו
}

export interface PipelineRun {
  id:        string
  input:     string
  stages:    PipelineStage[]
  status:    'running' | 'done' | 'error'
  report?:   string
  sources:   { uri: string; title: string }[]
  startedAt: string
  endedAt?:  string
}

export type PipelineCallback = (run: PipelineRun) => void

// ── כלי Pipeline (subset מלא) ──────────────────────────────
const PIPELINE_TOOLS: Anthropic.Tool[] = [
  {
    name: 'web_search',
    description: 'חפש מידע עדכני בכל האינטרנט.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query:      { type: 'string' },
        focus_tax:  { type: 'boolean' },
      },
      required: ['query'],
    },
  },
  {
    name: 'fetch_page',
    description: 'קרא תוכן מלא של דף אינטרנט.',
    input_schema: {
      type: 'object' as const,
      properties: { url: { type: 'string' } },
      required: ['url'],
    },
  },
  {
    name: 'search_court_cases',
    description: 'חפש פסקי דין במאגר המקומי.',
    input_schema: {
      type: 'object' as const,
      properties: { query: { type: 'string' }, limit: { type: 'number' } },
      required: ['query'],
    },
  },
  {
    name: 'search_tax_rulings',
    description: 'חפש חוזרי מס במאגר המקומי.',
    input_schema: {
      type: 'object' as const,
      properties: { query: { type: 'string' }, limit: { type: 'number' } },
      required: ['query'],
    },
  },
  {
    name: 'search_legislation',
    description: 'חפש חקיקה ישראלית.',
    input_schema: {
      type: 'object' as const,
      properties: { query: { type: 'string' }, limit: { type: 'number' } },
      required: ['query'],
    },
  },
]

// ── ביצוע כלי ────────────────────────────────────────────��─
async function runTool(
  name:  string,
  input: Record<string, unknown>,
  sources: { uri: string; title: string }[],
  toolLog: string[]
): Promise<string> {
  const supabase = createAdminSupabaseClient()

  try {
    switch (name) {
      case 'web_search': {
        const q    = input.query as string
        const tax  = input.focus_tax as boolean ?? false
        toolLog.push(`🌐 web_search: "${q}"${tax ? ' [tax sites]' : ''}`)
        const results = tax ? await israeliTaxSearch(q) : await duckduckgoSearch(q, 6)
        if (!results.length) return 'לא נמצאו תוצאות.'
        results.forEach(r => sources.push({ uri: r.url, title: r.title }))
        return results.map((r, i) => `[${i+1}] ${r.title}\n${r.url}\n${r.snippet}`).join('\n\n')
      }
      case 'fetch_page': {
        const url = input.url as string
        toolLog.push(`📄 fetch_page: ${url}`)
        const { title, content } = await fetchAndParse(url)
        sources.push({ uri: url, title })
        return `${title}\n\n${content}`
      }
      case 'search_court_cases': {
        toolLog.push(`🏛️ search_court_cases: "${input.query}"`)
        const { data } = await supabase
          .from('scraped_court_cases')
          .select('case_number,title,court,decision_date,summary,outcome')
          .ilike('summary', `%${input.query}%`)
          .limit((input.limit as number) ?? 5)
        return data?.length ? JSON.stringify(data, null, 2) : 'לא נמצא במאגר — נסה web_search.'
      }
      case 'search_tax_rulings': {
        toolLog.push(`📋 search_tax_rulings: "${input.query}"`)
        const { data } = await supabase
          .from('scraped_tax_rulings')
          .select('ruling_number,title,summary,date_issued,category')
          .ilike('title', `%${input.query}%`)
          .limit((input.limit as number) ?? 5)
        return data?.length ? JSON.stringify(data, null, 2) : 'לא נמצא במאגר — נסה web_search.'
      }
      case 'search_legislation': {
        toolLog.push(`⚖️ search_legislation: "${input.query}"`)
        const { data } = await supabase
          .from('scraped_legislation')
          .select('law_id,title,type,status,published_at,summary,source_url')
          .ilike('title', `%${input.query}%`)
          .limit((input.limit as number) ?? 5)
        return data?.length ? JSON.stringify(data, null, 2) : 'לא נמצא במאגר.'
      }
      default:
        return `כלי לא מוכר: ${name}`
    }
  } catch (err) {
    return `שגיאה: ${(err as Error).message}`
  }
}

// ── סוכן יחיד עם tool loop ─────────────────────────────────
async function runAgent(
  system:      string,
  userMessage: string,
  sources:     { uri: string; title: string }[],
  toolLog:     string[],
  useTools =   true,
  maxCalls =   12
): Promise<string> {
  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: userMessage }
  ]

  let callCount = 0
  let finalText = ''

  while (true) {
    const response = await anthropic.messages.create({
      model:      CLAUDE_MODEL,
      max_tokens: 8000,
      system,
      messages,
      thinking:   { type: 'adaptive' },
      ...(useTools ? { tools: PIPELINE_TOOLS } : {}),
    } as Anthropic.MessageCreateParamsNonStreaming)

    for (const b of response.content) {
      if (b.type === 'text') finalText = b.text
    }

    if (response.stop_reason !== 'tool_use' || callCount >= maxCalls) break

    messages.push({ role: 'assistant', content: response.content })

    const results: Anthropic.ToolResultBlockParam[] = []
    for (const b of response.content) {
      if (b.type === 'tool_use') {
        callCount++
        const out = await runTool(b.name, b.input as Record<string, unknown>, sources, toolLog)
        results.push({ type: 'tool_result', tool_use_id: b.id, content: out })
      }
    }
    messages.push({ role: 'user', content: results })
  }

  return finalText
}

// ── Pipeline ראשי ──────────────────────────────────────────
export async function runPipeline(
  input:      string,
  onUpdate:   PipelineCallback
): Promise<PipelineRun> {

  const run: PipelineRun = {
    id:        crypto.randomUUID(),
    input,
    status:    'running',
    startedAt: new Date().toISOString(),
    sources:   [],
    stages: [
      { id: 'research',  label: '🔍 מחקר וחיפוש',        status: 'pending', toolCalls: [] },
      { id: 'analysis',  label: '🧠 ניתוח משפטי',         status: 'pending', toolCalls: [] },
      { id: 'risk',      label: '⚠️  הערכת סיכונים',       status: 'pending', toolCalls: [] },
      { id: 'report',    label: '📋 עריכת דוח סופי',       status: 'pending', toolCalls: [] },
    ],
  }

  const update = (idx: number, patch: Partial<PipelineStage>) => {
    run.stages[idx] = { ...run.stages[idx], ...patch }
    onUpdate({ ...run, stages: [...run.stages] })
  }

  try {

    // ══════════════════════════════════════════════════
    // שלב 1 — RESEARCHER
    // ══════════════════════════════════════════════════
    update(0, { status: 'running', startedAt: new Date().toISOString() })

    const researchOut = await runAgent(
      `אתה סוכן מחקר בכיר. תפקידך: לאסוף כמה שיותר עובדות ומקורות רלוונטיים.
חובה להשתמש בכלי חיפוש לפני כל תשובה. חפש:
1. web_search עם focus_tax: true — חפש באתרי מס ישראליים
2. web_search כללי — חפש מידע נוסף
3. search_court_cases — חפש פסיקה רלוונטית
4. search_tax_rulings — חפש חוזרי מס
5. search_legislation — חפש חקיקה
6. fetch_page — קרא מסמכים שנמצאו

החזר: כל העובדות הגולמיות שמצאת, עם ציטוט מקור לכל אחת.`,
      `בצע מחקר מקיף על הנושא הבא:\n\n${input}`,
      run.sources,
      run.stages[0].toolCalls,
      true,
      15
    )

    update(0, {
      status: 'done',
      output: researchOut,
      endedAt: new Date().toISOString(),
    })

    // ══════════════════════════════════════════════════
    // שלב 2 — ANALYST
    // ══════════════════════════════════════════════════
    update(1, { status: 'running', startedAt: new Date().toISOString() })

    const analysisOut = await runAgent(
      `אתה משפטן מומחה למיסוי ישראלי.
קיבלת ממצאי מחקר גולמיים. נתח אותם לעומק:
- זהה את הסוגיות המשפטיות המרכזיות
- מפה את סעיפי החוק הרלוונטיים
- הצלב עם פסיקה קיימת
- זהה סתירות ופערים
- הסבר את המצב המשפטי הנוכחי

אם צריך מידע נוסף — השתמש בכלי החיפוש.
כתוב ניתוח מקצועי מלא בעברית.`,
      `נתח את ממצאי המחקר הבאים:\n\n${researchOut}`,
      run.sources,
      run.stages[1].toolCalls,
      true,
      6
    )

    update(1, {
      status: 'done',
      output: analysisOut,
      endedAt: new Date().toISOString(),
    })

    // ══════════════════════════════════════════════════
    // שלב 3 — RISK ASSESSOR
    // ══════════════════════════════════════════════════
    update(2, { status: 'running', startedAt: new Date().toISOString() })

    const riskOut = await runAgent(
      `אתה מומחה לניהול סיכוני מס.
קיבלת ניתוח משפטי. הערך סיכונים:
- דרג כל סיכון: 🔴 גבוה | 🟡 בינוני | 🟢 נמוך
- ציין תאריכי יעד קריטיים
- זהה פעולות מיידיות נדרשות
- הצג הזדמנויות חיסכון לגיטימיות
- השתמש בכלי חיפוש לאימות עמדות רשות המיסים

פורמט: טבלת סיכונים + רשימת פעולות ממוספרת.`,
      `הערך סיכונים על בסיס הניתוח הבא:\n\n${analysisOut}`,
      run.sources,
      run.stages[2].toolCalls,
      true,
      4
    )

    update(2, {
      status: 'done',
      output: riskOut,
      endedAt: new Date().toISOString(),
    })

    // ══════════════════════════════════════════════════
    // שלב 4 — REPORT WRITER
    // ══════════════════════════════════════════════════
    update(3, { status: 'running', startedAt: new Date().toISOString() })

    const reportOut = await runAgent(
      `אתה עורך דוחות מקצועיים בכיר.
קיבלת מחקר, ניתוח, והערכת סיכונים. כתוב דוח מקצועי מלא:

## מבנה חובה:
# דוח מקצועי — [כותרת מתאימה]
**תאריך:** ${new Date().toLocaleDateString('he-IL')}

## א. תקציר מנהלים (3-4 שורות)
## ב. ממצאי מחקר [עם ציטוטים]
## ג. ניתוח משפטי
## ד. הערכת סיכונים
| # | סיכון | דירוג | המלצה |
## ה. המלצות ופעולות מיידיות
(ממוספרות, עם תאריכי יעד)
## ו. הזדמנויות תכנון מס לגיטימיות
## ז. מקורות ואסמכתאות

---
⚠️ *דוח זה הוא כלי מחקר בלבד ואינו תחליף לייעוץ משפטי מוסמך.*`,
      `כתוב דוח מקצועי מלא על בסיס:

## מחקר גולמי:
${researchOut}

## ניתוח משפטי:
${analysisOut}

## הערכת סיכונים:
${riskOut}`,
      run.sources,
      run.stages[3].toolCalls,
      false,   // Report writer לא צריך tools
      0
    )

    update(3, {
      status: 'done',
      output: reportOut,
      endedAt: new Date().toISOString(),
    })

    run.report  = reportOut
    run.status  = 'done'
    run.endedAt = new Date().toISOString()
    onUpdate({ ...run })
    return run

  } catch (err) {
    const errMsg = (err as Error).message
    const failIdx = run.stages.findIndex(s => s.status === 'running')
    if (failIdx !== -1) {
      update(failIdx, { status: 'error', error: errMsg, endedAt: new Date().toISOString() })
    }
    run.status  = 'error'
    run.endedAt = new Date().toISOString()
    onUpdate({ ...run })
    return run
  }
}
