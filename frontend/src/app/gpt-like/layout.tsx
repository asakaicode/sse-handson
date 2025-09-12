import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'GPT-Like App',
  description: 'A simple GPT-like application',
}

export default function GptLikeLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return children
}
