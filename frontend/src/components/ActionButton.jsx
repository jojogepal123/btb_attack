import React from 'react'

export default function ActionButton({ label, loading, disabled, onClick }) {
  const isBusy = loading || disabled

  return (
    <button
      onClick={onClick}
      disabled={isBusy}
      className={`
        relative px-6 py-3 rounded border font-semibold text-sm tracking-wider uppercase
        transition-all duration-200
        ${
          isBusy
            ? 'border-gray-700 text-gray-600 cursor-not-allowed bg-gray-900'
            : 'border-green-500 text-green-300 bg-gray-900 hover:bg-green-900 hover:text-green-200 hover:shadow-[0_0_20px_rgba(34,197,94,0.3)] active:scale-95'
        }
      `}
    >
      {loading && (
        <span className="absolute left-3 top-1/2 -translate-y-1/2">
          <span className="inline-block w-2 h-2 bg-green-400 rounded-full animate-ping" />
        </span>
      )}
      {loading ? `${label}...` : label}
    </button>
  )
}
