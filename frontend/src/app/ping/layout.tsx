import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Ping Client',
  description: 'A simple SSE Ping Client',
}

export default function PingClientLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return children
}
