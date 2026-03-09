'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { GripVertical, Plus, Trash2, X, Check, Loader2, Pencil, RotateCcw } from 'lucide-react'
import { createFight, updateFight, deleteFight, setFightStatus, saveResult, clearResult, reorderFights } from '@/actions/admin'
import { RESULT_METHODS, ADMIN_FIGHT_STATUSES } from '@/lib/constants'
import { cn } from '@/lib/utils'
import type { Fight } from '@/types'

const STATUS_STYLES: Record<string, string> = {
  scheduled: 'bg-zinc-800 text-zinc-400 border-zinc-700',
  live: 'bg-[#e11d48]/10 text-[#e11d48] border-[#e11d48]/20',
  final: 'bg-green-500/10 text-green-400 border-green-500/20',
}

type FightStatus = (typeof ADMIN_FIGHT_STATUSES)[number]

// ─── Portal wrapper ──────────────────────────────────────────────────────────

function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  if (!mounted) return null
  return createPortal(children, document.body)
}

// ─── Shared modal form fields ────────────────────────────────────────────────

const INPUT_CLASS = 'h-9 w-full rounded-lg px-3 text-sm bg-[#0a0a0a] border border-[#27272a] text-[#f4f4f5] placeholder:text-[#3f3f46] focus:outline-none focus:border-[#e11d48]/50 transition-colors'

// ─── Fight Card ──────────────────────────────────────────────────────────────

interface FightCardProps {
  fight: Fight
  eventId: string
  isDragging: boolean
  isDragOver: boolean
  onEdit: () => void
  onDragStart: (e: React.DragEvent) => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent) => void
  onDragEnd: () => void
}

