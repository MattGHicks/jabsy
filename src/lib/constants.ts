export const WEIGHT_CLASSES = [
  'Strawweight',
  'Flyweight',
  'Bantamweight',
  'Featherweight',
  'Lightweight',
  'Welterweight',
  'Middleweight',
  'Light Heavyweight',
  'Heavyweight',
  "Women's Strawweight",
  "Women's Flyweight",
  "Women's Bantamweight",
  "Women's Featherweight",
] as const

export const FIGHT_METHODS = [
  { value: 'ko_tko', label: 'KO/TKO' },
  { value: 'submission', label: 'Submission' },
  { value: 'decision', label: 'Decision' },
] as const

export const RESULT_METHODS = [
  { value: 'ko_tko', label: 'KO/TKO' },
  { value: 'submission', label: 'Submission' },
  { value: 'decision', label: 'Decision' },
  { value: 'dq', label: 'DQ' },
  { value: 'draw', label: 'Draw' },
  { value: 'nc', label: 'No Contest' },
] as const

export const EVENT_STATUSES = ['upcoming', 'live', 'completed', 'cancelled'] as const
export const FIGHT_STATUSES = ['scheduled', 'live', 'final', 'cancelled', 'no_contest'] as const
export const ADMIN_FIGHT_STATUSES = ['scheduled', 'live', 'final'] as const

export const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'mattghicks@gmail.com'
