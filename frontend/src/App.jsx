import { AuthProvider, useAuth } from './context/AuthContext'
import LoginPage from './components/LoginPage'
import Dashboard from './components/Dashboard'

function Root() {
  const { token, loading } = useAuth()
  if (loading) return null
  return token ? <Dashboard /> : <LoginPage />
}

export default function App() {
  return (
    <AuthProvider>
      <Root />
    </AuthProvider>
  )
}
