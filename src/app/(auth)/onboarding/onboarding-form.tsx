'use client'

import { useState, useRef } from 'react'
import { Camera, User } from 'lucide-react'
import { updateProfile } from '@/actions/auth'

interface OnboardingFormProps {
  googleAvatarUrl: string | null
  pendingInvite?: string
}

export function OnboardingForm({ googleAvatarUrl, pendingInvite }: OnboardingFormProps) {
  const [avatarPreview, setAvatarPreview] = useState<string | null>(googleAvatarUrl)
  const [hasCustomFile, setHasCustomFile] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      const url = URL.createObjectURL(file)
      setAvatarPreview(url)
      setHasCustomFile(true)
    }
  }

  return (
    <form action={updateProfile} className="flex flex-col gap-6">
      {pendingInvite && (
        <input type="hidden" name="pending_invite" value={pendingInvite} />
      )}

      {/* Avatar */}
      <div className="flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="relative w-20 h-20 rounded-full bg-[#1e1e1e] border-2 border-[#27272a] hover:border-[#e11d48]/50 transition-colors cursor-pointer group overflow-hidden"
        >
          {avatarPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarPreview}
              alt="Avatar preview"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="flex flex-col items-center justify-center w-full h-full gap-1">
              <User className="w-7 h-7 text-[#52525b] group-hover:text-[#71717a] transition-colors" />
            </div>
          )}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <Camera className="w-5 h-5 text-white" />
          </div>
        </button>

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="text-xs text-[#71717a] hover:text-[#a1a1aa] transition-colors cursor-pointer"
        >
          {hasCustomFile ? 'Change photo' : googleAvatarUrl ? 'Using Google photo · click to change' : 'Upload photo (optional)'}
        </button>

        <input
          ref={fileRef}
          name="avatar"
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {/* Username */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="username" className="text-xs font-medium text-[#a1a1aa]">
          Fighter Name
        </label>
        <input
          id="username"
          name="username"
          type="text"
          required
          autoComplete="off"
          placeholder="e.g. ChampionPicks"
          minLength={3}
          maxLength={20}
          pattern="[a-zA-Z0-9_]+"
          className="h-10 w-full rounded-md px-3 text-sm bg-[#0a0a0a] border border-[#27272a] text-[#f4f4f5] placeholder:text-[#3f3f46] focus:outline-none focus:border-[#e11d48]/50 focus:ring-1 focus:ring-[#e11d48]/20 transition-colors"
        />
        <p className="text-xs text-[#52525b]">
          3–20 characters. Letters, numbers, underscores only.
        </p>
      </div>

      <button
        type="submit"
        className="h-11 w-full rounded-md bg-[#e11d48] text-white text-sm font-semibold hover:bg-[#be123c] transition-colors cursor-pointer"
      >
        Enter the Octagon
      </button>
    </form>
  )
}
