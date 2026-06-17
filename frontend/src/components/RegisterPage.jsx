import { useState } from 'react'
import AuthBackground from './AuthBackground'

const APP_NAME = import.meta.env.VITE_APP_NAME || '2FA Email Bypass'

export default function RegisterPage({ onRegister, onBack }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [shake, setShake] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (password !== confirm) { setError('Passwords do not match'); setShake(true); setTimeout(() => setShake(false), 500); return }
    if (password.length < 8) { setError('Password too short (min 8 chars)'); setShake(true); setTimeout(() => setShake(false), 500); return }
    setBusy(true)
    try {
      await onRegister(name, email, password)
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed')
      setShake(true)
      setTimeout(() => setShake(false), 500)
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 relative overflow-hidden">
      <AuthBackground />

      <div className="relative z-10 w-full max-w-md animate-scale-in">
        <div className="bg-gray-900/80 backdrop-blur-xl border border-gray-800/60 rounded-2xl p-8 sm:p-10 shadow-2xl shadow-green-900/10 animate-glow">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-green-500/10 border border-green-500/20 mb-4 animate-float">
              <span className="text-3xl">🛡</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-wider">
              {APP_NAME.split('_').map((part, i, arr) => (
                <span key={i}>
                  {part}{i < arr.length - 1 && <span className="text-green-400">_</span>}
                </span>
              ))}
            </h1>
            <p className="text-xs text-gray-500 mt-2 tracking-widest uppercase">Create Account</p>
          </div>

          <form onSubmit={handleSubmit} className={shake ? 'animate-shake' : ''}>
            <div className="space-y-4">
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="w-4 h-4 text-gray-600 group-focus-within:text-green-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <input type="text" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)}
                  className="auth-input w-full bg-gray-800/50 border border-gray-700/50 rounded-xl pl-10 pr-4 py-3 text-green-300 placeholder-gray-600 text-sm focus:outline-none focus:border-green-500/50 focus:bg-gray-800/80 transition-all duration-300" />
              </div>

              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="w-4 h-4 text-gray-600 group-focus-within:text-green-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <input type="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)}
                  className="auth-input w-full bg-gray-800/50 border border-gray-700/50 rounded-xl pl-10 pr-4 py-3 text-green-300 placeholder-gray-600 text-sm focus:outline-none focus:border-green-500/50 focus:bg-gray-800/80 transition-all duration-300" />
              </div>

              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="w-4 h-4 text-gray-600 group-focus-within:text-green-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)}
                  className="auth-input w-full bg-gray-800/50 border border-gray-700/50 rounded-xl pl-10 pr-4 py-3 text-green-300 placeholder-gray-600 text-sm focus:outline-none focus:border-green-500/50 focus:bg-gray-800/80 transition-all duration-300" />
              </div>

              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="w-4 h-4 text-gray-600 group-focus-within:text-green-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <input type="password" placeholder="Confirm password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
                  className="auth-input w-full bg-gray-800/50 border border-gray-700/50 rounded-xl pl-10 pr-4 py-3 text-green-300 placeholder-gray-600 text-sm focus:outline-none focus:border-green-500/50 focus:bg-gray-800/80 transition-all duration-300" />
              </div>
            </div>

            {error && (
              <div className="mt-4 flex items-center gap-2 text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 animate-slide-down">
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {error}
              </div>
            )}

            <button type="submit" disabled={busy}
              className="w-full mt-6 bg-green-600 hover:bg-green-500 text-white font-semibold py-3 rounded-xl text-sm transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden group">
              <span className="relative z-10 flex items-center justify-center gap-2">
                {busy ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    creating account...
                  </>
                ) : (
                  <>
                    Create Account
                    <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </>
                )}
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-green-600 to-green-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-xs text-gray-600">
              Already have an account?{' '}
              <button type="button" onClick={onBack} className="text-green-400 hover:text-green-300 font-medium transition-colors relative group">
                Sign in
                <span className="absolute bottom-0 left-0 w-0 h-px bg-green-400 group-hover:w-full transition-all duration-300" />
              </button>
            </p>
          </div>
        </div>

        <p className="text-center text-[10px] text-gray-700 mt-6">
          For authorized security testing only
        </p>
      </div>
    </div>
  )
}
