import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import AuthBackground from './AuthBackground'

const glitchLines = [
  '> ACCESS REQUEST...',
  '> SCANNING CREDENTIALS...',
  '> CHECKING AUTHORIZATION LEVEL...',
  '> STATUS: DENIED',
  '> REASON: REGISTRATION DISABLED BY ADMINISTRATOR',
  '> CONNECTION TERMINATED',
]

function GlitchTerminal() {
  const [lines, setLines] = useState([])
  const [done, setDone] = useState(false)
  const indexRef = useRef(0)

  useEffect(() => {
    const interval = setInterval(() => {
      if (indexRef.current < glitchLines.length) {
        const idx = indexRef.current
        setLines((prev) => [...prev, glitchLines[idx]])
        indexRef.current++
      } else {
        setDone(true)
        clearInterval(interval)
      }
    }, 600)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="rounded-xl border border-red-500/20 bg-gray-950/80 backdrop-blur-sm overflow-hidden shadow-2xl shadow-red-900/20 w-full max-w-md">
      <div className="flex items-center gap-2 px-4 py-3 bg-gray-900/80 border-b border-gray-800/50">
        <div className="w-3 h-3 rounded-full bg-red-500/80" />
        <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
        <div className="w-3 h-3 rounded-full bg-green-500/80" />
        <span className="ml-2 text-xs text-gray-500 font-mono">access-control</span>
      </div>
      <div className="p-3 font-mono text-xs leading-relaxed space-y-1 max-h-32 overflow-hidden">
        {lines.map((line, i) => (
          <div
            key={i}
            className="animate-fadeIn"
            style={{ animationDelay: `${i * 0.05}s` }}
          >
            <span
              className={
                line.includes('DENIED') || line.includes('TERMINATED')
                  ? 'text-red-400 font-bold'
                  : line.includes('DISABLED')
                  ? 'text-yellow-400'
                  : 'text-gray-500'
              }
            >
              {line}
            </span>
          </div>
        ))}
        {!done && <span className="inline-block w-2 h-4 bg-green-400 animate-blink ml-1" />}
      </div>
    </div>
  )
}

function GlitchText({ text }) {
  const [glitch, setGlitch] = useState(false)

  useEffect(() => {
    const interval = setInterval(() => {
      setGlitch(true)
      setTimeout(() => setGlitch(false), 200)
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="relative inline-block">
      <h1
        className={`text-6xl sm:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-b from-red-500 to-red-600 tracking-tighter select-none transition-all duration-100 ${
          glitch ? 'translate-x-1 -translate-y-1 skew-x-1' : ''
        }`}
      >
        {text}
      </h1>
      {glitch && (
        <>
          <h1
            className="absolute inset-0 text-6xl sm:text-7xl font-black text-red-400/30 tracking-tighter select-none -translate-x-1 translate-y-1 skew-x-[-2deg]"
            aria-hidden
          >
            {text}
          </h1>
          <h1
            className="absolute inset-0 text-6xl sm:text-7xl font-black text-cyan-400/20 tracking-tighter select-none translate-x-1 -skew-x-1"
            aria-hidden
          >
            {text}
          </h1>
        </>
      )}
    </div>
  )
}

function ShieldIcon() {
  return (
    <div className="relative mb-4 animate-float">
      <div className="absolute inset-0 w-16 h-16 mx-auto rounded-full bg-red-500/10 animate-pulse-ring" />
      <div className="absolute inset-0 w-16 h-16 mx-auto rounded-full border border-red-500/20" />
      <div className="relative w-16 h-16 mx-auto rounded-full bg-gradient-to-b from-red-500/20 to-red-600/10 border border-red-500/30 flex items-center justify-center backdrop-blur-sm">
        <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>
    </div>
  )
}

function ScanLines() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-20">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(34,197,94,0.03) 2px, rgba(34,197,94,0.03) 4px)',
        }}
      />
    </div>
  )
}

export default function AccessDenied() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 relative overflow-hidden">
      <AuthBackground />
      <ScanLines />

      <div className="relative z-10 w-full max-w-lg animate-scale-in">
        <div className="bg-gray-900/60 backdrop-blur-xl border border-red-500/20 rounded-2xl p-6 sm:p-8 shadow-2xl shadow-red-900/10">
          <div className="text-center">
            <ShieldIcon />

            <GlitchText text="403" />

            <div className="mt-4 mb-4">
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-wider mb-2">
                ACCESS DENIED
              </h2>
              <div className="w-16 h-0.5 mx-auto bg-gradient-to-r from-red-500 to-red-600 rounded-full" />
            </div>

            <p className="text-gray-400 text-xs sm:text-sm leading-relaxed mb-6 max-w-sm mx-auto">
              Registration is currently disabled by the administrator.
            </p>

            <div className="mb-6">
              <GlitchTerminal />
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/login"
                className="group px-8 py-3.5 rounded-xl bg-green-600 text-white font-bold text-sm hover:bg-green-500 transition-all duration-200 shadow-lg shadow-green-600/30 hover:shadow-green-500/40 hover:scale-105 relative overflow-hidden"
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  Sign In
                  <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-green-600 to-green-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </Link>
              <Link
                to="/"
                className="px-8 py-3.5 rounded-xl bg-gray-800/50 border border-gray-700/50 text-gray-300 text-sm hover:bg-gray-800 hover:border-gray-600 transition-all duration-200 hover:scale-105"
              >
                Back to Home
              </Link>
            </div>
          </div>
        </div>

        <p className="text-center text-[10px] text-gray-700 mt-6">
          For authorized security testing only
        </p>
      </div>
    </div>
  )
}
