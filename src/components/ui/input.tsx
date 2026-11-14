'use client'

import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-text-secondary"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'h-11 w-full rounded-lg px-3 text-sm',
            'bg-[#141414] border border-[#27272a]',
            'text-text-primary placeholder:text-text-muted',
            'transition-colors duration-150',
            'focus:outline-none focus:border-[#e11d48]/60 focus:ring-1 focus:ring-[#e11d48]/30',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            error && 'border-[#e11d48]/60 focus:border-[#e11d48] focus:ring-[#e11d48]/40',
            className
          )}
          {...props}
        />
        {error && (
          <p className="text-xs text-[#e11d48]">{error}</p>
        )}
        {hint && !error && (
          <p className="text-xs text-text-secondary">{hint}</p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'

export { Input }
export type { InputProps }
