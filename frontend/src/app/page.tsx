'use client'

import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()

  return (
    <div className="flex items-center justify-center h-screen">
      <h1 className="text-2xl font-bold">Welcome to the SSE Client</h1>
      <button
        className="mt-4 px-4 py-2 bg-blue-500 text-white rounded"
        onClick={() => router.push('/ping')}
      >
        Go to SSE Ping
      </button>
      <button
        className="mt-4 ml-4 px-4 py-2 bg-green-500 text-white rounded"
        onClick={() => router.push('/gpt-like')}
      >
        Go to GPT-Like
      </button>
    </div>
  )
}
