'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { WORKFLOW_TEMPLATES, Workflow, WorkflowRun, WorkflowStepResult } from '@/lib/automation/types'

const STATUS_ICON: Record<WorkflowStepResult['status'], string> = {
  pending: '⏳', running: '🔄', success: '✅', error: '❌', skipped: '⏭️',
}
const STATUS_COLOR: Record<WorkflowStepResult['status'], string> = {
  pending:  'text-slate-500',
  running:  'text-teal-400 animate-pulse',
  success:  'text-teal-300',
  error:    'text-rose-400',
  skipped:  'text-slate-600',
}

export default function AutomationPanel({ userId }: { userId: string }) {
  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null)
  const [inputText, setInputText]   = useState('')
  const [caseTitle, setCaseTitle]   = useState('')
  const [isRunning, setIsRunning]   = useState(false)
  const [activeRun, setActiveRun]   = useState<WorkflowRun | null>(null)
  const [finalOutput, setFinalOutput] = useState<string | null>(null)
  const [error, setError]           = useState<string | null>(null)
  const abortRef                    = useRef<AbortController | null>(null)

  const template = selectedTemplate !== null ? WORKFLOW_TEMPLATES[selectedTemplate] : null

  const handleFileUpload = async (file: File) => {
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
          text += ct.items.map(x => x.str).join(' ') + '\n'
        }
      } else {
        text = await file.text()
      }
      if (text.length > 55000) text = text.substring(0, 55000) + '\n[נחתך]'
      setInputText(text)
      if (!caseTitle) setCaseTitle(file.name.replace(/\.[^/.]+$/, ''))
    } catch {
      setError('שגיאה בקריאת הקובץ')
    }
  }

  const handleRun = async () => {
    if (!template || !inputText.trim() || isRunning) return
    setError(null)
    setFinalOutput(null)
    setActiveRun(null)
    setIsRunning(true)

    abortRef.current?.abort()
    abortRef.current = new AbortController()

    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setError('יש להתחבר מחדש'); setIsRunning(false); return }

    // יצירת תיק חדש לריצה
    const admin = createClient()
    const caseRes = await fetch('/api/cases', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ title: caseTitle || template.name, caseType: 'research' }),
    })
    const caseData = await caseRes.json()
    void admin  // suppress unused var warning

    // fallback: create case via agent endpoint on first step
    const tempCaseId = caseData?.id ?? crypto.randomUUID()

    const workflow: Workflow = {
      ...template,
      id:        crypto.randomUUID(),
      userId,
      createdAt: new Date().toISOString(),
    }

    try {
      const res = await fetch('/api/automation/run', {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body:   JSON.stringify({ workflow, inputText, caseId: tempCaseId }),
        signal: abortRef.current.signal,
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

          if (event.error) { setError(event.error as string); break }
          if (event.run)   { setActiveRun(event.run as WorkflowRun) }
          if (event.done && event.run) {
            const run = event.run as WorkflowRun
            setActiveRun(run)
            // Build final output from all successful steps
            const out = run.steps
              .filter(s => s.status === 'success' && s.output)
              .map(s => `## ${s.label}\n\n${s.output}`)
              .join('\n\n---\n\n')
            setFinalOutput(out)
          }
        }
      }
    } catch (err: unknown) {
      if ((err as { name?: string }).name !== 'AbortError') {
        setError((err as Error).message)
      }
    } finally {
      setIsRunning(false)
    }
  }

  const handleCopyOutput = () => {
    if (finalOutput) navigator.clipboard.writeText(finalOutput)
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

      {/* Left: Template + Input */}
      <div className="lg:col-span-1 space-y-4">
        <div className="rounded-xl border border-slate-700/50 overflow-hidden"
             style={{ background: 'rgba(15,23,42,0.6)' }}>
          <div className="px-4 py-3 border-b border-slate-700/50">
            <h3 className="text-sm font-semibold text-slate-300">בחר תהליך</h3>
          </div>
          <div className="p-3 space-y-2">
            {WORKFLOW_TEMPLATES.map((t, i) => (
              <button
                key={i}
                onClick={() => setSelectedTemplate(i)}
                className={`w-full text-right px-3 py-3 rounded-lg border transition text-sm ${
                  selectedTemplate === i
                    ? 'border-teal-500/50 bg-teal-500/10 text-teal-300'
                    : 'border-slate-700/40 text-slate-400 hover:bg-slate-700/30 hover:text-slate-200'
                }`}
              >
                <div className="font-semibold">{t.name}</div>
                <div className="text-xs mt-0.5 opacity-70">{t.description}</div>
                {selectedTemplate === i && (
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {t.steps.map((s, si) => (
                      <span key={si}
                        className="text-xs px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-400 border border-teal-500/20">
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
        {selectedTemplate !== null && (
          <div className="rounded-xl border border-slate-700/50 overflow-hidden"
               style={{ background: 'rgba(15,23,42,0.6)' }}>
            <div className="px-4 py-3 border-b border-slate-700/50">
              <h3 className="text-sm font-semibold text-slate-300">קלט לתהליך</h3>
            </div>
            <div className="p-4 space-y-3">
              <input
                type="text"
                placeholder="שם התיק (אופציונלי)"
                value={caseTitle}
                onChange={e => setCaseTitle(e.target.value)}
                className="w-full bg-slate-800/60 border border-slate-600 rounded-lg px-3 py-2
                           text-sm text-slate-200 placeholder-slate-500 focus:outline-none
                           focus:border-teal-500 transition"
              />
              <label className="cursor-pointer block">
                <input type="file" accept=".pdf,.txt" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f) }} />
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed
                                border-teal-500/30 hover:border-teal-500/50 hover:bg-teal-500/5
                                transition text-sm text-teal-400/80">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
                  </svg>
                  העלה PDF/TXT
                </div>
              </label>
              <textarea
                rows={6}
                placeholder="או הדבק טקסט ישירות..."
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                className="w-full bg-slate-800/60 border border-slate-600 rounded-lg px-3 py-2
                           text-sm text-slate-200 placeholder-slate-500 focus:outline-none
                           focus:border-teal-500 transition resize-none"
              />
              <button
                onClick={handleRun}
                disabled={isRunning || !inputText.trim()}
                className="w-full py-2.5 rounded-lg font-bold text-sm text-slate-900 transition disabled:opacity-40"
                style={{ background: isRunning ? '#334155' : 'linear-gradient(45deg,#2dd4bf,#5eead4)' }}
              >
                {isRunning ? '⚙️ מריץ תהליך...' : `▶ הפעל — ${template?.name}`}
              </button>
              {isRunning && (
                <button
                  onClick={() => { abortRef.current?.abort(); setIsRunning(false) }}
                  className="w-full py-1.5 rounded-lg text-xs border border-rose-500/40 text-rose-400 hover:bg-rose-500/10 transition"
                >
                  עצור ⏹
                </button>
              )}
              {error && (
                <div className="rounded-lg p-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                  {error}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Right: Live Run Progress + Output */}
      <div className="lg:col-span-2 space-y-4">

        {/* Step progress */}
        {activeRun && (
          <div className="rounded-xl border border-slate-700/50 overflow-hidden"
               style={{ background: 'rgba(15,23,42,0.6)' }}>
            <div className="px-5 py-3 border-b border-slate-700/50 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-300">התקדמות</h3>
              <span className={`text-xs px-2 py-0.5 rounded-full border ${
                activeRun.status === 'running'  ? 'border-teal-500/40 text-teal-400 bg-teal-500/10' :
                activeRun.status === 'success'  ? 'border-teal-500/40 text-teal-300 bg-teal-500/10' :
                                                  'border-rose-500/40 text-rose-400 bg-rose-500/10'
              }`}>
                {activeRun.status === 'running' ? '⚙️ רץ...' :
                 activeRun.status === 'success' ? '✅ הושלם' : '❌ שגיאה'}
              </span>
            </div>
            <div className="p-4 space-y-3">
              {activeRun.steps.map((step) => (
                <div key={step.stepId}
                  className={`rounded-lg border p-3 transition ${
                    step.status === 'running'
                      ? 'border-teal-500/40 bg-teal-500/5'
                      : step.status === 'success'
                      ? 'border-teal-500/20 bg-teal-500/5'
                      : step.status === 'error'
                      ? 'border-rose-500/30 bg-rose-500/5'
                      : 'border-slate-700/40'
                  }`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-sm ${STATUS_COLOR[step.status]}`}>
                      {STATUS_ICON[step.status]}
                    </span>
                    <span className="text-sm font-medium text-slate-300">{step.label}</span>
                    {step.startedAt && step.endedAt && (
                      <span className="text-xs text-slate-600 mr-auto">
                        {(
                          (new Date(step.endedAt).getTime() -
                           new Date(step.startedAt).getTime()) / 1000
                        ).toFixed(1)}ש
                      </span>
                    )}
                  </div>
                  {step.error && (
                    <p className="text-xs text-rose-400 mt-1">{step.error}</p>
                  )}
                  {step.status === 'success' && step.output && (
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                      {step.output.substring(0, 120)}...
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Final output */}
        {finalOutput && (
          <div className="rounded-xl border border-teal-500/20 overflow-hidden"
               style={{ background: 'rgba(15,23,42,0.6)' }}>
            <div className="px-5 py-3 border-b border-teal-500/20 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-teal-300">✅ תוצאות התהליך</h3>
              <div className="flex gap-2">
                <button onClick={handleCopyOutput}
                  className="text-xs px-3 py-1 rounded-full border border-slate-600 text-slate-400 hover:bg-slate-700/30 transition">
                  העתק
                </button>
                <button onClick={() => {
                  const win = window.open('', '_blank')
                  if (!win) return
                  win.document.write(`<html dir="rtl"><head><meta charset="UTF-8">
                    <style>body{font-family:sans-serif;padding:2rem;line-height:1.7;}
                    h2{border-bottom:1px solid #ccc;padding-bottom:.3rem;}
                    pre{background:#f5f5f5;padding:1rem;border-radius:.5rem;white-space:pre-wrap;}</style>
                    </head><body><pre>${finalOutput}</pre></body></html>`)
                  win.document.close()
                  setTimeout(() => { win.print(); win.close() }, 300)
                }}
                  className="text-xs px-3 py-1 rounded-full border border-slate-600 text-slate-400 hover:bg-slate-700/30 transition">
                  הדפס
                </button>
              </div>
            </div>
            <div className="p-5 max-h-96 overflow-y-auto">
              <pre className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed font-sans">
                {finalOutput}
              </pre>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!activeRun && !finalOutput && (
          <div className="rounded-xl border border-slate-700/30 flex items-center justify-center"
               style={{ background: 'rgba(15,23,42,0.3)', minHeight: '300px' }}>
            <div className="text-center text-slate-600">
              <div className="text-4xl mb-3">⚙️</div>
              <p className="text-sm">בחר תהליך והזן קלט להפעלה</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
