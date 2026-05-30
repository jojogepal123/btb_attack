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
  { label: 'View Logs', endpoint: '/api/logs', icon: '📋' },
]

export default function Sidebar({ onRun, loading, showBrowser, onToggleBrowser }) {
  const { user, logout } = useAuth()
  const [showRemove, setShowRemove] = useState(false)
  const [containers, setContainers] = useState([])
  const [fetching, setFetching] = useState(false)
  const dropdownRef = useRef(null)

  useEffect(() => {
    if (!showRemove) return
    setFetching(true)
    axios.get(`${BASE}/api/containers`, { headers: authHeaders() })
      .then((res) => setContainers(res.data.containers || []))
      .catch(() => setContainers([]))
      .finally(() => setFetching(false))
  }, [showRemove])

  useEffect(() => {
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowRemove(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleRemove = (name) => {
    setShowRemove(false)
    onRun(`Remove ${name}`, `/api/containers/remove`, { name })
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

        <div ref={dropdownRef} className="relative">
          <button
            onClick={() => setShowRemove((v) => !v)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded text-sm text-gray-400 hover:text-red-300 hover:bg-gray-800 transition"
          >
            <span className="text-xs">🗑</span>
            <span>Remove Container</span>
          </button>

          {showRemove && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
              {fetching ? (
                <p className="px-3 py-2 text-xs text-gray-500">loading...</p>
              ) : containers.length === 0 ? (
                <p className="px-3 py-2 text-xs text-gray-500">no running containers</p>
              ) : (
                containers.map((c) => (
                  <button
                    key={c.name}
                    onClick={() => handleRemove(c.name)}
                    className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-gray-700 hover:text-red-400 transition border-b border-gray-700 last:border-0"
                  >
                    <span className="font-medium">{c.name}</span>
                    <span className="text-gray-600 ml-2">({c.id})</span>
                    <span className="block text-[10px] text-gray-600">{c.image} — {c.status}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        <button
          onClick={onToggleBrowser}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded text-sm text-gray-400 hover:text-green-300 hover:bg-gray-800 transition"
        >
          <span className="text-xs">🌐</span>
          <span>{showBrowser ? 'Close Browser' : 'Open Firefox'}</span>
        </button>
      </nav>

      <div className="p-3 border-t border-gray-800 space-y-2">
        <p className="text-xs text-gray-600 truncate">{user}</p>
        <button onClick={logout} className="text-xs text-red-500 hover:text-red-400 transition">
          logout
        </button>
      </div>
    </aside>
  )
}
