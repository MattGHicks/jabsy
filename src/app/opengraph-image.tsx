import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'Jabsy — Fantasy MMA Picks'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#0a0a0a',
          width: '100%',
          height: '100%',
          display: 'flex',
          fontFamily: 'sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Dot grid texture */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
            display: 'flex',
          }}
        />

        {/* Corner brackets */}
        <div style={{ position: 'absolute', top: 40, left: 40, width: 40, height: 40, borderTop: '2px solid #e11d48', borderLeft: '2px solid #e11d48', display: 'flex' }} />
        <div style={{ position: 'absolute', bottom: 40, right: 40, width: 40, height: 40, borderBottom: '2px solid #e11d48', borderRight: '2px solid #e11d48', display: 'flex' }} />

        {/* Diagonal slash */}
        <div
          style={{
            position: 'absolute',
            top: -80,
            left: '43%',
            width: 8,
            height: 900,
            background: 'linear-gradient(180deg, transparent 0%, #e11d48 20%, #e11d48 80%, transparent 100%)',
            transform: 'rotate(15deg)',
            display: 'flex',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: -80,
            left: '45%',
            width: 2,
            height: 900,
            background: 'linear-gradient(180deg, transparent 0%, #e11d48 20%, #e11d48 80%, transparent 100%)',
            transform: 'rotate(15deg)',
            opacity: 0.35,
            display: 'flex',
          }}
        />

        {/* Red glow behind slash */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '38%',
            width: 320,
            height: 700,
            transform: 'translateY(-50%) rotate(15deg)',
            background: 'radial-gradient(ellipse, rgba(225,29,72,0.10) 0%, transparent 70%)',
            display: 'flex',
          }}
        />

        {/* LEFT — main branding */}
        <div
          style={{
            position: 'absolute',
            left: 72,
            top: 0,
            bottom: 0,
            width: 500,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              fontSize: 158,
              fontWeight: 900,
              color: '#f4f4f5',
              letterSpacing: '-6px',
              lineHeight: 0.85,
              textTransform: 'uppercase',
              display: 'flex',
            }}
          >
            JABSY
          </div>
          <div style={{ width: 100, height: 5, background: '#e11d48', marginTop: 22, marginBottom: 22, display: 'flex' }} />
          <div
            style={{
              fontSize: 21,
              fontWeight: 700,
              color: '#71717a',
              letterSpacing: '0.25em',
              textTransform: 'uppercase',
              display: 'flex',
            }}
          >
            FANTASY MMA PICKS
          </div>
        </div>

        {/* RIGHT — feature list */}
        <div
          style={{
            position: 'absolute',
            right: 72,
            top: 0,
            bottom: 0,
            width: 400,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'flex-end',
            gap: 28,
          }}
        >
          {[
            { text: 'Make your picks', dim: false },
            { text: 'Compete with friends', dim: true },
            { text: 'Prove you know MMA', dim: true },
          ].map(({ text, dim }, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  fontSize: 19,
                  fontWeight: 700,
                  color: dim ? '#52525b' : '#a1a1aa',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  display: 'flex',
                }}
              >
                {text}
              </div>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#e11d48', display: 'flex', flexShrink: 0 }} />
            </div>
          ))}
          <div style={{ fontSize: 14, fontWeight: 600, color: '#27272a', letterSpacing: '0.1em', marginTop: 8, display: 'flex' }}>
            JABSYPICKS.COM
          </div>
        </div>

        {/* Bottom red bar */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 4,
            background: 'linear-gradient(90deg, #e11d48 0%, #be123c 40%, transparent 100%)',
            display: 'flex',
          }}
        />
      </div>
    ),
    { ...size }
  )
}
