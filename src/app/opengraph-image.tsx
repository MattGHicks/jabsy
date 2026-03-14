import { ImageResponse } from 'next/og'
import fs from 'node:fs'
import path from 'node:path'

// Node.js runtime for fs access
export const alt = 'Jabsy — Fantasy MMA Picks'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  // ── Font ──────────────────────────────────────────────────────
  let fontData: ArrayBuffer | null = null
  try {
    const css = await fetch(
      'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;900',
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    ).then(r => r.text())
    const urls = [...css.matchAll(/url\(([^)]+)\)/g)].map(m => m[1])
    if (urls[0]) fontData = await fetch(urls[0]).then(r => r.arrayBuffer())
  } catch { /* fall back to system font */ }

  const ff = fontData ? 'Barlow Condensed' : 'sans-serif'
  const fonts = fontData
    ? [{ name: 'Barlow Condensed', data: fontData, weight: 900 as const, style: 'normal' as const }]
    : []

  // ── Background image ──────────────────────────────────────────
  let bgData: string | null = null
  try {
    const buf = fs.readFileSync(path.join(process.cwd(), 'public/fighters/background.jpg'))
    bgData = `data:image/jpeg;base64,${buf.toString('base64')}`
  } catch { /* fallback to dark bg */ }

  return new ImageResponse(
    (
      <div style={{
        width: 1200, height: 630,
        background: '#060202',
        display: 'flex',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: ff,
      }}>

        {/* ── Fighter background ── */}
        {bgData && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={bgData}
            alt=""
            style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              width: '100%', height: '100%',
              objectFit: 'cover', objectPosition: 'center',
            }}
          />
        )}

        {/* ── Top vignette — pulls top edge to dark ── */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 200, display: 'flex',
          background: 'linear-gradient(180deg, rgba(3,1,1,0.7) 0%, transparent 100%)',
        }} />

        {/* ── Bottom vignette — grounds the image ── */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 180, display: 'flex',
          background: 'linear-gradient(0deg, rgba(3,1,1,0.8) 0%, transparent 100%)',
        }} />

        {/* ── Left edge fade ── */}
        <div style={{
          position: 'absolute', top: 0, left: 0, bottom: 0, width: 120, display: 'flex',
          background: 'linear-gradient(90deg, rgba(3,1,1,0.5) 0%, transparent 100%)',
        }} />

        {/* ── Right edge fade ── */}
        <div style={{
          position: 'absolute', top: 0, right: 0, bottom: 0, width: 120, display: 'flex',
          background: 'linear-gradient(-90deg, rgba(3,1,1,0.5) 0%, transparent 100%)',
        }} />

        {/* ════════════════════════════════════════
            JABSY BRANDING — centered
        ════════════════════════════════════════ */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          width: 1200, height: 630,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          zIndex: 20,
        }}>
          {/* JABSY */}
          <div style={{
            fontSize: 200, fontWeight: 900,
            color: '#ffffff',
            letterSpacing: '-5px', lineHeight: 0.85,
            textTransform: 'uppercase',
            display: 'flex', fontFamily: ff,
            // Subtle text shadow to lift it off the bg
            textShadow: '0 2px 40px rgba(0,0,0,0.8), 0 0 80px rgba(0,0,0,0.5)',
          }}>
            JABSY
          </div>

          {/* Red divider */}
          <div style={{
            width: 200, height: 4,
            background: 'linear-gradient(90deg, transparent, #e11d48, transparent)',
            marginTop: 20, marginBottom: 18,
            display: 'flex',
          }} />

          {/* Tagline */}
          <div style={{
            fontSize: 44, fontWeight: 900,
            color: 'rgba(255,245,245,0.82)',
            letterSpacing: '0.24em',
            textTransform: 'uppercase',
            display: 'flex', fontFamily: ff, lineHeight: 1,
            textShadow: '0 2px 20px rgba(0,0,0,0.9)',
          }}>
            FANTASY MMA PICKS
          </div>
        </div>

      </div>
    ),
    { ...size, fonts }
  )
}
