import { useState, useEffect, useRef } from 'react'

export default function OtpPage({ email, onVerify, onResend, onBack }) {
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [resendBusy, setResendBusy] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const inputs = useRef([])

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

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
    if (code.length !== 6) { setError('Enter all 6 digits'); return }
    setBusy(true); setError('')
    try {
      await onVerify(email, code)
    } catch (err) {
      setError(err.response?.data?.detail || 'Verification failed')
      setBusy(false)
    }
  }

  const handleResend = async () => {
    setResendBusy(true); setError('')
    try {
      await onResend(email)
      setCooldown(60)
      setOtp(['', '', '', '', '', ''])
      inputs.current[0]?.focus()
    } catch (err) {
      setError(err.response?.data?.detail || 'Resend failed')
    } finally {
      setResendBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-gray-900 border border-gray-800 rounded-lg p-8">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-green-400 tracking-widest drop-shadow-[0_0_8px_rgba(34,197,94,0.5)]">
            BTB_ATTACK
          </h1>
          <p className="text-xs text-gray-500 mt-2">verify your email</p>
          <p className="text-xs text-gray-600 mt-3">{email}</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="flex justify-center gap-2 mb-6">
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
                className="w-10 h-12 text-center text-lg font-bold text-green-300 bg-gray-800 border border-gray-700 rounded focus:outline-none focus:border-green-500"
              />
            ))}
          </div>

          {error && <p className="text-red-400 text-xs mb-4 text-center">{error}</p>}

          <button type="submit" disabled={busy}
            className="w-full bg-green-700 hover:bg-green-600 text-white font-semibold py-2.5 rounded text-sm transition disabled:opacity-50">
            {busy ? 'verifying...' : 'verify'}
          </button>
        </form>

        <div className="flex items-center justify-between mt-4 text-xs">
          <button
            onClick={handleResend}
            disabled={resendBusy || cooldown > 0}
            className="text-gray-500 hover:text-green-400 transition disabled:opacity-40"
          >
            {cooldown > 0 ? `resend in ${cooldown}s` : resendBusy ? 'sending...' : 'resend code'}
          </button>
          <button onClick={onBack} className="text-gray-500 hover:text-green-400 transition">
            back to login
          </button>
        </div>
      </div>
    </div>
  )
}
