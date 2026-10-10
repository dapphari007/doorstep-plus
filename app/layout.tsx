import './globals.css'
import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import { AlertOverlay } from './components/AlertOverlay'
import { AppShell } from './components/AppShell'
import { AppProvider } from './providers/AppProvider'

export const metadata: Metadata = {
  title: 'Doorstep+',
  description: 'Know what is happening at your front door, in the way that works for you.',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#181c21' },
  ],
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-profile="standard">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans text-[16px] antialiased">
        <AppProvider>
          <AppShell>{children}</AppShell>
          <AlertOverlay />
        </AppProvider>
      </body>
    </html>
  )
}
