'use client'

import { useState, useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, Loader2, Check } from 'lucide-react'
import { cn, getInitials } from '@/lib/utils'
import { updateLeague } from '@/actions/leagues'

interface LeagueSettingsFormProps {
  leagueId: string
  initialName: string
  initialDescription: string | null
  initialAvatarUrl: string | null
}

export function LeagueSettingsForm({ leagueId, initialName, initialDescription, initialAvatarUrl }: LeagueSettingsFormProps) {
  const router = useRouter()
  const [name, setName] = useState(initialName)
  const [description, setDescription] = useState(initialDescription ?? '')
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
    fd.set('id', leagueId)
    fd.set('name', name)
    fd.set('description', description)
    if (avatarFile) fd.set('avatar', avatarFile)
    startTransition(async () => {
      try {
        const result = await updateLeague(fd)
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* League logo */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="relative w-20 h-20 rounded-xl shrink-0 group cursor-pointer"
        >
          <div className="w-full h-full rounded-xl bg-[#1a1a1a] border-2 border-[#27272a] overflow-hidden flex items-center justify-center">
            {avatarPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarPreview} alt={name} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
            ) : (
              <span
                className="text-2xl text-[#52525b]"
                style={{ fontFamily: 'var(--font-barlow)', fontWeight: 900 }}
              >
                {getInitials(name || 'L')}
              </span>
            )}
          </div>
          <div className="absolute inset-0 rounded-xl bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <Camera className="w-5 h-5 text-white" />
          </div>
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-[#a1a1aa] uppercase tracking-wider mb-1">League Logo</p>
          <p className="text-[11px] text-[#52525b]">Click to upload. Square images work best.</p>
        </div>
      </div>

      {/* Name */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-[#a1a1aa] uppercase tracking-wider">League Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="h-10 px-3 rounded-lg bg-[#1a1a1a] border border-[#27272a] text-[#f4f4f5] text-sm placeholder:text-[#52525b] focus:outline-none focus:border-[#e11d48] transition-colors"
        />
      </div>

      {/* Description */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-[#a1a1aa] uppercase tracking-wider">
          Description <span className="text-[#52525b] normal-case">(optional)</span>
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="px-3 py-2.5 rounded-lg bg-[#1a1a1a] border border-[#27272a] text-[#f4f4f5] text-sm placeholder:text-[#52525b] focus:outline-none focus:border-[#e11d48] transition-colors resize-none"
          placeholder="What's this league about?"
        />
      </div>

      {/* Error */}
      {error && (
        <p className="text-sm text-[#e11d48]">{error}</p>
      )}

      {/* Submit */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className={cn(
            'h-9 px-5 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer',
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
    </form>
  )
}
