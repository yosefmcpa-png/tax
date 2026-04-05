# Tax Solver — Claude Code Context

## מה האפליקציה
פלטפורמת Enterprise למחקר מס ישראלי. סוכני AI אוטונומיים שמחפשים ברשת ובמאגרי נתונים
ממשלתיים ומייצרים דוחות מקצועיים.

## Stack
- **Framework**: Next.js 15 App Router, TypeScript strict
- **AI**: Claude API (claude-opus-4-6) — `lib/claude/`
- **DB**: Supabase PostgreSQL + Auth + RLS
- **Rate Limiting**: Upstash Redis
- **WhatsApp**: Twilio
- **UI**: Tailwind CSS, RTL Hebrew, dark theme

## ארכיטקטורה — קבצים חשובים
```
lib/claude/
  client.ts     — Anthropic SDK client, callClaude, callClaudeStream
  agent.ts      — Agentic loop עם 7 כלים (web_search, fetch_page, 4x DB)
  pipeline.ts   — 4-agent pipeline: Research→Analysis→Risk→Report
  prompts.ts    — System prompts לכל 16 סוגי פעולות
  chunker.ts    — Map-reduce למסמכים גדולים

lib/tools/
  web-search.ts — DuckDuckGo חינם + israeliTaxSearch + fetchAndParse

lib/scrapers/
  companies.ts  — רשם החברות (data.gov.il API)
  legislation.ts— Knesset API + חוקי מס
  court-cases.ts— פסקי דין
  tax-rulings.ts— חוזרי מס רשות המיסים

app/api/
  agent/stream/route.ts    — SSE streaming לצ'אט
  agent/pipeline/route.ts  — SSE pipeline 4 סוכנים
  cron/sync/route.ts       — Vercel Cron לסנכרון DB
  whatsapp/route.ts        — Twilio webhook
```

## כללי קוד חשובים
1. **אל תשנה lib/gemini/** — קבצים ישנים, לא בשימוש
2. **API routes** חייבים auth + rate limit לפני כל פעולה
3. **DB writes** — תמיד דרך adminClient (service role), קריאות דרך serverClient
4. **Streaming** — כל תגובת AI מגיעה דרך SSE (text/event-stream)
5. **Hebrew RTL** — כל UI בעברית, dir="rtl" ב-layout
6. **Type safety** — ActionType נמצא ב-types/index.ts, לא להמציא

## ENV variables נדרשים
```
ANTHROPIC_API_KEY
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
NEXT_PUBLIC_APP_URL
```

## הפעלה מקומית
```bash
cp .env.example .env.local   # מלא מפתחות
npm install
# הרץ schema.sql + schema_v2.sql ב-Supabase SQL Editor
npm run dev                  # http://localhost:3000
```

## Branch
claude/hebrew-tax-calculator-ZxcUv
