'use client'

import { useMemo } from 'react'
import Link from 'next/link'

interface Deadline {
  date:     string   // MM-DD
  title:    string
  desc:     string
  category: 'income' | 'vat' | 'ni' | 'corporate' | 'property'
  urgent:   boolean
}

const DEADLINES: Deadline[] = [
  // מס הכנסה
  { date: '01-31', title: 'ניכויים במקור — דו"ח שנתי',          desc: 'הגשת דו"ח ניכויים במקור לשנת המס הקודמת',         category: 'income',    urgent: false },
  { date: '04-30', title: 'דו"ח שנתי — שכירים',                  desc: 'הגשת דו"ח מס הכנסה שנתי לשכירים (רשות)',          category: 'income',    urgent: false },
  { date: '05-31', title: 'דו"ח שנתי — עצמאים',                  desc: 'הגשת דו"ח מס הכנסה שנתי לעצמאים ובעלי חברות',    category: 'income',    urgent: true  },
  { date: '11-30', title: 'בקשת הארכה לדו"ח שנתי',               desc: 'מועד אחרון לבקשת הארכה להגשת הדו"ח השנתי',       category: 'income',    urgent: false },

  // מע"מ — דו-חודשי (ינואר, מרץ, מאי, יולי, ספטמבר, נובמבר)
  { date: '02-15', title: 'דו"ח מע"מ ינואר–פברואר',              desc: 'הגשה ותשלום מע"מ לחודשים ינואר-פברואר',          category: 'vat',       urgent: false },
  { date: '04-15', title: 'דו"ח מע"מ מרץ–אפריל',                 desc: 'הגשה ותשלום מע"מ לחודשים מרץ-אפריל',            category: 'vat',       urgent: false },
  { date: '06-15', title: 'דו"ח מע"מ מאי–יוני',                  desc: 'הגשה ותשלום מע"מ לחודשים מאי-יוני',             category: 'vat',       urgent: false },
  { date: '08-15', title: 'דו"ח מע"מ יולי–אוגוסט',               desc: 'הגשה ותשלום מע"מ לחודשים יולי-אוגוסט',          category: 'vat',       urgent: false },
  { date: '10-15', title: 'דו"ח מע"מ ספטמבר–אוקטובר',            desc: 'הגשה ותשלום מע"מ לחודשים ספטמבר-אוקטובר',       category: 'vat',       urgent: false },
  { date: '12-15', title: 'דו"ח מע"מ נובמבר–דצמבר',              desc: 'הגשה ותשלום מע"מ לחודשים נובמבר-דצמבר',         category: 'vat',       urgent: false },

  // ביטוח לאומי
  { date: '01-15', title: 'מקדמות ביטוח לאומי — ינואר',          desc: 'תשלום מקדמות ביטוח לאומי לעצמאים',               category: 'ni',        urgent: false },
  { date: '02-15', title: 'ניכויים — שכרים ינואר',               desc: 'העברת ניכויים לביטוח לאומי בגין שכר ינואר',      category: 'ni',        urgent: false },
  { date: '04-30', title: 'דו"ח שנתי ביטוח לאומי',               desc: 'הגשת דו"ח שנתי לביטוח לאומי',                   category: 'ni',        urgent: false },

  // מס חברות
  { date: '03-31', title: 'תשלום מס חברות — פעימה ראשונה',       desc: 'תשלום מקדמה על רווחי שנת המס הקודמת',            category: 'corporate', urgent: false },
  { date: '07-31', title: 'תשלום מס חברות — פעימה שנייה',        desc: 'תשלום פעימה שנייה של מס חברות',                  category: 'corporate', urgent: false },

  // מיסוי מקרקעין
  { date: '02-15', title: 'דיווח על עסקת נדל"ן',                 desc: 'דיווח על עסקת מקרקעין שנחתמה בחודש הקודם',       category: 'property',  urgent: false },
  { date: '07-15', title: 'ארנונה — הנחות ופטורים',               desc: 'הגשת בקשות הנחה בארנונה לשנת הכספים',           category: 'property',  urgent: false },
]

const CAT_COLORS: Record<Deadline['category'], { bg: string; text: string; border: string; label: string }> = {
  income:    { bg: 'bg-teal-500/10',   text: 'text-teal-300',   border: 'border-teal-500/30',   label: 'מס הכנסה'  },
  vat:       { bg: 'bg-purple-500/10', text: 'text-purple-300', border: 'border-purple-500/30', label: 'מע"מ'      },
  ni:        { bg: 'bg-blue-500/10',   text: 'text-blue-300',   border: 'border-blue-500/30',   label: 'ביטוח לאומי' },
  corporate: { bg: 'bg-amber-500/10',  text: 'text-amber-300',  border: 'border-amber-500/30',  label: 'מס חברות'  },
  property:  { bg: 'bg-rose-500/10',   text: 'text-rose-300',   border: 'border-rose-500/30',   label: 'מקרקעין'   },
}

