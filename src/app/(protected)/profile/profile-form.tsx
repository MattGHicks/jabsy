'use client'

import { useState, useRef, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, Loader2, Check } from 'lucide-react'
import { toast } from 'sonner'
import { cn, getInitials } from '@/lib/utils'
import { updateProfileSettings, updateAvatar } from '@/actions/auth'

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
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarPreview(URL.createObjectURL(file))
    setAvatarUploading(true)
    try {
      const fd = new FormData()
      fd.set('avatar', file)
      const result = await updateAvatar(fd)
      if (result?.error) {
        toast.error(result.error)
      } else {
        toast.success('Avatar updated')
        router.refresh()
      }
    } catch {
      toast.error('Failed to upload avatar')
    } finally {
      setAvatarUploading(false)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const fd = new FormData()
    fd.set('username', username)
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
      <div className="flex items-center gap-5 sm:gap-6 mb-8">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={avatarUploading}
          className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full shrink-0 group cursor-pointer"
        >
          <div className="w-full h-full rounded-full bg-[#1e1e1e] border-2 border-[#27272a] overflow-hidden flex items-center justify-center">
            {avatarUploading ? (
              <Loader2 className="w-6 h-6 text-[#52525b] animate-spin" />
            ) : avatarPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarPreview} alt={username} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
            ) : (
              <span className="text-3xl font-black text-[#52525b]" style={{ fontFamily: 'var(--font-barlow)', fontWeight: 900 }}>
                {getInitials(username || 'U')}
              </span>
            )}
          </div>
          {/* Persistent camera badge */}
          <div className="absolute -bottom-0.5 -right-0.5 w-7 h-7 rounded-full bg-[#1e1e1e] border border-[#27272a] flex items-center justify-center group-hover:bg-[#e11d48]/20 group-hover:border-[#e11d48]/30 transition-all">
            <Camera className="w-3.5 h-3.5 text-[#52525b] group-hover:text-[#e11d48] transition-colors" />
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

      {/* ── Account settings card ── */}
      <div className="mb-10">
        <p className="text-[10px] font-semibold text-[#3f3f46] uppercase tracking-[0.15em] mb-4">Account Settings</p>
        <div className="rounded-xl bg-[#111111] border border-[#1e1e1e] p-5 sm:p-6 max-w-lg">
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

      {/* ── Stats + Leagues (server-rendered children) ── */}
      {children}
    </form>
  )
}
