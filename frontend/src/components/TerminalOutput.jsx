import React, { useEffect, useRef } from 'react'

function renderLine(line) {
  if (line.startsWith('$')) {
    return <span className="text-cyan-400">{line}</span>
  }
  if (line.startsWith('  [ERR]')) {
    return <span className="text-red-400">{line}</span>
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

export default function TerminalOutput({ logs, onClear }) {
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  return (
    <div className="mt-6 bg-gray-900 border border-gray-800 rounded-lg p-4 max-h-80 overflow-y-auto">
      <div className="flex items-center justify-between mb-2 text-xs text-gray-500">
        <span>terminal — output</span>
        {logs.length > 0 && (
          <button onClick={onClear} className="hover:text-green-400 transition">
            clear
          </button>
        )}
      </div>
      {logs.length === 0 ? (
        <span className="text-gray-600 italic">Awaiting command...</span>
      ) : (
        logs.map((line, i) => (
          <div key={i} className="text-sm leading-relaxed whitespace-pre-wrap">
            {renderLine(line)}
          </div>
        ))
      )}
      <div ref={bottomRef} />
    </div>
  )
}
