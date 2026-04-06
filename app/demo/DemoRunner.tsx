'use client'

import { useState, useRef } from 'react'
import { WORKFLOW_TEMPLATES, WorkflowRun, WorkflowStepResult } from '@/lib/automation/types'

const STATUS_ICON: Record<WorkflowStepResult['status'], string> = {
  pending: '⏳', running: '🔄', success: '✅', error: '❌', skipped: '⏭️',
}

const EXAMPLES = [
  'האם יש לי פטור ממס שבח על מכירת דירת המגורים שלי?',
  'חברה בע"מ — מה ההוצאות המוכרות לצרכי מס?',
  'קיבלתי שומה מפקיד השומה — מה הצעדים הבאים?',
  'מיסוי עצמאי — הפקדה לפנסיה וקופת גמל',
  'רווח הון ממכירת מניות — חישוב המס',
]

export default function DemoRunner() {
  const [query, setQuery]               = useState('')
  const [templateIndex, setTemplateIndex] = useState(0)
  const [isRunning, setIsRunning]       = useState(false)
  const [activeRun, setActiveRun]       = useState<WorkflowRun | null>(null)
  const [finalOutput, setFinalOutput]   = useState<string | null>(null)
  const [error, setError]               = useState<string | null>(null)
  const [caseId, setCaseId]             = useState<string | null>(null)
  const abortRef                        = useRef<AbortController | null>(null)

  const template = WORKFLOW_TEMPLATES[templateIndex]

  const handleRun = async () => {
    if (!query.trim() || isRunning) return
    setError(null); setFinalOutput(null); setActiveRun(null); setIsRunning(true)

    abortRef.current?.abort()
    abortRef.current = new AbortController()

    try {
      const res = await fetch('/api/automation/demo', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ query, templateIndex }),
        signal:  abortRef.current.signal,
      })

      if (!res.ok || !res.body) throw new Error('שגיאת שרת')

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
          let event: Record<string, unknown>
          try { event = JSON.parse(line.slice(6)) } catch { continue }

          if (event.error)  { setError(event.error as string); break }
          if (event.caseId) setCaseId(event.caseId as string)
          if (event.run)    setActiveRun(event.run as WorkflowRun)
          if (event.done && event.run) {
            const run = event.run as WorkflowRun
            setActiveRun(run)
            const out = run.steps
              .filter(s => s.status === 'success' && s.output)
              .map(s => `## ${s.label}\n\n${s.output}`)
              .join('\n\n---\n\n')
            setFinalOutput(out)
          }
        }
      }
    } catch (err: unknown) {
      if ((err as { name?: string }).name !== 'AbortError') setError((err as Error).message)
    } finally {
      setIsRunning(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 font-sans" dir="rtl">

      {/* Header */}
      <div className="max-w-5xl mx-auto mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-lg"
               style={{ background: 'linear-gradient(135deg,#0d9488,#2dd4bf)' }}>⚡</div>
          <h1 className="text-xl font-bold text-white">מערכת מס AI — Standalone Mode</h1>
          <span className="text-xs px-2 py-0.5 rounded-full bg-teal-500/20 border border-teal-500/30 text-teal-400">
            ללא API keys
          </span>
        </div>
        <p className="text-slate-400 text-sm">
          חיפוש אוטונומי ברשת + ניתוח מקצועי + הערכת סיכונים — הכל רץ מקומית
        </p>
      </div>

      <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Left panel */}
        <div className="space-y-4">

          {/* Workflow selector */}
          <div className="rounded-xl border border-slate-700/50 overflow-hidden bg-slate-900/60">
            <div className="px-4 py-3 border-b border-slate-700/50">
              <h3 className="text-sm font-semibold text-slate-300">בחר תהליך</h3>
            </div>
            <div className="p-3 space-y-2">
              {WORKFLOW_TEMPLATES.map((t, i) => (
                <button key={i} onClick={() => setTemplateIndex(i)}
                  className={`w-full text-right px-3 py-3 rounded-lg border transition text-sm ${
                    templateIndex === i
                      ? 'border-teal-500/50 bg-teal-500/10 text-teal-300'
                      : 'border-slate-700/40 text-slate-400 hover:bg-slate-700/30'
                  }`}>
                  <div className="font-semibold">{t.name}</div>
                  <div className="text-xs mt-0.5 opacity-70">{t.description}</div>
                  {templateIndex === i && (
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {t.steps.map((s, si) => (
                        <span key={si} className="text-xs px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-400 border border-teal-500/20">
                          {s.label}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Input */}
          <div className="rounded-xl border border-slate-700/50 overflow-hidden bg-slate-900/60">
            <div className="px-4 py-3 border-b border-slate-700/50">
              <h3 className="text-sm font-semibold text-slate-300">שאלת המס</h3>
            </div>
            <div className="p-4 space-y-3">
              <textarea rows={4} value={query} onChange={e => setQuery(e.target.value)}
                placeholder="תאר את נושא המס, מסמך, או שאלה..."
                className="w-full bg-slate-800/60 border border-slate-600 rounded-lg px-3 py-2
                           text-sm text-slate-200 placeholder-slate-500 focus:outline-none
                           focus:border-teal-500 transition resize-none" />

              {/* Example chips */}
              <div className="space-y-1">
                <p className="text-xs text-slate-600">דוגמאות:</p>
                <div className="flex flex-wrap gap-1">
                  {EXAMPLES.slice(0, 3).map((ex, i) => (
                    <button key={i} onClick={() => setQuery(ex)}
                      className="text-xs px-2 py-1 rounded-full border border-slate-700 text-slate-500 hover:border-teal-500/40 hover:text-teal-400 transition">
                      {ex.substring(0, 28)}...
                    </button>
                  ))}
                </div>
              </div>

              <button onClick={handleRun} disabled={isRunning || !query.trim()}
                className="w-full py-2.5 rounded-lg font-bold text-sm text-slate-900 transition disabled:opacity-40"
                style={{ background: isRunning ? '#334155' : 'linear-gradient(45deg,#2dd4bf,#5eead4)' }}>
                {isRunning ? '⚙️ מריץ...' : `▶ הפעל — ${template.name}`}
              </button>

              {isRunning && (
                <button onClick={() => { abortRef.current?.abort(); setIsRunning(false) }}
                  className="w-full py-1.5 rounded-lg text-xs border border-rose-500/40 text-rose-400 hover:bg-rose-500/10 transition">
                  עצור ⏹
                </button>
              )}
              {error && (
                <div className="rounded-lg p-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">{error}</div>
              )}
              {caseId && (
                <p className="text-xs text-slate-600">תיק: <code className="text-teal-600">{caseId.slice(0, 8)}</code></p>
              )}
            </div>
          </div>
        </div>

        {/* Right panel */}
        <div className="lg:col-span-2 space-y-4">

          {/* Progress */}
          {activeRun && (
            <div className="rounded-xl border border-slate-700/50 overflow-hidden bg-slate-900/60">
              <div className="px-5 py-3 border-b border-slate-700/50 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-300">התקדמות הסוכן</h3>
                <span className={`text-xs px-2 py-0.5 rounded-full border ${
                  activeRun.status === 'running' ? 'border-teal-500/40 text-teal-400 bg-teal-500/10' :
                  activeRun.status === 'success' ? 'border-teal-500/40 text-teal-300 bg-teal-500/10' :
                                                   'border-rose-500/40 text-rose-400 bg-rose-500/10'
                }`}>
                  {activeRun.status === 'running' ? '⚙️ רץ...' :
                   activeRun.status === 'success' ? '✅ הושלם' : '❌ שגיאה'}
                </span>
              </div>
              <div className="p-4 space-y-2">
                {activeRun.steps.map(step => (
                  <div key={step.stepId} className={`rounded-lg border p-3 transition ${
                    step.status === 'running' ? 'border-teal-500/40 bg-teal-500/5' :
                    step.status === 'success' ? 'border-teal-500/20 bg-teal-500/5' :
                    step.status === 'error'   ? 'border-rose-500/30 bg-rose-500/5' :
                                               'border-slate-700/40'
                  }`}>
                    <div className="flex items-center gap-2">
                      <span className={step.status === 'running' ? 'animate-spin' : ''}>
                        {STATUS_ICON[step.status]}
                      </span>
                      <span className="text-sm font-medium text-slate-300">{step.label}</span>
                      {step.startedAt && step.endedAt && (
                        <span className="text-xs text-slate-600 mr-auto">
                          {((new Date(step.endedAt).getTime() - new Date(step.startedAt).getTime()) / 1000).toFixed(1)}ש
                        </span>
                      )}
                    </div>
                    {step.status === 'success' && step.output && (
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                        {step.output.substring(0, 120)}...
                      </p>
                    )}
                    {step.error && <p className="text-xs text-rose-400 mt-1">{step.error}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Output */}
          {finalOutput && (
            <div className="rounded-xl border border-teal-500/20 overflow-hidden bg-slate-900/60">
              <div className="px-5 py-3 border-b border-teal-500/20 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-teal-300">✅ תוצאות הניתוח</h3>
                <div className="flex gap-2">
                  <button onClick={() => navigator.clipboard.writeText(finalOutput)}
                    className="text-xs px-3 py-1 rounded-full border border-slate-600 text-slate-400 hover:bg-slate-700/30 transition">
                    העתק
                  </button>
                  <button onClick={() => {
                    const w = window.open('', '_blank')
                    if (!w) return
                    w.document.write(`<html dir="rtl"><head><meta charset="UTF-8">
                      <style>body{font-family:sans-serif;padding:2rem;line-height:1.8;max-width:800px;margin:auto}
                      h2{border-bottom:2px solid #0d9488;padding-bottom:.3rem;color:#0d9488}
                      pre{background:#f5f5f5;padding:1rem;border-radius:.5rem;white-space:pre-wrap}</style>
                      </head><body><pre>${finalOutput.replace(/</g,'&lt;')}</pre></body></html>`)
                    w.document.close()
                    setTimeout(() => { w.print(); w.close() }, 400)
                  }} className="text-xs px-3 py-1 rounded-full border border-slate-600 text-slate-400 hover:bg-slate-700/30 transition">
                    הדפס
                  </button>
                </div>
              </div>
              <div className="p-5 max-h-[500px] overflow-y-auto">
                <pre className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed font-sans">
                  {finalOutput}
                </pre>
              </div>
            </div>
          )}

          {/* Empty state */}
          {!activeRun && !finalOutput && (
            <div className="rounded-xl border border-slate-700/30 flex items-center justify-center bg-slate-900/30"
                 style={{ minHeight: '320px' }}>
              <div className="text-center text-slate-600 px-8">
                <div className="text-5xl mb-4">🤖</div>
                <p className="text-sm font-medium text-slate-500">הסוכן מוכן לעבודה</p>
                <p className="text-xs mt-2 text-slate-600">
                  בחר תהליך, הזן שאלת מס, ולחץ הפעל.<br/>
                  הסוכן יחפש ברשת וייצר דוח מקצועי.
                </p>
                <div className="mt-4 flex flex-wrap gap-2 justify-center">
                  {EXAMPLES.map((ex, i) => (
                    <button key={i} onClick={() => setQuery(ex)}
                      className="text-xs px-3 py-1.5 rounded-full border border-slate-700 text-slate-500
                                 hover:border-teal-500/40 hover:text-teal-400 transition text-right">
                      {ex}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
