import { NextResponse } from 'next/server'

// ============================================================
// GET /api/health — בדיקת חיבורים לכל השירותים
// ============================================================

export async function GET() {
  const checks: Record<string, { ok: boolean; msg: string }> = {}

  // Claude API
  checks.claude = process.env.ANTHROPIC_API_KEY?.startsWith('sk-ant')
    ? { ok: true,  msg: 'מחובר' }
    : { ok: false, msg: 'ANTHROPIC_API_KEY חסר' }

  // Supabase
  checks.supabase = (
    !!process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('.supabase.co') &&
    (process.env.SUPABASE_SERVICE_ROLE_KEY?.length ?? 0) > 20
  )
    ? { ok: true,  msg: 'מחובר' }
    : { ok: false, msg: 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY חסרים' }

  // Upstash Redis
  checks.redis = process.env.UPSTASH_REDIS_REST_URL?.includes('upstash.io')
    ? { ok: true,  msg: 'מחובר' }
    : { ok: false, msg: 'UPSTASH_REDIS_REST_URL חסר' }

  // Twilio WhatsApp (אופציונלי)
  checks.whatsapp = process.env.TWILIO_ACCOUNT_SID?.startsWith('AC')
    ? { ok: true,  msg: 'מחובר' }
    : { ok: false, msg: 'לא מוגדר (אופציונלי)' }

  const allCritical = checks.claude.ok && checks.supabase.ok && checks.redis.ok
  const ready = allCritical

  // DB record counts (רק אם Supabase מחובר)
  const db: Record<string, number> = {}
  if (checks.supabase.ok) {
    try {
      const { createAdminSupabaseClient } = await import('@/lib/supabase/server')
      const admin = createAdminSupabaseClient()
      const [co, le, ca, ru] = await Promise.all([
        admin.from('scraped_companies').select('*', { count: 'exact', head: true }),
        admin.from('scraped_legislation').select('*', { count: 'exact', head: true }),
        admin.from('scraped_court_cases').select('*', { count: 'exact', head: true }),
        admin.from('scraped_tax_rulings').select('*', { count: 'exact', head: true }),
      ])
      db.companies   = co.count  ?? 0
      db.legislation = le.count  ?? 0
      db.court_cases = ca.count  ?? 0
      db.tax_rulings = ru.count  ?? 0
    } catch { /* DB not yet migrated */ }
  }

  return NextResponse.json({ ready, checks, db, timestamp: new Date().toISOString() }, {
    status: ready ? 200 : 503,
  })
}
