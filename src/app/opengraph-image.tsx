import { ImageResponse } from 'next/og'
import { getNextUpcomingEvent } from '@/lib/next-event'

export const alt = 'Jabsy — Fantasy MMA Picks'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// The card is rendered from whatever event is next, so it has to be allowed to
// go stale and re-render. Baked once at build time it would still be showing a
// finished card weeks later, which is exactly how the previous one broke.
export const revalidate = 300

// Same split the landing page uses, so the share card reads like the product.
const lastName = (n: string) => (n.split(' ').pop() ?? n).toUpperCase()
const firstNames = (n: string) => n.split(' ').slice(0, -1).join(' ')

/** "Xfinity Mobile Arena, Philadelphia, PA" → "PHILADELPHIA, PA" */
function shortVenue(venue: string | null): string | null {
  if (!venue) return null
  const parts = venue.split(',').map(p => p.trim()).filter(Boolean)
  return (parts.length > 1 ? parts.slice(1).join(', ') : parts[0]).toUpperCase()
}

/**
 * Built from explicit parts rather than a single locale string: Intl's own
 * formatting carries commas and narrow no-break spaces that render as ragged
 * gaps once the card sets everything in letter-spaced caps.
 */
function lockLine(iso: string): string {
  const tz = 'America/New_York'
  const part = (opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat('en-US', { timeZone: tz, ...opts })
      .format(new Date(iso))
      .replace(/\s+/g, ' ')
      .trim()

  const weekday = part({ weekday: 'short' })
  const month = part({ month: 'short' })
  const day = part({ day: 'numeric' })
  const time = part({ hour: 'numeric', minute: '2-digit' })

  return `${weekday} ${month} ${day} · ${time} ET`.toUpperCase()
}

export default async function Image() {
  // ── Font (Barlow Condensed, heavy) ────────────────────────────
  let fontData: ArrayBuffer | null = null
  try {
    const css = await fetch(
      'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@900',
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    ).then(r => r.text())
    const urls = [...css.matchAll(/url\(([^)]+)\)/g)].map(m => m[1])
    if (urls[0]) fontData = await fetch(urls[0]).then(r => r.arrayBuffer())
  } catch { /* fall back to system font */ }

  const ff = fontData ? 'Barlow Condensed' : 'sans-serif'
  const fonts = fontData
    ? [
        { name: 'Barlow Condensed', data: fontData, weight: 900 as const, style: 'normal' as const },
        { name: 'Barlow Condensed', data: fontData, weight: 700 as const, style: 'normal' as const },
      ]
    : []

  // Never let a data problem produce a broken card — fall back to the brand card.
  // The no-event card is otherwise only reachable by emptying the events table,
  // so this switch exists to preview it locally: JABSY_OG_FORCE_FALLBACK=1.
  const event = process.env.JABSY_OG_FORCE_FALLBACK
    ? null
    : await getNextUpcomingEvent().catch(() => null)
  const main = event?.mainEvent ?? null
  const isLive = event?.status === 'live'

  const shell = {
    width: 1200,
    height: 630,
    display: 'flex' as const,
    position: 'relative' as const,
    overflow: 'hidden' as const,
    background: '#0a0a0a',
    fontFamily: ff,
  }

  const Brand = (
    <div style={{ position: 'absolute', top: 44, left: 60, display: 'flex', alignItems: 'center' }}>
      <div
        style={{
          width: 56, height: 56, borderRadius: 14, background: '#e11d48',
          display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 14,
        }}
      >
        <div style={{ fontSize: 40, fontWeight: 900, color: '#0a0a0a', display: 'flex', marginTop: -2 }}>J</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: 34, fontWeight: 900, color: '#ffffff', letterSpacing: 1, lineHeight: 1, display: 'flex' }}>
          JABSY
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#a1a1aa', letterSpacing: 4, display: 'flex', marginTop: 4 }}>
          FANTASY MMA PICKS
        </div>
      </div>
    </div>
  )

  // Reads to someone who has never heard of Jabsy: this is the whole game.
  const ScoringStrip = (
    <div style={{ position: 'absolute', top: 168, left: 60, display: 'flex', alignItems: 'center' }}>
      {[['5', 'WINNER'], ['3', 'METHOD'], ['2', 'ROUND']].map(([n, label], i) => (
        <div key={label} style={{ display: 'flex', alignItems: 'center' }}>
          {i > 0 && (
            <div style={{ width: 1, height: 26, display: 'flex', background: 'rgba(255,255,255,0.14)', margin: '0 22px' }} />
          )}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ fontSize: 34, fontWeight: 900, color: '#e11d48', display: 'flex', marginRight: 10 }}>{n}</div>
            <div style={{ fontSize: 19, fontWeight: 700, color: '#a1a1aa', letterSpacing: 3, display: 'flex', marginTop: 2 }}>{label}</div>
          </div>
        </div>
      ))}
      <div style={{ width: 1, height: 26, display: 'flex', background: 'rgba(255,255,255,0.14)', margin: '0 22px' }} />
      <div style={{ fontSize: 17, fontWeight: 700, color: '#52525b', letterSpacing: 3, display: 'flex' }}>
        PTS PER FIGHT
      </div>
    </div>
  )

  // Ambient glow + grid, echoing the landing page hero.
  const Backdrop = (
    <div style={{ position: 'absolute', top: 0, left: 0, width: 1200, height: 630, display: 'flex' }}>
      <div
        style={{
          position: 'absolute', top: -260, right: -180, width: 900, height: 900, display: 'flex',
          background: 'radial-gradient(circle, rgba(225,29,72,0.30) 0%, rgba(225,29,72,0.10) 42%, rgba(10,10,10,0) 70%)',
        }}
      />
      <div
        style={{
          position: 'absolute', bottom: -320, left: -220, width: 820, height: 820, display: 'flex',
          background: 'radial-gradient(circle, rgba(59,130,246,0.18) 0%, rgba(10,10,10,0) 68%)',
        }}
      />
      <div
        style={{
          position: 'absolute', top: 0, left: 0, width: 1200, height: 630, display: 'flex',
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />
    </div>
  )

  // ── Fallback: no upcoming event on the board ──────────────────
  if (!event || !main) {
    return new ImageResponse(
      (
        <div style={shell}>
          {Backdrop}
          {Brand}
          <div
            style={{
              position: 'absolute', left: 60, bottom: 64, width: 1080,
              display: 'flex', flexDirection: 'column',
            }}
          >
            <div style={{ fontSize: 22, fontWeight: 700, color: '#e11d48', letterSpacing: 5, display: 'flex', marginBottom: 14 }}>
              PICK EVERY FIGHT ON THE CARD
            </div>
            <div style={{ fontSize: 104, fontWeight: 900, color: '#ffffff', lineHeight: 1, display: 'flex' }}>
              PROVE YOU KNOW MMA.
            </div>
            <div
              style={{
                width: 820, height: 6, display: 'flex', marginTop: 22, marginBottom: 26,
                background: 'linear-gradient(90deg, #e11d48 0%, #e11d48 38%, #3b82f6 62%, #3b82f6 100%)',
              }}
            />
            <div style={{ display: 'flex', width: 1080, justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                {[['5', 'WINNER'], ['3', 'METHOD'], ['2', 'ROUND']].map(([n, label]) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', marginRight: 34 }}>
                    <div style={{ fontSize: 46, fontWeight: 900, color: '#e11d48', display: 'flex', marginRight: 10 }}>{n}</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: '#a1a1aa', letterSpacing: 2, display: 'flex', marginTop: 3 }}>{label}</div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 26, fontWeight: 900, color: '#fb7185', display: 'flex' }}>JABSYPICKS.COM</div>
            </div>
          </div>
        </div>
      ),
      { ...size, fonts }
    )
  }

  // ── Main path: next event's headline fight ────────────────────
  const meta = [main.weight_class, `${main.scheduled_rounds} ROUNDS`]
    .filter(Boolean).join(' · ').toUpperCase()
  const venue = shortVenue(event.venue)
  const footerLeft = [
    isLive ? 'LIVE NOW' : `PICKS LOCK · ${lockLine(event.start_time)}`,
    venue,
    event.fightCount ? `${event.fightCount} FIGHTS` : null,
  ].filter(Boolean).join(' · ')

  const Corner = ({ name, record, color }: { name: string; record: string | null; color: string }) => (
    <div style={{ display: 'flex', flexDirection: 'column', width: 430 }}>
      <div style={{ fontSize: 26, fontWeight: 700, color: '#a1a1aa', letterSpacing: 2, display: 'flex' }}>
        {firstNames(name) || ' '}
      </div>
      <div style={{ fontSize: 76, fontWeight: 900, color: '#ffffff', lineHeight: 1.05, display: 'flex' }}>
        {lastName(name)}
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color, letterSpacing: 2, display: 'flex', marginTop: 6 }}>
        {record ?? ''}
      </div>
    </div>
  )

  return new ImageResponse(
    (
      <div style={shell}>
        {Backdrop}
        {Brand}
        {ScoringStrip}

        {/* Status pill — top right */}
        <div
          style={{
            position: 'absolute', top: 50, right: 60, display: 'flex', alignItems: 'center',
            padding: '10px 20px', borderRadius: 999,
            border: `2px solid ${isLive ? 'rgba(225,29,72,0.75)' : 'rgba(255,255,255,0.22)'}`,
            background: isLive ? 'rgba(225,29,72,0.16)' : 'rgba(255,255,255,0.06)',
          }}
        >
          <div
            style={{
              fontSize: 20, fontWeight: 900, letterSpacing: 4, display: 'flex',
              color: isLive ? '#fb7185' : '#f4f4f5',
            }}
          >
            {isLive ? 'LIVE NOW' : 'UP NEXT'}
          </div>
        </div>

        {/* Title block — bottom */}
        <div
          style={{
            position: 'absolute', left: 60, bottom: 44, width: 1080,
            display: 'flex', flexDirection: 'column',
          }}
        >
          <div style={{ fontSize: 21, fontWeight: 700, color: '#e11d48', letterSpacing: 4, display: 'flex', marginBottom: 6 }}>
            MAIN EVENT{meta ? ` · ${meta}` : ''}
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: '#71717a', letterSpacing: 1, display: 'flex', marginBottom: 18 }}>
            {event.name.toUpperCase()}
          </div>

          {/* Corners */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <Corner name={main.red_name} record={main.red_record} color="#fb7185" />
            <div
              style={{
                fontSize: 40, fontWeight: 900, color: '#52525b', letterSpacing: 2,
                display: 'flex', width: 100, justifyContent: 'center',
              }}
            >
              VS
            </div>
            <Corner name={main.blue_name} record={main.blue_record} color="#60a5fa" />
          </div>

          <div
            style={{
              width: 960, height: 6, display: 'flex', marginTop: 18, marginBottom: 18,
              background: 'linear-gradient(90deg, #e11d48 0%, #e11d48 38%, #3b82f6 62%, #3b82f6 100%)',
            }}
          />

          <div style={{ display: 'flex', width: 1080, justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#f4f4f5', letterSpacing: 1, display: 'flex' }}>
              {footerLeft}
            </div>
            <div style={{ fontSize: 26, fontWeight: 900, color: '#fb7185', display: 'flex' }}>JABSYPICKS.COM</div>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts }
  )
}
