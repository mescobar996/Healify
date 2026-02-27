import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://healify-sigma.vercel.app'
  const iconUrl = `${baseUrl}/icon.png`

  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          display: 'grid',
          placeItems: 'center',
          background: '#0A0E1A',
        }}
      >
        <img
          src={iconUrl}
          width="32"
          height="32"
          alt="Healify"
          style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 6 }}
        />
      </div>
    ),
    { ...size }
  )
}
