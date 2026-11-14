import Link from 'next/link'
import { StaleAuthCleaner } from '@/components/stale-auth-cleaner'
import { LockCountdown } from '@/components/lock-countdown'
import { PickDemo } from '@/components/landing/pick-demo'
import { getNextUpcomingEvent } from '@/lib/next-event'
import { getLastName } from '@/lib/utils'

// Landing page is ISR'd so the hero always shows the real next fight card
// without a DB hit per visit. Countdown ticks client-side regardless.
export const revalidate = 300

// Shown only if the next event can't be loaded, so the page never renders empty.
const SAMPLE_FIGHT = {
  red_name: 'Jon Jones',
  red_record: '28-1-0',
  blue_name: 'Tom Aspinall',
  blue_record: '15-3-0',
  weight_class: 'Heavyweight',
  scheduled_rounds: 5,
}

const display = { fontFamily: 'var(--font-barlow)', fontWeight: 900 } as const

export default async function LandingPage() {
  const nextEvent = await getNextUpcomingEvent()
  const isLive = nextEvent?.status === 'live'
  const fight = nextEvent?.mainEvent ?? SAMPLE_FIGHT
  const redLast = getLastName(fight.red_name)
  const blueLast = getLastName(fight.blue_name)

  const start = nextEvent ? new Date(nextEvent.start_time) : null
  const eventDate = start?.toLocaleDateString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric', timeZone: 'America/New_York',
  })
  const eventTime = start?.toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York',
  })

  // One finished fight, four ways to have called it.
  const examples = [
    { call: `${redLast}, knockout, round 2`, winner: true, method: true, round: true, points: 10 },
    { call: `${redLast}, knockout, round 4`, winner: true, method: true, round: false, points: 8 },
    { call: `${redLast}, decision`, winner: true, method: false, round: false, points: 5 },
    { call: `${blueLast}, any way`, winner: false, method: false, round: false, points: 0 },
  ]

  return (
    <>
      <StaleAuthCleaner />

      <div className="min-h-screen bg-surface-0 text-text-primary overflow-x-clip">
        {/* Nav */}
        <header className="fixed top-0 inset-x-0 z-50 border-b border-border-subtle bg-surface-0/85 backdrop-blur-md">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
            <Link href="/" className="text-xl text-brand" style={{ ...display, letterSpacing: '0.08em' }}>
              JABSY
            </Link>
            <nav className="flex items-center gap-1 sm:gap-2">
              <Link
                href="/login"
                className="inline-flex items-center h-10 px-3 rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
              >
                Sign in
              </Link>
              <Link href="/signup" className="btn-primary inline-flex items-center h-10 px-4 rounded-lg text-sm font-semibold">
                Create account
              </Link>
            </nav>
          </div>
        </header>

        <main>
          {/* Hero — a working pick slip for the real main event */}
          <section className="pt-14">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-10 sm:pt-14 pb-14 sm:pb-20">
              <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto] gap-8 lg:gap-12 lg:items-end mb-8 sm:mb-10">
                <div>
                  <h1 className="uppercase leading-[0.85]" style={{ ...display, fontSize: 'clamp(3.75rem, 10.5vw, 7.5rem)' }}>
                    Who you got?
                  </h1>
                  <p className="mt-5 max-w-xl text-lg text-text-secondary leading-relaxed">
                    Call every fight on the card: who wins, how, and in what round. Score
                    points when you&rsquo;re right, and settle it with your friends on a live board.
                  </p>
                </div>

                {nextEvent ? (
                  <div className="lg:text-right lg:pb-1">
                    <p className={`inline-flex items-center gap-2 text-sm font-medium ${isLive ? 'text-brand-light' : 'text-text-secondary'}`}>
                      {isLive && <span className="live-dot w-2 h-2 rounded-full bg-brand" />}
                      {isLive ? 'Live now' : 'Up next'}
                    </p>
                    <p className="mt-1 text-2xl sm:text-3xl uppercase leading-none" style={{ ...display, fontWeight: 800 }}>
                      {nextEvent.name}
                    </p>
                    <p className="mt-2 text-sm text-text-muted">
                      {eventDate}, {eventTime} ET
                      {nextEvent.venue && <span className="block">{nextEvent.venue}</span>}
                    </p>
                    {!isLive && (
                      <p className="mt-3 text-sm text-text-secondary">
                        Picks lock in{' '}
                        <span className="text-lg text-text-primary align-[-1px]" style={{ ...display, fontWeight: 800 }}>
                          <LockCountdown lockTime={nextEvent.start_time} variant="inline" />
                        </span>
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-text-muted lg:pb-1">Sample fight</p>
                )}
              </div>

              <PickDemo
                red={{ name: fight.red_name, record: fight.red_record }}
                blue={{ name: fight.blue_name, record: fight.blue_record }}
                weightClass={fight.weight_class}
                rounds={fight.scheduled_rounds}
              />
              <p className="mt-3 text-sm text-text-muted">
                {nextEvent ? 'That’s the main event.' : 'That’s one fight.'} Try it. Nothing is saved until you sign up.
              </p>
            </div>
          </section>

          {/* The rest of the card */}
          {nextEvent && nextEvent.fights.length > 1 && (
            <section className="border-t border-border-subtle">
              <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24 grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-8 lg:gap-16">
                <div className="lg:sticky lg:top-24 lg:self-start">
                  <h2 className="uppercase leading-[0.9]" style={{ ...display, fontSize: 'clamp(2.5rem, 6vw, 4.5rem)' }}>
                    {nextEvent.fights.length} fights. Call every one.
                  </h2>
                  <p className="mt-4 max-w-md text-text-secondary leading-relaxed">
                    The prelims count the same as the main event, so the board is usually decided
                    by who did their homework on the early fights.
                  </p>
                </div>
                <ol className="border-t border-border">
                  {nextEvent.fights.map((f, i) => (
                    <li
                      key={`${f.red_name}-${f.blue_name}`}
                      className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-baseline gap-3 py-3 border-b border-border"
                    >
                      <span className="truncate text-lg sm:text-xl uppercase" style={{ ...display, fontWeight: i === 0 ? 900 : 700 }}>
                        {getLastName(f.red_name)}
                      </span>
                      <span className="text-xs text-text-muted text-center whitespace-nowrap">
                        {f.weight_class ?? 'vs'}
                      </span>
                      <span className="truncate text-lg sm:text-xl uppercase text-right" style={{ ...display, fontWeight: i === 0 ? 900 : 700 }}>
                        {getLastName(f.blue_name)}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            </section>
          )}

          {/* Scoring */}
          <section className="border-t border-border-subtle bg-surface-1/40">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
              <h2 className="uppercase leading-[0.9] max-w-4xl" style={{ ...display, fontSize: 'clamp(2.5rem, 6vw, 4.5rem)' }}>
                Five for the winner. Three for the method. Two for the round.
              </h2>
              <p className="mt-4 max-w-xl text-text-secondary leading-relaxed">
                Each bonus only counts if the call before it was right, and decisions have no
                round to call. Ten points is a perfect pick.
              </p>

              <div className="mt-10 rounded-2xl border border-border bg-surface-0 overflow-hidden">
                <p className="px-4 sm:px-6 py-4 border-b border-border text-sm text-text-secondary">
                  Say it ends{' '}
                  <span className="text-text-primary font-medium">{redLast} by knockout in round 2.</span>
                </p>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-text-muted">
                      <th scope="col" className="font-normal px-4 sm:px-6 py-3">Your call</th>
                      <th scope="col" className="font-normal px-2 py-3 text-center hidden sm:table-cell">Winner</th>
                      <th scope="col" className="font-normal px-2 py-3 text-center hidden sm:table-cell">Method</th>
                      <th scope="col" className="font-normal px-2 py-3 text-center hidden sm:table-cell">Round</th>
                      <th scope="col" className="font-normal px-4 sm:px-6 py-3 text-right">Points</th>
                    </tr>
                  </thead>
                  <tbody>
                    {examples.map(ex => (
                      <tr key={ex.call} className="border-t border-border">
                        <th scope="row" className="font-normal text-left px-4 sm:px-6 py-4 text-text-primary">{ex.call}</th>
                        {[
                          { hit: ex.winner, pts: 5 },
                          { hit: ex.method, pts: 3 },
                          { hit: ex.round, pts: 2 },
                        ].map(({ hit, pts }) => (
                          <td key={pts} className="px-2 py-4 text-center tabular-nums hidden sm:table-cell">
                            {hit ? <span className="text-text-primary">+{pts}</span> : <span className="text-text-muted">0</span>}
                          </td>
                        ))}
                        <td className="px-4 sm:px-6 py-4 text-right">
                          <span
                            className={`text-2xl leading-none tabular-nums ${ex.points ? 'text-text-primary' : 'text-text-muted'}`}
                            style={display}
                          >
                            {ex.points}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* How a night goes — a real sequence, so it is numbered */}
          <section className="border-t border-border-subtle">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
              <h2 className="uppercase leading-[0.9]" style={{ ...display, fontSize: 'clamp(2.5rem, 6vw, 4.5rem)' }}>
                How fight night goes
              </h2>
              <ol className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-x-10 gap-y-10">
                {[
                  {
                    title: 'Start a league, or join one',
                    body: 'Send your friends one invite link. Everyone in the league picks the same card.',
                  },
                  {
                    title: 'Get your picks in before the lock',
                    body: 'Picks lock when the first fight starts. Nobody sees anyone else’s until then.',
                  },
                  {
                    title: 'Watch the board move',
                    body: 'Results post after every fight and the standings update live. Top score takes the night.',
                  },
                ].map(({ title, body }, i) => (
                  <li key={title} className="border-t-2 border-border pt-5">
                    <span className="block text-5xl leading-none text-brand" style={display} aria-hidden="true">
                      {i + 1}
                    </span>
                    <h3 className="mt-4 text-lg font-semibold text-text-primary">{title}</h3>
                    <p className="mt-2 text-text-secondary leading-relaxed">{body}</p>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          {/* Closing action */}
          <section className="border-t border-border-subtle">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-28 flex flex-col items-start gap-8 lg:flex-row lg:items-end lg:justify-between">
              <h2 className="uppercase leading-[0.85]" style={{ ...display, fontSize: 'clamp(3rem, 9vw, 7rem)' }}>
                {nextEvent && !isLive ? 'Get your picks in.' : 'Start your league.'}
              </h2>
              <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto shrink-0 whitespace-nowrap">
                <Link href="/signup" className="btn-primary inline-flex items-center justify-center h-14 px-8 rounded-lg text-base font-semibold">
                  Create a free account
                </Link>
                <Link href="/login" className="btn-secondary inline-flex items-center justify-center h-14 px-8 rounded-lg text-base font-semibold">
                  Sign in
                </Link>
              </div>
            </div>
          </section>
        </main>

        <footer className="border-t border-border-subtle">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <span className="text-lg text-brand" style={{ ...display, letterSpacing: '0.08em' }}>JABSY</span>
            <nav className="flex items-center gap-5 text-sm text-text-muted">
              <Link href="/privacy" className="hover:text-text-primary transition-colors">Privacy</Link>
              <Link href="/terms" className="hover:text-text-primary transition-colors">Terms</Link>
              <span>&copy; {new Date().getFullYear()} Jabsy</span>
            </nav>
          </div>
        </footer>
      </div>
    </>
  )
}
