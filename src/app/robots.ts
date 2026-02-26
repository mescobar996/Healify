import { MetadataRoute } from 'next'

const BASE = process.env.NEXT_PUBLIC_APP_URL || 'https://healify-sigma.vercel.app'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/pricing', '/docs', '/auth/signin'],
        disallow: [
          '/dashboard/',
          '/api/',
          '/auth/error',
        ],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
  }
}
