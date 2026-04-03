import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
  type GenerateContentRequest,
} from '@google/generative-ai'
import { Source } from '@/types'

// ============================================================
// Gemini Client — SERVER SIDE ONLY
// API Key לעולם לא יגיע לצד הלקוח
// ============================================================

const GEMINI_API_KEY = process.env.GEMINI_API_KEY
if (!GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY is not set in environment variables')
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY)

// הגדרות בטיחות — מחמירות לסביבת עסקי/משפטי
const SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
]

const TEXT_MODEL = 'gemini-2.5-flash-preview-05-20'
const TTS_MODEL  = 'gemini-2.5-flash-preview-tts'

export interface GeminiTextResult {
  text: string
  sources: Source[]
  inputTokens: number
  outputTokens: number
}

// ---- Retry עם exponential backoff ----
async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 4,
  delayMs = 1000
): Promise<T> {
  try {
    return await fn()
  } catch (err: unknown) {
    const error = err as { status?: number; message?: string }
    if (retries > 0 && (error?.status === 429 || error?.status === 503)) {
      await new Promise(r => setTimeout(r, delayMs))
      return withRetry(fn, retries - 1, delayMs * 2)
    }
    throw err
  }
}

// ---- קריאת טקסט רגילה / עם Grounding ----
export async function callGemini(params: {
  systemInstruction: string
  userMessage: string
  history?: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }>
  grounded?: boolean
  jsonMode?: boolean
}): Promise<GeminiTextResult> {
  const { systemInstruction, userMessage, history = [], grounded = false, jsonMode = false } = params

  const model = genAI.getGenerativeModel({
    model: TEXT_MODEL,
    systemInstruction,
    safetySettings: SAFETY_SETTINGS,
    generationConfig: {
      temperature: 0.2,          // נמוך — לדיוק ועקביות
      topP: 0.8,
      maxOutputTokens: 8192,
      ...(jsonMode ? { responseMimeType: 'application/json' } : {}),
    },
  })

  const tools = grounded ? [{ googleSearch: {} } as never] : undefined

  const request: GenerateContentRequest = {
    contents: [
      ...history,
      { role: 'user', parts: [{ text: userMessage }] },
    ],
    ...(tools ? { tools } : {}),
  }

  const result = await withRetry(() => model.generateContent(request))
  const response = result.response

  // חילוץ טוקנים
  const inputTokens  = response.usageMetadata?.promptTokenCount ?? 0
  const outputTokens = response.usageMetadata?.candidatesTokenCount ?? 0

  // בדיקת finish reason
  const finishReason = response.candidates?.[0]?.finishReason
  if (finishReason === 'SAFETY') throw new Error('התגובה נחסמה מטעמי בטיחות.')
  if (finishReason === 'MAX_TOKENS') throw new Error('התגובה נקטעה — המסמך ארוך מדי. נסה לפצל.')

  const text = response.text()

  // חילוץ מקורות מ-Grounding
  const sources: Source[] = []
  const groundingMeta = response.candidates?.[0]?.groundingMetadata
  if (grounded && groundingMeta) {
    const chunks = (groundingMeta as unknown as {
      groundingChunks?: Array<{ web?: { uri?: string; title?: string } }>
    }).groundingChunks ?? []

    chunks.forEach(chunk => {
      if (chunk.web?.uri && chunk.web?.title) {
        sources.push({ uri: chunk.web.uri, title: chunk.web.title })
      }
    })
  }

  return { text, sources, inputTokens, outputTokens }
}

// ---- TTS ----
export async function callGeminiTTS(text: string): Promise<{
  audioData: string
  mimeType: string
}> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${TTS_MODEL}:generateContent?key=${GEMINI_API_KEY}`

  const payload = {
    contents: [{ parts: [{ text: `אנא קרא את הטקסט הבא בעברית בצורה ברורה ומקצועית:\n\n${text}` }] }],
    generationConfig: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
      },
    },
  }

  const res = await withRetry(() =>
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(r => r.json())
  )

  const audioData = res.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data
  const mimeType  = res.candidates?.[0]?.content?.parts?.[0]?.inlineData?.mimeType

  if (!audioData) throw new Error('לא התקבל אודיו מהשרת.')
  return { audioData, mimeType: mimeType ?? 'audio/L16;rate=24000' }
}
