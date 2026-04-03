import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

// GET /api/cases/[id] — היסטוריית שיחה מלאה לתיק
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // בדיקת בעלות דרך RLS — Supabase יחזיר null אם לא שייך למשתמש
    const { data: caseData, error: caseError } = await supabase
      .from('cases')
      .select('*')
      .eq('id', id)
      .single()

    if (caseError || !caseData) {
      return NextResponse.json({ error: 'תיק לא נמצא' }, { status: 404 })
    }

    const { data: conversations } = await supabase
      .from('conversations')
      .select('id, role, content, sources, action_type, created_at')
      .eq('case_id', id)
      .order('created_at', { ascending: true })
      .limit(100)

    return NextResponse.json({ case: caseData, conversations: conversations ?? [] })
  } catch (err: unknown) {
    const error = err as Error
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
