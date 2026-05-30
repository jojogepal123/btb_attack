import { createContext, useContext, useState, useEffect } from 'react'
import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL || ''

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem('btb_token'))
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) { setLoading(false); return }
    axios.get(`${API_BASE}/api/auth/verify`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => setUser(res.data.user))
      .catch(() => { localStorage.removeItem('btb_token'); setToken(null) })
      .finally(() => setLoading(false))
  }, [token])

  const login = async (username, password) => {
    const res = await axios.post(`${API_BASE}/api/auth/login`, { username, password })
    localStorage.setItem('btb_token', res.data.token)
    setToken(res.data.token)
    setUser(username)
  }

  const register = async (username, password) => {
    const res = await axios.post(`${API_BASE}/api/auth/register`, { username, password })
    localStorage.setItem('btb_token', res.data.token)
    setToken(res.data.token)
    setUser(username)
  }

  const logout = () => {
    localStorage.removeItem('btb_token')
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
