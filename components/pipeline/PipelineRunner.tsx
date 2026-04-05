'use client'

import { useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { marked } from 'marked'
import DOMPurify from 'isomorphic-dompurify'

// ============================================================
// PipelineRunner — ממשק ה-4-Agent Pipeline
// Research → Analysis → Risk → Report
// ============================================================

interface StageState {
  id:       string
  label:    string
  status:   'pending' | 'running' | 'done' | 'error'
  toolCalls: string[]
  error?:   string
}

interface PipelineRun {
  id:        string
  status:    'running' | 'done' | 'error'
  stages:    StageState[]
  report?:   string
  sources:   { uri: string; title: string }[]
}

const STAGE_ICONS: Record<string, string> = {
  research: '🔍',
  analysis: '🧠',
  risk:     '⚠️',
  report:   '📋',
}

export default function PipelineRunner({ caseId }: { caseId?: string }) {
  const [input,    setInput]    = useState('')
  const [run,      setRun]      = useState<PipelineRun | null>(null)
  const [loading,  setLoading]  = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const start = useCallback(async () => {
    if (!input.trim() || loading) return

    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    abortRef.current?.abort()
    abortRef.current = new AbortController()
    setLoading(true)
    setRun(null)

    try {
      const res = await fetch('/api/agent/pipeline', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body:    JSON.stringify({ input, caseId }),
        signal:  abortRef.current.signal,
      })

      if (!res.body) throw new Error('No stream')

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let   buffer  = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const ev = JSON.parse(line.slice(6))
            if (ev.run) setRun({ ...ev.run })
            if (ev.done && ev.run) setRun({ ...ev.run })
          } catch {}
        }
      }
    } catch (err: unknown) {
      if ((err as { name?: string }).name !== 'AbortError') {
        console.error(err)
      }
    } finally {
      setLoading(false)
    }
  }, [input, loading, caseId])

  const copy = () => {
    if (run?.report) navigator.clipboard.writeText(run.report)
  }

  const print = () => {
    if (!run?.report) return
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(`<html dir="rtl"><head><meta charset="utf-8"><title>דוח מס</title>
    <style>body{font-family:Arial,sans-serif;padding:40px;max-width:900px;margin:auto;line-height:1.6}
    h1,h2,h3{color:#1e3a5f}table{width:100%;border-collapse:collapse}
    td,th{border:1px solid #ccc;padding:8px}th{background:#f0f4f8}</style></head>
    <body>${DOMPurify.sanitize(marked.parse(run.report) as string)}</body></html>`)
    w.print()
  }

  return (
    <div className="flex flex-col gap-6 h-full">

      {/* Input */}
      <div className="bg-slate-800/40 rounded-2xl border border-slate-700/50 p-5">
        <h3 className="text-sm font-semibold text-teal-400 mb-3">
          🤖 Pipeline אוטומטי — 4 סוכנים במקביל
        </h3>
        <p className="text-xs text-slate-400 mb-4">
          הזן שאלה, סוגיה, או הדבק מסמך. המערכת תחקור ברשת, תנתח, תעריך סיכונים, ותכתוב דוח מלא — אוטומטית.
        </p>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          disabled={loading}
          rows={4}
          placeholder="לדוגמה: ניתוח חברת X — מה הסיכונים ממיסוי בינלאומי? ...או הדבק מסמך שומה"
          className="w-full bg-slate-900/60 border border-slate-600/50 rounded-xl px-4 py-3
                     text-sm text-slate-200 placeholder-slate-500 resize-none focus:outline-none
                     focus:border-teal-500/50 transition"
        />
        <div className="flex gap-3 mt-3">
          <button
            onClick={start}
            disabled={loading || !input.trim()}
            className="flex-1 py-2.5 rounded-xl bg-teal-500/20 border border-teal-500/40
                       text-teal-300 text-sm font-medium hover:bg-teal-500/30 transition
                       disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? '⏳ מריץ pipeline...' : '▶ הפעל 4 סוכנים'}
          </button>
          {loading && (
            <button
              onClick={() => { abortRef.current?.abort(); setLoading(false) }}
              className="px-4 py-2.5 rounded-xl border border-rose-500/40 text-rose-400
                         text-sm hover:bg-rose-500/10 transition"
            >
              עצור
            </button>
          )}
        </div>
      </div>

      {/* Stages progress */}
      {run && (
        <div className="bg-slate-800/40 rounded-2xl border border-slate-700/50 p-5">
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
            התקדמות
          </h4>
          <div className="flex flex-col gap-3">
            {run.stages.map(stage => (
              <StageRow key={stage.id} stage={stage} />
            ))}
          </div>
        </div>
      )}

      {/* Final report */}
      {run?.report && (
        <div className="bg-slate-800/40 rounded-2xl border border-teal-500/20 p-5 flex-1 overflow-auto">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-semibold text-teal-400">📋 דוח סופי</h4>
            <div className="flex gap-2">
              <button onClick={copy}
                className="text-xs px-3 py-1.5 rounded-lg border border-slate-600 text-slate-400
                           hover:border-teal-500/40 hover:text-teal-400 transition">
                העתק
              </button>
              <button onClick={print}
                className="text-xs px-3 py-1.5 rounded-lg border border-slate-600 text-slate-400
                           hover:border-teal-500/40 hover:text-teal-400 transition">
                הדפס
              </button>
            </div>
          </div>

          <div
            className="prose prose-sm prose-invert max-w-none text-slate-300 leading-relaxed"
            dangerouslySetInnerHTML={{
              __html: DOMPurify.sanitize(marked.parse(run.report) as string)
            }}
          />

          {run.sources.length > 0 && (
            <div className="mt-6 pt-4 border-t border-slate-700/50">
              <h5 className="text-xs font-semibold text-slate-400 mb-2">מקורות ({run.sources.length})</h5>
              <div className="flex flex-col gap-1">
                {run.sources.map((s, i) => (
                  <a key={i} href={s.uri} target="_blank" rel="noopener noreferrer"
                     className="text-xs text-teal-400/70 hover:text-teal-300 truncate transition">
                    [{i + 1}] {s.title || s.uri}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Stage Row ───────────────────────────────────────────────
function StageRow({ stage }: { stage: StageState }) {
  const [open, setOpen] = useState(false)

  const colors = {
    pending: 'border-slate-700/50 text-slate-500',
    running: 'border-teal-500/40 text-teal-300 animate-pulse',
    done:    'border-emerald-500/40 text-emerald-400',
    error:   'border-rose-500/40 text-rose-400',
  }[stage.status]

  const dot = {
    pending: '⬜',
    running: '🔄',
    done:    '✅',
    error:   '❌',
  }[stage.status]

  return (
    <div className={`rounded-xl border px-4 py-3 ${colors} transition-all`}>
      <div className="flex items-center justify-between cursor-pointer"
           onClick={() => stage.toolCalls.length > 0 && setOpen(o => !o)}>
        <div className="flex items-center gap-3">
          <span className="text-base">{dot}</span>
          <span className="text-sm font-medium">{stage.label}</span>
          {stage.status === 'running' && (
            <span className="text-xs text-teal-400/60 animate-pulse">עובד...</span>
          )}
        </div>
        {stage.toolCalls.length > 0 && (
          <span className="text-xs text-slate-500">
            {stage.toolCalls.length} כלים {open ? '▲' : '▼'}
          </span>
        )}
      </div>

      {open && stage.toolCalls.length > 0 && (
        <div className="mt-2 pt-2 border-t border-slate-700/30">
          {stage.toolCalls.map((t, i) => (
            <div key={i} className="text-xs text-slate-400 font-mono py-0.5">{t}</div>
          ))}
        </div>
      )}

      {stage.error && (
        <div className="text-xs text-rose-400/80 mt-1">{stage.error}</div>
      )}
    </div>
  )
}
