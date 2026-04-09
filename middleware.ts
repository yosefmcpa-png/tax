import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// ============================================================
// Middleware — הגנת נתיבים + רענון session
// ============================================================

const PUBLIC_PATHS = [
  '/login', '/auth/callback', '/api/auth',
  '/demo', '/api/automation/demo',
  '/api/agent/standalone', '/api/history', '/api/scraper',
  '/history', '/dashboard', '/calculator', '/search', '/deadlines', '/report', '/',
]

function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
  return (
    url.startsWith('https://') &&
    !url.includes('placeholder') &&
    url.includes('.supabase.co') &&
    key.length > 20 &&
    !key.includes('placeholder')
  )
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname
  const isPublic = PUBLIC_PATHS.some(p => path === p || (p !== '/' && path.startsWith(p)))

  // Local/demo session — cookie שנקבע ב-client
  const hasLocalSession = request.cookies.has('tax_local_session')

  // אם Supabase לא מוגדר — דלג על כל קריאות ה-auth
  if (!isSupabaseConfigured()) {
    // הפניה לדף login אם אין session כלל ולא נתיב ציבורי
    if (!hasLocalSession && !isPublic) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('redirectTo', path)
      return NextResponse.redirect(url)
    }
    // הפניה מ-login אם כבר יש session
    if (hasLocalSession && path === '/login') {
      const url = request.nextUrl.clone()
      url.pathname = '/demo'
      return NextResponse.redirect(url)
    }
    return NextResponse.next({ request })
  }

  // ── Supabase מוגדר — בדיקת session רגילה ──────────────────
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user && !hasLocalSession && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirectTo', path)
    return NextResponse.redirect(url)
  }

  if ((user || hasLocalSession) && path === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = hasLocalSession ? '/demo' : '/'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
