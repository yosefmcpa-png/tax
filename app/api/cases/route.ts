import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase/server'

// ============================================================
// /api/cases — ניהול תיקים
// ============================================================

// GET /api/cases — כל התיקים של המשתמש
export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: cases, error } = await supabase
      .from('cases')
      .select(`
        id, title, status, case_type, created_at, updated_at,
        conversations(count)
      `)
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(50)

    if (error) throw error

    return NextResponse.json({ cases })
  } catch (err: unknown) {
    const error = err as Error
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE /api/cases?id=xxx — מחיקת תיק
export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const caseId = req.nextUrl.searchParams.get('id')
    if (!caseId) return NextResponse.json({ error: 'חסר מזהה תיק' }, { status: 400 })

    const adminClient = createAdminSupabaseClient()

    // וודא בעלות לפני מחיקה
    const { data: caseData } = await adminClient
      .from('cases')
      .select('id')
      .eq('id', caseId)
      .eq('user_id', user.id)
      .single()

    if (!caseData) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    // CASCADE DELETE ימחק conversations ו-documents אוטומטית
    await adminClient.from('cases').delete().eq('id', caseId)

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const error = err as Error
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
