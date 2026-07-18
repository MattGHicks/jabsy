import { ImageResponse } from 'next/og'
import fs from 'node:fs'
import path from 'node:path'

// Node.js runtime for fs access
// Picnicface "Hey Africa!" energy — both main-event fighters are African
// (Du Plessis RSA, Usman NGA). Funny share card, still clearly a picks CTA.
export const alt =
  'Hey Africa! Du Plessis vs Usman — Make your picks on Jabsy'
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

  // ── Background photo (Du Plessis–Usman "Hey Africa" lion shoot) ─
  let bgData: string | null = null
  const bgCandidates = [
    'public/og/ufc-fn-duplessis-usman-africa-1200.jpg',
    'public/og/ufc-fn-duplessis-usman-africa.jpg',
  ]
  for (const rel of bgCandidates) {
    try {
      const buf = fs.readFileSync(path.join(process.cwd(), rel))
      bgData = `data:image/jpeg;base64,${buf.toString('base64')}`
      break
    } catch { /* try next candidate */ }
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          display: 'flex',
          position: 'relative',
          overflow: 'hidden',
          background: '#06070c',
          fontFamily: ff,
        }}
      >
        {/* ── Background ── */}
        {bgData && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={bgData}
            alt=""
            width={1200}
            height={630}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: 1200,
              height: 630,
              objectFit: 'cover',
              objectPosition: '50% 40%',
            }}
          />
        )}

        {/* ── Top scrim — light, just enough to seat the brand row ── */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 150,
            display: 'flex',
            background:
              'linear-gradient(180deg, rgba(6,7,12,0.65) 0%, rgba(6,7,12,0) 100%)',
          }}
        />

        {/* ── Bottom scrim — graduated fade, no hard black slab ── */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 410,
            display: 'flex',
            background:
              'linear-gradient(0deg, rgba(6,7,12,0.96) 0%, rgba(6,7,12,0.88) 26%, rgba(6,7,12,0.62) 50%, rgba(6,7,12,0.28) 74%, rgba(6,7,12,0) 100%)',
          }}
        />

        {/* ════ Brand — top left ════ */}
        <div
          style={{
            position: 'absolute',
            top: 44,
            left: 60,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: '#e11d48',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 14,
            }}
          >
            <div
              style={{
                fontSize: 40,
                fontWeight: 900,
                color: '#0a0a0a',
                display: 'flex',
                marginTop: -2,
              }}
            >
              J
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div
              style={{
                fontSize: 34,
                fontWeight: 900,
                color: '#ffffff',
                letterSpacing: 1,
                lineHeight: 1,
                display: 'flex',
              }}
            >
              JABSY
            </div>
            <div
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: '#a1a1aa',
                letterSpacing: 4,
                display: 'flex',
                marginTop: 4,
              }}
            >
              FANTASY MMA PICKS
            </div>
          </div>
        </div>

        {/* ════ Hey Africa badge — top right ════ */}
        <div
          style={{
            position: 'absolute',
            top: 50,
            right: 60,
            display: 'flex',
            alignItems: 'center',
            padding: '10px 18px',
            borderRadius: 10,
            border: '2px solid rgba(250,204,21,0.65)',
            background: 'rgba(6,7,12,0.7)',
          }}
        >
          <div
            style={{
              fontSize: 22,
              fontWeight: 900,
              color: '#facc15',
              letterSpacing: 4,
              display: 'flex',
            }}
          >
            HEY AFRICA!
          </div>
        </div>

        {/* ════ Title block — bottom ════ */}
        <div
          style={{
            position: 'absolute',
            left: 60,
            bottom: 36,
            width: 1080,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Eyebrow — the Picnicface bit, compressed */}
          <div
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: '#facc15',
              letterSpacing: 3,
              display: 'flex',
              marginBottom: 8,
            }}
          >
            RSA VS NGA · TWO AFRICANS · ZERO TIGERS
          </div>

          {/* Names */}
          <div style={{ display: 'flex', alignItems: 'baseline' }}>
            <div
              style={{
                fontSize: 82,
                fontWeight: 900,
                color: '#ffffff',
                lineHeight: 1,
                display: 'flex',
              }}
            >
              DU PLESSIS
            </div>
            <div
              style={{
                fontSize: 38,
                fontWeight: 900,
                color: '#e11d48',
                letterSpacing: 2,
                display: 'flex',
                margin: '0 18px',
              }}
            >
              VS
            </div>
            <div
              style={{
                fontSize: 82,
                fontWeight: 900,
                color: '#ffffff',
                lineHeight: 1,
                display: 'flex',
              }}
            >
              USMAN
            </div>
          </div>

          {/* Red → blue bar */}
          <div
            style={{
              width: 820,
              height: 6,
              display: 'flex',
              marginTop: 12,
              marginBottom: 14,
              background:
                'linear-gradient(90deg, #e11d48 0%, #e11d48 38%, #3b82f6 62%, #3b82f6 100%)',
            }}
          />

          {/* Gag subline */}
          <div
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: '#d4d4d8',
              letterSpacing: 1,
              display: 'flex',
              marginBottom: 14,
            }}
          >
            Are the lions scary? Sure they are. Also: make your picks.
          </div>

          {/* Footer row */}
          <div
            style={{
              display: 'flex',
              width: 1080,
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div
              style={{
                fontSize: 24,
                fontWeight: 700,
                color: '#ffffff',
                letterSpacing: 1,
                display: 'flex',
              }}
            >
              PICKS LOCK · SAT JUL 18 · 5:00 PM ET · OKC
            </div>
            <div
              style={{
                fontSize: 26,
                fontWeight: 900,
                color: '#fb7185',
                display: 'flex',
              }}
            >
              JABSYPICKS.COM
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts }
  )
}
