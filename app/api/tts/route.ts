import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { callGeminiTTS } from '@/lib/gemini/client'
import { ttsRatelimit } from '@/lib/agent/ratelimit'

// POST /api/tts — Text-to-Speech מאובטח
export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Rate limit מחמיר יותר ל-TTS
    const { success } = await ttsRatelimit.limit(user.id)
    if (!success) {
      return NextResponse.json({ error: 'יותר מדי בקשות TTS. נסה שוב בעוד דקה.' }, { status: 429 })
    }

    const { text } = await req.json()
    if (!text || typeof text !== 'string' || text.length > 5000) {
      return NextResponse.json({ error: 'טקסט לא תקין (מקסימום 5,000 תווים)' }, { status: 400 })
    }

    const { audioData, mimeType } = await callGeminiTTS(text)

    return NextResponse.json({ audioData, mimeType })
  } catch (err: unknown) {
    const error = err as Error
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
