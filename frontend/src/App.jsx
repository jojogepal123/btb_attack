import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import LandingPage from './components/LandingPage'
import LoginPage from './components/LoginPage'
import RegisterPage from './components/RegisterPage'
import OtpPage from './components/OtpPage'
import Dashboard from './components/Dashboard'
import AccessDenied from './components/AccessDenied'

const API_BASE = import.meta.env.VITE_API_URL || ''

function ProtectedRoute({ children }) {
  const { token, loading } = useAuth()
  if (loading) return null
  if (!token) return <Navigate to="/login" replace />
  return children
}

function AuthRoute({ children }) {
  const { token, loading } = useAuth()
  if (loading) return null
  if (token) return <Navigate to="/dashboard" replace />
  return children
}

function LoginPageWrapper({ allowRegister = true }) {
  const { login, register, verifyOtp, resendOtp } = useAuth()
  const navigate = useNavigate()
  const [pendingEmail, setPendingEmail] = useState('')
  const [page, setPage] = useState('login')

  if (page === 'otp') {
    return (
      <OtpPage
        email={pendingEmail}
        onVerify={verifyOtp}
        onResend={resendOtp}
        onBack={() => setPage('login')}
      />
    )
  }

  if (page === 'register') {
    return (
      <RegisterPage
        onRegister={async (name, email, password) => {
          await register(name, email, password)
          setPendingEmail(email)
          setPage('otp')
        }}
        onBack={() => setPage('login')}
      />
    )
  }

  return (
    <LoginPage
      onLogin={async (email, password) => {
        try {
          await login(email, password)
        } catch (err) {
          if (err.response?.status === 403) {
            setPendingEmail(email)
            setPage('otp')
            return
          }
          throw err
        }
      }}
      onGoRegister={() => allowRegister ? setPage('register') : navigate('/register')}
    />
  )
}

function AppRoutes() {
  const { loading } = useAuth()
  const [allowRegister, setAllowRegister] = useState(true)

  useEffect(() => {
    fetch(`${API_BASE}/api/config`)
      .then((res) => res.json())
      .then((data) => setAllowRegister(data.allowRegister))
      .catch(() => {})
  }, [])

  if (loading) return null

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route
        path="/login"
        element={
          <AuthRoute>
            <LoginPageWrapper allowRegister={allowRegister} />
          </AuthRoute>
        }
      />
      {allowRegister ? (
        <Route
          path="/register"
          element={
            <AuthRoute>
              <LoginPageWrapper allowRegister={allowRegister} />
            </AuthRoute>
          }
        />
      ) : (
        <Route path="/register" element={<AccessDenied />} />
      )}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  )
}
