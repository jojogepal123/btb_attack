import { createContext, useContext, useState, useEffect } from 'react'
import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL || ''

const AuthContext = createContext(null)

axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('btb_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem('btb_token'))
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) { setLoading(false); return }
    axios.get(`${API_BASE}/api/auth/verify`)
      .then((res) => setUser({ email: res.data.email, name: res.data.name }))
      .catch(() => { localStorage.removeItem('btb_token'); setToken(null) })
      .finally(() => setLoading(false))
  }, [token])

  const login = async (email, password, remember = false) => {
    const endpoint = remember ? '/api/auth/login-remember' : '/api/auth/login'
    const res = await axios.post(`${API_BASE}${endpoint}`, { email, password })
    localStorage.setItem('btb_token', res.data.token)
    setToken(res.data.token)
    setUser({ email: res.data.email, name: res.data.name })
  }

  const register = async (name, email, password) => {
    await axios.post(`${API_BASE}/api/auth/register`, { name, email, password })
  }

  const verifyOtp = async (email, otp) => {
    const res = await axios.post(`${API_BASE}/api/auth/verify-otp`, { email, otp })
    localStorage.setItem('btb_token', res.data.token)
    setToken(res.data.token)
    setUser({ email: res.data.email, name: res.data.name })
  }

  const resendOtp = async (email) => {
    await axios.post(`${API_BASE}/api/auth/resend-otp`, { email })
  }

  const logout = async () => {
    const currentToken = localStorage.getItem('btb_token')
    if (currentToken) {
      try {
        await axios.post(`${API_BASE}/api/auth/logout`, { token: currentToken })
      } catch {
        // logout even if backend call fails
      }
    }
    localStorage.removeItem('btb_token')
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, token, login, register, verifyOtp, resendOtp, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
