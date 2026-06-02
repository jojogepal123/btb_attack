import { useState, useRef, useCallback } from 'react'
import Sidebar from './Sidebar'
import TerminalOutput from './TerminalOutput'
import useAsyncAction from '../hooks/useAsyncAction'

const VPS_IP = import.meta.env.VITE_VPS_IP || '127.0.0.1'

let tabIdCounter = 0

export default function Dashboard() {
  const { loading, logs, run, clearLogs } = useAsyncAction()
  const [tabs, setTabs] = useState([])
  const [activeTabId, setActiveTabId] = useState(null)
  const [iframeError, setIframeError] = useState(false)
  const iframeRef = useRef(null)

  function addTab(url, label) {
    const existing = tabs.find((t) => t.url === url)
    if (existing) {
      setActiveTabId(existing.id)
      setIframeError(false)
      return
    }
    const id = ++tabIdCounter
    setTabs([...tabs, { id, url, label }])
    setActiveTabId(id)
    setIframeError(false)
  }

  const closeTab = useCallback((id) => {
    setTabs((prev) => {
      const idx = prev.findIndex((t) => t.id === id)
      const next = prev.filter((t) => t.id !== id)
      if (activeTabId === id) {
        if (next.length === 0) {
          setActiveTabId(null)
        } else if (idx > 0) {
          setActiveTabId(next[idx - 1].id)
        } else {
          setActiveTabId(next[0].id)
        }
      }
      return next
    })
  }, [activeTabId])

  const activeTab = tabs.find((t) => t.id === activeTabId)

  return (
    <div className="min-h-screen bg-gray-950 flex">
      <Sidebar
        onRun={run}
        loading={loading}
        onOpenBrowser={addTab}
      />

      <main className="flex-1 flex flex-col p-6 overflow-hidden">
        <div className="text-xs text-gray-600 mb-4">
          target: <span className="text-green-500">{VPS_IP}</span>
        </div>

        <TerminalOutput logs={logs} onClear={clearLogs} />

        {tabs.length > 0 && (
          <div className="mt-4 border border-gray-800 rounded-lg overflow-hidden flex-1 flex flex-col">
            <div className="bg-gray-900 border-b border-gray-800 shrink-0 flex">
              {tabs.map((tab) => (
                <div
                  key={tab.id}
                  onClick={() => { setActiveTabId(tab.id); setIframeError(false) }}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs cursor-pointer border-r border-gray-800 transition ${
                    tab.id === activeTabId
                      ? 'bg-gray-800 text-green-300'
                      : 'text-gray-500 hover:text-gray-300 hover:bg-gray-850'
                  }`}
                >
                  <span>{tab.label}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); closeTab(tab.id) }}
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
                className="ml-auto px-3 py-2 text-xs text-blue-400 hover:text-blue-300 underline shrink-0"
              >
                open in new tab
              </a>
              <button
                onClick={() => { setTabs([]); setActiveTabId(null) }}
                className="px-3 py-2 text-xs text-gray-500 hover:text-red-400 transition shrink-0"
                title="Close browser"
              >
                ×
              </button>
            </div>

            {iframeError ? (
              <div className="flex-1 flex items-center justify-center bg-gray-950 min-h-[400px]">
                <div className="text-center">
                  <p className="text-red-400 text-sm mb-2">Could not connect to {activeTab?.url}</p>
                  <p className="text-gray-500 text-xs mb-4">
                    Make sure the container is running and port is open on the VPS.
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
                key={activeTabId}
                ref={iframeRef}
                src={activeTab?.url}
                className="w-full flex-1 min-h-[400px] bg-black"
                title={activeTab?.label}
                onError={() => setIframeError(true)}
              />
            )}
          </div>
        )}
      </main>
    </div>
  )
}
