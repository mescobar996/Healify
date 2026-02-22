import { ImageResponse } from 'next/og'

// Route segment config
export const runtime = 'edge'

// Image metadata
export const alt = 'Healify - AI-Powered Test Self-Healing Platform'
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = 'image/png'

// Image generation
export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0a0a0a',
          backgroundImage: 'radial-gradient(circle at 50% 0%, #0ea5e9 0%, transparent 50%)',
          padding: '80px',
        }}
      >
        {/* Logo and Brand */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: '40px',
          }}
        >
          <div
            style={{
              width: '80px',
              height: '80px',
              borderRadius: '20px',
              background: 'linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: '24px',
            }}
          >
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 17L12 22L22 17" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 12L12 17L22 12" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span
            style={{
              fontSize: '48px',
              fontWeight: 'bold',
              color: 'white',
            }}
          >
            Healify
          </span>
        </div>

        {/* Main Headline */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
          }}
        >
          <h1
            style={{
              fontSize: '72px',
              fontWeight: 'bold',
              color: 'white',
              margin: '0',
              lineHeight: '1.1',
            }}
          >
            Tests that
          </h1>
          <h1
            style={{
              fontSize: '72px',
              fontWeight: 'bold',
              background: 'linear-gradient(90deg, #0ea5e9 0%, #6366f1 50%, #0ea5e9 100%)',
              backgroundClip: 'text',
              color: 'transparent',
              margin: '0',
              lineHeight: '1.1',
            }}
          >
            heal themselves.
          </h1>
        </div>

        {/* Subtitle */}
        <p
          style={{
            fontSize: '28px',
            color: '#94a3b8',
            marginTop: '32px',
            textAlign: 'center',
            maxWidth: '800px',
          }}
        >
          AI-powered test self-healing platform. Zero broken tests, no manual intervention.
        </p>

        {/* Stats */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '48px',
            marginTop: '48px',
          }}
        >
          {[
            { value: '500+', label: 'Teams' },
            { value: '10K+', label: 'Tests Healed' },
            { value: '98%', label: 'Accuracy' },
          ].map((stat) => (
            <div
              key={stat.label}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
            >
              <span
                style={{
                  fontSize: '40px',
                  fontWeight: 'bold',
                  color: 'white',
                }}
              >
                {stat.value}
              </span>
              <span
                style={{
                  fontSize: '18px',
                  color: '#64748b',
                }}
              >
                {stat.label}
              </span>
            </div>
          ))}
        </div>

        {/* URL */}
        <div
          style={{
            position: 'absolute',
            bottom: '40px',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <span
            style={{
              fontSize: '20px',
              color: '#64748b',
            }}
          >
            healify.dev
          </span>
        </div>
      </div>
    ),
    {
      ...size,
    }
  )
}
