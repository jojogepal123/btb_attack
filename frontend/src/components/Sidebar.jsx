import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'

const BASE = import.meta.env.VITE_API_URL || ''

function authHeaders() {
  const token = localStorage.getItem('btb_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

const ITEMS = [
  { label: 'Deploy Server', endpoint: '/api/deploy', icon: '🖥' },
  { label: 'Configure', endpoint: '/api/configure', icon: '⚙' },
  { label: 'Launch Firefox', endpoint: '/api/launch', icon: '🔥' },
  { label: 'Credentials', endpoint: '/api/credentials', icon: '🔑' },
  { label: 'View Logs', endpoint: '/api/logs', icon: '📋' },
]

export default function Sidebar({ onRun, loading, onOpenBrowser }) {
  const { user, logout } = useAuth()
  const [showPhishlets, setShowPhishlets] = useState(false)
  const [phishlets, setPhishlets] = useState([])
  const [phishletFetching, setPhishletFetching] = useState(false)
  const [phishletError, setPhishletError] = useState('')
  const phishletRef = useRef(null)

  useEffect(() => {
    if (!showPhishlets) return
    setPhishletFetching(true); setPhishletError('')
    axios.get(`${BASE}/api/phishlets`, { headers: authHeaders() })
      .then((res) => {
        setPhishlets(res.data.phishlets || [])
        if (res.data.error) setPhishletError(res.data.error)
      })
      .catch((err) => { setPhishlets([]); setPhishletError(err.message) })
      .finally(() => setPhishletFetching(false))
  }, [showPhishlets])

  useEffect(() => {
    function handleClick(e) {
      if (phishletRef.current && !phishletRef.current.contains(e.target)) {
        setShowPhishlets(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handlePhishletLaunch = (key, label, port) => {
    setShowPhishlets(false)
    const p = onRun(`Launch ${label}`, `/api/phishlets/launch`, { key })
    if (p) {
      p.then((data) => {
        if (data && data.status === 'success') {
          setTimeout(() => {
            onOpenBrowser(`http://${import.meta.env.VITE_VPS_IP || '127.0.0.1'}:${port}`, label)
          }, 4000)
        }
      })
    }
  }

  const handlePhishletOpen = (url, label) => {
    setShowPhishlets(false)
    onOpenBrowser(url, label)
  }

  const handlePhishletRemove = (name, label) => {
    setShowPhishlets(false)
    onRun(`Remove ${label}`, `/api/containers/remove`, { name })
  }

  return (
    <aside className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col shrink-0">
      <div className="px-4 py-5 border-b border-gray-800">
        <h1 className="text-lg font-bold text-green-400 tracking-widest drop-shadow-[0_0_6px_rgba(34,197,94,0.4)]">
          BTB_ATTACK
        </h1>
        <p className="text-[10px] text-gray-600 mt-0.5">v1.0 — security simulator</p>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {ITEMS.map((item) => (
          <button
            key={item.label}
            onClick={() => onRun(item.label, item.endpoint)}
            disabled={loading[item.label]}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded text-sm text-gray-400 hover:text-green-300 hover:bg-gray-800 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span className="text-xs">{item.icon}</span>
            <span>{loading[item.label] ? `${item.label}...` : item.label}</span>
          </button>
        ))}

        <div ref={phishletRef} className="relative">
          <button
            onClick={() => setShowPhishlets((v) => !v)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded text-sm text-gray-400 hover:text-yellow-300 hover:bg-gray-800 transition"
          >
            <span className="text-xs">🎯</span>
            <span>Phishlets</span>
          </button>

          {showPhishlets && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-10 max-h-56 overflow-y-auto">
              {phishletFetching ? (
                <p className="px-3 py-2 text-xs text-gray-500">loading...</p>
              ) : phishletError ? (
                <p className="px-3 py-2 text-xs text-red-400">{phishletError}</p>
              ) : phishlets.length === 0 ? (
                <p className="px-3 py-2 text-xs text-gray-500">no phishlets configured</p>
              ) : (
                phishlets.map((p) => (
                  <div
                    key={p.key}
                    className="px-3 py-2 border-b border-gray-700 last:border-0"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-gray-200">
                        {p.running ? '🟢' : '🔴'} {p.label}
                      </span>
                      <span className="text-[10px] text-gray-500">:{p.port}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {!p.running ? (
                        <button
                            onClick={() => handlePhishletLaunch(p.key, p.label, p.port)}
                          className="text-[10px] px-2 py-0.5 rounded bg-green-700 text-green-200 hover:bg-green-600 transition"
                        >
                          Launch
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => handlePhishletOpen(`http://${import.meta.env.VITE_VPS_IP || '127.0.0.1'}:${p.port}`, p.label)}
                            className="text-[10px] px-2 py-0.5 rounded bg-blue-700 text-blue-200 hover:bg-blue-600 transition"
                          >
                            Open
                          </button>
                          <button
                            onClick={() => handlePhishletRemove(p.name, p.label)}
                            className="text-[10px] px-2 py-0.5 rounded bg-red-800 text-red-200 hover:bg-red-700 transition"
                          >
                            Remove
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <button
          onClick={() => onOpenBrowser(`http://${import.meta.env.VITE_VPS_IP || '127.0.0.1'}:5800`, 'Firefox')}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded text-sm text-gray-400 hover:text-green-300 hover:bg-gray-800 transition"
        >
          <span className="text-xs">🌐</span>
          <span>Open Firefox</span>
        </button>
      </nav>

      <div className="p-3 border-t border-gray-800 space-y-2">
        <p className="text-xs text-gray-600 truncate">{user?.name || user?.email}</p>
        <button onClick={logout} className="text-xs text-red-500 hover:text-red-400 transition">
          logout
        </button>
      </div>
    </aside>
  )
}