export default function DeadlinesPage() {
  const now   = new Date()
  const year  = now.getFullYear()
  const today = now.toISOString().slice(0, 10)

  const enriched = useMemo(() => DEADLINES.map(d => {
    const full = `${year}-${d.date}`
    const dt   = new Date(full)
    const diff = Math.ceil((dt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    return { ...d, fullDate: full, daysLeft: diff }
  }).sort((a, b) => a.daysLeft - b.daysLeft), [year]) // eslint-disable-line react-hooks/exhaustive-deps

  const upcoming = enriched.filter(d => d.daysLeft >= 0).slice(0, 12)
  const past     = enriched.filter(d => d.daysLeft < 0).slice(-4).reverse()

  const nextDeadline = upcoming[0]

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6" dir="rtl">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-white">מועדים קריטיים {year}</h1>
            <p className="text-slate-500 text-sm mt-0.5">היום: {new Date(today).toLocaleDateString('he-IL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
          <Link href="/demo" className="text-sm px-3 py-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-slate-200 transition">← חזרה</Link>
        </div>

        {/* Next deadline banner */}
        {nextDeadline && (
          <div className={`rounded-xl p-4 mb-6 border ${nextDeadline.daysLeft <= 7 ? 'border-rose-500/40 bg-rose-500/10' : nextDeadline.daysLeft <= 30 ? 'border-amber-500/40 bg-amber-500/10' : 'border-teal-500/30 bg-teal-500/10'}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-400 mb-1">המועד הקרוב ביותר</p>
                <p className="text-base font-bold text-white">{nextDeadline.title}</p>
                <p className="text-sm text-slate-400 mt-0.5">{nextDeadline.desc}</p>
              </div>
              <div className="text-center flex-shrink-0 pr-2">
                <div className={`text-3xl font-black ${nextDeadline.daysLeft <= 7 ? 'text-rose-400' : nextDeadline.daysLeft <= 30 ? 'text-amber-400' : 'text-teal-400'}`}>
                  {nextDeadline.daysLeft}
                </div>
                <div className="text-xs text-slate-500">ימים</div>
              </div>
            </div>
          </div>
        )}

        {/* Category filter legend */}
        <div className="flex flex-wrap gap-2 mb-5">
          {Object.entries(CAT_COLORS).map(([cat, c]) => (
            <span key={cat} className={`text-xs px-2 py-1 rounded-full border ${c.bg} ${c.text} ${c.border}`}>
              {c.label}
            </span>
          ))}
        </div>

        {/* Upcoming */}
        <h2 className="text-sm font-semibold text-slate-400 mb-3">מועדים קרובים</h2>
        <div className="space-y-2 mb-8">
          {upcoming.map((d, i) => {
            const c = CAT_COLORS[d.category]
            const urgency = d.daysLeft <= 7 ? 'border-rose-500/50' : d.daysLeft <= 30 ? 'border-amber-500/30' : 'border-slate-700/50'
            return (
              <div key={i} className={`rounded-xl border ${urgency} bg-slate-900/60 p-3 flex items-center gap-4`}>
                {/* Date */}
                <div className="flex-shrink-0 w-12 text-center">
                  <div className="text-lg font-black text-slate-300">{d.date.split('-')[1]}</div>
                  <div className="text-xs text-slate-600">{['ינו','פבר','מרץ','אפר','מאי','יוני','יולי','אוג','ספט','אוק','נוב','דצ'][parseInt(d.date.split('-')[0])-1]}</div>
                </div>
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-200">{d.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{d.desc}</p>
                </div>
                {/* Days + badge */}
                <div className="flex-shrink-0 flex flex-col items-end gap-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${c.bg} ${c.text} ${c.border}`}>{c.label}</span>
                  <span className={`text-xs font-bold ${d.daysLeft <= 7 ? 'text-rose-400' : d.daysLeft <= 30 ? 'text-amber-400' : 'text-slate-500'}`}>
                    {d.daysLeft === 0 ? 'היום!' : `${d.daysLeft}י`}
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Past */}
        {past.length > 0 && (
          <>
            <h2 className="text-sm font-semibold text-slate-600 mb-3">עברו לאחרונה</h2>
            <div className="space-y-2 opacity-50">
              {past.map((d, i) => (
                <div key={i} className="rounded-xl border border-slate-800 bg-slate-900/30 p-3 flex items-center gap-4">
                  <div className="flex-shrink-0 w-12 text-center">
                    <div className="text-lg font-black text-slate-600">{d.date.split('-')[1]}</div>
                    <div className="text-xs text-slate-700">{['ינו','פבר','מרץ','אפר','מאי','יוני','יולי','אוג','ספט','אוק','נוב','דצ'][parseInt(d.date.split('-')[0])-1]}</div>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-slate-500">{d.title}</p>
                  </div>
                  <span className="text-xs text-slate-700">עבר</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
