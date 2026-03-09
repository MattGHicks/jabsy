'use client'

import { useEffect, useState } from 'react'

export default function ClearCachePage() {
  const [status, setStatus] = useState('Clearing cache...')

  useEffect(() => {
    async function clearEverything() {
      try {
        // Unregister all service workers
        if ('serviceWorker' in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations()
          await Promise.all(registrations.map(r => r.unregister()))
        }

        // Clear all caches
        if ('caches' in window) {
          const keys = await caches.keys()
          await Promise.all(keys.map(k => caches.delete(k)))
        }

        setStatus('Cache cleared! Redirecting...')

        // Redirect to home after a short delay
        setTimeout(() => {
          window.location.href = '/'
        }, 1000)
      } catch {
        setStatus('Error clearing cache. Please clear your browser data manually.')
      }
    }

    clearEverything()
  }, [])

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
      <div className="text-center">
        <h1
          className="text-2xl text-[#f4f4f5] mb-4"
          style={{ fontFamily: 'var(--font-barlow)', fontWeight: 900 }}
        >
          {status}
        </h1>
        <p className="text-sm text-[#71717a]">
          This fixes loading issues from a previous version of the app.
        </p>
      </div>
    </div>
  )
}
