import { useState } from 'react'
import Sidebar from './Sidebar'
import TerminalOutput from './TerminalOutput'
import useAsyncAction from '../hooks/useAsyncAction'

const VPS_IP = import.meta.env.VITE_VPS_IP || '127.0.0.1'
const FIREFOX_UI_URL = `http://${VPS_IP}:5800`

export default function Dashboard() {
  const { loading, logs, run, clearLogs } = useAsyncAction()
  const [showBrowser, setShowBrowser] = useState(false)

  return (
    <div className="min-h-screen bg-gray-950 flex">
      <Sidebar
        onRun={run}
        loading={loading}
        showBrowser={showBrowser}
        onToggleBrowser={() => setShowBrowser((v) => !v)}
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
            <iframe
              src={FIREFOX_UI_URL}
              className="w-full flex-1 min-h-[400px] bg-black"
              title="Firefox Browser"
            />
          </div>
        )}
      </main>
    </div>
  )
}
