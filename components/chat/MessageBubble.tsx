'use client'

import { useEffect, useRef } from 'react'
import { marked } from 'marked'
import isomorphicDompurify from 'isomorphic-dompurify'
import { UIMessage, Source } from '@/types'

marked.setOptions({ breaks: true })

function processMarkdown(text: string, sources: Source[]): string {
  const unique = [...new Map(sources.map(s => [s.uri, s])).values()]
  const withCitations = text.replace(/\[(\d+)\]/g, (match, num) => {
    const idx = parseInt(num, 10) - 1
    if (idx >= 0 && idx < unique.length) {
      return `<a href="${unique[idx].uri}" target="_blank" rel="noopener noreferrer" class="citation" title="${unique[idx].title}">[${num}]</a>`
    }
    return match
  })
  const rawHtml = marked.parse(withCitations) as string
  return isomorphicDompurify.sanitize(rawHtml, { ADD_ATTR: ['target', 'rel'] })
}

interface Props {
  message: UIMessage
}

export default function MessageBubble({ message }: Props) {
  const { role, content, sources = [], error, isLoading, timestamp } = message
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Scroll into view on mount
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [])

  if (isLoading) {
    return (
      <div ref={ref} className="animate-fade-slide-in flex justify-end mb-4">
        <div className="rounded-xl border border-teal-500/30 backdrop-blur-md px-6 py-4 max-w-md"
             style={{ background: 'rgba(15,23,42,0.7)' }}>
          <div className="flex items-center gap-3">
            <svg className="h-5 w-5 text-teal-400 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            <span className="text-slate-300 text-sm">{content}</span>
          </div>
        </div>
      </div>
    )
  }

  const isUser = role === 'user'

  return (
    <div ref={ref} className={`animate-fade-slide-in flex mb-4 ${isUser ? 'justify-start' : 'justify-end'}`}>
      <div className={`rounded-xl border backdrop-blur-md px-5 py-4 max-w-3xl w-full shadow-lg ${
        error
          ? 'border-rose-500/40 bg-rose-900/20 text-rose-300'
          : isUser
          ? 'border-indigo-500/40 bg-indigo-900/20'
          : 'border-teal-500/20 bg-slate-900/60'
      }`}>
        {/* Timestamp */}
        <div className="text-xs text-slate-500 mb-3 pb-2 border-b border-slate-700/50">
          {isUser ? 'שאילתה' : 'Tax Solver Agent'} · {timestamp.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
        </div>

        {/* Content */}
        <div
          className="prose prose-invert max-w-none"
          dangerouslySetInnerHTML={{
            __html: isUser
              ? isomorphicDompurify.sanitize(content.replace(/\n/g, '<br>'))
              : processMarkdown(content, sources),
          }}
        />

        {/* Sources */}
        {!isUser && sources.length > 0 && (
          <div className="mt-4 pt-3 border-t border-slate-700/50">
            <p className="text-xs text-slate-500 font-semibold mb-2">מקורות:</p>
            <ol className="space-y-1">
              {[...new Map(sources.map(s => [s.uri, s])).values()].map((src, i) => (
                <li key={src.uri} className="text-xs">
                  <span className="text-slate-500">{i + 1}. </span>
                  <a href={src.uri} target="_blank" rel="noopener noreferrer"
                     className="text-teal-400 hover:text-teal-300 hover:underline transition">
                    {src.title || src.uri}
                  </a>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </div>
  )
}
