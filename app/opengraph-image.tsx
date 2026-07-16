import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export const alt = 'XURL - Modern URL Shortener'
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'black',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
        }}
      >
        <div
          style={{
            fontSize: 200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            background: 'black',
            color: 'white',
            border: '8px solid white',
            borderRadius: 60,
            width: 320,
            height: 320,
            marginBottom: 40,
          }}
        >
          X
        </div>
        <div
          style={{
            fontSize: 80,
            fontWeight: 700,
            letterSpacing: '0.1em',
            color: 'white',
          }}
        >
          XURL
        </div>
      </div>
    ),
    {
      ...size,
    }
  )
}
