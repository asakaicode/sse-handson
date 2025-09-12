'use client'

import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()

  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <h1 className="text-2xl font-bold">Welcome to the SSE Client</h1>
      <div className="flex items-center mt-4 space-x-4">
        <button
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded cursor-pointer"
          onClick={() => router.push('/ping')}
        >
          Go to SSE Ping
        </button>
        <button
          className="mt-4 ml-4 px-4 py-2 bg-green-500 text-white rounded cursor-pointer"
          onClick={() => router.push('/gpt-like')}
        >
          Go to GPT-Like
        </button>
      </div>
    </div>
  )
}
