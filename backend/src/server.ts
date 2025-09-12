import cors from 'cors'
import express, { Request, Response } from 'express'
import { nanoid } from 'nanoid'

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001

// Replace the HTTP server implementation with Express routes below
const app = express()
app.use(cors({ origin: 'http://localhost:3000' }))
app.use(express.json())

// id -> streaming state
const streams = new Map<
  string,
  { text: string; cursor: number; timer: NodeJS.Timeout | null }
>()

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

app.post('/api/conversations', (req: Request, res: Response) => {
  const message = (req.body?.message ?? '').toString()
  if (!message) return res.status(400).json({ error: 'message is required' })

  const id = nanoid()
  const text = craftReply(message)
  streams.set(id, { text, cursor: 0, timer: null })
  res.json({ id })
})

app.get('/api/conversations/:id/stream', (req: Request, res: Response) => {
  const item = streams.get(req.params.id)
  if (!item) return res.status(404).end('no such stream id')

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no') // nginx buffering off
  ;(res as any).flushHeaders?.()

  res.write(`event: system\n`)
  res.write(`data: ${JSON.stringify({ startedAt: Date.now() })}\n\n`)

  const words = item.text.split(/(\s+)/) // keep spaces
  item.timer = setInterval(() => {
    if (item.cursor >= words.length) {
      res.write(`event: done\n`)
      res.write(`data: { "ok": true }\n\n`)
      clearInterval(item.timer!)
      streams.delete(req.params.id)
      res.end()
      return
    }
    const chunk = words[item.cursor++]
    res.write(`data: ${JSON.stringify(chunk)}\n\n`)
  }, 40)

  req.on('close', () => {
    clearInterval(item.timer!)
    streams.delete(req.params.id)
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
