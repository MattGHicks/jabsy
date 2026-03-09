'use client'

import { useEffect } from 'react'

export function StaleAuthCleaner() {
  useEffect(() => {
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

    // Clear Supabase auth cookies via document.cookie
    try {
      document.cookie.split(';').forEach((c) => {
        const name = c.trim().split('=')[0]
        if (name.startsWith('sb-')) {
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
        }
      })
    } catch {}
  }, [])

  return null
}
