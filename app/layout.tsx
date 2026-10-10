import './globals.css'
import type { Metadata } from 'next'
import { Nav } from './components/Nav'
import { ProfileProvider } from './components/ProfileProvider'
import { AlertLayer } from './components/AlertLayer'

export const metadata: Metadata = {
  title: 'Doorstep Copilot',
  description: 'An accessible, privacy-first AI copilot for Ring doorbells.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-profile="standard">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen font-sans antialiased">
        <ProfileProvider>
          <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 btn-primary">
            Skip to content
          </a>
          <Nav />
          <main id="main" className="mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6">
            {children}
          </main>
          <AlertLayer />
        </ProfileProvider>
      </body>
    </html>
  )
}
