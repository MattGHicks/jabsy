'use client'

import { useState, useTransition, useRef } from 'react'
import { GripVertical, Plus, Trash2, X, Check, Loader2 } from 'lucide-react'
import { createFight, deleteFight, setFightStatus, saveResult, reorderFights } from '@/actions/admin'
import { RESULT_METHODS, FIGHT_STATUSES } from '@/lib/constants'
import { cn } from '@/lib/utils'
import type { Fight } from '@/types'

const STATUS_STYLES: Record<string, string> = {
  scheduled: 'bg-zinc-800 text-zinc-400 border-zinc-700',
  live: 'bg-[#e11d48]/10 text-[#e11d48] border-[#e11d48]/20',
  final: 'bg-green-500/10 text-green-400 border-green-500/20',
  cancelled: 'bg-zinc-900 text-zinc-600 border-zinc-800',
  no_contest: 'bg-zinc-900 text-zinc-600 border-zinc-800',
}

type FightStatus = (typeof FIGHT_STATUSES)[number]

// ─── Fight Card ─────────────────────────────────────────────────────────────

interface FightCardProps {
  fight: Fight
  eventId: string
  isDragging: boolean
  isDragOver: boolean
  onDragStart: (e: React.DragEvent) => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent) => void
  onDragEnd: () => void
}

