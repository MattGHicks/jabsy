'use client'

import { useEffect, useState } from 'react'

interface LocalTimeProps {
  isoString: string
}

export function LocalTime({ isoString }: LocalTimeProps) {
  const [display, setDisplay] = useState<string | null>(null)

  useEffect(() => {
    const d = new Date(isoString)
    const local = d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZoneName: 'short',
    })
    setDisplay(local)
  }, [isoString])

  // Server render: show ET as fallback until JS runs
  if (!display) {
    return (
      <span suppressHydrationWarning>
        {new Intl.DateTimeFormat('en-US', {
          timeZone: 'America/New_York',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        }).format(new Date(isoString))} ET
      </span>
    )
  }

  return <span>{display}</span>
}
