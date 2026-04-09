'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'

// ── Types ──────────────────────────────────────────────────────
interface ReportSection {
  title: string
  content: string
}

interface ReportData {
  clientName: string
  reportType: string
  year: string
  sections: ReportSection[]
  generatedAt: string
}

const REPORT_TYPES = [
  { value: 'income_tax',   label: 'דו"ח מס הכנסה שנתי' },
  { value: 'vat_report',   label: 'דו"ח מע"מ רבעוני' },
  { value: 'appeal',       label: 'ערעור מס / השגה' },
  { value: 'research',     label: 'מחקר מיסויי' },
  { value: 'real_estate',  label: 'עסקת מקרקעין' },
  { value: 'company_tax',  label: 'מס חברות שנתי' },
]

const SECTION_TEMPLATES: Record<string, ReportSection[]> = {
  income_tax: [
    { title: 'פרטי הנישום', content: '' },
    { title: 'סיכום הכנסות', content: '' },
    { title: 'ניכויים מותרים', content: '' },
    { title: 'חישוב המס', content: '' },
    { title: 'זיכויים ופטורים', content: '' },
    { title: 'יתרה לתשלום / החזר', content: '' },
  ],
  vat_report: [
    { title: 'פרטי עוסק', content: '' },
    { title: 'עסקאות חייבות', content: '' },
    { title: 'עסקאות פטורות', content: '' },
    { title: 'תשומות (מע"מ תשומות)', content: '' },
    { title: 'יתרה לתשלום', content: '' },
  ],
  appeal: [
    { title: 'פרטי המערער', content: '' },
    { title: 'נסיבות המקרה', content: '' },
    { title: 'טענות המערער', content: '' },
    { title: 'בסיס חוקי', content: '' },
    { title: 'עדויות ומסמכים', content: '' },
    { title: 'הסעד המבוקש', content: '' },
  ],
  research: [
    { title: 'שאלת המחקר', content: '' },
    { title: 'רקע חוקי', content: '' },
    { title: 'ניתוח פסיקה', content: '' },
    { title: 'השוואה בינלאומית', content: '' },
    { title: 'מסקנות והמלצות', content: '' },
  ],
  real_estate: [
    { title: 'פרטי הנכס', content: '' },
    { title: 'פרטי הצדדים', content: '' },
    { title: 'חישוב מס שבח', content: '' },
    { title: 'מס רכישה', content: '' },
    { title: 'פטורים ישימים', content: '' },
    { title: 'המלצות', content: '' },
  ],
  company_tax: [
    { title: 'פרטי החברה', content: '' },
    { title: 'הכנסות ורווחים', content: '' },
    { title: 'הוצאות מוכרות', content: '' },
    { title: 'הכנסה חייבת', content: '' },
    { title: 'ניצול הפסדים', content: '' },
    { title: 'מס לתשלום', content: '' },
  ],
}

