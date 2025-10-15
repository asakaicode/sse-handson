import cors from 'cors'
import express, { Request, Response } from 'express'
import { nanoid } from 'nanoid'

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001

const app = express()
app.use(cors({ origin: 'http://localhost:3000' }))
app.use(express.json())

// minimal in-memory store for pending conversations
const conversations = new Map<
  string,
  { message: string; createdAt: number; maxTokens?: number }
>()

// Env for local LLM (Ollama by default)
const OLLAMA_BASE_URL =
  process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.1:8b'
const ENABLE_OLLAMA =
  String(process.env.ENABLE_OLLAMA ?? '').toLowerCase() === 'true'
const FALLBACK_ENABLED =
  String(process.env.FALLBACK ?? '').toLowerCase() === 'true'

// Fallback canned reply (used only if local LLM is unreachable and FALLBACK=true)
const craftReply = (userText: string): string => {
  const canned = [
    'なるほど…',
    'それは面白い視点ですね。',
    '結論から言うと、',
    'ポイントは次の3つです:',
    '1) 明確な目標,',
    '2) 小さな反復,',
    '3) フィードバックの取り込み。',
    '以上が私の提案です。',
  ].join(' ')
  return `「${userText}」への考え: ${canned}`
}

const streamFallbackReply = (res: Response, userMessage: string) => {
  const text = craftReply(userMessage)
  const words = text.split(/(\s+)/)
  for (const w of words) {
    if (!w) continue
    res.write(`data: ${JSON.stringify(w)}\n\n`)
  }
  res.write(`event: done\n`)
  res.write(`data: { \"ok\": true }\n\n`)
  res.end()
}

app.post('/api/conversations', (req: Request, res: Response) => {
  const message = (req.body?.message ?? '').toString()
  if (!message) return res.status(400).json({ error: 'message is required' })

  const maxTokensRaw = req.body?.maxTokens
  const maxTokens =
    typeof maxTokensRaw === 'number' && isFinite(maxTokensRaw) && maxTokensRaw > 0
      ? Math.floor(maxTokensRaw)
      : undefined

  const id = nanoid()
  conversations.set(id, { message, createdAt: Date.now(), maxTokens })
  res.json({ id })
})

app.get('/api/conversations/:id/stream', (req: Request, res: Response) => {
  const conv = conversations.get(req.params.id)
  if (!conv) return res.status(404).end('no such stream id')

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no') // nginx buffering off
  ;(res as any).flushHeaders?.()

  res.write(`event: system\n`)
  res.write(`data: ${JSON.stringify({ startedAt: Date.now() })}\n\n`)

  if (!ENABLE_OLLAMA) {
    streamFallbackReply(res, conv.message)
    conversations.delete(req.params.id)
    return
  }

  // Stream from local LLM (Ollama)
  const controller = new AbortController()
  const { signal } = controller
  const startedAt = Date.now()
  const MAX_TOKENS =
    conversations.get(req.params.id)?.maxTokens ||
    (process.env.OLLAMA_MAX_TOKENS ? Number(process.env.OLLAMA_MAX_TOKENS) : 256)
  const CHARS_PER_TOKEN = process.env.ETA_CHARS_PER_TOKEN
    ? Number(process.env.ETA_CHARS_PER_TOKEN)
    : 3
  let emittedChars = 0
  let approxTokensEmitted = 0

  const streamFromOllama = async () => {
    try {
      const resp = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: OLLAMA_MODEL,
          messages: [{ role: 'user', content: conv.message }],
          stream: true,
          options: { num_predict: MAX_TOKENS },
        }),
        signal,
      })

      if (!resp.ok || !resp.body) {
        throw new Error(`Ollama error: ${resp.status} ${resp.statusText}`)
      }

      const reader = resp.body.getReader()
      const decoder = new TextDecoder('utf-8')
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        // Ollama streams NDJSON (one JSON per line)
        let idx: number
        while ((idx = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, idx).trim()
          buffer = buffer.slice(idx + 1)
          if (!line) continue
          try {
            const obj = JSON.parse(line) as any
            if (obj?.message?.content) {
              const chunk = String(obj.message.content)
              res.write(`data: ${JSON.stringify(chunk)}\n\n`)
              emittedChars += chunk.length
              approxTokensEmitted = Math.max(
                approxTokensEmitted,
                Math.floor(emittedChars / Math.max(1, CHARS_PER_TOKEN)),
              )
              const elapsedSec = Math.max(0.001, (Date.now() - startedAt) / 1000)
              const tps = approxTokensEmitted / elapsedSec
              const remaining = Math.max(0, MAX_TOKENS - approxTokensEmitted)
              const etaSec = tps > 0 ? Math.ceil(remaining / tps) : null
              const progress = {
                tokensEmitted: approxTokensEmitted,
                maxTokens: MAX_TOKENS,
                tokensPerSec: Number.isFinite(tps) ? Number(tps.toFixed(2)) : null,
                etaSec,
              }
              res.write(`event: progress\n`)
              res.write(`data: ${JSON.stringify(progress)}\n\n`)
            }
            if (obj?.done) {
              res.write(`event: done\n`)
              res.write(`data: { \"ok\": true }\n\n`)
              res.end()
              conversations.delete(req.params.id)
              controller.abort()
              return
            }
          } catch (e) {
            // ignore malformed lines
          }
        }
      }

      // In case stream ended without done flag
      res.write(`event: done\n`)
      res.write(`data: { \"ok\": true }\n\n`)
      res.end()
      conversations.delete(req.params.id)
    } catch (err: any) {
      // Optional fallback when local LLM is unavailable
      if (FALLBACK_ENABLED) {
        streamFallbackReply(res, conv.message)
      } else {
        res.write(`event: error\n`)
        res.write(
          `data: ${JSON.stringify({ message: String(err?.message || err) })}\n\n`,
        )
        res.end()
      }
      conversations.delete(req.params.id)
    }
  }

  streamFromOllama()

  req.on('close', () => {
    controller.abort()
    conversations.delete(req.params.id)
  })
})

// SSE ping-like endpoint (original)
app.get('/stream', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.write(': connected\n\n')

  let id = 0

  const ping = setInterval(() => {
    const now = new Date().toISOString()
    res.write(`id: ${++id}\n`)
    res.write(`event: ping\n`)
    res.write(`data: {"time":"${now}"}\n\n`)
  }, 1000)

  const msg = setInterval(() => {
    const now = new Date().toISOString()
    res.write(`data: tick ${now}\n\n`)
  }, 10000)

  req.on('close', () => {
    clearInterval(ping)
    clearInterval(msg)
    res.end()
  })
})

app.listen(PORT, () => {
  console.log(`SSE backend running on http://localhost:${PORT}`)
})
