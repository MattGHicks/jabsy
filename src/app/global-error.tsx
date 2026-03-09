'use client'

import { useEffect } from 'react'

function clearAuthState() {
  // Clear Supabase auth tokens from localStorage
  try {
    const keysToRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith('sb-')) {
        keysToRemove.push(key)
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key))
  } catch {}

  // Clear Supabase auth cookies
  try {
    document.cookie.split(';').forEach((c) => {
      const name = c.trim().split('=')[0]
      if (name.startsWith('sb-')) {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
      }
    })
  } catch {}
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Global error caught:', error)
    clearAuthState()
  }, [error])

  return (
    <html lang="en" className="dark">
      <body style={{ backgroundColor: '#0a0a0a', color: '#f4f4f5', margin: 0 }}>
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            textAlign: 'center',
          }}
        >
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.5rem' }}>
            Something went wrong
          </h2>
          <p style={{ color: '#71717a', fontSize: '0.875rem', marginBottom: '1.5rem', maxWidth: '24rem' }}>
            We&apos;ve cleared stale session data. Click below to continue.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={() => {
                clearAuthState()
                window.location.href = '/login'
              }}
              style={{
                height: '2.5rem',
                padding: '0 1.25rem',
                borderRadius: '0.5rem',
                backgroundColor: '#e11d48',
                color: 'white',
                fontSize: '0.875rem',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Go to Sign In
            </button>
            <button
              onClick={() => {
                clearAuthState()
                reset()
              }}
              style={{
                height: '2.5rem',
                padding: '0 1.25rem',
                borderRadius: '0.5rem',
                backgroundColor: '#1e1e1e',
                color: '#f4f4f5',
                fontSize: '0.875rem',
                fontWeight: 600,
                border: '1px solid #27272a',
                cursor: 'pointer',
              }}
            >
              Try Again
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
