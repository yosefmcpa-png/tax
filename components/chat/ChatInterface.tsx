'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useCaseStore, ACTION_LOADING_TEXT } from '@/store/caseStore'
import { ActionType, AgentRequest, Source, ConversationMessage } from '@/types'
import MessageBubble from './MessageBubble'
import InputBar from './InputBar'
import AnalysisModal from '@/components/modals/AnalysisModal'
import { createClient } from '@/lib/supabase/client'

export default function ChatInterface() {
  const {
    messages, addMessage, updateMessage, clearMessages,
    isLoading, setIsLoading,
    activeCaseId, setActiveCaseId,
    modalContent, setModalContent,
  } = useCaseStore()

  const scrollRef  = useRef<HTMLDivElement>(null)
  const abortRef   = useRef<AbortController | null>(null)
  const [toolStatus, setToolStatus] = useState<string>('')

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, toolStatus])

  const callAgentStream = useCallback(async (
    query: string,
    actionType: ActionType,
    renderInModal = false
  ) => {
    if (isLoading) return

    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    abortRef.current?.abort()
    abortRef.current = new AbortController()
    setIsLoading(true)
    setToolStatus('')

    if (!renderInModal) {
      addMessage({ role: 'user', content: query })
    }

    const placeholderId = addMessage({
      role:      'model',
      content:   ACTION_LOADING_TEXT[actionType] ?? 'מעבד...',
      isLoading: true,
    })

    const history: ConversationMessage[] = messages
      .filter(m => !m.isLoading && !m.error)
      .slice(-10)
      .map(m => ({ role: m.role, content: m.content, sources: m.sources }))

    const body: AgentRequest = {
      query,
      actionType,
      caseId:  activeCaseId ?? undefined,
      history: actionType === 'followup' ? history : [],
    }

    try {
      const res = await fetch('/api/agent/stream', {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body:   JSON.stringify(body),
        signal: abortRef.current.signal,
      })

      if (!res.ok || !res.body) throw new Error(`שגיאת שרת: ${res.status}`)

      const reader   = res.body.getReader()
      const decoder  = new TextDecoder()
      let   buffer   = ''
      let   fullText = ''
      let   sources: Source[] = []
      let   started  = false

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const raw = line.slice(6).trim()
          if (!raw) continue

          let event: Record<string, unknown>
          try { event = JSON.parse(raw) } catch { continue }

          if (event.error) {
            setToolStatus('')
            updateMessage(placeholderId, { content: `שגיאה: ${event.error}`, isLoading: false, error: true })
            setIsLoading(false)
            return
          }

          if (event.caseId && !activeCaseId) {
            setActiveCaseId(event.caseId as string)
          }

          // הודעת סטטוס (chunking, tool calls)
          if (event.status && !event.text) {
            setToolStatus(event.status as string)
            updateMessage(placeholderId, { content: event.status as string, isLoading: true })
            continue
          }

          // כלי פעיל (web_search, fetch_page וכד')
          if (event.toolCall) {
            setToolStatus(event.toolCall as string)
            continue
          }

          // טקסט חי
          if (event.text) {
            if (!started) { started = true; setToolStatus('') }
            fullText += event.text as string
            updateMessage(placeholderId, { content: fullText, isLoading: false })
          }

          if (event.done) {
            sources = (event.sources as Source[]) ?? []
            setToolStatus('')
            if (renderInModal) {
              updateMessage(placeholderId, { content: '', isLoading: false })
              setModalContent({ text: fullText, sources, title: getModalTitle(actionType) })
            } else {
              updateMessage(placeholderId, { content: fullText, sources, isLoading: false })
            }
            setIsLoading(false)
          }
        }
      }
    } catch (err: unknown) {
      if ((err as { name?: string }).name === 'AbortError') return
      const error = err as Error
      setToolStatus('')
      updateMessage(placeholderId, { content: `שגיאה: ${error.message}`, isLoading: false, error: true })
    } finally {
      setIsLoading(false)
      setToolStatus('')
    }
  }, [isLoading, messages, activeCaseId, addMessage, updateMessage,
      setIsLoading, setActiveCaseId, setModalContent])

  const handleDocumentAnalyze = useCallback((docText: string) => {
    callAgentStream(docText, 'analyze')
  }, [callAgentStream])

  const lastModelMsg = [...messages].reverse()
    .find(m => m.role === 'model' && !m.isLoading && !m.error)
  const showActions = !!lastModelMsg && !isLoading

  return (
    <div className="relative flex flex-col h-full">

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-grow overflow-y-auto px-4 pt-4 pb-2"
        style={{
          maskImage:       'linear-gradient(to top, black 92%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to top, black 92%, transparent 100%)',
        }}
      >
        {messages.length === 0 && <WelcomeScreen onAnalyze={handleDocumentAnalyze} />}
        {messages.filter(m => m.content).map(msg => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
      </div>

      {/* Tool activity bar */}
      {toolStatus && (
        <div className="mx-4 mb-1 px-3 py-1.5 rounded-lg bg-teal-900/20 border border-teal-500/20
                        flex items-center gap-2 text-xs text-teal-400/80 animate-pulse">
          <span className="h-1.5 w-1.5 rounded-full bg-teal-400 animate-ping" />
          {toolStatus}
        </div>
      )}

      {/* Contextual actions */}
      {showActions && (
        <div className="px-4 pb-2 flex flex-wrap gap-2 justify-center">
          {[
            { label: '📊 פתח דוח מלא',    color: 'teal'   as const, action: () => setModalContent({ text: lastModelMsg!.content, sources: lastModelMsg!.sources ?? [], title: 'דוח מלא' }) },
            { label: '⚖️ השוואה לפסיקה',  color: 'indigo' as const, action: () => callAgentStream(lastModelMsg!.content, 'compare', true) },
            { label: '⚠️ הערכת סיכונים',  color: 'amber'  as const, action: () => callAgentStream(lastModelMsg!.content, 'risk', true) },
            { label: '🎭 סימולציה',        color: 'purple' as const, action: () => callAgentStream(lastModelMsg!.content, 'simulation') },
            { label: '🗒 תיק חדש',         color: 'slate'  as const, action: clearMessages },
          ].map(b => (
            <ContextBtn key={b.label} label={b.label} color={b.color} onClick={b.action} />
          ))}
        </div>
      )}

      {/* Stop button */}
      {isLoading && (
        <div className="px-4 pb-1 flex justify-center">
          <button
            onClick={() => { abortRef.current?.abort(); setIsLoading(false); setToolStatus('') }}
            className="text-xs px-3 py-1 rounded-full border border-rose-500/40
                       text-rose-400 hover:bg-rose-500/10 transition"
          >
            ⏹ עצור
          </button>
        </div>
      )}

      {/* Input */}
      <div className="px-4 pb-4 pt-1 flex-shrink-0">
        <InputBar
          onSubmit={(q, type) => callAgentStream(q, type)}
          disabled={isLoading}
          placeholder={messages.length > 0 ? 'שאל שאלת המשך...' : 'הזן סוגיית מס — הסוכן יחפש ברשת ויביא מקורות...'}
        />
      </div>

      {/* Analysis Modal */}
      {modalContent && (
        <AnalysisModal
          title={modalContent.title}
          text={modalContent.text}
          sources={modalContent.sources}
          onClose={() => setModalContent(null)}
          onAction={(actionType) => callAgentStream(modalContent.text, actionType, true)}
        />
      )}
    </div>
  )
}

// ── Welcome Screen ─────────────────────────────────────────
function WelcomeScreen({ onAnalyze }: { onAnalyze: (t: string) => void }) {
  const { setIsLoading } = useCaseStore()

  const handleFile = async (file: File) => {
    setIsLoading(true)
    try {
      let text = ''
      if (file.type === 'application/pdf') {
        const pdfjsLib = (window as unknown as {
          pdfjsLib: {
            GlobalWorkerOptions: { workerSrc: string }
            getDocument: (data: ArrayBuffer) => {
              promise: Promise<{
                numPages: number
                getPage: (n: number) => Promise<{
                  getTextContent: () => Promise<{ items: Array<{ str: string }> }>
                }>
              }>
            }
          }
        }).pdfjsLib
        pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
        const pdf = await pdfjsLib.getDocument(await file.arrayBuffer()).promise
        for (let i = 1; i <= pdf.numPages; i++) {
          const pg = await pdf.getPage(i)
          const ct = await pg.getTextContent()
          text += `--- עמוד ${i} ---\n${ct.items.map((x: { str: string }) => x.str).join(' ')}\n\n`
        }
      } else {
        text = await file.text()
      }
      if (text.length > 55000) text = text.substring(0, 55000) + '\n\n[הטקסט נחתך]'
      onAnalyze(text)
    } catch {
      alert('שגיאה בקריאת הקובץ.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center h-full gap-8 py-12 text-center">
      <div>
        <h2 className="text-3xl font-bold text-teal-400 mb-2"
            style={{ textShadow: '0 0 24px rgba(45,212,191,0.4)' }}>
          Tax Solver Agent
        </h2>
        <p className="text-slate-400 text-sm">
          מחקר מס אוטונומי — הסוכן מחפש ברשת ומביא מקורות לבד
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl w-full px-4">
        <HintCard icon="🌐" title="חיפוש אוטונומי" desc='שאל ושאל — הסוכן ימצא את המידע לבד' />
        <HintCard icon="📄" title="ניתוח מסמך"     desc="העלה שומה, צו, או מכתב מהרשות" />
        <HintCard icon="🤖" title="Pipeline מלא"    desc='Dashboard → הרץ 4 סוכנים במקביל' />
      </div>

      <label className="cursor-pointer group mt-2">
        <input type="file" accept=".pdf,.txt" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
        <div className="flex items-center gap-3 px-6 py-3 rounded-xl border-2 border-dashed
                        border-teal-500/30 group-hover:border-teal-500/60 group-hover:bg-teal-500/5
                        transition-all">
          <svg className="h-5 w-5 text-teal-400/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
          </svg>
          <span className="text-sm text-teal-400/80 group-hover:text-teal-300 transition font-medium">
            העלה מסמך PDF / TXT לניתוח אוטומטי
          </span>
        </div>
      </label>
    </div>
  )
}

function HintCard({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="rounded-xl border border-slate-700/50 p-4 text-right bg-slate-800/20
                    hover:bg-slate-800/40 transition">
      <div className="text-2xl mb-2">{icon}</div>
      <div className="text-sm font-semibold text-slate-200 mb-1">{title}</div>
      <div className="text-xs text-slate-500">{desc}</div>
    </div>
  )
}

function ContextBtn({
  label, color, onClick,
}: { label: string; color: 'teal' | 'indigo' | 'amber' | 'purple' | 'slate'; onClick: () => void }) {
  const cls = {
    teal:   'border-teal-500/40   text-teal-400   hover:bg-teal-500/10',
    indigo: 'border-indigo-500/40 text-indigo-400 hover:bg-indigo-500/10',
    amber:  'border-amber-500/40  text-amber-400  hover:bg-amber-500/10',
    purple: 'border-purple-500/40 text-purple-400 hover:bg-purple-500/10',
    slate:  'border-slate-600     text-slate-400  hover:bg-slate-700/30',
  }[color]
  return (
    <button onClick={onClick}
      className={`text-xs px-3 py-1.5 rounded-full border transition ${cls}`}>
      {label}
    </button>
  )
}

function getModalTitle(actionType: ActionType): string {
  const titles: Partial<Record<ActionType, string>> = {
    summarize: 'סיכום מנהלים', explain: 'הסבר פשוט',
    email: 'טיוטת מייל', risk: 'הערכת סיכונים',
    agenda: 'סדר יום', international: 'ניתוח בינלאומי',
    predict: 'חיזוי תוצאות', checklist: 'רשימת מסמכים',
    appeal: 'טיוטת ערעור', planning: 'תכנון מס',
    compare: 'השוואה לפסיקה', extract: 'חילוץ נתונים',
  }
  return titles[actionType] ?? 'ניתוח'
}
