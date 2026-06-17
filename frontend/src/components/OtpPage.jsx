import { useState, useEffect, useRef } from 'react'
import AuthBackground from './AuthBackground'

const APP_NAME = import.meta.env.VITE_APP_NAME || '2FA Email Bypass'

export default function OtpPage({ email, onVerify, onResend, onBack }) {
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [resendBusy, setResendBusy] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [success, setSuccess] = useState('')
  const [shake, setShake] = useState(false)
  const inputs = useRef([])

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  useEffect(() => {
    inputs.current[0]?.focus()
  }, [])

  const focusNext = (i) => {
    if (i < 5) inputs.current[i + 1]?.focus()
  }

  const handleChange = (i, val) => {
    if (!/^\d?$/.test(val)) return
    const copy = [...otp]
    copy[i] = val
    setOtp(copy)
    if (val) focusNext(i)
  }

  const handleKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !otp[i] && i > 0) {
      inputs.current[i - 1]?.focus()
    }
  }

  const handlePaste = (e) => {
    e.preventDefault()
    const data = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    const copy = [...otp]
    for (let i = 0; i < 6; i++) copy[i] = data[i] || ''
    setOtp(copy)
    const next = Math.min(data.length, 5)
    inputs.current[next]?.focus()
  }

  const handleSubmit = async (e) => {
    e && e.preventDefault()
    const code = otp.join('')
    if (code.length !== 6) { setError('Enter all 6 digits'); setShake(true); setTimeout(() => setShake(false), 500); return }
    setBusy(true); setError('')
    try {
      await onVerify(email, code)
    } catch (err) {
      setError(err.response?.data?.detail || 'Verification failed')
      setShake(true)
      setTimeout(() => setShake(false), 500)
      setBusy(false)
    }
  }

  const handleResend = async () => {
    setResendBusy(true); setError(''); setSuccess('')
    try {
      await onResend(email)
      setCooldown(60)
      setSuccess('OTP sent! Check your email.')
      setOtp(['', '', '', '', '', ''])
      inputs.current[0]?.focus()
    } catch (err) {
      setError(err.response?.data?.detail || 'Resend failed')
    } finally {
      setResendBusy(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 relative overflow-hidden">
      <AuthBackground />

      <div className="relative z-10 w-full max-w-md animate-scale-in">
        <div className="bg-gray-900/80 backdrop-blur-xl border border-gray-800/60 rounded-2xl p-8 sm:p-10 shadow-2xl shadow-green-900/10 animate-glow">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-green-500/10 border border-green-500/20 mb-4 animate-float relative">
              <span className="text-3xl">✉</span>
              <div className="absolute inset-0 rounded-2xl border border-green-500/30 animate-pulse-ring" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-wider">
              {APP_NAME.split('_').map((part, i, arr) => (
                <span key={i}>
                  {part}{i < arr.length - 1 && <span className="text-green-400">_</span>}
                </span>
              ))}
            </h1>
            <p className="text-xs text-gray-500 mt-2 tracking-widest uppercase">Email Verification</p>
          </div>

          <div className="text-center mb-6">
            <p className="text-xs text-gray-500">We sent a 6-digit code to</p>
            <p className="text-sm text-green-400 mt-1 font-medium break-all">{email}</p>
          </div>

          <form onSubmit={handleSubmit} className={shake ? 'animate-shake' : ''}>
            <div className="flex justify-center gap-2 sm:gap-3 mb-6">
              {otp.map((d, i) => (
                <input
                  key={i}
                  ref={(el) => (inputs.current[i] = el)}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={d}
                  onChange={(e) => handleChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  onPaste={i === 0 ? handlePaste : undefined}
                  className={`w-11 h-13 sm:w-12 sm:h-14 text-center text-xl font-bold rounded-xl transition-all duration-300 focus:outline-none ${
                    d
                      ? 'bg-green-500/10 border-2 border-green-500/50 text-green-300 shadow-lg shadow-green-500/10'
                      : 'bg-gray-800/50 border border-gray-700/50 text-green-300 focus:border-green-500/50 focus:bg-gray-800/80'
                  }`}
                />
              ))}
            </div>

            {error && (
              <div className="mb-4 flex items-center gap-2 text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 animate-slide-down">
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {error}
              </div>
            )}

            {success && (
              <div className="mb-4 flex items-center gap-2 text-green-400 text-xs bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2 animate-slide-down">
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {success}
              </div>
            )}

            <button type="submit" disabled={busy}
              className="w-full bg-green-600 hover:bg-green-500 text-white font-semibold py-3 rounded-xl text-sm transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden group">
              <span className="relative z-10 flex items-center justify-center gap-2">
                {busy ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    verifying...
                  </>
                ) : (
                  <>
                    Verify Code
                    <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </>
                )}
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-green-600 to-green-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </button>
          </form>

          <p className="text-[10px] text-gray-600 text-center mt-4">
            Code expires in 5 minutes
          </p>

          <div className="flex items-center justify-between mt-4 text-xs">
            <button
              onClick={handleResend}
              disabled={resendBusy || cooldown > 0}
              className="text-gray-500 hover:text-green-400 transition disabled:opacity-40 relative group"
            >
              {cooldown > 0 ? (
                <span className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  resend in {cooldown}s
                </span>
              ) : resendBusy ? 'sending...' : 'resend code'}
              {cooldown <= 0 && !resendBusy && <span className="absolute bottom-0 left-0 w-0 h-px bg-green-400 group-hover:w-full transition-all duration-300" />}
            </button>
            <button onClick={onBack} className="text-gray-500 hover:text-green-400 transition relative group">
              back to login
              <span className="absolute bottom-0 left-0 w-0 h-px bg-green-400 group-hover:w-full transition-all duration-300" />
            </button>
          </div>
        </div>

        <p className="text-center text-[10px] text-gray-700 mt-6">
          For authorized security testing only
        </p>
      </div>
    </div>
  )
}
