import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import LandingPage from './components/LandingPage'
import LoginPage from './components/LoginPage'
import RegisterPage from './components/RegisterPage'
import OtpPage from './components/OtpPage'
import Dashboard from './components/Dashboard'

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

function LoginPageWrapper() {
  const { login, register, verifyOtp, resendOtp } = useAuth()
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
      onGoRegister={() => setPage('register')}
    />
  )
}

function AppRoutes() {
  const { loading } = useAuth()
  if (loading) return null

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route
        path="/login"
        element={
          <AuthRoute>
            <LoginPageWrapper />
          </AuthRoute>
        }
      />
      <Route
        path="/register"
        element={
          <AuthRoute>
            <LoginPageWrapper />
          </AuthRoute>
        }
      />
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
