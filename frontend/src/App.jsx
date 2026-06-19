import { useState, useEffect } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import LandingPage from "./components/LandingPage";
import LoginPage from "./components/LoginPage";
import RegisterPage from "./components/RegisterPage";
import OtpPage from "./components/OtpPage";
import Dashboard from "./components/Dashboard";
import AccessDenied from "./components/AccessDenied";

const API_BASE = import.meta.env.VITE_API_URL || "";

function ProtectedRoute({ children }) {
  const { token, loading } = useAuth();
  if (loading) return <LoadingSpinner />;
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

function AuthRoute({ children }) {
  const { token, loading } = useAuth();
  if (loading) return <LoadingSpinner />;
  if (token) return <Navigate to="/dashboard" replace />;
  return children;
}

function LoadingSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="flex flex-col items-center gap-3">
        <svg className="w-8 h-8 animate-spin text-green-400" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <p className="text-xs text-gray-500 tracking-widest uppercase">Loading...</p>
      </div>
    </div>
  );
}

function LoginPageWrapper({ allowRegister = true }) {
  const { login, register, verifyOtp, resendOtp } = useAuth();
  const navigate = useNavigate();
  const [pendingEmail, setPendingEmail] = useState("");
  const [page, setPage] = useState("login");
  const [verifyMessage, setVerifyMessage] = useState("");

  if (page === "otp") {
    return (
      <OtpPage
        email={pendingEmail}
        onVerify={verifyOtp}
        onResend={resendOtp}
        onBack={() => { setPage("login"); setVerifyMessage(""); }}
      />
    );
  }

  if (page === "register") {
    return (
      <RegisterPage
        onRegister={async (name, email, password) => {
          await register(name, email, password);
          setPendingEmail(email);
          setPage("otp");
        }}
        onBack={() => setPage("login")}
      />
    );
  }

  return (
    <LoginPage
      onLogin={async (email, password, remember) => {
        try {
          await login(email, password, remember);
        } catch (err) {
          if (err.response?.status === 403) {
            setPendingEmail(email);
            setVerifyMessage(err.response?.data?.detail || "");
            setPage("otp");
            return;
          }
          throw err;
        }
      }}
      onGoRegister={() =>
        allowRegister ? setPage("register") : navigate("/register")
      }
      verifyMessage={verifyMessage}
    />
  );
}

function AppRoutes() {
  const { loading } = useAuth();
  const [allowRegister, setAllowRegister] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/api/config`)
      .then((res) => res.json())
      .then((data) => setAllowRegister(data.allowRegister))
      .catch(() => {});
  }, []);

  if (loading) return <LoadingSpinner />;

  return (
    <Routes>
      <Route
        path="/"
        element={
          <AuthRoute>
            <LoginPageWrapper allowRegister={allowRegister} />
          </AuthRoute>
        }
      />
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
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
