import { useState, useRef } from 'react'
import Sidebar from './Sidebar'
import TerminalOutput from './TerminalOutput'
import useAsyncAction from '../hooks/useAsyncAction'

const VPS_IP = import.meta.env.VITE_VPS_IP || '127.0.0.1'
const FIREFOX_UI_URL = `http://${VPS_IP}:5800`

export default function Dashboard() {
  const { loading, logs, run, clearLogs } = useAsyncAction()
  const [showBrowser, setShowBrowser] = useState(false)
  const [iframeError, setIframeError] = useState(false)
  const iframeRef = useRef(null)

  return (
    <div className="min-h-screen bg-gray-950 flex">
      <Sidebar
        onRun={run}
        loading={loading}
        showBrowser={showBrowser}
        onToggleBrowser={() => { setShowBrowser((v) => !v); setIframeError(false) }}
      />

      <main className="flex-1 flex flex-col p-6 overflow-hidden">
        <div className="text-xs text-gray-600 mb-4">
          target: <span className="text-green-500">{VPS_IP}</span>
        </div>

        <TerminalOutput logs={logs} onClear={clearLogs} />

        {showBrowser && (
          <div className="mt-4 border border-gray-800 rounded-lg overflow-hidden flex-1 flex flex-col">
            <div className="bg-gray-900 px-4 py-2 text-xs text-gray-500 border-b border-gray-800 flex items-center justify-between shrink-0">
              <span>firefox — {FIREFOX_UI_URL}</span>
              <a
                href={FIREFOX_UI_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 underline"
              >
                open in new tab
              </a>
            </div>

            {iframeError ? (
              <div className="flex-1 flex items-center justify-center bg-gray-950 min-h-[400px]">
                <div className="text-center">
                  <p className="text-red-400 text-sm mb-2">Could not connect to {FIREFOX_UI_URL}</p>
                  <p className="text-gray-500 text-xs mb-4">
                    Make sure the Firefox container is running and port 5800 is open on the VPS.
                  </p>
                  <a
                    href={FIREFOX_UI_URL}
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
                ref={iframeRef}
                src={FIREFOX_UI_URL}
                className="w-full flex-1 min-h-[400px] bg-black"
                title="Firefox Browser"
                onError={() => setIframeError(true)}
              />
            )}
          </div>
        )}
      </main>
    </div>
  )
}
