import type { Metadata } from 'next'
import './globals.css'
import ApolloClientProvider from '@/lib/apollo-provider'
import { ThemeProvider } from '@/components/ThemeProvider'
import { AuthProvider } from '@/components/AuthProvider'

export const metadata: Metadata = {
  title: 'Yogi Registry',
  description: 'The modern package manager for developers and teams.',
  icons: {
    icon: '/favicon.png',
    apple: '/icon.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;650;700;800&display=swap" rel="stylesheet" />
      </head>
      <body>
        <ApolloClientProvider>
          <ThemeProvider>
            <AuthProvider>
              {children}
            </AuthProvider>
          </ThemeProvider>
        </ApolloClientProvider>
      </body>
    </html>
  )
}