'use client'

import { useEffect, useRef, useState } from 'react'

export default function SsePingClient() {
  const [logs, setLogs] = useState<string[]>([])
  const esRef = useRef<EventSource | null>(null)
  const connectedRef = useRef(false)

  useEffect(() => {
    if (connectedRef.current) return // StrictMode対策（重複接続防止）
    connectedRef.current = true

    // バックエンドSSEエンドポイント（compose内: http://backend:3001/stream）
    const base = (
      process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'
    ).replace(/\/$/, '')
    const url = `${base}/stream`

    const es = new EventSource(url)
    esRef.current = es

    es.onopen = () => {
      setLogs((p) => [...p, `[open] connected ${url}`])
    }

    es.onmessage = (e) => {
      setLogs((p) => [...p, `[message] ${e.data}`])
    }

    const onPing = (e: MessageEvent) => {
      try {
        const payload = JSON.parse(e.data)
        setLogs((p) => [...p, `[ping] ${payload.time}`])
      } catch {
        setLogs((p) => [...p, `[ping] ${e.data}`])
      }
    }
    es.addEventListener('ping', onPing)

    es.onerror = (err) => {
      // 自動再接続されます（サーバから retry: を送れば間隔を指定可能）
      setLogs((p) => [...p, `[error] ${String(err)}`])
    }

    return () => {
      es.removeEventListener('ping', onPing)
      es.close() // アンマウント時に明示クローズ
    }
  }, [])

  return (
    <div className="p-6 space-y-3">
      <h1 className="text-xl font-bold">SSE Client</h1>
      <div className="flex gap-2">
        <button
          className="px-3 py-1 rounded bg-gray-200 cursor-pointer"
          onClick={() => esRef.current?.close()}
        >
          Disconnect
        </button>
        <button
          className="px-3 py-1 rounded bg-gray-200 cursor-pointer"
          onClick={() => {
            if (!esRef.current || esRef.current.readyState === 2) {
              // 再接続したいとき（簡易）：新しい EventSource を作る
              connectedRef.current = false
              window.location.reload()
            }
          }}
        >
          Reconnect (reload)
        </button>
      </div>
      <ul className="text-sm space-y-1">
        {logs.map((m, i) => (
          <li key={i} className="font-mono">
            {m}
          </li>
        ))}
      </ul>
    </div>
  )
}
