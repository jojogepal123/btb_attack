import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const { login, register } = useAuth()
  const [isRegister, setIsRegister] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setBusy(true); setError('')
    try {
      if (isRegister) {
        await register(username, password)
      } else {
        await login(username, password)
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Connection failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-gray-900 border border-gray-800 rounded-lg p-8"
      >
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-green-400 tracking-widest drop-shadow-[0_0_8px_rgba(34,197,94,0.5)]">
            BTB_ATTACK
          </h1>
          <p className="text-xs text-gray-500 mt-2">security learning simulator</p>
        </div>

        <input
          type="text"
          placeholder="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2.5 text-green-300 placeholder-gray-600 text-sm mb-3 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
        />
        <input
          type="password"
          placeholder="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2.5 text-green-300 placeholder-gray-600 text-sm mb-4 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
        />

        {error && (
          <p className="text-red-400 text-xs mb-4 text-center">{error}</p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full bg-green-700 hover:bg-green-600 text-white font-semibold py-2.5 rounded text-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy ? 'processing...' : isRegister ? 'register' : 'authenticate'}
        </button>

        <p className="text-center text-xs text-gray-600 mt-4">
          {isRegister ? 'already have an account?' : "don't have an account?"}{' '}
          <button
            type="button"
            onClick={() => { setIsRegister(!isRegister); setError('') }}
            className="text-green-500 hover:text-green-400 underline"
          >
            {isRegister ? 'login' : 'register'}
          </button>
        </p>
      </form>
    </div>
  )
}
