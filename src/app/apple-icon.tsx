import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#0a0a0a',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '40px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Red bottom bar */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 12,
            background: '#e11d48',
            display: 'flex',
          }}
        />
        {/* J lettermark */}
        <div
          style={{
            fontSize: 120,
            fontWeight: 900,
            color: '#f4f4f5',
            fontFamily: 'sans-serif',
            lineHeight: 1,
            marginBottom: 10,
            display: 'flex',
          }}
        >
          J
        </div>
      </div>
    ),
    { ...size }
  )
}
