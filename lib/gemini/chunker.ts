import { callGemini } from './client'

// ============================================================
// Smart Document Chunker — Map-Reduce לטיפול במסמכים ארוכים
// ============================================================

const MAX_WORDS_PER_CHUNK = 5000   // ~6,500 tokens — בטוח מתחת ל-32K
const OVERLAP_WORDS       = 300    // חפיפה לשמירת הקשר בין chunks

export interface ChunkResult {
  processedText: string
  chunkCount: number
  totalWords: number
}

function splitToChunks(text: string): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const chunks: string[] = []

  for (let i = 0; i < words.length; i += MAX_WORDS_PER_CHUNK - OVERLAP_WORDS) {
    chunks.push(words.slice(i, i + MAX_WORDS_PER_CHUNK).join(' '))
    if (i + MAX_WORDS_PER_CHUNK >= words.length) break
  }

  return chunks
}

export async function processDocument(text: string): Promise<ChunkResult> {
  const words = text.split(/\s+/).filter(Boolean)
  const totalWords = words.length

  // מסמך קצר — עבד ישירות
  if (totalWords <= MAX_WORDS_PER_CHUNK) {
    return { processedText: text, chunkCount: 1, totalWords }
  }

  const chunks = splitToChunks(text)
  console.log(`[Chunker] Document split into ${chunks.length} chunks (${totalWords} words total)`)

  // ---- MAP: עיבוד מקביל של כל chunk ----
  const summaries = await Promise.all(
    chunks.map(async (chunk, index) => {
      const { text: summary } = await callGemini({
        systemInstruction: 'אתה מסכם מסמכים משפטיים. שמר על כל המידע הקריטי: תאריכים, סכומים, שמות, סעיפי חוק. אסור להוסיף מידע שאינו במקור.',
        userMessage: `סכם את חלק ${index + 1} מתוך ${chunks.length} של המסמך הבא. שמר על כל הפרטים הקריטיים:\n\n${chunk}`,
      })
      return `### חלק ${index + 1}:\n${summary}`
    })
  )

  // ---- REDUCE: מיזוג לניתוח אחד ----
  const combined = summaries.join('\n\n')
  const { text: finalSummary } = await callGemini({
    systemInstruction: 'אתה מסנתז סיכומי מסמך לניתוח אחד מקיף. שמר על כל הפרטים הקריטיים. אל תוסיף מידע חדש.',
    userMessage: `סנתז את סיכומי החלקים הבאים לתמונה מלאה ומסודרת של המסמך:\n\n${combined}`,
  })

  return { processedText: finalSummary, chunkCount: chunks.length, totalWords }
}
