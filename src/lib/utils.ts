import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { formatDistanceToNow } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(date))
}

export function formatDateTime(date: string | Date) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(date)) + ' ET'
}

export function formatRelative(date: string | Date) {
  return formatDistanceToNow(new Date(date), { addSuffix: true })
}

export function generateInviteCode(length = 8): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

/**
 * Check if picks are open for an event.
 * Picks open at midnight ET on the day of the event and lock at lock_time.
 */
export function isPicksOpen(startTime: string, lockTime: string | null): boolean {
  const now = new Date()
  // Get event date in ET
  const eventDate = new Date(startTime)
  const etFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const nowParts = etFormatter.formatToParts(now)
  const eventParts = etFormatter.formatToParts(eventDate)

  const getVal = (parts: Intl.DateTimeFormatPart[], type: string) =>
    parts.find(p => p.type === type)?.value ?? ''

  const nowDateStr = `${getVal(nowParts, 'year')}-${getVal(nowParts, 'month')}-${getVal(nowParts, 'day')}`
  const eventDateStr = `${getVal(eventParts, 'year')}-${getVal(eventParts, 'month')}-${getVal(eventParts, 'day')}`

  // Picks open on event day (in ET)
  if (nowDateStr < eventDateStr) return false

  // Check lock time
  if (lockTime && now >= new Date(lockTime)) return false

  return true
}

/**
 * Get a formatted date string for when picks open (event day in ET).
 */
export function getPicksOpenDate(startTime: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date(startTime))
}
