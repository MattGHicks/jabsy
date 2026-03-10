'use client'

import { useState, useRef, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, Loader2, Check } from 'lucide-react'
import { cn, getInitials } from '@/lib/utils'
import { updateProfileSettings } from '@/actions/auth'

interface ProfileFormProps {
  email: string
  initialUsername: string
  initialAvatarUrl: string | null
  role: string
  memberSince: string | null
  leagueCount: number
  roleLabel: string
  children: ReactNode
}

export function ProfileForm({ email, initialUsername, initialAvatarUrl, role, memberSince, leagueCount, roleLabel, children }: ProfileFormProps) {
  const router = useRouter()
  const [username, setUsername] = useState(initialUsername)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(initialAvatarUrl)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const fd = new FormData()
    fd.set('username', username)
    if (avatarFile) fd.set('avatar', avatarFile)
    startTransition(async () => {
      try {
        const result = await updateProfileSettings(fd)
        if (result?.error) {
          setError(result.error)
        } else {
          setSaved(true)
          router.refresh()
          setTimeout(() => setSaved(false), 2500)
        }
      } catch {
        setError('Something went wrong. Please try again.')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* ── Header with editable avatar ── */}
      <div className="flex items-center gap-5 sm:gap-6 mb-10">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full shrink-0 group cursor-pointer"
        >
          <div className="w-full h-full rounded-full bg-[#1e1e1e] border-2 border-[#27272a] overflow-hidden flex items-center justify-center">
            {avatarPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarPreview} alt={username} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
            ) : (
              <span className="text-3xl font-black text-[#52525b]" style={{ fontFamily: 'var(--font-barlow)', fontWeight: 900 }}>
                {getInitials(username || 'U')}
              </span>
            )}
          </div>
          <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <Camera className="w-5 h-5 text-white" />
          </div>
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />

        <div className="flex-1 min-w-0">
          <h1
            className="text-[#f4f4f5] uppercase leading-tight mb-1.5"
            style={{ fontFamily: 'var(--font-barlow)', fontWeight: 900, fontSize: 'clamp(1.8rem, 5vw, 3rem)' }}
          >
            {username}
          </h1>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-[#e11d48]/10 text-[#e11d48] border border-[#e11d48]/20">
              {roleLabel}
            </span>
            {memberSince && (
              <span className="text-[11px] text-[#52525b]">
                Joined {memberSince}
              </span>
            )}
            <span className="text-[11px] text-[#52525b]">
              · {leagueCount} {leagueCount === 1 ? 'league' : 'leagues'}
            </span>
          </div>
        </div>
      </div>

      {/* ── Desktop: two-column layout (stats+leagues | account form) ── */}
      <div className="lg:grid lg:grid-cols-[1fr_380px] lg:gap-10">
        {/* Left column: stats + leagues (server-rendered) */}
        <div className="min-w-0">
          {children}
        </div>

        {/* Right column: account details */}
        <div className="lg:sticky lg:top-20 lg:self-start">
          <p className="text-[10px] font-semibold text-[#3f3f46] uppercase tracking-[0.15em] mb-4 hidden lg:block">Account Settings</p>
          <div className="lg:rounded-xl lg:bg-[#111111] lg:border lg:border-[#1e1e1e] lg:p-6">
      <div className="flex flex-col gap-5">
        {/* Username edit */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-semibold text-[#3f3f46] uppercase tracking-[0.15em]">Username</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            minLength={3}
            maxLength={30}
            pattern="[a-zA-Z0-9_\-]+"
            className="h-10 px-3 rounded-lg bg-[#1a1a1a] border border-[#27272a] text-[#f4f4f5] text-sm placeholder:text-[#52525b] focus:outline-none focus:border-[#e11d48] transition-colors"
          />
          <p className="text-[11px] text-[#3f3f46]">Letters, numbers, underscores, and hyphens only.</p>
        </div>

        {/* Email + Role info rows */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between py-2.5 border-b border-[#1e1e1e]">
            <span className="text-[10px] font-semibold text-[#3f3f46] uppercase tracking-[0.15em]">Email</span>
            <span className="text-sm text-[#71717a]">{email}</span>
          </div>
          <div className="flex items-center justify-between py-2.5 border-b border-[#1e1e1e]">
            <span className="text-[10px] font-semibold text-[#3f3f46] uppercase tracking-[0.15em]">Role</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-[#e11d48]/10 text-[#e11d48] border border-[#e11d48]/20">
              {roleLabel}
            </span>
          </div>
        </div>

        {/* Error */}
        {error && (
          <p className="text-sm text-[#e11d48]">{error}</p>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={isPending}
          className={cn(
            'h-11 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer',
            saved
              ? 'bg-green-500/15 border border-green-500/30 text-green-400'
              : 'bg-[#e11d48] text-white hover:bg-[#be123c]',
            isPending && 'opacity-60 cursor-not-allowed'
          )}
        >
          {isPending ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
          ) : saved ? (
            <><Check className="w-4 h-4" /> Saved!</>
          ) : (
            'Save Changes'
          )}
        </button>
      </div>
          </div>
        </div>
      </div>
    </form>
  )
}
