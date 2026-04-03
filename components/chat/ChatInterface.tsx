'use client'

import { useCallback, useEffect, useRef } from 'react'
import { useCaseStore, ACTION_LOADING_TEXT } from '@/store/caseStore'
import { ActionType, AgentRequest, AgentResponse, ConversationMessage } from '@/types'
import MessageBubble from './MessageBubble'
import InputBar from './InputBar'
import ActionMenu from '@/components/modals/ActionMenu'
import AnalysisModal from '@/components/modals/AnalysisModal'
import { createClient } from '@/lib/supabase/client'

export default function ChatInterface() {
  const {
    messages, addMessage, updateMessage, clearMessages,
    isLoading, setIsLoading,
    activeCaseId, setActiveCaseId,
    modalContent, setModalContent,
  } = useCaseStore()

  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  // ── API Call ─────────────────────────────────────────────
  const callAgent = useCallback(async (
    query: string,
    actionType: ActionType,
    renderInModal = false
  ) => {
    if (isLoading) return

    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    setIsLoading(true)

    // Add user message to UI (non-modal actions)
    if (!renderInModal) {
      addMessage({ role: 'user', content: query })
    }

    // Add loading placeholder
    const loadingId = addMessage({
      role:      'model',
      content:   ACTION_LOADING_TEXT[actionType] ?? 'מעבד...',
      isLoading: true,
    })

    // Build history for followup
    const history: ConversationMessage[] = messages
      .filter(m => !m.isLoading && !m.error)
      .slice(-10)  // שולחים רק 10 הודעות אחרונות לחיסכון ב-tokens
      .map(m => ({ role: m.role, content: m.content, sources: m.sources }))

    try {
      const body: AgentRequest = {
        query,
        actionType,
        caseId: activeCaseId ?? undefined,
        history: actionType === 'followup' ? history : [],
      }

      const res = await fetch('/api/agent', {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
      })

      const data: AgentResponse & { error?: string } = await res.json()

      if (!res.ok || data.error) {
        throw new Error(data.error ?? 'שגיאת שרת')
      }

      // שמור caseId שנוצר
      if (data.caseId && !activeCaseId) {
        setActiveCaseId(data.caseId)
      }

      if (renderInModal) {
        // הסר loading bubble
        updateMessage(loadingId, { content: '', isLoading: false })
        setModalContent({ text: data.text, sources: data.sources, title: getModalTitle(actionType) })
      } else {
        updateMessage(loadingId, {
          content:   data.text,
          sources:   data.sources,
          isLoading: false,
        })
      }
    } catch (err: unknown) {
      const error = err as Error
      updateMessage(loadingId, {
        content:   `שגיאה: ${error.message}`,
        isLoading: false,
        error:     true,
      })
    } finally {
      setIsLoading(false)
    }
  }, [isLoading, messages, activeCaseId, addMessage, updateMessage, setIsLoading, setActiveCaseId, setModalContent])

  // ── Action handler for document analysis ────────────────
  const handleDocumentAnalyze = useCallback((docText: string) => {
    callAgent(docText, 'analyze')
  }, [callAgent])

  // ── Action buttons below last response ──────────────────
  const lastModelMsg = [...messages].reverse().find(m => m.role === 'model' && !m.isLoading && !m.error)
  const showActions  = !!lastModelMsg && !isLoading

  return (
    <div className="relative flex flex-col h-full">
      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-grow overflow-y-auto px-4 pt-4 pb-2"
        style={{
          maskImage: 'linear-gradient(to top, black 90%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to top, black 90%, transparent 100%)',
        }}
      >
        {messages.length === 0 && (
          <WelcomeScreen onAnalyze={handleDocumentAnalyze} />
        )}
        {messages.filter(m => m.content).map(msg => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
      </div>

      {/* Contextual action buttons */}
      {showActions && (
        <div className="px-4 pb-2 flex flex-wrap gap-2 justify-center">
          <button
            onClick={() => setModalContent({ text: lastModelMsg!.content, sources: lastModelMsg!.sources ?? [], title: 'דוח מלא' })}
            className="text-xs px-3 py-1.5 rounded-full border border-teal-500/40 text-teal-400 hover:bg-teal-500/10 transition"
          >
            פתח דוח מלא
          </button>
          <button
            onClick={() => callAgent(lastModelMsg!.content, 'simulation')}
            className="text-xs px-3 py-1.5 rounded-full border border-indigo-500/40 text-indigo-400 hover:bg-indigo-500/10 transition"
          >
            התחל סימולציה
          </button>
          <button
            onClick={clearMessages}
            className="text-xs px-3 py-1.5 rounded-full border border-slate-600 text-slate-400 hover:bg-slate-700/30 transition"
          >
            תיק חדש
          </button>
        </div>
      )}

      {/* Input */}
      <div className="px-4 pb-4 pt-1 flex-shrink-0">
        <InputBar
          onSubmit={(q, type) => callAgent(q, type)}
          disabled={isLoading}
          placeholder={messages.length > 0 ? 'שאל שאלת המשך...' : 'הזן סוגיית מס למחקר...'}
        />
      </div>

      {/* Modal */}
      {modalContent && (
        <AnalysisModal
          title={modalContent.title}
          text={modalContent.text}
          sources={modalContent.sources}
          onClose={() => setModalContent(null)}
          onAction={(actionType) => callAgent(modalContent.text, actionType, true)}
        />
      )}
    </div>
  )
}

// ── Welcome / Document Upload Screen ────────────────────────
function WelcomeScreen({ onAnalyze }: { onAnalyze: (text: string) => void }) {
  const { setIsLoading } = useCaseStore()

  const handleFileUpload = async (file: File) => {
    setIsLoading(true)
    try {
      let text = ''
      if (file.type === 'application/pdf') {
        // PDF.js loaded from CDN in layout
        const pdfjsLib = (window as unknown as { pdfjsLib: {
          GlobalWorkerOptions: { workerSrc: string }
          getDocument: (data: ArrayBuffer) => { promise: Promise<{
            numPages: number
            getPage: (n: number) => Promise<{
              getTextContent: () => Promise<{ items: Array<{ str: string }> }>
            }>
          }> }
        } }).pdfjsLib
        pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
        const buf = await file.arrayBuffer()
        const pdf = await pdfjsLib.getDocument(buf).promise
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i)
          const content = await page.getTextContent()
          text += `--- עמוד ${i} ---\n${content.items.map((it: { str: string }) => it.str).join(' ')}\n\n`
        }
      } else {
        text = await file.text()
      }
      if (text.length > 55000) text = text.substring(0, 55000) + '\n\n[הטקסט נחתך עקב מגבלת גודל]'
      onAnalyze(text)
    } catch {
      alert('שגיאה בקריאת הקובץ. ודא שהקובץ תקין.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 text-center py-12">
      <div>
        <h2 className="text-2xl font-bold text-teal-400 mb-2"
            style={{ textShadow: '0 0 20px rgba(45,212,191,0.4)' }}>
          Tax Solver Agent
        </h2>
        <p className="text-slate-400 text-sm">שאל סוגיית מס, או העלה מסמך לניתוח</p>
      </div>

      <label className="cursor-pointer group">
        <input
          type="file" accept=".pdf,.txt" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f) }}
        />
        <div className="flex flex-col items-center gap-3 px-8 py-6 rounded-xl border-2 border-dashed border-teal-500/30 group-hover:border-teal-500/60 group-hover:bg-teal-500/5 transition-all max-w-xs">
          <svg className="h-8 w-8 text-teal-500/60 group-hover:text-teal-400 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
          </svg>
          <span className="text-sm text-teal-400/80 group-hover:text-teal-300 transition">
            העלה מסמך PDF / TXT
          </span>
          <span className="text-xs text-slate-500">שומה, מכתב ממס הכנסה, החלטה</span>
        </div>
      </label>
    </div>
  )
}

function getModalTitle(actionType: ActionType): string {
  const titles: Partial<Record<ActionType, string>> = {
    summarize:     'סיכום מנהלים',
    explain:       'הסבר פשוט',
    email:         'טיוטת מייל ללקוח',
    risk:          'הערכת סיכונים',
    agenda:        'סדר יום לפגישה',
    international: 'ניתוח בינלאומי',
    predict:       'חיזוי תוצאות',
    checklist:     'רשימת מסמכים',
    appeal:        'טיוטת מכתב ערעור',
    planning:      'המלצות תכנון מס',
    compare:       'השוואה לפסיקה',
    extract:       'חילוץ נתונים',
  }
  return titles[actionType] ?? 'ניתוח'
}
