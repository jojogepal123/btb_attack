import { useState } from 'react'
import axios from 'axios'
import authHeaders from '../utils/authHeaders'

const BASE = import.meta.env.VITE_API_URL || ''

export default function useAsyncAction() {
  const [loading, setLoading] = useState({})
  const [logs, setLogs] = useState([])

  const run = (label, endpoint, body) => {
    if (loading[label]) return
    setLoading((prev) => ({ ...prev, [label]: true }))
    setLogs((prev) => [...prev, `$ ${label}...`])

    const request = body
      ? axios.post(`${BASE}${endpoint}`, body, { headers: authHeaders() })
      : axios.get(`${BASE}${endpoint}`, { headers: authHeaders() })

    return request
      .then((res) => {
        const msg = res.data.message
        setLogs((prev) => [...prev, `  ${msg}`])
        return res.data
      })
      .catch((err) => {
        const detail = err.response?.data?.detail || err.message
        setLogs((prev) => [...prev, `  [ERR] ${detail}`])
      })
      .finally(() => {
        setLoading((prev) => ({ ...prev, [label]: false }))
      })
  }

  const clearLogs = () => setLogs([])

  return { loading, logs, run, clearLogs }
}
