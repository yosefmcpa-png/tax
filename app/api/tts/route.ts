import { NextResponse } from 'next/server'

// TTS הוסר — השתמש ב-Web Speech API בצד הלקוח:
// window.speechSynthesis.speak(new SpeechSynthesisUtterance(text))
export async function POST() {
  return NextResponse.json(
    { error: 'TTS זמין ישירות בדפדפן דרך window.speechSynthesis' },
    { status: 501 }
  )
}
