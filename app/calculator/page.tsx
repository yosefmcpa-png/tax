'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { calculateTax, formatILS, PRESETS, TaxInput } from '@/lib/tax/calculator'

const CREDIT_OPTIONS = [
  { key: 'resident',    label: 'תושב ישראל',       points: 2.25 },
  { key: 'child05',     label: 'ילד 0-5',           points: 1.5  },
  { key: 'child617',    label: 'ילד 6-17',          points: 1    },
  { key: 'singleParent',label: 'הורה יחיד',         points: 1    },
  { key: 'newImm',      label: 'עולה חדש',          points: 3    },
  { key: 'soldier',     label: 'שחרור מצבא',        points: 0.5  },
  { key: 'disabled',    label: 'נכות',              points: 2    },
]

export default function CalculatorPage() {
  const [income,   setIncome]   = useState(180_000)
  const [type,     setType]     = useState<'employee' | 'self_employed'>('employee')
  const [pension,  setPension]  = useState(6)
  const [credits,  setCredits]  = useState<Set<string>>(new Set(['resident']))
  const [vatRev,   setVatRev]   = useState(0)
  const [showVAT,  setShowVAT]  = useState(false)

  const totalCredits = useMemo(() =>
    CREDIT_OPTIONS.filter(o => credits.has(o.key)).reduce((s, o) => s + o.points, 0),
    [credits])

  const input: TaxInput = {
    annualIncome:   income,
    employeeType:   type,
    creditPoints:   totalCredits,
    pensionPercent: pension,
    includeVAT:     showVAT,
    vatableRevenue: vatRev,
  }

  const result = useMemo(() => calculateTax(input), [income, type, totalCredits, pension, showVAT, vatRev]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleCredit = (key: string) => {
    setCredits(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const applyPreset = (p: typeof PRESETS[number]) => {
    setIncome(p.income)
    setType(p.type)
    setPension(p.pension)
    setCredits(new Set(['resident']))
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6" dir="rtl">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-white">מחשבון מס ישראלי 2024</h1>
            <p className="text-slate-500 text-sm mt-0.5">מס הכנסה · ביטוח לאומי · מע&quot;מ</p>
          </div>
          <Link href="/demo" className="text-sm px-3 py-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-slate-200 transition">
            ← חזרה
          </Link>
        </div>

        {/* Presets */}
        <div className="flex flex-wrap gap-2 mb-5">
          {PRESETS.map(p => (
            <button key={p.label} onClick={() => applyPreset(p)}
              className="text-xs px-3 py-1.5 rounded-full border border-slate-700 text-slate-400
                         hover:border-teal-500/40 hover:text-teal-400 transition">
              {p.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

          {/* Inputs — Left */}
          <div className="lg:col-span-2 space-y-4">

            {/* Income */}
            <div className="rounded-xl border border-slate-700/50 bg-slate-900/60 p-4">
              <h3 className="text-sm font-semibold text-slate-300 mb-3">הכנסה שנתית</h3>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl font-bold text-teal-400">{formatILS(income)}</span>
              </div>
              <input type="range" min={30_000} max={1_500_000} step={6_000}
                value={income} onChange={e => setIncome(+e.target.value)}
                className="w-full accent-teal-500 mb-2" />
              <div className="flex justify-between text-xs text-slate-600">
                <span>₪30K</span><span>₪750K</span><span>₪1.5M</span>
              </div>
              <input type="number" value={income} onChange={e => setIncome(+e.target.value)}
                className="mt-3 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2
                           text-sm text-slate-200 focus:outline-none focus:border-teal-500 transition" />
            </div>

            {/* Type */}
            <div className="rounded-xl border border-slate-700/50 bg-slate-900/60 p-4">
              <h3 className="text-sm font-semibold text-slate-300 mb-3">סוג עובד</h3>
              <div className="grid grid-cols-2 gap-2">
                {(['employee', 'self_employed'] as const).map(t => (
                  <button key={t} onClick={() => setType(t)}
                    className={`py-2 rounded-lg text-sm font-medium border transition ${
                      type === t
                        ? 'bg-teal-500/15 border-teal-500/50 text-teal-300'
                        : 'border-slate-700 text-slate-500 hover:border-slate-600 hover:text-slate-300'
                    }`}>
                    {t === 'employee' ? '👔 שכיר' : '💼 עצמאי'}
                  </button>
                ))}
              </div>
            </div>

            {/* Pension */}
            <div className="rounded-xl border border-slate-700/50 bg-slate-900/60 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-300">הפקדה לפנסיה</h3>
                <span className="text-teal-400 font-bold">{pension}%</span>
              </div>
              <input type="range" min={0} max={7} step={0.5}
                value={pension} onChange={e => setPension(+e.target.value)}
                className="w-full accent-teal-500" />
              <div className="flex justify-between text-xs text-slate-600 mt-1">
                <span>0%</span><span>3.5%</span><span>7% (מקסימום)</span>
              </div>
              <p className="text-xs text-slate-600 mt-2">
                חיסכון מס: {formatILS(result.pensionDeduction * 0.20)}–{formatILS(result.pensionDeduction * 0.35)}
              </p>
            </div>

            {/* Credit points */}
            <div className="rounded-xl border border-slate-700/50 bg-slate-900/60 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-300">נקודות זיכוי</h3>
                <span className="text-teal-400 font-bold">{totalCredits.toFixed(2)} נק&apos;</span>
              </div>
              <div className="space-y-1.5">
                {CREDIT_OPTIONS.map(o => (
                  <label key={o.key} className="flex items-center gap-2 cursor-pointer group">
                    <input type="checkbox" checked={credits.has(o.key)}
                      onChange={() => toggleCredit(o.key)}
                      className="accent-teal-500 w-3.5 h-3.5" />
                    <span className="text-xs text-slate-400 group-hover:text-slate-200 transition flex-1">
                      {o.label}
                    </span>
                    <span className="text-xs text-slate-600">{o.points}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* VAT */}
            {type === 'self_employed' && (
              <div className="rounded-xl border border-slate-700/50 bg-slate-900/60 p-4">
                <label className="flex items-center gap-2 cursor-pointer mb-3">
                  <input type="checkbox" checked={showVAT} onChange={e => setShowVAT(e.target.checked)}
                    className="accent-teal-500" />
                  <span className="text-sm font-semibold text-slate-300">חשב מע&quot;מ</span>
                </label>
                {showVAT && (
                  <>
                    <input type="number" value={vatRev} onChange={e => setVatRev(+e.target.value)}
                      placeholder="הכנסה חייבת מע״מ"
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2
                                 text-sm text-slate-200 focus:outline-none focus:border-teal-500" />
                    <p className="text-xs text-slate-600 mt-1">מע&quot;מ 17% — לגבות מהלקוח</p>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Results — Right */}
          <div className="lg:col-span-3 space-y-4">

            {/* Summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'ברוטו שנתי',   value: formatILS(result.grossIncome),    color: 'slate' },
                { label: 'נטו שנתי',     value: formatILS(result.netIncome),       color: 'teal'  },
                { label: 'נטו חודשי',    value: formatILS(result.monthlyNet),      color: 'teal'  },
                { label: 'שיעור אפקטיבי',value: `${result.effectiveRate.toFixed(1)}%`, color: 'amber' },
              ].map(card => (
                <div key={card.label}
                  className={`rounded-xl border p-3 text-center ${
                    card.color === 'teal'  ? 'border-teal-500/30 bg-teal-500/10' :
                    card.color === 'amber' ? 'border-amber-500/30 bg-amber-500/10' :
                                            'border-slate-700/50 bg-slate-900/60'
                  }`}>
                  <div className={`text-base font-bold ${
                    card.color === 'teal' ? 'text-teal-300' :
                    card.color === 'amber'? 'text-amber-300' : 'text-slate-200'
                  }`}>{card.value}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{card.label}</div>
                </div>
              ))}
            </div>

            {/* Breakdown */}
            <div className="rounded-xl border border-slate-700/50 bg-slate-900/60 p-4">
              <h3 className="text-sm font-semibold text-slate-300 mb-3">פירוט ניכויים</h3>
              <div className="space-y-2">
                {[
                  { label: 'הכנסה ברוטו',         value: result.grossIncome,       color: 'text-slate-200', sign: '' },
                  result.pensionDeduction > 0
                    ? { label: 'ניכוי פנסיה',      value: -result.pensionDeduction, color: 'text-teal-400',  sign: '-' }
                    : null,
                  { label: 'הכנסה חייבת',          value: result.taxableIncome,     color: 'text-slate-300', sign: '=', bold: true },
                  { label: 'מס הכנסה (לפני זיכוי)', value: result.incomeTaxGross,   color: 'text-rose-400',  sign: '-' },
                  result.creditReduction > 0
                    ? { label: 'זיכוי נקודות',     value: result.creditReduction,   color: 'text-teal-400',  sign: '+' }
                    : null,
                  { label: 'מס הכנסה נטו',          value: result.incomeTaxNet,     color: 'text-rose-300',  sign: '-', bold: true },
                  { label: 'ביטוח לאומי',            value: result.nationalInsurance,color: 'text-orange-400',sign: '-' },
                  result.healthInsurance > 0
                    ? { label: 'ביטוח בריאות',      value: result.healthInsurance,  color: 'text-orange-400',sign: '-' }
                    : null,
                  result.vatAmount > 0
                    ? { label: 'מע"מ לגבות (17%)',  value: result.vatAmount,        color: 'text-purple-400',sign: '+' }
                    : null,
                  { label: 'הכנסה נטו לשנה',         value: result.netIncome,        color: 'text-teal-300',  sign: '=', bold: true },
                ].filter(Boolean).map((row, i) => row && (
                  <div key={i} className={`flex justify-between items-center py-1.5 border-b border-slate-800/60 ${row.bold ? 'border-t border-slate-700/50 mt-1 pt-2' : ''}`}>
                    <span className={`text-xs ${row.bold ? 'font-semibold text-slate-200' : 'text-slate-400'}`}>
                      {row.label}
                    </span>
                    <span className={`text-sm font-mono ${row.color} ${row.bold ? 'font-bold' : ''}`}>
                      {row.sign === '-' ? '−' : row.sign === '+' ? '+' : row.sign === '=' ? '' : ''}
                      {' '}{formatILS(Math.abs(row.value))}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Tax brackets visual */}
            <div className="rounded-xl border border-slate-700/50 bg-slate-900/60 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-300">מדרגות מס</h3>
                <span className="text-xs text-slate-500">מס שולי: <span className="text-amber-400 font-bold">{result.marginalRate.toFixed(0)}%</span></span>
              </div>
              <div className="space-y-2">
                {result.brackets.map((b, i) => (
                  <div key={i}>
                    <div className="flex justify-between text-xs text-slate-500 mb-0.5">
                      <span>מדרגה {b.rate.toFixed(0)}%</span>
                      <span>{formatILS(b.amount)} → מס: {formatILS(b.tax)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.min(100, (b.amount / result.grossIncome) * 100)}%`,
                          background: `hsl(${170 - i * 25},70%,45%)`,
                        }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Marginal rate note */}
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-300/80">
              <strong>שיעור מס שולי: {result.marginalRate.toFixed(0)}%</strong> — על כל שקל נוסף מעבר להכנסה הנוכחית.
              {result.marginalRate >= 47 && ' ⚠️ שקול מבנה שכר-דיבידנד לאופטימיזציה.'}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
