import { useState, useEffect, useRef, useCallback } from "react";
import AuthBackground from "./AuthBackground";

const APP_NAME = import.meta.env.VITE_APP_NAME || "2FA Email Bypass";
const OTP_EXPIRE_SECONDS = 300;

export default function OtpPage({ email, onVerify, onResend, onBack }) {
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [resendBusy, setResendBusy] = useState(false);
  const [expiresAt, setExpiresAt] = useState(
    () => Date.now() + OTP_EXPIRE_SECONDS * 1000,
  );
  const [remaining, setRemaining] = useState(OTP_EXPIRE_SECONDS);
  const [success, setSuccess] = useState("");
  const [shake, setShake] = useState(false);
  const inputs = useRef([]);

  useEffect(() => {
    inputs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (remaining <= 0) return;
    const t = setTimeout(() => {
      const left = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
      setRemaining(left);
    }, 1000);
    return () => clearTimeout(t);
  }, [remaining, expiresAt]);

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const focusNext = (i) => {
    if (i < 5) inputs.current[i + 1]?.focus();
  };

  const handleChange = (i, val) => {
    if (!/^\d?$/.test(val)) return;
    const copy = [...otp];
    copy[i] = val;
    setOtp(copy);
    if (val) focusNext(i);

    const code = copy.join("");
    if (code.length === 6 && copy.every((d) => d !== "")) {
      setTimeout(() => submitCode(code), 100);
    }
  };

  const handleKeyDown = (i, e) => {
    if (e.key === "Backspace" && !otp[i] && i > 0) {
      inputs.current[i - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const data = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    const copy = [...otp];
    for (let i = 0; i < 6; i++) copy[i] = data[i] || "";
    setOtp(copy);
    const next = Math.min(data.length, 5);
    inputs.current[next]?.focus();

    if (data.length === 6) {
      setTimeout(() => submitCode(data), 100);
    }
  };

  const submitCode = async (code) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await onVerify(email, code);
    } catch (err) {
      setError(err.response?.data?.detail || "Verification failed");
      setShake(true);
      setTimeout(() => setShake(false), 500);
      setBusy(false);
    }
  };

  const handleSubmit = (e) => {
    e && e.preventDefault();
    const code = otp.join("");
    if (code.length !== 6) {
      setError("Enter all 6 digits");
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return;
    }
    submitCode(code);
  };

  const handleResend = useCallback(async () => {
    setResendBusy(true);
    setError("");
    setSuccess("");
    try {
      await onResend(email);
      const newExpiresAt = Date.now() + OTP_EXPIRE_SECONDS * 1000;
      setExpiresAt(newExpiresAt);
      setRemaining(OTP_EXPIRE_SECONDS);
      setSuccess("OTP resent! Check your email.");
      setOtp(["", "", "", "", "", ""]);
      inputs.current[0]?.focus();
    } catch (err) {
      setError(err.response?.data?.detail || "Resend failed");
    } finally {
      setResendBusy(false);
    }
  }, [email, onResend]);

  const otpExpired = remaining <= 0;
  const timerColor =
    remaining > 60
      ? "text-green-400"
      : remaining > 0
        ? "text-yellow-400"
        : "text-red-400";
  const timerBarColor =
    remaining > 60
      ? "bg-green-500"
      : remaining > 0
        ? "bg-yellow-500"
        : "bg-red-500";
  const timerProgress = (remaining / OTP_EXPIRE_SECONDS) * 100;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 relative overflow-hidden">
      <AuthBackground />

      <div className="relative z-10 w-full max-w-md animate-scale-in">
        <div className="bg-gray-900/80 backdrop-blur-xl border border-gray-800/60 rounded-2xl p-8 sm:p-10 shadow-2xl shadow-green-900/10 animate-glow">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-green-500/10 border border-green-500/20 mb-4 animate-float relative">
              <span className="text-3xl">✉</span>
              <div className="absolute inset-0 rounded-2xl border border-green-500/30 animate-pulse-ring" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-wider">
              {APP_NAME.split("_").map((part, i, arr) => (
                <span key={i}>
                  {part}
                  {i < arr.length - 1 && (
                    <span className="text-green-400">_</span>
                  )}
                </span>
              ))}
            </h1>
            <p className="text-xs text-gray-500 mt-2 tracking-widest uppercase">
              Email Verification
            </p>
          </div>

          <div className="text-center mb-6">
            <p className="text-xs text-gray-500">We sent a 6-digit OTP to</p>
            <p className="text-sm text-green-400 mt-1 font-medium break-all">
              {email}
            </p>
          </div>

          <div className="mb-6">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] text-gray-500 uppercase tracking-wider">
                OTP expires in
              </span>
              <span className={`text-sm font-mono font-bold ${timerColor}`}>
                {formatTime(remaining)}
              </span>
            </div>
            <div className="h-1 w-full bg-gray-800 rounded-full overflow-hidden">
              <div
                className={`h-full ${timerBarColor} rounded-full transition-all duration-1000 ease-linear`}
                style={{ width: `${timerProgress}%` }}
              />
            </div>
            {otpExpired && (
              <p className="text-[10px] text-red-400 mt-1.5 text-center">
                OTP expired. Please resend to get a new OTP.
              </p>
            )}
          </div>

          <form
            onSubmit={handleSubmit}
            className={shake ? "animate-shake" : ""}
          >
            <div className="flex justify-center gap-2 sm:gap-3 mb-6">
              {otp.map((d, i) => (
                <input
                  key={i}
                  ref={(el) => (inputs.current[i] = el)}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={d}
                  onChange={(e) => handleChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  onPaste={i === 0 ? handlePaste : undefined}
                  disabled={otpExpired}
                  className={`w-11 h-13 sm:w-12 sm:h-14 text-center text-xl font-bold rounded-xl transition-all duration-300 focus:outline-none ${
                    otpExpired
                      ? "bg-gray-800/30 border border-gray-700/30 text-gray-600 cursor-not-allowed"
                      : d
                        ? "bg-green-500/10 border-2 border-green-500/50 text-green-300 shadow-lg shadow-green-500/10"
                        : "bg-gray-800/50 border border-gray-700/50 text-green-300 focus:border-green-500/50 focus:bg-gray-800/80"
                  }`}
                />
              ))}
            </div>

            {error && (
              <div className="mb-4 flex items-center gap-2 text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 animate-slide-down">
                <svg
                  className="w-4 h-4 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                {error}
              </div>
            )}

            {success && (
              <div className="mb-4 flex items-center gap-2 text-green-400 text-xs bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2 animate-slide-down">
                <svg
                  className="w-4 h-4 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={busy || otpExpired}
              className="w-full bg-green-600 hover:bg-green-500 text-white font-semibold py-3 rounded-xl text-sm transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden group"
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                {busy ? (
                  <>
                    <svg
                      className="w-4 h-4 animate-spin"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    verifying...
                  </>
                ) : (
                  <>
                    Verify OTP
                    <svg
                      className="w-4 h-4 group-hover:translate-x-1 transition-transform"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </>
                )}
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-green-600 to-green-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </button>
          </form>

          <div className="flex items-center justify-between mt-5 text-xs">
            <button
              onClick={handleResend}
              disabled={resendBusy || (!otpExpired && remaining > 0)}
              className="text-gray-500 hover:text-green-400 transition disabled:opacity-40 relative group"
            >
              {resendBusy ? (
                <span className="flex items-center gap-1.5">
                  <svg
                    className="w-3.5 h-3.5 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  sending...
                </span>
              ) : !otpExpired && remaining > 0 ? (
                <span className="flex items-center gap-1.5">
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  resend OTP
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  resend OTP
                </span>
              )}
              {!otpExpired && remaining > 0 && !resendBusy && (
                <span className="absolute bottom-0 left-0 w-0 h-px bg-green-400 group-hover:w-full transition-all duration-300" />
              )}
            </button>
            <button
              onClick={onBack}
              className="text-gray-500 hover:text-green-400 transition relative group"
            >
              back to login
              <span className="absolute bottom-0 left-0 w-0 h-px bg-green-400 group-hover:w-full transition-all duration-300" />
            </button>
          </div>
        </div>

        <p className="text-center text-[10px] text-gray-700 mt-6">
          For authorized security testing only
        </p>
      </div>
    </div>
  );
}
