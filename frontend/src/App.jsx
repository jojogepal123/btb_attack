import { useState } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import LoginPage from './components/LoginPage'
import RegisterPage from './components/RegisterPage'
import OtpPage from './components/OtpPage'
import Dashboard from './components/Dashboard'

function Root() {
  const { token, login, register, verifyOtp, resendOtp, loading } = useAuth()
  const [page, setPage] = useState('login')
  const [pendingEmail, setPendingEmail] = useState('')

  if (loading) return null
  if (token) return <Dashboard />

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

export default function App() {
  return (
    <AuthProvider>
      <Root />
    </AuthProvider>
  )
}
