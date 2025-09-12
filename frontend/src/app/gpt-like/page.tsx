'use client'

import { useCallback, useRef, useState } from 'react'
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3001'

type Bubble = { who: 'user' | 'bot'; html: string }

export default function GptLikePage() {
  const [items, setItems] = useState<Bubble[]>([])
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const send = useCallback(async (text: string) => {
    setBusy(true)

    // ① ユーザー発言＋ボット仮バブルを "1回の setItems" で追加し botIndex を確定
    let botIndex = -1
    setItems((prev): Bubble[] => {
      const next: Bubble[] = [...prev, { who: 'user', html: escapeHtml(text) }]
      botIndex = next.length // ここに bot が入る
      return [
        ...next,
        {
          who: 'bot',
          html: '<span class="small">考え中…</span><span class="cursor"></span>',
        },
      ]
    })

    try {
      const r = await fetch(`${API_BASE}/api/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      })
      const { id } = await r.json()

      const es = new EventSource(`${API_BASE}/api/conversations/${id}/stream`)

      // ② 各チャンクで "botIndex の要素" だけを functional update で書き換え
      es.onmessage = (ev) => {
        const chunk = JSON.parse(ev.data)
        const htmlChunk = (
          typeof chunk === 'string' ? escapeHtml(chunk) : String(chunk)
        ).replace(/\n/g, '<br/>')

        setItems((arr): Bubble[] =>
          arr.map((it, i) => {
            if (i !== botIndex) return it
            // 先頭の「考え中…」と末尾のカーソルを取り除いて追記
            const withoutCursor = it.html
              .replace(/<span class="cursor"><\/span>$/, '')
              .replace(/^<span class="small">考え中…<\/span>/, '')
            return {
              ...it,
              html: withoutCursor + htmlChunk + '<span class="cursor"></span>',
            }
          }),
        )
      }

      es.addEventListener('done', () => {
        es.close()
        setItems((arr) =>
          arr.map((it, i) =>
            i === botIndex
              ? {
                  ...it,
                  html: it.html.replace(/<span class="cursor"><\/span>$/, ''),
                }
              : it,
          ),
        )
        setBusy(false)
      })

      es.onerror = (e) => {
        console.warn('SSE error', e)
        es.close()
        setBusy(false)
      }
    } catch (e) {
      console.error(e)
      setBusy(false)
    }
  }, []) // <- items を依存に入れない（常に functional update を使う）

  return (
    <>
      <div className="chat">
        {items.map((b, i) => (
          <div
            key={i}
            className={`bubble ${b.who}`}
            dangerouslySetInnerHTML={{ __html: b.html }}
          />
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          const v = inputRef.current?.value?.trim()
          if (!v) return
          inputRef.current!.value = ''
          send(v)
        }}
      >
        <input
          ref={inputRef}
          type="text"
          placeholder="メッセージを入力..."
          disabled={busy}
        />
        <button type="submit" disabled={busy}>
          送信
        </button>
      </form>
    </>
  )
}

const escapeHtml = (s: string): string =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[
        c
      ]!),
  )
