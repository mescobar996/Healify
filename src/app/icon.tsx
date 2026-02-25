import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

// Este archivo genera el ícono dinámico de Next.js
// El ícono real (estático) está en /public/favicon.ico y /public/favicon-32.png
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          background: 'linear-gradient(135deg, #00F5C8 0%, #7B5EF8 50%, #E040A0 100%)',
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ color: 'white', fontSize: 20, fontWeight: 900 }}>V</div>
      </div>
    ),
    { ...size }
  )
}
