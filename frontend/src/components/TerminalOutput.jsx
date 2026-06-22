import React, { useEffect, useRef, useState, useMemo } from 'react'

function renderLine(line) {
  if (line.startsWith('$')) {
    return <span className="text-cyan-400">{line}</span>
  }
  if (line.startsWith('  [ERR]')) {
    return <span className="text-red-400">{line}</span>
  }
  if (line.startsWith('<timestamp:')) {
    return <span className="text-yellow-500 text-[11px]">{line}</span>
  }
  const parts = line.split(/(https?:\/\/[^\s]+)/g)
  return (
    <span className="text-green-300">
      {parts.map((part, i) =>
        /^https?:\/\//.test(part) ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 underline hover:text-blue-300"
          >
            {part}
          </a>
        ) : (
          part
        )
      )}
    </span>
  )
}

function getTimestamp(line) {
  const tsMatch = line.match(/<timestamp:([^>]+)>/)
  if (tsMatch) return tsMatch[1]
  return null
}

function formatTimestamp(ts) {
  try {
    const date = new Date(ts)
    if (isNaN(date.getTime())) return ts
    return date.toLocaleTimeString()
  } catch {
    return ts
  }
}

export default function TerminalOutput({ logs, onClear }) {
  const bottomRef = useRef(null)
  const containerRef = useRef(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [autoScroll, setAutoScroll] = useState(true)

  const filteredLogs = useMemo(() => {
    if (!searchTerm.trim()) return logs
    const term = searchTerm.toLowerCase()
    return logs.filter(log => log.toLowerCase().includes(term))
  }, [logs, searchTerm])

  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [filteredLogs, autoScroll])

  const handleScroll = () => {
    if (!containerRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50
    if (!isAtBottom && autoScroll) {
      setAutoScroll(false)
    }
  }

  return (
    <div className="bg-gray-900 flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-800 shrink-0">
        <div className="flex-1 flex items-center gap-2 bg-gray-950 rounded px-2 py-1">
          <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filter logs..."
            className="bg-transparent text-xs text-gray-300 placeholder-gray-600 focus:outline-none w-full"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="text-gray-500 hover:text-gray-300 text-xs"
            >
              ×
            </button>
          )}
        </div>
        <button
          onClick={() => setAutoScroll(!autoScroll)}
          className={`px-2 py-1 text-[10px] rounded transition ${
            autoScroll
              ? 'bg-green-900/50 text-green-300'
              : 'bg-gray-800 text-gray-400 hover:text-gray-300'
          }`}
          title={autoScroll ? 'Auto-scroll ON' : 'Auto-scroll OFF'}
        >
          ⬇ {autoScroll ? 'ON' : 'OFF'}
        </button>
        <button
          onClick={onClear}
          className="px-2 py-1 text-[10px] rounded bg-gray-800 text-gray-400 hover:text-green-300 transition"
        >
          Clear
        </button>
      </div>

      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-2"
      >
        {filteredLogs.length === 0 ? (
          <span className="text-gray-600 italic text-xs">
            {searchTerm ? 'No matching logs...' : 'Awaiting command...'}
          </span>
        ) : (
          filteredLogs.map((line, i) => {
            const timestamp = getTimestamp(line)
            return (
              <div key={i} className="flex items-start gap-2 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap break-all group">
                {timestamp && (
                  <span className="text-gray-600 text-[10px] shrink-0 pt-0.5">
                    {formatTimestamp(timestamp)}
                  </span>
                )}
                <span className={timestamp ? '' : 'pl-0'}>{renderLine(line)}</span>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
