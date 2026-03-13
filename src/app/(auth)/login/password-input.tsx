'use client'

import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

export function PasswordInput() {
  const [show, setShow] = useState(false)

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="password" className="text-xs font-medium text-[#a1a1aa]">Password</label>
      <div className="relative">
        <input
          id="password"
          name="password"
          type={show ? 'text' : 'password'}
          required
          autoComplete="current-password"
          placeholder="••••••••"
          className="h-10 w-full rounded-md px-3 pr-10 text-sm bg-[#0a0a0a] border border-[#27272a] text-[#f4f4f5] placeholder:text-[#3f3f46] focus:outline-none focus:border-[#e11d48]/50 focus:ring-1 focus:ring-[#e11d48]/20 transition-colors"
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#52525b] hover:text-[#a1a1aa] transition-colors"
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  )
}
