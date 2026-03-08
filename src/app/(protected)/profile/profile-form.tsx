'use client'

import { useState, useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, Loader2, Check } from 'lucide-react'
import { cn, getInitials } from '@/lib/utils'
import { updateProfileSettings } from '@/actions/auth'

interface ProfileFormProps {
  email: string
  initialUsername: string
  initialAvatarUrl: string | null
  role: string
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  league_owner: 'League Owner',
  player: 'Player',
}

export function ProfileForm({ email, initialUsername, initialAvatarUrl, role }: ProfileFormProps) {
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
          router.refresh() // Refresh so NavBar picks up new username/avatar
          setTimeout(() => setSaved(false), 2500)
        }
      } catch {
        setError('Something went wrong. Please try again.')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {/* Avatar */}
      <div className="flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="relative w-24 h-24 rounded-full overflow-hidden group"
        >
          <div className="w-full h-full rounded-full bg-[#1e1e1e] border border-[#27272a] flex items-center justify-center overflow-hidden">
            {avatarPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarPreview} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="text-2xl font-bold text-[#71717a]" style={{ fontFamily: 'var(--font-barlow)' }}>
                {getInitials(username || 'U')}
              </span>
            )}
          </div>
          <div className="absolute inset-0 rounded-full bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <Camera className="w-5 h-5 text-white" />
          </div>
        </button>
        <p className="text-xs text-[#52525b]">Click to change avatar</p>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
      </div>

      {/* Email (read-only) */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-[#52525b] uppercase tracking-wider">Email</label>
        <div className="h-10 px-3 rounded-lg bg-[#111111] border border-[#1e1e1e] text-sm text-[#52525b] flex items-center">
          {email}
        </div>
      </div>

      {/* Role (read-only) */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-[#52525b] uppercase tracking-wider">Role</label>
        <div className="h-10 px-3 rounded-lg bg-[#111111] border border-[#1e1e1e] text-sm text-[#71717a] flex items-center gap-2">
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-[#e11d48]/10 text-[#e11d48] border border-[#e11d48]/20">
            {ROLE_LABELS[role] ?? role}
          </span>
        </div>
      </div>

      {/* Username */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-[#a1a1aa] uppercase tracking-wider">Username</label>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          minLength={3}
          maxLength={30}
          pattern="[a-zA-Z0-9_\-]+"
          className="h-10 px-3 rounded-lg bg-[#1a1a1a] border border-[#27272a] text-[#f4f4f5] text-sm placeholder:text-[#52525b] focus:outline-none focus:border-[#e11d48] transition-colors"
        />
        <p className="text-[11px] text-[#52525b]">Letters, numbers, underscores, and hyphens only.</p>
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
          'h-11 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2',
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
    </form>
  )
}
