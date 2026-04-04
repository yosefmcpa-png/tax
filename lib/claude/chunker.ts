import { callClaude } from './client'
import { MASTER_SYSTEM_PROMPT } from './prompts'

// ============================================================
// Map-Reduce Document Chunker — Claude API
// מסמכים גדולים מעל 5000 מילים מפוצלים לחלקים
// ============================================================

const CHUNK_WORDS     = 5000
const OVERLAP_WORDS   = 200
const MAX_CHUNKS      = 8

export interface ProcessedDocument {
  processedText: string
  chunkCount:    number
  originalWords: number
}

export async function processDocument(text: string): Promise<ProcessedDocument> {
  const words = text.split(/\s+/)

  if (words.length <= CHUNK_WORDS) {
    return { processedText: text, chunkCount: 1, originalWords: words.length }
  }

  // ── MAP: פצל לחלקים ועבד כל חלק בנפרד ────────────────────
  const chunks = splitIntoChunks(words, CHUNK_WORDS, OVERLAP_WORDS)
  const limitedChunks = chunks.slice(0, MAX_CHUNKS)

  console.log(`[Chunker] Processing ${limitedChunks.length} chunks (${words.length} words total)`)

  const summaries = await Promise.all(
    limitedChunks.map((chunk, i) =>
      callClaude({
        systemInstruction: `${MASTER_SYSTEM_PROMPT}\n\nמשימה: סכם את החלק הבא בצורה מדויקת ותמציתית. שמור על כל הנתונים המספריים, תאריכים, שמות, וסעיפי חוק.`,
        userMessage:       `חלק ${i + 1} מתוך ${limitedChunks.length}:\n\n${chunk}`,
        useThinking:       false,  // סיכום — מהיר
        useWebSearch:      false,
      }).then(r => r.text).catch(() => `[שגיאה בעיבוד חלק ${i + 1}]`)
    )
  )

  // ── REDUCE: מזג את כל הסיכומים לסיכום אחד ─────────────────
  const mergePrompt = summaries
    .map((s, i) => `## חלק ${i + 1}\n${s}`)
    .join('\n\n---\n\n')

  const { text: mergedText } = await callClaude({
    systemInstruction: `${MASTER_SYSTEM_PROMPT}\n\nמשימה: מזג את כל סיכומי החלקים לניתוח מקיף ואחיד. הסר חזרות, שמור על הרצף הלוגי.`,
    userMessage:       `מזג את הסיכומים הבאים:\n\n${mergePrompt}`,
    useThinking:       true,
    useWebSearch:      false,
  })

  return {
    processedText: mergedText,
    chunkCount:    limitedChunks.length,
    originalWords: words.length,
  }
}

function splitIntoChunks(words: string[], chunkSize: number, overlap: number): string[] {
  const chunks: string[] = []
  let start = 0

  while (start < words.length) {
    const end = Math.min(start + chunkSize, words.length)
    chunks.push(words.slice(start, end).join(' '))
    start += chunkSize - overlap
    if (start >= words.length) break
  }

  return chunks
}
