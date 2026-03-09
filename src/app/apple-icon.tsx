import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default async function AppleIcon() {
  const fontData = await fetch(
    'https://fonts.gstatic.com/s/barlowcondensed/v13/HTxwL3I-JCGChYJ8VI-L6OO_au7B45L0_3E.ttf'
  ).then((res) => res.arrayBuffer())

  return new ImageResponse(
    (
      <div
        style={{
          background: '#e11d48',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '40px',
        }}
      >
        <div
          style={{
            fontSize: 140,
            fontFamily: 'Barlow Condensed',
            fontWeight: 900,
            color: '#0a0a0a',
            lineHeight: 1,
            display: 'flex',
            marginTop: -8,
          }}
        >
          J
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        {
          name: 'Barlow Condensed',
          data: fontData,
          weight: 900,
          style: 'normal',
        },
      ],
    }
  )
}
