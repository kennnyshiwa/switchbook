'use client'

import { useEffect } from 'react'
import { SessionProvider } from 'next-auth/react'
import type { Session } from 'next-auth'
import { ThemeProvider } from '@/contexts/ThemeContext'

function SessionRevalidation() {
  useEffect(() => {
    // Validate the server-hydrated session once without Auth.js's cross-document
    // broadcast, which can make the outgoing document refetch during navigation.
    void fetch('/api/auth/session', { cache: 'no-store' })
  }, [])

  return null
}

export function Providers({ children, session }: { children: React.ReactNode; session: Session | null }) {
  return (
    <SessionProvider session={session} refetchOnWindowFocus={false}>
      <SessionRevalidation />
      <ThemeProvider>
        {children}
      </ThemeProvider>
    </SessionProvider>
  )
}
