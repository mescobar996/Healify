import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export const size = {
  width: 32,
  height: 32,
}
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#0A0E1A',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg
          width="32"
          height="32"
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="faviconGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#00F5C8" />
              <stop offset="50%" stopColor="#7B5EF8" />
              <stop offset="100%" stopColor="#FF6BFF" />
            </linearGradient>
          </defs>
          <path
            d="M8 12 L20 12 L24 36 L16 36 Z"
            fill="url(#faviconGradient)"
            opacity="0.9"
          />
          <path
            d="M28 12 L40 12 L32 36 L24 36 Z"
            fill="url(#faviconGradient)"
            opacity="0.9"
          />
          <path
            d="M14 20 L10 24 L14 28"
            stroke="url(#faviconGradient)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <path
            d="M18 18 L22 30"
            stroke="url(#faviconGradient)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <path
            d="M34 20 L38 24 L34 28"
            stroke="url(#faviconGradient)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
      </div>
    ),
    { ...size }
  )
}