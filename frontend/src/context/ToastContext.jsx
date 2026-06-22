import { createContext, useContext, useState, useCallback } from "react";
import { createPortal } from "react-dom";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = "success", duration = 3000) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      {createPortal(
        <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`pointer-events-auto px-4 py-3 rounded-lg shadow-lg text-sm font-medium transition-all duration-300 animate-slide-in ${
                toast.type === "success"
                  ? "bg-green-900/90 text-green-200 border border-green-700"
                  : toast.type === "error"
                  ? "bg-red-900/90 text-red-200 border border-red-700"
                  : toast.type === "info"
                  ? "bg-blue-900/90 text-blue-200 border border-blue-700"
                  : "bg-gray-900/90 text-gray-200 border border-gray-700"
              }`}
            >
              <div className="flex items-center gap-2">
                <span>
                  {toast.type === "success" && "✓"}
                  {toast.type === "error" && "✕"}
                  {toast.type === "info" && "ℹ"}
                </span>
                <span>{toast.message}</span>
                <button
                  onClick={() => removeToast(toast.id)}
                  className="ml-2 text-xs opacity-60 hover:opacity-100"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
