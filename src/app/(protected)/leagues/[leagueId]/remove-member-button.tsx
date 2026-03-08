'use client'

import { useState, useTransition } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { X, AlertTriangle } from 'lucide-react'
import { removeMember } from '@/actions/leagues'

interface RemoveMemberButtonProps {
  leagueId: string
  memberId: string
  username: string | null
}

export function RemoveMemberButton({ leagueId, memberId, username }: RemoveMemberButtonProps) {
  const router = useRouter()
  const [showModal, setShowModal] = useState(false)
  const [isRemoving, startRemoving] = useTransition()

  function handleConfirm() {
    startRemoving(async () => {
      await removeMember(leagueId, memberId)
      setShowModal(false)
      router.refresh()
    })
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        title="Remove member"
        className="inline-flex items-center justify-center w-7 h-7 rounded-md text-[#52525b] hover:text-[#e11d48] hover:bg-[#e11d48]/5 border border-transparent hover:border-[#e11d48]/20 transition-colors cursor-pointer"
      >
        <X className="w-3.5 h-3.5" />
      </button>

      {showModal && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => !isRemoving && setShowModal(false)}
          />

          {/* Modal */}
          <div className="relative w-full max-w-sm rounded-xl bg-[#141414] border border-[#27272a] shadow-2xl p-6">
            {/* Close button */}
            <button
              onClick={() => !isRemoving && setShowModal(false)}
              className="absolute top-4 right-4 text-[#52525b] hover:text-[#a1a1aa] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Icon + heading */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-[#e11d48]/10 border border-[#e11d48]/20 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-[#e11d48]" />
              </div>
              <div>
                <h2
                  className="text-[#f4f4f5] uppercase leading-tight"
                  style={{ fontFamily: 'var(--font-barlow)', fontWeight: 800, fontSize: '1.25rem' }}
                >
                  Remove Member?
                </h2>
                <p className="text-xs text-[#71717a] mt-0.5">This cannot be undone</p>
              </div>
            </div>

            <p className="text-sm text-[#a1a1aa] mb-6">
              <span className="text-[#f4f4f5] font-semibold">{username ?? 'This member'}</span> will be removed from the league and will lose access to all events and picks. They can rejoin via invite link.
            </p>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => !isRemoving && setShowModal(false)}
                disabled={isRemoving}
                className="flex-1 h-10 rounded-lg text-sm font-semibold border border-[#27272a] bg-[#1e1e1e] text-[#a1a1aa] hover:text-[#f4f4f5] hover:border-[#333] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={isRemoving}
                className="flex-1 h-10 rounded-lg text-sm font-semibold bg-[#e11d48] hover:bg-[#be123c] text-white transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isRemoving ? 'Removing…' : 'Yes, remove'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
