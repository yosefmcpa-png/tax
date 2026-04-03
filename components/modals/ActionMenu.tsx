'use client'

import { useState, useRef, useEffect } from 'react'
import { ActionType } from '@/types'

interface Action {
  type: ActionType
  label: string
  icon: React.ReactNode
}

const ACTIONS: Action[] = [
  { type: 'summarize',     label: 'סכם דוח',             icon: <SumIcon /> },
  { type: 'explain',       label: 'הסבר פשוט',           icon: <InfoIcon /> },
  { type: 'email',         label: 'נסח מייל ללקוח',      icon: <MailIcon /> },
  { type: 'risk',          label: 'הערכת סיכונים',        icon: <WarnIcon /> },
  { type: 'agenda',        label: 'סדר יום לפגישה',      icon: <CalIcon /> },
  { type: 'international', label: 'היבטים בינלאומיים',   icon: <GlobeIcon /> },
  { type: 'predict',       label: 'חזה תוצאות',          icon: <StarIcon /> },
  { type: 'checklist',     label: 'רשימת מסמכים',        icon: <CheckIcon /> },
  { type: 'appeal',        label: 'נסח מכתב ערעור',      icon: <DocIcon /> },
  { type: 'planning',      label: 'המלצות תכנון מס',     icon: <LightIcon /> },
  { type: 'compare',       label: 'השווה לפסיקה',        icon: <ScaleIcon /> },
  { type: 'extract',       label: 'חלץ נתונים',          icon: <FilterIcon /> },
]

interface Props {
  onAction: (type: ActionType) => void
  disabled?: boolean
}

export default function ActionMenu({ onAction, disabled }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen(o => !o)}
        disabled={disabled}
        className="flex items-center gap-2 px-4 py-2 rounded-full border border-indigo-500/40 text-indigo-300 hover:bg-indigo-500/10 text-sm font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <span>כלי ניתוח</span>
        <svg className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 20 20">
          <path d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.27a.75.75 0 01.02-1.06z"/>
        </svg>
      </button>

      {open && (
        <div className="absolute bottom-full mb-2 right-0 w-56 rounded-xl border border-teal-500/30 shadow-2xl overflow-hidden z-50"
             style={{ background: 'rgba(10,15,30,0.97)', backdropFilter: 'blur(20px)' }}>
          {ACTIONS.map(action => (
            <button
              key={action.type}
              onClick={() => { setOpen(false); onAction(action.type) }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-right text-sm text-slate-300 hover:bg-teal-500/10 hover:text-teal-300 border-b border-slate-700/40 last:border-0 transition"
            >
              <span className="text-teal-500/70 flex-shrink-0">{action.icon}</span>
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ---- Micro icons ----
function SumIcon()    { return <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v1H5V4zM5 7h10v9a2 2 0 01-2 2H7a2 2 0 01-2-2V7z"/></svg> }
function InfoIcon()   { return <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"/></svg> }
function MailIcon()   { return <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"/><path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"/></svg> }
function WarnIcon()   { return <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.21 3.03-1.742 3.03H4.42c-1.532 0-2.492-1.696-1.742-3.03l5.58-9.92zM10 13a1 1 0 110-2 1 1 0 010 2zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/></svg> }
function CalIcon()    { return <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd"/></svg> }
function GlobeIcon()  { return <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM4.332 8.027a6.012 6.012 0 011.912-2.706C6.512 5.73 6.974 6 7.5 6A1.5 1.5 0 019 7.5V8a2 2 0 004 0 2 2 0 011.523-1.943A5.977 5.977 0 0116 10c0 .34-.028.675-.083 1H15a2 2 0 00-2 2v2.197A5.973 5.973 0 0110 16v-2a2 2 0 00-2-2 2 2 0 01-2-2 2 2 0 00-1.668-.973z" clipRule="evenodd"/></svg> }
function StarIcon()   { return <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg> }
function CheckIcon()  { return <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg> }
function DocIcon()    { return <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4zm3 1a1 1 0 000 2h6a1 1 0 100-2H7z" clipRule="evenodd"/></svg> }
function LightIcon()  { return <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 001.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z"/><path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z"/></svg> }
function ScaleIcon()  { return <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path d="M2 5a2 2 0 012-2h12a2 2 0 012 2v2a2 2 0 01-2 2H4a2 2 0 01-2-2V5zm14 1a1 1 0 10-2 0v1a1 1 0 102 0V6zM2 13a2 2 0 012-2h12a2 2 0 012 2v2a2 2 0 01-2 2H4a2 2 0 01-2-2v-2zm14 1a1 1 0 10-2 0v1a1 1 0 102 0v-1z"/></svg> }
function FilterIcon() { return <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd"/></svg> }
