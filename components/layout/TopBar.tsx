'use client'

export default function TopBar() {
  return (
    <header className="flex-shrink-0 flex items-center justify-between px-6 py-3 border-b border-slate-700/50 backdrop-blur-xl z-10"
            style={{ background: 'rgba(10,15,30,0.6)' }}>
      <div className="flex items-center gap-3">
        {/* Status LED */}
        <div className="flex items-center gap-1.5 text-xs font-semibold text-green-400">
          <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse-green" />
          קישור מאובטח
        </div>
        <div className="h-3 w-px bg-slate-700" />
        <span className="text-xs text-slate-500">
          כל הקריאות ל-AI מוצפנות ומאובטחות
        </span>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-600 border border-slate-700 rounded px-2 py-0.5">
          Powered by Gemini 2.5 Flash
        </span>
      </div>
    </header>
  )
}
