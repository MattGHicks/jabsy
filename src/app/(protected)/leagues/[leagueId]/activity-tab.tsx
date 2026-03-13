'use client'

import { useState, useEffect } from 'react'
import { Loader2, Activity, UserPlus, FileCheck, Trophy } from 'lucide-react'
import { cn, getInitials } from '@/lib/utils'
import { getLeagueActivity, type ActivityItem } from '@/actions/activity'

interface ActivityTabProps {
  leagueId: string
  currentUserId: string
}

const ACTIVITY_CONFIG: Record<ActivityItem['type'], { icon: typeof Activity; color: string; bg: string; border: string }> = {
  member_joined: { icon: UserPlus, color: '#22c55e', bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.15)' },
  picks_submitted: { icon: FileCheck, color: '#60a5fa', bg: 'rgba(96,165,250,0.08)', border: 'rgba(96,165,250,0.15)' },
  event_completed: { icon: Trophy, color: '#fbbf24', bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.15)' },
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function getActivityDescription(item: ActivityItem, isMe: boolean): string {
  const name = isMe ? 'You' : (item.username ?? 'Someone')
  switch (item.type) {
    case 'member_joined':
      return `${name} joined the league`
    case 'picks_submitted':
      return `${name} submitted ${item.meta.pickCount ?? 0} pick${(item.meta.pickCount ?? 0) !== 1 ? 's' : ''} for ${item.meta.eventName}`
    case 'event_completed':
      return `${item.meta.eventName} has been completed`
  }
}

export function ActivityTab({ leagueId, currentUserId }: ActivityTabProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setIsLoading(true)
      const data = await getLeagueActivity(leagueId)
      setActivities(data)
      setIsLoading(false)
    }
    load()
  }, [leagueId])

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-[#52525b] animate-spin mb-3" />
        <p className="text-sm text-[#52525b]">Loading activity...</p>
      </div>
    )
  }

  if (activities.length === 0) {
    return (
      <div className="flex flex-col items-center py-20 text-center">
        <Activity className="w-8 h-8 text-[#52525b] mb-3" />
        <p className="text-sm text-[#71717a] mb-1">No activity yet</p>
        <p className="text-xs text-[#3f3f46]">Join events, make picks, and invite members to see activity here.</p>
      </div>
    )
  }

  // Group activities by date
  const grouped: { label: string; items: ActivityItem[] }[] = []
  let currentLabel = ''
  for (const item of activities) {
    const date = new Date(item.timestamp)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
    let label: string
    if (diffDays === 0) label = 'Today'
    else if (diffDays === 1) label = 'Yesterday'
    else if (diffDays < 7) label = 'This Week'
    else label = 'Earlier'

    if (label !== currentLabel) {
      grouped.push({ label, items: [] })
      currentLabel = label
    }
    grouped[grouped.length - 1].items.push(item)
  }

  return (
    <div className="flex flex-col gap-6">
      {grouped.map((group) => (
        <div key={group.label}>
          <p
            className="text-[10px] uppercase tracking-[0.15em] text-[#3f3f46] mb-3 px-1"
            style={{ fontFamily: 'var(--font-barlow)', fontWeight: 700 }}
          >
            {group.label}
          </p>
          <div className="flex flex-col gap-1.5">
            {group.items.map((item) => {
              const config = ACTIVITY_CONFIG[item.type]
              const Icon = config.icon
              const isMe = item.userId === currentUserId

              return (
                <div
                  key={item.id}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#111111] border border-[#1e1e1e] hover:border-[#27272a] transition-colors"
                >
                  {/* Activity icon */}
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: config.bg, border: `1px solid ${config.border}` }}
                  >
                    <Icon className="w-4 h-4" style={{ color: config.color }} />
                  </div>

                  {/* Avatar (for user-driven activities) */}
                  {item.userId && (
                    <div className="w-7 h-7 rounded-full bg-[#1e1e1e] border border-[#27272a] overflow-hidden shrink-0">
                      {item.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.avatarUrl} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-[9px] font-bold text-[#52525b] flex items-center justify-center w-full h-full">
                          {getInitials(item.username ?? 'U')}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Description */}
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-sm leading-snug', isMe ? 'text-[#f4f4f5]' : 'text-[#a1a1aa]')}>
                      {getActivityDescription(item, isMe)}
                    </p>
                  </div>

                  {/* Timestamp */}
                  <span className="text-[10px] text-[#3f3f46] shrink-0 whitespace-nowrap">
                    {formatRelativeTime(item.timestamp)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
