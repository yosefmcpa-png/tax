'use client'

import { useRef, useState } from 'react'
import { useCaseStore } from '@/store/caseStore'
import { ActionType } from '@/types'

interface Props {
  onSubmit: (query: string, actionType: ActionType) => void
  disabled: boolean
  placeholder?: string
  showFilters?: boolean
}

export default function InputBar({ onSubmit, disabled, placeholder, showFilters = true }: Props) {
  const [text, setText] = useState('')
  const { sourceGov, sourceNews, sourceForums, toggleSource } = useCaseStore()
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = () => {
    const q = text.trim()
    if (!q || disabled) return
    onSubmit(q, 'research')
    setText('')
    inputRef.current?.focus()
  }

  return (
    <div className="w-full max-w-3xl mx-auto">
      {/* Input bar */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-2xl border border-teal-500/40 backdrop-blur-xl shadow-lg"
           style={{ background: 'rgba(30,41,59,0.6)' }}>
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit() } }}
          disabled={disabled}
          placeholder={placeholder ?? 'הזן סוגיית מס למחקר...'}
          className="flex-grow bg-transparent border-none text-slate-200 placeholder-slate-500 text-base px-2 py-1 focus:outline-none disabled:opacity-50"
        />
        <button
          onClick={handleSubmit}
          disabled={disabled || !text.trim()}
          className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: 'linear-gradient(45deg, #2dd4bf, #5eead4)' }}
          title="שלח"
        >
          {disabled ? (
            <svg className="h-4 w-4 text-slate-900 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
          ) : (
            <svg className="h-4 w-4 text-slate-900" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          )}
        </button>
      </div>

      {/* Source filters */}
      {showFilters && (
        <div className="mt-2 flex justify-center gap-4 text-xs text-slate-500 flex-wrap">
          <span>מקורות:</span>
          {([
            ['sourceGov',    'ממשלתי'],
            ['sourceNews',   'חדשות'],
            ['sourceForums', 'פורומים'],
          ] as const).map(([key, label]) => (
            <label key={key} className="flex items-center gap-1 cursor-pointer hover:text-slate-300 transition">
              <input
                type="checkbox"
                checked={key === 'sourceGov' ? sourceGov : key === 'sourceNews' ? sourceNews : sourceForums}
                onChange={() => toggleSource(key)}
                className="rounded border-slate-600 text-teal-500 focus:ring-teal-500 bg-transparent"
              />
              {label}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
