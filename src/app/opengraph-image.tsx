import { ImageResponse } from 'next/og'
import fs from 'node:fs'
import path from 'node:path'

// Node.js runtime for fs access
export const alt = 'UFC Freedom 250 — Make your picks on Jabsy'
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

  // ── Background photo (Freedom 250) ────────────────────────────
  let bgData: string | null = null
  try {
    const buf = fs.readFileSync(path.join(process.cwd(), 'public/og/freedom-250.jpg'))
    bgData = `data:image/jpeg;base64,${buf.toString('base64')}`
  } catch { /* fallback to dark bg */ }

  return new ImageResponse(
    (
      <div style={{
        width: 1200, height: 630,
        display: 'flex', position: 'relative', overflow: 'hidden',
        background: '#04070f', fontFamily: ff,
      }}>

        {/* ── Background ── */}
        {bgData && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={bgData}
            alt=""
            width={1200}
            height={630}
            style={{
              position: 'absolute', top: 0, left: 0,
              width: 1200, height: 630,
              objectFit: 'cover', objectPosition: '50% 30%',
            }}
          />
        )}

        {/* ── Top scrim — keeps the brand legible ── */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 180, display: 'flex',
          background: 'linear-gradient(180deg, rgba(4,7,15,0.85) 0%, rgba(4,7,15,0) 100%)',
        }} />

        {/* ── Bottom scrim — grounds the title over the busy lower third ── */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 360, display: 'flex',
          background: 'linear-gradient(0deg, rgba(4,7,15,0.96) 0%, rgba(4,7,15,0.72) 45%, rgba(4,7,15,0) 100%)',
        }} />

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
            <div style={{ fontSize: 15, fontWeight: 700, color: '#C9A227', letterSpacing: 4, display: 'flex', marginTop: 4 }}>FANTASY MMA PICKS</div>
          </div>
        </div>

        {/* ════ Event title — bottom left ════ */}
        <div style={{ position: 'absolute', left: 60, bottom: 40, width: 1080, display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 21, fontWeight: 700, color: '#C9A227', letterSpacing: 5, display: 'flex', marginBottom: 6 }}>
            {"AMERICA'S 250TH · FLAG DAY SHOWDOWN"}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline' }}>
            <div style={{ fontSize: 104, fontWeight: 900, color: '#ffffff', letterSpacing: -1, lineHeight: 1, display: 'flex' }}>FREEDOM</div>
            <div style={{ fontSize: 104, fontWeight: 900, color: '#C9A227', letterSpacing: -1, lineHeight: 1, display: 'flex', marginLeft: 20 }}>250</div>
          </div>
          <div style={{ width: 360, height: 6, background: '#B22234', display: 'flex', marginTop: 12, marginBottom: 16 }} />
          <div style={{ display: 'flex', width: 1080, justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 25, fontWeight: 700, color: '#ffffff', letterSpacing: 1, display: 'flex' }}>PICKS LOCK · JUN 14 · 8PM ET</div>
            <div style={{ fontSize: 27, fontWeight: 900, color: '#C9A227', display: 'flex' }}>JABSYPICKS.COM</div>
          </div>
        </div>

      </div>
    ),
    { ...size, fonts }
  )
}
