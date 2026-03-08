'use client'

import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

type ButtonVariant = 'primary' | 'default' | 'ghost' | 'outline' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-[#e11d48] text-white hover:bg-[#be123c] active:bg-[#9f1239] border border-[#e11d48] hover:border-[#be123c]',
  default:
    'bg-[#282828] text-[#f4f4f5] hover:bg-[#333] border border-[#333] hover:border-[#444]',
  ghost:
    'bg-transparent text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#1e1e1e] border border-transparent',
  outline:
    'bg-transparent text-[#f4f4f5] border border-[#3f3f46] hover:border-[#52525b] hover:bg-[#1e1e1e]',
  danger:
    'bg-transparent text-[#e11d48] border border-[#e11d48]/30 hover:bg-[#e11d48]/10 hover:border-[#e11d48]/60',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2.5',
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'md', loading, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          'inline-flex items-center justify-center font-medium rounded-md transition-all duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e11d48]/50',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'cursor-pointer select-none',
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {loading ? (
          <>
            <svg
              className="animate-spin w-4 h-4 shrink-0"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            <span>Loading...</span>
          </>
        ) : (
          children
        )}
      </button>
    )
  }
)

Button.displayName = 'Button'

export { Button }
export type { ButtonProps }
