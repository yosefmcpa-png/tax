'use client'

import { useEffect, useRef, useState } from 'react'
import { marked } from 'marked'
import isomorphicDompurify from 'isomorphic-dompurify'
import { Source, ActionType } from '@/types'
import ActionMenu from './ActionMenu'

interface Props {
  title:    string
  text:     string
  sources:  Source[]
  onClose:  () => void
  onAction: (type: ActionType) => void
}

export default function AnalysisModal({ title, text, sources, onClose, onAction }: Props) {
  const [copied, setCopied]     = useState(false)
  const [qaOpen, setQaOpen]     = useState(false)
  const [qaText, setQaText]     = useState('')
  const [qaLoading, setQaLoading] = useState(false)
  const [qaLog, setQaLog]       = useState<Array<{ q: string; a: string }>>([])
  const contentRef              = useRef<HTMLDivElement>(null)

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const unique = [...new Map(sources.map(s => [s.uri, s])).values()]

  const processedHtml = isomorphicDompurify.sanitize(
    (marked.parse(
      text.replace(/\[(\d+)\]/g, (match, num) => {
        const idx = parseInt(num, 10) - 1
        if (idx >= 0 && idx < unique.length) {
          return `<a href="${unique[idx].uri}" target="_blank" rel="noopener noreferrer" class="citation" title="${unique[idx].title}">[${num}]</a>`
        }
        return match
      })
    ) as string),
    { ADD_ATTR: ['target', 'rel'] }
  )

  const handleCopy = () => {
    const plainText = contentRef.current?.innerText ?? text
    navigator.clipboard.writeText(plainText).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const handlePrint = () => {
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`
      <!DOCTYPE html><html lang="he" dir="rtl">
      <head><meta charset="UTF-8"><title>${title}</title>
      <link href="https://fonts.googleapis.com/css2?family=Assistant:wght@400;600;700&display=swap" rel="stylesheet">
      <style>body{font-family:'Assistant',sans-serif;padding:2cm;color:#111;line-height:1.7;}
      h2{border-bottom:1px solid #ccc;padding-bottom:.3rem;color:#1e40af;}
      table{width:100%;border-collapse:collapse;margin:1rem 0;}
      th,td{border:1px solid #ddd;padding:.5rem;text-align:right;}
      th{background:#f2f2f2;}</style></head>
      <body>${contentRef.current?.innerHTML ?? ''}</body></html>
    `)
    win.document.close()
    setTimeout(() => { win.print(); win.close() }, 400)
  }

  // QA follow-up (calls /api/agent with followup action)
  const handleQaSubmit = async () => {
    const q = qaText.trim()
    if (!q || qaLoading) return
    setQaLoading(true)
    setQaText('')
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          query: q,
          actionType: 'followup',
          history: [
            { role: 'model', content: text },
            { role: 'user',  content: q },
          ],
        }),
      })
      const data = await res.json()
      setQaLog(prev => [...prev, { q, a: data.text ?? data.error ?? 'שגיאה' }])
    } catch {
      setQaLog(prev => [...prev, { q, a: 'שגיאת חיבור' }])
    } finally {
      setQaLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-xl border border-teal-500/30 shadow-2xl overflow-hidden"
           style={{ background: 'rgba(10,15,30,0.98)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50 flex-shrink-0">
          <h2 className="text-lg font-bold text-teal-300">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 text-2xl leading-none transition">×</button>
        </div>

        {/* Body */}
        <div className="flex-grow overflow-y-auto px-6 py-5">
          <div ref={contentRef} className="prose prose-invert max-w-none"
               dangerouslySetInnerHTML={{ __html: processedHtml }} />

          {unique.length > 0 && (
            <div className="mt-6 pt-4 border-t border-slate-700/50">
              <p className="text-xs text-slate-500 font-semibold mb-2">מקורות:</p>
              <ol className="space-y-1">
                {unique.map((src, i) => (
                  <li key={src.uri} className="text-xs">
                    <span className="text-slate-500">{i + 1}. </span>
                    <a href={src.uri} target="_blank" rel="noopener noreferrer"
                       className="text-teal-400 hover:text-teal-300 hover:underline transition">
                      {src.title}
                    </a>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* QA Log */}
          {qaOpen && (
            <div className="mt-6 pt-4 border-t border-slate-700/50">
              <h3 className="text-sm font-semibold text-teal-400 mb-3">שאלות המשך:</h3>
              <div className="space-y-3 max-h-60 overflow-y-auto mb-4">
                {qaLog.map((item, i) => (
                  <div key={i} className="space-y-1">
                    <div className="bg-indigo-900/30 border border-indigo-500/30 rounded-lg px-3 py-2 text-sm text-slate-300">
                      <strong>שאלה:</strong> {item.q}
                    </div>
                    <div className="bg-slate-800/40 border border-slate-700/40 rounded-lg px-3 py-2 text-sm text-slate-300 prose prose-invert max-w-none"
                         dangerouslySetInnerHTML={{ __html: isomorphicDompurify.sanitize(marked.parse(item.a) as string) }} />
                  </div>
                ))}
                {qaLoading && (
                  <div className="text-xs text-teal-400 animate-pulse">מחפש תשובה...</div>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  type="text" value={qaText}
                  onChange={e => setQaText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleQaSubmit() }}
                  placeholder="שאל שאלת המשך..."
                  className="flex-grow bg-slate-800/60 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-teal-500 transition"
                  disabled={qaLoading}
                />
                <button
                  onClick={handleQaSubmit} disabled={qaLoading || !qaText.trim()}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-900 disabled:opacity-40 transition"
                  style={{ background: 'linear-gradient(45deg,#2dd4bf,#5eead4)' }}
                >
                  שלח
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-6 py-4 border-t border-slate-700/50 flex flex-wrap gap-2 items-center">
          <ActionMenu onAction={onAction} />

          <button onClick={() => setQaOpen(o => !o)}
            className="text-xs px-3 py-1.5 rounded-full border border-slate-600 text-slate-300 hover:bg-slate-700/30 transition">
            שאלת המשך
          </button>
          <button onClick={handleCopy}
            className="text-xs px-3 py-1.5 rounded-full border border-slate-600 text-slate-300 hover:bg-slate-700/30 transition">
            {copied ? '✓ הועתק' : 'העתק'}
          </button>
          <button onClick={handlePrint}
            className="text-xs px-3 py-1.5 rounded-full border border-slate-600 text-slate-300 hover:bg-slate-700/30 transition">
            הדפס
          </button>
        </div>
      </div>
    </div>
  )
}