export default function ReportPage() {
  const [clientName, setClientName] = useState('')
  const [reportType, setReportType] = useState('income_tax')
  const [year, setYear] = useState('2024')
  const [sections, setSections] = useState<ReportSection[]>(SECTION_TEMPLATES.income_tax)
  const [generating, setGenerating] = useState(false)
  const [generated, setGenerated] = useState(false)
  const [aiQuery, setAiQuery] = useState('')
  const [aiStreaming, setAiStreaming] = useState(false)
  const [aiAnswer, setAiAnswer] = useState('')
  const printRef = useRef<HTMLDivElement>(null)

  function handleTypeChange(t: string) {
    setReportType(t)
    setSections((SECTION_TEMPLATES[t] ?? SECTION_TEMPLATES.income_tax).map(s => ({ ...s, content: '' })))
    setGenerated(false)
  }

  function updateSection(idx: number, content: string) {
    setSections(prev => prev.map((s, i) => i === idx ? { ...s, content } : s))
  }

  async function handleGenerate() {
    setGenerating(true)
    // Simulate brief generation delay then mark done
    await new Promise(r => setTimeout(r, 800))
    setGenerating(false)
    setGenerated(true)
  }

  async function askAI() {
    if (!aiQuery.trim() || aiStreaming) return
    setAiStreaming(true)
    setAiAnswer('')
    try {
      const res = await fetch('/api/agent/standalone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: aiQuery, caseId: 'report-helper' }),
      })
      if (!res.body) return
      const reader = res.body.getReader()
      const dec = new TextDecoder()
      let buf = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })
        const parts = buf.split('\n\n')
        buf = parts.pop() ?? ''
        for (const part of parts) {
          if (!part.startsWith('data: ')) continue
          try {
            const d = JSON.parse(part.slice(6))
            if (d.token) setAiAnswer(prev => prev + d.token)
          } catch { /* skip */ }
        }
      }
    } finally {
      setAiStreaming(false)
    }
  }

  function handlePrint() {
    window.print()
  }

  const reportLabel = REPORT_TYPES.find(t => t.value === reportType)?.label ?? ''

  return (
    <div dir="rtl" className="min-h-screen" style={{ background: 'rgb(10,14,26)' }}>

      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50 print:hidden"
              style={{ background: 'rgba(10,15,30,0.9)' }}>
        <div className="flex items-center gap-3">
          <Link href="/" className="text-slate-400 hover:text-slate-200 text-sm">→ חזרה</Link>
          <span className="text-slate-700">|</span>
          <h1 className="text-base font-bold text-teal-400">מחולל דוחות מס</h1>
        </div>
        {generated && (
          <button onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                       bg-teal-600 hover:bg-teal-500 text-white transition">
            🖨️ הדפסה / PDF
          </button>
        )}
      </header>

      <div className="max-w-5xl mx-auto px-4 py-8 print:p-0">

        {/* Config panel */}
        <div className="print:hidden grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div>
            <label className="block text-xs text-slate-400 mb-1">שם הלקוח / תיק</label>
            <input value={clientName} onChange={e => setClientName(e.target.value)}
              placeholder="ישראל ישראלי"
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700
                         text-slate-200 text-sm placeholder-slate-600 focus:outline-none focus:border-teal-500"/>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">סוג הדוח</label>
            <select value={reportType} onChange={e => handleTypeChange(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700
                         text-slate-200 text-sm focus:outline-none focus:border-teal-500">
              {REPORT_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">שנת מס</label>
            <select value={year} onChange={e => setYear(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700
                         text-slate-200 text-sm focus:outline-none focus:border-teal-500">
              {['2024', '2023', '2022', '2021'].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>

        {/* AI assistant panel */}
        <div className="print:hidden mb-8 p-4 rounded-xl border border-teal-500/20"
             style={{ background: 'rgba(13,148,136,0.04)' }}>
          <p className="text-xs text-teal-400 font-medium mb-2">🤖 עוזר AI — שאל שאלת מס לעזרה במילוי הדוח</p>
          <div className="flex gap-2">
            <input value={aiQuery} onChange={e => setAiQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && askAI()}
              placeholder="מה שיעור מס החברות לשנת 2024?"
              className="flex-1 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700
                         text-slate-200 text-sm placeholder-slate-600 focus:outline-none focus:border-teal-500"/>
            <button onClick={askAI} disabled={aiStreaming}
              className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 disabled:opacity-50
                         text-white text-sm font-medium transition">
              {aiStreaming ? '...' : 'שאל'}
            </button>
          </div>
          {aiAnswer && (
            <div className="mt-3 p-3 rounded-lg bg-slate-800/60 text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
              {aiAnswer}
            </div>
          )}
        </div>

        {/* Sections editor */}
        <div className="print:hidden space-y-4 mb-8">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-300">סעיפי הדוח</h2>
            <button onClick={handleGenerate} disabled={generating}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50
                         text-white text-sm font-medium transition">
              {generating ? 'מייצר...' : '⚡ צור דוח'}
            </button>
          </div>
          {sections.map((sec, idx) => (
            <div key={idx} className="rounded-xl border border-slate-700/60 overflow-hidden">
              <div className="px-4 py-2 bg-slate-800/60 border-b border-slate-700/40">
                <span className="text-xs font-semibold text-slate-400">{idx + 1}. {sec.title}</span>
              </div>
              <textarea
                value={sec.content}
                onChange={e => updateSection(idx, e.target.value)}
                placeholder={`הכנס תוכן לסעיף "${sec.title}"...`}
                rows={4}
                className="w-full px-4 py-3 bg-slate-900/40 text-sm text-slate-200
                           placeholder-slate-700 focus:outline-none resize-none"/>
            </div>
          ))}
        </div>

        {/* Printable Report */}
        {generated && (
          <div ref={printRef}
               className="print:block rounded-2xl border border-slate-700/40 overflow-hidden"
               style={{ background: 'rgba(15,20,35,0.8)' }}>

            {/* Report Header */}
            <div className="px-8 py-8 border-b border-slate-700/40 text-center print:bg-white print:text-black">
              <div className="flex items-center justify-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-2xl"
                     style={{ background: 'linear-gradient(135deg,#0d9488,#2dd4bf)' }}>⚖️</div>
                <div className="text-right">
                  <h1 className="text-xl font-bold text-teal-400 print:text-black">{reportLabel}</h1>
                  <p className="text-sm text-slate-400 print:text-gray-600">Tax Solver AI — מחקר מס מקצועי</p>
                </div>
              </div>
              <div className="flex items-center justify-center gap-8 text-sm text-slate-500 print:text-gray-600">
                {clientName && <span><strong className="text-slate-300 print:text-black">לקוח:</strong> {clientName}</span>}
                <span><strong className="text-slate-300 print:text-black">שנת מס:</strong> {year}</span>
                <span><strong className="text-slate-300 print:text-black">תאריך הפקה:</strong> {new Date().toLocaleDateString('he-IL')}</span>
              </div>
            </div>

            {/* Sections */}
            <div className="px-8 py-6 space-y-6 print:bg-white print:text-black">
              {sections.map((sec, idx) => (
                <div key={idx} className="border-b border-slate-700/30 pb-6 last:border-0 last:pb-0 print:border-gray-200">
                  <h3 className="text-base font-bold text-teal-300 print:text-black mb-3">
                    {idx + 1}. {sec.title}
                  </h3>
                  <div className="text-sm text-slate-300 print:text-gray-800 leading-relaxed whitespace-pre-wrap min-h-[40px]">
                    {sec.content || <span className="text-slate-600 print:text-gray-400 italic">לא הוזן תוכן לסעיף זה</span>}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="px-8 py-4 border-t border-slate-700/40 print:bg-white print:text-gray-400">
              <p className="text-xs text-slate-600 print:text-gray-400 text-center">
                דוח זה הופק על ידי Tax Solver AI · {new Date().toLocaleString('he-IL')} ·
                הדוח מיועד לסיוע מקצועי בלבד ואינו מהווה ייעוץ משפטי/מיסויי
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body { background: white !important; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  )
}