function FightCard({ fight, eventId, isDragging, isDragOver, onDragStart, onDragOver, onDrop, onDragEnd }: FightCardProps) {
  const [winner, setWinner] = useState(fight.result_winner ?? '')
  const [method, setMethod] = useState(fight.result_method ?? '')
  const [round, setRound] = useState(fight.result_round?.toString() ?? '')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [isCompleted, setIsCompleted] = useState(fight.status === 'final')
  const [currentStatus, setCurrentStatus] = useState<FightStatus>(fight.status as FightStatus)
  const [statusPending, setStatusPending] = useState(false)
  const [, startSaveTransition] = useTransition()
  const savedTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const showRound = method === 'ko_tko' || method === 'submission'
  const roundButtons = Array.from({ length: fight.scheduled_rounds }, (_, i) => i + 1)

  function triggerSave(w: string, m: string, r: string) {
    if (!w || !m) return
    clearTimeout(savedTimerRef.current)
    setSaveStatus('saving')
    startSaveTransition(async () => {
      const result = await saveResult({
        fight_id: fight.id,
        event_id: eventId,
        result_winner: w,
        result_method: m,
        result_round: r ? parseInt(r) : null,
      })
      if (result.success) {
        setSaveStatus('saved')
        setIsCompleted(true)
        setCurrentStatus('final')
        savedTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2500)
      } else {
        setSaveStatus('error')
      }
    })
  }

  function handleWinnerChange(value: string) {
    setWinner(value)
    if (method) triggerSave(value, method, round)
  }

  function handleMethodChange(value: string) {
    const isNoRound = value === 'decision' || value === 'dq' || value === 'nc'
    const effectiveRound = isNoRound ? '' : round
    setMethod(value)
    if (isNoRound) setRound('')
    if (winner) triggerSave(winner, value, effectiveRound)
  }

  function handleRoundChange(r: number) {
    const rStr = r.toString()
    const newRound = round === rStr ? '' : rStr
    setRound(newRound)
    if (winner && method) triggerSave(winner, method, newRound)
  }

  async function handleStatusChange(status: FightStatus) {
    setStatusPending(true)
    setCurrentStatus(status)
    if (status === 'final') setIsCompleted(true)
    await setFightStatus(fight.id, status, eventId)
    setStatusPending(false)
  }

  return (
    <div
      className={cn(
        'rounded-lg border transition-all duration-150',
        isDragging && 'opacity-30 scale-[0.99]',
        isDragOver && 'border-[#e11d48]/40 bg-[#e11d48]/5',
        !isDragOver && isCompleted && 'border-green-500/20 bg-[#141414]',
        !isDragOver && !isCompleted && 'border-[#1e1e1e] bg-[#141414]',
      )}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {/* Top row */}
      <div className="px-3 py-3 flex items-center gap-3">
        {/* Drag handle */}
        <div
          draggable
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          className="cursor-grab active:cursor-grabbing text-[#3f3f46] hover:text-[#71717a] transition-colors select-none shrink-0"
        >
          <GripVertical className="w-4 h-4" />
        </div>

        {/* Fight info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            {fight.is_main_event && (
              <span className="text-[8px] font-bold tracking-widest text-[#e11d48] uppercase">Main</span>
            )}
            <span className="text-sm font-bold text-[#e11d48]">{fight.red_name}</span>
            {fight.red_record && <span className="text-xs text-[#52525b]">({fight.red_record})</span>}
            <span className="text-xs text-[#3f3f46] font-medium">vs</span>
            <span className="text-sm font-bold text-blue-400">{fight.blue_name}</span>
            {fight.blue_record && <span className="text-xs text-[#52525b]">({fight.blue_record})</span>}
          </div>
          <p className="text-[11px] text-[#52525b] mt-0.5">{fight.scheduled_rounds}R</p>
        </div>

        {/* Status + Delete */}
        <div className="flex items-center gap-2 shrink-0">
          <select
            value={currentStatus}
            disabled={statusPending}
            onChange={(e) => handleStatusChange(e.target.value as FightStatus)}
            className={cn(
              'h-7 pl-2 pr-6 rounded-md text-xs font-semibold border appearance-none cursor-pointer focus:outline-none transition-colors disabled:opacity-60',
              STATUS_STYLES[currentStatus] ?? STATUS_STYLES.scheduled
            )}
          >
            {FIGHT_STATUSES.map(s => (
              <option key={s} value={s} className="bg-[#1e1e1e] text-[#f4f4f5] font-normal">
                {s.replace('_', ' ')}
              </option>
            ))}
          </select>

          <form action={async () => { await deleteFight(fight.id, eventId) }}>
            <button
              type="submit"
              className="w-7 h-7 flex items-center justify-center rounded-md text-[#52525b] hover:text-[#e11d48] hover:bg-[#e11d48]/5 transition-colors cursor-pointer"
              title="Delete fight"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </div>

      {/* Result entry row */}
      <div className="px-3 pb-3 pt-3 border-t border-[#1a1a1a] flex flex-wrap items-end gap-x-4 gap-y-2">
        {/* Winner */}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold text-[#3f3f46] uppercase tracking-wider">Winner</span>
          <div className="flex rounded-md overflow-hidden border border-[#27272a]">
            {[
              { value: 'red', label: fight.red_name.split(' ').pop() ?? 'Red', color: 'text-[#e11d48]' },
              { value: 'blue', label: fight.blue_name.split(' ').pop() ?? 'Blue', color: 'text-blue-400' },
              { value: 'draw', label: 'Draw', color: 'text-[#a1a1aa]' },
              { value: 'nc', label: 'NC', color: 'text-[#71717a]' },
            ].map(({ value, label, color }) => (
              <button
                key={value}
                type="button"
                onClick={() => handleWinnerChange(value)}
                className={cn(
                  'px-2.5 h-7 text-xs font-semibold cursor-pointer transition-colors border-r border-[#27272a] last:border-r-0',
                  winner === value
                    ? `bg-[#1e1e1e] ${color}`
                    : 'bg-[#0a0a0a] text-[#3f3f46] hover:text-[#71717a]'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Method */}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold text-[#3f3f46] uppercase tracking-wider">Method</span>
          <select
            value={method}
            onChange={(e) => handleMethodChange(e.target.value)}
            className="h-7 pl-2 pr-7 rounded-md text-xs bg-[#0a0a0a] border border-[#27272a] text-[#f4f4f5] focus:outline-none focus:border-[#e11d48]/50 transition-colors"
          >
            <option value="">— select —</option>
            {RESULT_METHODS.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>

        {/* Round buttons (KO/Sub only) */}
        {showRound && (
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold text-[#3f3f46] uppercase tracking-wider">Round</span>
            <div className="flex gap-1">
              {roundButtons.map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => handleRoundChange(r)}
                  className={cn(
                    'w-7 h-7 rounded-md text-xs font-bold border cursor-pointer transition-colors',
                    round === r.toString()
                      ? 'bg-[#1e1e1e] border-[#e11d48]/40 text-[#e11d48]'
                      : 'bg-[#0a0a0a] border-[#27272a] text-[#3f3f46] hover:text-[#71717a] hover:border-[#333]'
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Save status indicator */}
        <div className="ml-auto flex items-end pb-0.5">
          {saveStatus === 'saving' && (
            <span className="flex items-center gap-1 text-xs text-[#71717a]">
              <Loader2 className="w-3 h-3 animate-spin" />
              Saving
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="flex items-center gap-1 text-xs text-green-400">
              <Check className="w-3 h-3" />
              Saved
            </span>
          )}
          {saveStatus === 'error' && (
            <span className="text-xs text-[#e11d48]">Failed to save</span>
          )}
          {isCompleted && saveStatus === 'idle' && (
            <span className="text-xs text-green-500/40 font-medium">Final</span>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Add Fight Modal ─────────────────────────────────────────────────────────

interface AddFightModalProps {
  eventId: string
  defaultBoutOrder: number
  onClose: () => void
}

function AddFightModal({ eventId, defaultBoutOrder, onClose }: AddFightModalProps) {
  const [rounds, setRounds] = useState(3)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#141414] border border-[#27272a] rounded-xl shadow-2xl w-full max-w-lg">

        {/* Modal header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[#1e1e1e]">
          <h2 className="text-sm font-bold text-[#f4f4f5] tracking-wide">Add Fight</h2>
          <button onClick={onClose} className="text-[#52525b] hover:text-[#a1a1aa] transition-colors cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form action={createFight} className="px-6 py-5 grid grid-cols-2 gap-4">
          <input type="hidden" name="event_id" value={eventId} />
          <input type="hidden" name="bout_order" value={defaultBoutOrder} />
          <input type="hidden" name="scheduled_rounds" value={rounds} />

          {/* Red corner */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[#e11d48]">
              Red Corner <span className="text-[#e11d48]">*</span>
            </label>
            <input
              name="red_name" type="text" required placeholder="Fighter name"
              className="h-9 w-full rounded-md px-3 text-sm bg-[#0a0a0a] border border-[#27272a] text-[#f4f4f5] placeholder:text-[#3f3f46] focus:outline-none focus:border-[#e11d48]/50 transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[#a1a1aa]">Red Record</label>
            <input
              name="red_record" type="text" placeholder="e.g. 27-1"
              className="h-9 w-full rounded-md px-3 text-sm bg-[#0a0a0a] border border-[#27272a] text-[#f4f4f5] placeholder:text-[#3f3f46] focus:outline-none focus:border-[#e11d48]/50 transition-colors"
            />
          </div>

          {/* Blue corner */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-blue-400">
              Blue Corner <span className="text-[#e11d48]">*</span>
            </label>
            <input
              name="blue_name" type="text" required placeholder="Fighter name"
              className="h-9 w-full rounded-md px-3 text-sm bg-[#0a0a0a] border border-[#27272a] text-[#f4f4f5] placeholder:text-[#3f3f46] focus:outline-none focus:border-[#e11d48]/50 transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[#a1a1aa]">Blue Record</label>
            <input
              name="blue_record" type="text" placeholder="e.g. 22-3"
              className="h-9 w-full rounded-md px-3 text-sm bg-[#0a0a0a] border border-[#27272a] text-[#f4f4f5] placeholder:text-[#3f3f46] focus:outline-none focus:border-[#e11d48]/50 transition-colors"
            />
          </div>

          {/* Sherdog URLs */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[#e11d48]/70">Red Sherdog URL</label>
            <input
              name="red_sherdog_url" type="url" placeholder="https://sherdog.com/fighter/..."
              className="h-9 w-full rounded-md px-3 text-sm bg-[#0a0a0a] border border-[#27272a] text-[#f4f4f5] placeholder:text-[#3f3f46] focus:outline-none focus:border-[#e11d48]/50 transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-blue-400/70">Blue Sherdog URL</label>
            <input
              name="blue_sherdog_url" type="url" placeholder="https://sherdog.com/fighter/..."
              className="h-9 w-full rounded-md px-3 text-sm bg-[#0a0a0a] border border-[#27272a] text-[#f4f4f5] placeholder:text-[#3f3f46] focus:outline-none focus:border-[#e11d48]/50 transition-colors"
            />
          </div>

          {/* Scheduled rounds */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[#a1a1aa]">Rounds</label>
            <div className="flex gap-2">
              {[3, 5].map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRounds(r)}
                  className={cn(
                    'flex-1 h-9 rounded-md border text-sm font-bold transition-colors cursor-pointer',
                    rounds === r
                      ? 'bg-[#1e1e1e] border-[#e11d48]/30 text-[#f4f4f5]'
                      : 'bg-[#0a0a0a] border-[#27272a] text-[#52525b] hover:text-[#a1a1aa] hover:border-[#333]'
                  )}
                >
                  {r}R
                </button>
              ))}
            </div>
          </div>

          {/* Main event toggle */}
          <div className="col-span-2 flex items-center gap-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input name="is_main_event" type="checkbox" className="w-4 h-4 rounded border-[#27272a] bg-[#0a0a0a] accent-[#e11d48]" />
              <span className="text-sm font-medium text-[#a1a1aa]">Main Event</span>
            </label>
          </div>

          {/* Actions */}
          <div className="col-span-2 flex gap-3 pt-2 border-t border-[#1e1e1e]">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-9 rounded-md text-sm font-medium text-[#71717a] border border-[#27272a] hover:text-[#a1a1aa] hover:border-[#333] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 h-9 rounded-md bg-[#e11d48] text-white text-sm font-semibold hover:bg-[#be123c] transition-colors cursor-pointer"
            >
              Add Fight
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Event Manager ───────────────────────────────────────────────────────────

export interface EventManagerProps {
  initialFights: Fight[]
  eventId: string
}

export function EventManager({ initialFights, eventId }: EventManagerProps) {
  const [fights, setFights] = useState(initialFights)
  const [showModal, setShowModal] = useState(false)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [, startReorder] = useTransition()

  function handleDragStart(e: React.DragEvent, id: string) {
    e.dataTransfer.effectAllowed = 'move'
    setDraggingId(id)
  }

  function handleDragOver(e: React.DragEvent, id: string) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (id !== draggingId) setDragOverId(id)
  }

  function handleDrop(e: React.DragEvent, targetId: string) {
    e.preventDefault()
    if (!draggingId || draggingId === targetId) {
      setDraggingId(null)
      setDragOverId(null)
      return
    }
    const fromIdx = fights.findIndex(f => f.id === draggingId)
    const toIdx = fights.findIndex(f => f.id === targetId)
    const reordered = [...fights]
    const [moved] = reordered.splice(fromIdx, 1)
    reordered.splice(toIdx, 0, moved)
    const updated = reordered.map((f, i) => ({ ...f, bout_order: i + 1 }))
    setFights(updated)
    setDraggingId(null)
    setDragOverId(null)
    startReorder(async () => {
      await reorderFights(eventId, updated.map(f => f.id))
    })
  }

  function handleDragEnd() {
    setDraggingId(null)
    setDragOverId(null)
  }

  return (
    <>
      {/* List header */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-semibold text-[#52525b] uppercase tracking-widest">
          {fights.length} {fights.length === 1 ? 'Fight' : 'Fights'}
          {fights.length > 0 && (
            <span className="ml-2 font-normal normal-case text-[#3f3f46]">· drag to reorder</span>
          )}
        </p>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-md bg-[#e11d48] text-white text-xs font-semibold hover:bg-[#be123c] transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Fight
        </button>
      </div>

      {/* Fights or empty state */}
      {fights.length === 0 ? (
        <div className="flex flex-col items-center py-16 border border-dashed border-[#1e1e1e] rounded-lg">
          <p className="text-sm text-[#52525b]">No fights yet. Hit Add Fight to get started.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {fights.map(fight => (
            <FightCard
              key={fight.id}
              fight={fight}
              eventId={eventId}
              isDragging={draggingId === fight.id}
              isDragOver={dragOverId === fight.id}
              onDragStart={e => handleDragStart(e, fight.id)}
              onDragOver={e => handleDragOver(e, fight.id)}
              onDrop={e => handleDrop(e, fight.id)}
              onDragEnd={handleDragEnd}
            />
          ))}
        </div>
      )}

      {/* Add fight modal */}
      {showModal && (
        <AddFightModal
          eventId={eventId}
          defaultBoutOrder={fights.length + 1}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  )
}
