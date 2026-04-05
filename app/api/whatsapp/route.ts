import { NextRequest, NextResponse } from 'next/server'
import twilio from 'twilio'
import { runClaudeAgent } from '@/lib/claude/agent'
import { MASTER_SYSTEM_PROMPT } from '@/lib/claude/prompts'
import { createAdminSupabaseClient } from '@/lib/supabase/server'

// ============================================================
// POST /api/whatsapp — Twilio WhatsApp Webhook
//
// 1. הגדר ב-Twilio Console: Webhook URL = https://yourdomain.com/api/whatsapp
// 2. שמור TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_NUMBER
// ============================================================

// אימות חתימת Twilio (מונע זיוף בקשות)
function validateTwilioSignature(req: NextRequest, body: string): boolean {
  const accountSid  = process.env.TWILIO_ACCOUNT_SID
  const authToken   = process.env.TWILIO_AUTH_TOKEN
  if (!accountSid || !authToken) return false

  const signature = req.headers.get('X-Twilio-Signature') ?? ''
  const url = `${process.env.NEXT_PUBLIC_APP_URL}/api/whatsapp`

  return twilio.validateRequest(authToken, signature, url, Object.fromEntries(
    new URLSearchParams(body)
  ))
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.text()

    // אמת חתימה (בprod בלבד)
    if (process.env.NODE_ENV === 'production') {
      if (!validateTwilioSignature(req, body)) {
        return new NextResponse('Unauthorized', { status: 403 })
      }
    }

    const params  = new URLSearchParams(body)
    const from    = params.get('From')    ?? ''   // whatsapp:+972501234567
    const message = params.get('Body')    ?? ''
    const mediaUrl = params.get('MediaUrl0')    // קובץ מצורף (PDF)

    if (!from || !message.trim()) {
      return twimlResponse('נא לשלוח הודעה טקסטואלית.')
    }

    // מספר טלפון כ-ID משתמש ב-WhatsApp
    const phoneNumber = from.replace('whatsapp:', '')

    // בדוק rate limit (3 שאלות/דקה לכל מספר)
    const supabase = createAdminSupabaseClient()
    const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString()
    const { count } = await supabase
      .from('whatsapp_messages')
      .select('id', { count: 'exact' })
      .eq('phone_number', phoneNumber)
      .gte('created_at', oneMinuteAgo)

    if ((count ?? 0) >= 3) {
      return twimlResponse('⚠️ יותר מדי שאלות. נסה שוב בעוד דקה.')
    }

    // שמור הודעה נכנסת
    await supabase.from('whatsapp_messages').insert({
      phone_number: phoneNumber,
      direction:    'inbound',
      message:      message.substring(0, 1000),
      created_at:   new Date().toISOString(),
    })

    // בנה היסטוריית שיחה (5 הודעות אחרונות)
    const { data: history } = await supabase
      .from('whatsapp_messages')
      .select('direction, message')
      .eq('phone_number', phoneNumber)
      .order('created_at', { ascending: false })
      .limit(10)

    const chatHistory = (history ?? [])
      .reverse()
      .slice(0, -1)
      .map((h: { direction: string; message: string }) => ({
        role:    h.direction === 'inbound' ? 'user' as const : 'assistant' as const,
        content: h.message,
      }))

    // הפעל Claude Agent
    const whatsappSystem = `${MASTER_SYSTEM_PROMPT}

## ערוץ: WhatsApp
תגובות חייבות להיות:
- קצרות: מקסימום 300 מילה
- ללא Markdown כבד (אין #, **, _)
- נקיות ועם שורות חדשות
- תמיד לסיים ב: "לפרטים נוספים, שאל אותי!"`

    const { text } = await runClaudeAgent({
      systemInstruction: whatsappSystem,
      userMessage:       mediaUrl
        ? `קיבלתי קובץ מצורף: ${mediaUrl}\n\nשאלה: ${message}`
        : message,
      history:     chatHistory,
      useThinking: false,  // WhatsApp — מהיר יותר ללא thinking
      maxToolCalls: 3,
    })

    const reply = text.substring(0, 1500) // Twilio מגביל 1600 תווים

    // שמור תגובה
    await supabase.from('whatsapp_messages').insert({
      phone_number: phoneNumber,
      direction:    'outbound',
      message:      reply,
      created_at:   new Date().toISOString(),
    })

    return twimlResponse(reply)

  } catch (err) {
    console.error('[WhatsApp] Error:', err)
    return twimlResponse('אירעה שגיאה. נסה שוב.')
  }
}

// פורמט TwiML — מה ש-Twilio מבין
function twimlResponse(message: string): NextResponse {
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${escapeXml(message)}</Message>
</Response>`

  return new NextResponse(twiml, {
    status: 200,
    headers: { 'Content-Type': 'text/xml; charset=utf-8' },
  })
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
