import { ImageResponse } from 'next/og'

export const alt = 'UFC 329: McGregor vs. Holloway 2 — Make your picks on Jabsy'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

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
  // Register the one heavy weight under both 700 + 900 so every label
  // resolves to Barlow regardless of the fontWeight we ask for.
  const fonts = fontData
    ? [
        { name: 'Barlow Condensed', data: fontData, weight: 900 as const, style: 'normal' as const },
        { name: 'Barlow Condensed', data: fontData, weight: 700 as const, style: 'normal' as const },
      ]
    : []

  return new ImageResponse(
    (
      <div style={{
        width: 1200, height: 630,
        display: 'flex', position: 'relative', overflow: 'hidden',
        background: '#06070c', fontFamily: ff,
      }}>

        {/* ── Red corner light (left) ── */}
        <div style={{
          position: 'absolute', top: 0, left: 0, width: 700, height: 630, display: 'flex',
          background: 'radial-gradient(ellipse 85% 120% at 0% 55%, rgba(225,29,72,0.34) 0%, rgba(225,29,72,0.10) 45%, rgba(225,29,72,0) 72%)',
        }} />

        {/* ── Blue corner light (right) ── */}
        <div style={{
          position: 'absolute', top: 0, right: 0, width: 700, height: 630, display: 'flex',
          background: 'radial-gradient(ellipse 85% 120% at 100% 55%, rgba(59,130,246,0.30) 0%, rgba(59,130,246,0.09) 45%, rgba(59,130,246,0) 72%)',
        }} />

        {/* ── Floor scrim — grounds the footer ── */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 220, display: 'flex',
          background: 'linear-gradient(0deg, rgba(6,7,12,0.92) 0%, rgba(6,7,12,0) 100%)',
        }} />

        {/* ── Ghost "2" — the rematch mark ── */}
        <div style={{
          position: 'absolute', right: 40, bottom: -120, display: 'flex',
          fontSize: 640, fontWeight: 900, lineHeight: 1, color: 'rgba(148,163,184,0.07)',
        }}>2</div>

        {/* ════ Brand — top left ════ */}
        <div style={{ position: 'absolute', top: 44, left: 60, display: 'flex', alignItems: 'center' }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14, background: '#e11d48',
            display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 14,
          }}>
            <div style={{ fontSize: 40, fontWeight: 900, color: '#0a0a0a', display: 'flex', marginTop: -2 }}>J</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 34, fontWeight: 900, color: '#ffffff', letterSpacing: 1, lineHeight: 1, display: 'flex' }}>JABSY</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#a1a1aa', letterSpacing: 4, display: 'flex', marginTop: 4 }}>FANTASY MMA PICKS</div>
          </div>
        </div>

        {/* ════ Rematch badge — top right ════ */}
        <div style={{
          position: 'absolute', top: 50, right: 60, display: 'flex', alignItems: 'center',
          padding: '10px 18px', borderRadius: 10,
          border: '2px solid rgba(225,29,72,0.45)', background: 'rgba(225,29,72,0.10)',
        }}>
          <div style={{ fontSize: 21, fontWeight: 900, color: '#fb7185', letterSpacing: 5, display: 'flex' }}>THE REMATCH</div>
        </div>

        {/* ════ Main block — bottom left ════ */}
        <div style={{ position: 'absolute', left: 60, bottom: 40, width: 1080, display: 'flex', flexDirection: 'column' }}>

          {/* Eyebrow */}
          <div style={{ fontSize: 21, fontWeight: 700, color: '#a1a1aa', letterSpacing: 5, display: 'flex', marginBottom: 14 }}>
            UFC 329 · T-MOBILE ARENA · LAS VEGAS
          </div>

          {/* Red corner name */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ width: 12, height: 96, background: '#e11d48', display: 'flex', marginRight: 22 }} />
            <div style={{ fontSize: 124, fontWeight: 900, color: '#ffffff', letterSpacing: 0, lineHeight: 0.92, display: 'flex' }}>MCGREGOR</div>
          </div>

          {/* VS divider */}
          <div style={{ display: 'flex', alignItems: 'center', margin: '10px 0 10px 34px' }}>
            <div style={{ fontSize: 25, fontWeight: 900, color: '#e11d48', letterSpacing: 8, display: 'flex' }}>VS</div>
            <div style={{ width: 110, height: 2, background: '#3f3f46', display: 'flex', marginLeft: 18 }} />
          </div>

          {/* Blue corner name */}
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
            <div style={{ width: 12, height: 96, background: '#3b82f6', display: 'flex', marginRight: 22 }} />
            <div style={{ fontSize: 124, fontWeight: 900, color: '#ffffff', letterSpacing: 0, lineHeight: 0.92, display: 'flex' }}>HOLLOWAY</div>
          </div>

          {/* Footer row */}
          <div style={{ display: 'flex', width: 1080, justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 25, fontWeight: 700, color: '#ffffff', letterSpacing: 1, display: 'flex' }}>PICKS LOCK · SAT JUL 11 · 5:00 PM ET</div>
            <div style={{ fontSize: 27, fontWeight: 900, color: '#fb7185', display: 'flex' }}>JABSYPICKS.COM</div>
          </div>
        </div>

      </div>
    ),
    { ...size, fonts }
  )
}
