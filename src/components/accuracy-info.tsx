'use client'

import { useState } from 'react'
import { Info, X } from 'lucide-react'

export function AccuracyInfo() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-[10px] text-[#3f3f46] hover:text-[#52525b] transition-colors uppercase tracking-[0.12em] font-semibold cursor-pointer"
      >
        <Info className="w-3 h-3" />
        How is accuracy calculated?
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" onClick={() => setOpen(false)}>
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

          {/* Modal */}
          <div
            className="relative w-full max-w-md rounded-xl bg-[#111111] border border-[#1e1e1e] overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e1e1e]">
              <h3
                className="text-[#f4f4f5] uppercase"
                style={{ fontFamily: 'var(--font-barlow)', fontWeight: 800, fontSize: '1rem', letterSpacing: '0.04em' }}
              >
                Accuracy Breakdown
              </h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-[#52525b] hover:text-[#a1a1aa] hover:bg-[#1a1a1a] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="px-5 py-5 flex flex-col gap-4">
              <p className="text-[13px] text-[#71717a] leading-relaxed">
                Accuracy measures how many points you earned out of the maximum possible — it&apos;s a weighted percentage, not just win/loss.
              </p>

              <div className="flex flex-col gap-2">
                <p className="text-[10px] font-semibold text-[#3f3f46] uppercase tracking-[0.15em]">Points per fight</p>
                <div className="grid grid-cols-1 gap-1.5">
                  <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-[#0a0a0a] border border-[#1a1a1a]">
                    <span className="text-xs text-[#a1a1aa]">Correct winner</span>
                    <span className="text-xs font-bold text-[#f4f4f5]" style={{ fontFamily: 'var(--font-barlow)', fontWeight: 800 }}>5 pts</span>
                  </div>
                  <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-[#0a0a0a] border border-[#1a1a1a]">
                    <span className="text-xs text-[#a1a1aa]">Correct method</span>
                    <span className="text-xs font-bold text-[#f4f4f5]" style={{ fontFamily: 'var(--font-barlow)', fontWeight: 800 }}>+3 pts</span>
                  </div>
                  <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-[#0a0a0a] border border-[#1a1a1a]">
                    <span className="text-xs text-[#a1a1aa]">Correct round <span className="text-[#52525b]">(KO/Sub only)</span></span>
                    <span className="text-xs font-bold text-[#f4f4f5]" style={{ fontFamily: 'var(--font-barlow)', fontWeight: 800 }}>+2 pts</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <p className="text-[10px] font-semibold text-[#3f3f46] uppercase tracking-[0.15em]">Max possible per fight</p>
                <div className="grid grid-cols-2 gap-1.5">
                  <div className="flex flex-col items-center py-3 rounded-lg bg-[#0a0a0a] border border-[#1a1a1a]">
                    <span
                      className="text-lg leading-none text-[#60a5fa] mb-1"
                      style={{ fontFamily: 'var(--font-barlow)', fontWeight: 800 }}
                    >
                      8
                    </span>
                    <span className="text-[9px] text-[#52525b] uppercase tracking-wider">Decision</span>
                  </div>
                  <div className="flex flex-col items-center py-3 rounded-lg bg-[#0a0a0a] border border-[#1a1a1a]">
                    <span
                      className="text-lg leading-none text-[#e11d48] mb-1"
                      style={{ fontFamily: 'var(--font-barlow)', fontWeight: 800 }}
                    >
                      10
                    </span>
                    <span className="text-[9px] text-[#52525b] uppercase tracking-wider">KO/TKO · Sub</span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-[#1e1e1e]">
                <p className="text-[11px] text-[#52525b] leading-relaxed">
                  <span className="text-[#71717a] font-medium">Formula:</span> Total points earned ÷ total max possible × 100. Draws and no-contests are excluded.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