function FightCard({ fight, eventId, isDragging, isDragOver, onEdit, onDragStart, onDragOver, onDrop, onDragEnd }: FightCardProps) {
  const [winner, setWinner] = useState(fight.result_winner ?? '')
  const [method, setMethod] = useState(fight.result_method ?? '')
  const [round, setRound] = useState(fight.result_round?.toString() ?? '')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [isCompleted, setIsCompleted] = useState(fight.status === 'final')
  const [currentStatus, setCurrentStatus] = useState<FightStatus>(fight.status as FightStatus)
  const [statusPending, setStatusPending] = useState(false)
  const [, startSaveTransition] = useTransition()
  const savedTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  // Draw/NC are methods that auto-set the winner
  const isNoWinnerMethod = method === 'draw' || method === 'nc'
  const showRound = method === 'ko_tko' || method === 'submission'
  const roundButtons = Array.from({ length: fight.scheduled_rounds }, (_, i) => i + 1)

  function splitName(name: string) {
    const parts = name.trim().split(/\s+/)
    if (parts.length <= 1) return { first: '', last: name }
    return { first: parts.slice(0, -1).join(' '), last: parts[parts.length - 1] }
  }

  const redName = splitName(fight.red_name)
  const blueName = splitName(fight.blue_name)

  function triggerSave(w: string, m: string, r: string) {
    const effectiveWinner = m === 'draw' ? 'draw' : m === 'nc' ? 'nc' : w
    if (!effectiveWinner || !m) return
    clearTimeout(savedTimerRef.current)
    setSaveStatus('saving')
    startSaveTransition(async () => {
      const result = await saveResult({
        fight_id: fight.id,
        event_id: eventId,
        result_winner: effectiveWinner,
        result_method: m,
        result_round: r ? parseInt(r) : null,
      })
      if (result.success) {
        setSaveStatus('saved')
        setErrorMsg('')
        setIsCompleted(true)
        setCurrentStatus('final')
        savedTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2500)
      } else {
        setSaveStatus('error')
        setErrorMsg(result.error ?? 'Save failed')
        savedTimerRef.current = setTimeout(() => { setSaveStatus('idle'); setErrorMsg('') }, 5000)
      }
    })
  }

  function handleWinnerChange(value: string) {
    setWinner(value)
    if (method) triggerSave(value, method, round)
  }

  function handleMethodChange(value: string) {
    const noRound = value === 'decision' || value === 'dq' || value === 'draw' || value === 'nc'
    const effectiveRound = noRound ? '' : round
    setMethod(value)
    if (noRound) setRound('')

    if (value === 'draw') {
      setWinner('draw')
      triggerSave('draw', value, '')
    } else if (value === 'nc') {
      setWinner('nc')
      triggerSave('nc', value, '')
    } else if (winner) {
      triggerSave(winner, value, effectiveRound)
    }
  }

  function handleRoundChange(r: number) {
    const rStr = r.toString()
    const newRound = round === rStr ? '' : rStr
    setRound(newRound)
    if (winner && method) triggerSave(winner, method, newRound)
  }

  async function handleClearResult() {
    setSaveStatus('saving')
    const result = await clearResult(fight.id, eventId)
    if (result.success) {
      setWinner('')
      setMethod('')
      setRound('')
      setIsCompleted(false)
      setCurrentStatus('scheduled')
      setSaveStatus('idle')
    } else {
      setSaveStatus('error')
    }
  }

  async function handleStatusChange(status: FightStatus) {
    const prevStatus = currentStatus
    const prevCompleted = isCompleted
    setStatusPending(true)
    setCurrentStatus(status)
    if (status === 'final') setIsCompleted(true)
    try {
      await setFightStatus(fight.id, status, eventId)
    } catch {
      // Rollback on failure
      setCurrentStatus(prevStatus)
      setIsCompleted(prevCompleted)
    }
    setStatusPending(false)
  }

  return (
    <div
      className={cn(
        'rounded-xl border overflow-hidden transition-all duration-150',
        isDragging && 'opacity-30 scale-[0.99]',
        isDragOver && 'border-[#e11d48]/40 bg-[#e11d48]/5',
        !isDragOver && isCompleted && 'border-green-500/20 bg-[#111111]',
        !isDragOver && !isCompleted && 'border-[#1e1e1e] bg-[#111111]',
      )}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {/* Top bar: drag handle + meta + actions */}
      <div className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-[#0e0e0e]">
        <div
          draggable
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          className="cursor-grab active:cursor-grabbing text-[#3f3f46] hover:text-[#71717a] transition-colors select-none shrink-0 p-1"
        >
          <GripVertical className="w-4 h-4" />
        </div>

        <div className="flex items-center gap-2 flex-1 min-w-0">
          {fight.is_main_event && (
            <span className="text-[8px] font-bold tracking-[0.2em] text-[#e11d48] uppercase">Main</span>
          )}
          <span className="text-[11px] text-[#3f3f46]">
            {fight.scheduled_rounds}R
            {fight.weight_class && <span className="ml-1">· {fight.weight_class}</span>}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <select
            value={currentStatus}
            disabled={statusPending}
            onChange={(e) => handleStatusChange(e.target.value as FightStatus)}
            className={cn(
              'h-8 pl-2.5 pr-6 rounded-lg text-[11px] font-semibold border appearance-none cursor-pointer focus:outline-none transition-colors disabled:opacity-60',
              STATUS_STYLES[currentStatus] ?? STATUS_STYLES.scheduled
            )}
          >
            {ADMIN_FIGHT_STATUSES.map(s => (
              <option key={s} value={s} className="bg-[#1e1e1e] text-[#f4f4f5] font-normal">
                {s}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={onEdit}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[#52525b] hover:text-[#a1a1aa] hover:bg-[#1a1a1a] transition-colors cursor-pointer"
            title="Edit fight"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>

          <form action={async () => { await deleteFight(fight.id, eventId) }}>
            <button
              type="submit"
              className="w-8 h-8 flex items-center justify-center rounded-lg text-[#52525b] hover:text-[#e11d48] hover:bg-[#e11d48]/5 transition-colors cursor-pointer"
              title="Delete fight"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </div>

      {/* Fighter matchup — pick-card-style grid layout */}
      <div className="grid grid-cols-[1fr_auto_1fr]">
        {/* Red corner */}
        <div
          className={cn(
            'relative py-4 px-4 text-left transition-all',
            !isNoWinnerMethod && 'cursor-pointer',
          )}
          onClick={() => !isNoWinnerMethod && handleWinnerChange('red')}
          style={winner === 'red'
            ? { background: 'linear-gradient(to right, rgba(225,29,72,0.12), transparent)' }
            : undefined
          }
        >
          <div className={cn(
            'absolute left-0 top-0 bottom-0 w-[3px] transition-all',
            winner === 'red' ? 'bg-[#e11d48]' : 'bg-[#e11d48]/20'
          )} />
          <div className="pl-1">
            {redName.first && (
              <p className="text-[10px] text-[#71717a] uppercase tracking-wide leading-none mb-0.5">{redName.first}</p>
            )}
            <p
              className={cn(
                'uppercase leading-[0.95] transition-colors',
                winner === 'red' ? 'text-[#e11d48]' : 'text-[#f4f4f5]'
              )}
              style={{ fontFamily: 'var(--font-barlow)', fontWeight: 800, fontSize: 'clamp(1rem, 3vw, 1.25rem)' }}
            >
              {redName.last}
            </p>
            {fight.red_record && (
              <p className="text-[10px] text-[#52525b] mt-1">{fight.red_record}</p>
            )}
          </div>
          {winner === 'red' && (
            <div className="absolute top-2 right-2">
              <div className="w-4 h-4 rounded-full bg-[#e11d48] flex items-center justify-center">
                <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
          )}
        </div>

        {/* VS divider */}
        <div className="flex flex-col items-center justify-center px-1">
          <span className="text-[11px] font-black text-[#3f3f46]" style={{ fontFamily: 'var(--font-barlow)' }}>
            VS
          </span>
        </div>

        {/* Blue corner */}
        <div
          className={cn(
            'relative py-4 px-4 text-right transition-all',
            !isNoWinnerMethod && 'cursor-pointer',
          )}
          onClick={() => !isNoWinnerMethod && handleWinnerChange('blue')}
          style={winner === 'blue'
            ? { background: 'linear-gradient(to left, rgba(96,165,250,0.12), transparent)' }
            : undefined
          }
        >
          <div className={cn(
            'absolute right-0 top-0 bottom-0 w-[3px] transition-all',
            winner === 'blue' ? 'bg-blue-400' : 'bg-blue-500/20'
          )} />
          <div className="pr-1">
            {blueName.first && (
              <p className="text-[10px] text-[#71717a] uppercase tracking-wide leading-none mb-0.5">{blueName.first}</p>
            )}
            <p
              className={cn(
                'uppercase leading-[0.95] transition-colors',
                winner === 'blue' ? 'text-blue-400' : 'text-[#f4f4f5]'
              )}
              style={{ fontFamily: 'var(--font-barlow)', fontWeight: 800, fontSize: 'clamp(1rem, 3vw, 1.25rem)' }}
            >
              {blueName.last}
            </p>
            {fight.blue_record && (
              <p className="text-[10px] text-[#52525b] mt-1">{fight.blue_record}</p>
            )}
          </div>
          {winner === 'blue' && (
            <div className="absolute top-2 left-2">
              <div className="w-4 h-4 rounded-full bg-blue-400 flex items-center justify-center">
                <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Result entry — stacked rows for easy thumb access */}
      <div className="px-3 sm:px-4 pb-3 pt-2.5 border-t border-[#1a1a1a] space-y-2">
        {/* Method row */}
        <div className="space-y-1.5">
          <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#3f3f46]">Method</span>
          <div className="grid grid-cols-3 gap-1.5">
            {RESULT_METHODS.map(m => (
              <button
                key={m.value}
                type="button"
                onClick={() => handleMethodChange(m.value)}
                className={cn(
                  'h-9 px-2 rounded-lg text-[11px] font-bold border transition-all cursor-pointer',
                  method === m.value
                    ? 'bg-[#27272a] border-[#3f3f46] text-[#f4f4f5]'
                    : 'bg-[#0a0a0a] border-[#1e1e1e] text-[#52525b] hover:border-[#3f3f46] hover:text-[#71717a]'
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Round row (KO/Sub only) */}
        {showRound && (
          <div className="space-y-1.5">
            <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#3f3f46]">Round</span>
            <div className="flex gap-1.5">
              {roundButtons.map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => handleRoundChange(r)}
                  className={cn(
                    'w-9 h-9 rounded-lg text-xs font-bold border cursor-pointer transition-colors',
                    round === r.toString()
                      ? 'bg-[#1e1e1e] border-[#e11d48]/40 text-[#e11d48]'
                      : 'bg-[#0a0a0a] border-[#1e1e1e] text-[#52525b] hover:text-[#71717a] hover:border-[#27272a]'
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Save indicator + reset */}
        <div className="flex items-center justify-between min-h-[20px]">
          {/* Reset result button */}
          {(winner || isCompleted) && saveStatus === 'idle' && (
            <button
              type="button"
              onClick={handleClearResult}
              className="flex items-center gap-1 text-[11px] text-[#52525b] hover:text-amber-400 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </button>
          )}
          <div className="ml-auto flex items-center">
            {saveStatus === 'saving' && (
              <span className="flex items-center gap-1 text-[11px] text-[#71717a]">
                <Loader2 className="w-3 h-3 animate-spin" />
              </span>
            )}
            {saveStatus === 'saved' && (
              <span className="flex items-center gap-1 text-[11px] text-green-400">
                <Check className="w-3 h-3" />
                Saved
              </span>
            )}
            {saveStatus === 'error' && (
              <span className="text-[11px] text-[#e11d48]">{errorMsg || 'Failed'}</span>
            )}
            {isCompleted && saveStatus === 'idle' && (
              <span className="text-[11px] text-green-500/40 font-medium">Final</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Fight Form Modal (shared for Add + Edit) ───────────────────────────────

interface FightFormModalProps {
  eventId: string
  fight?: Fight | null
  defaultBoutOrder: number
  onClose: () => void
}

function FightFormModal({ eventId, fight, defaultBoutOrder, onClose }: FightFormModalProps) {
  const [rounds, setRounds] = useState(fight?.scheduled_rounds ?? 3)
  const isEdit = !!fight

  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-[#111111] border border-[#27272a] rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">

          {/* Modal header */}
          <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[#1e1e1e]">
            <h2
              className="text-[#f4f4f5] uppercase"
              style={{ fontFamily: 'var(--font-barlow)', fontWeight: 800, fontSize: '1rem', letterSpacing: '0.04em' }}
            >
              {isEdit ? 'Edit Fight' : 'Add Fight'}
            </h2>
            <button onClick={onClose} className="text-[#52525b] hover:text-[#a1a1aa] transition-colors cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>

          <form action={isEdit ? updateFight : createFight} className="px-6 py-5 grid grid-cols-2 gap-4">
            <input type="hidden" name="event_id" value={eventId} />
            {isEdit && <input type="hidden" name="id" value={fight.id} />}
            <input type="hidden" name="bout_order" value={fight?.bout_order ?? defaultBoutOrder} />
            <input type="hidden" name="scheduled_rounds" value={rounds} />

            {/* Red corner */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-[#e11d48] uppercase tracking-wider">
                Red Corner <span className="text-[#e11d48]/50">*</span>
              </label>
              <input
                name="red_name" type="text" required placeholder="Fighter name"
                defaultValue={fight?.red_name ?? ''}
                className={INPUT_CLASS}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-[#52525b] uppercase tracking-wider">Red Record</label>
              <input
                name="red_record" type="text" placeholder="e.g. 27-1"
                defaultValue={fight?.red_record ?? ''}
                className={INPUT_CLASS}
              />
            </div>

            {/* Blue corner */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">
                Blue Corner <span className="text-[#e11d48]/50">*</span>
              </label>
              <input
                name="blue_name" type="text" required placeholder="Fighter name"
                defaultValue={fight?.blue_name ?? ''}
                className={INPUT_CLASS}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-[#52525b] uppercase tracking-wider">Blue Record</label>
              <input
                name="blue_record" type="text" placeholder="e.g. 22-3"
                defaultValue={fight?.blue_record ?? ''}
                className={INPUT_CLASS}
              />
            </div>

            {/* Sherdog URLs */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-[#52525b] uppercase tracking-wider">Red Sherdog URL</label>
              <input
                name="red_sherdog_url" type="url" placeholder="https://sherdog.com/fighter/..."
                defaultValue={fight?.red_sherdog_url ?? ''}
                className={INPUT_CLASS}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-[#52525b] uppercase tracking-wider">Blue Sherdog URL</label>
              <input
                name="blue_sherdog_url" type="url" placeholder="https://sherdog.com/fighter/..."
                defaultValue={fight?.blue_sherdog_url ?? ''}
                className={INPUT_CLASS}
              />
            </div>

            {/* Scheduled rounds */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-[#52525b] uppercase tracking-wider">Rounds</label>
              <div className="flex gap-2">
                {[3, 5].map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRounds(r)}
                    className={cn(
                      'flex-1 h-9 rounded-lg border text-sm font-bold transition-colors cursor-pointer',
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
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  name="is_main_event"
                  type="checkbox"
                  defaultChecked={fight?.is_main_event ?? false}
                  className="w-4 h-4 rounded border-[#27272a] bg-[#0a0a0a] accent-[#e11d48]"
                />
                <span className="text-sm font-medium text-[#a1a1aa]">Main Event</span>
              </label>
            </div>

            {/* Actions */}
            <div className="col-span-2 flex gap-3 pt-3 border-t border-[#1e1e1e]">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 h-10 rounded-lg text-sm font-medium text-[#71717a] border border-[#27272a] hover:text-[#a1a1aa] hover:border-[#333] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 h-10 rounded-lg bg-[#e11d48] text-white text-sm font-semibold hover:bg-[#be123c] transition-colors cursor-pointer"
              >
                {isEdit ? 'Save Changes' : 'Add Fight'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Portal>
  )
}

// ─── Event Manager ───────────────────────────────────────────────────────────

export interface EventManagerProps {
  initialFights: Fight[]
  eventId: string
}

export function EventManager({ initialFights, eventId }: EventManagerProps) {
  const [fights, setFights] = useState(initialFights)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingFight, setEditingFight] = useState<Fight | null>(null)
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
        <p className="text-[10px] font-bold text-[#52525b] uppercase tracking-widest">
          {fights.length} {fights.length === 1 ? 'Fight' : 'Fights'}
          {fights.length > 0 && (
            <span className="ml-2 font-normal normal-case text-[#3f3f46]">· drag to reorder</span>
          )}
        </p>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-lg bg-[#e11d48] text-white text-xs font-semibold hover:bg-[#be123c] transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Fight
        </button>
      </div>

      {/* Fights or empty state */}
      {fights.length === 0 ? (
        <div className="flex flex-col items-center py-16 border border-dashed border-[#1e1e1e] rounded-xl">
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
              onEdit={() => setEditingFight(fight)}
              onDragStart={e => handleDragStart(e, fight.id)}
              onDragOver={e => handleDragOver(e, fight.id)}
              onDrop={e => handleDrop(e, fight.id)}
              onDragEnd={handleDragEnd}
            />
          ))}
        </div>
      )}

      {/* Add fight modal */}
      {showAddModal && (
        <FightFormModal
          eventId={eventId}
          defaultBoutOrder={fights.length + 1}
          onClose={() => setShowAddModal(false)}
        />
      )}

      {/* Edit fight modal */}
      {editingFight && (
        <FightFormModal
          eventId={eventId}
          fight={editingFight}
          defaultBoutOrder={editingFight.bout_order}
          onClose={() => setEditingFight(null)}
        />
      )}
    </>
  )
}
