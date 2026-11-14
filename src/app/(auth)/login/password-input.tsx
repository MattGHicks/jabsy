'use client'

import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

export function PasswordInput() {
  const [show, setShow] = useState(false)

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="password" className="text-sm font-medium text-text-secondary">Password</label>
      <div className="relative">
        <input
          id="password"
          name="password"
          type={show ? 'text' : 'password'}
          required
          autoComplete="current-password"
          placeholder="••••••••"
          className="h-11 w-full rounded-lg px-3 pr-10 text-sm bg-[#0a0a0a] border border-[#27272a] text-text-primary placeholder:text-text-faint focus:outline-none focus:border-[#e11d48]/50 focus:ring-1 focus:ring-[#e11d48]/20 transition-colors"
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          aria-label={show ? 'Hide password' : 'Show password'}
          aria-pressed={show}
          className="absolute right-1 top-1/2 -translate-y-1/2 w-9 h-9 grid place-items-center rounded-md text-text-muted hover:text-text-primary transition-colors cursor-pointer"
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  )
}
