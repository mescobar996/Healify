import { NextResponse } from 'next/server'

/**
 * GET /api/auth/check
 * Lightweight diagnostic endpoint for OAuth configuration.
 * Shows only non-sensitive info: which vars are SET (not their values).
 * Safe for temporary production use.
 */
export async function GET() {
  const githubId = process.env.GITHUB_CLIENT_ID || process.env.GITHUB_ID
  const githubSecret = process.env.GITHUB_CLIENT_SECRET || process.env.GITHUB_SECRET
  const googleId = process.env.GOOGLE_CLIENT_ID
  const googleSecret = process.env.GOOGLE_CLIENT_SECRET

  const nextauthUrl = process.env.NEXTAUTH_URL
  const vercelUrl = process.env.VERCEL_URL

  // What NextAuth will resolve as the base URL
  const resolvedBaseUrl = nextauthUrl
    || (vercelUrl ? `https://${vercelUrl}` : 'http://localhost:3000')

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    env: {
      NEXTAUTH_SECRET:  process.env.NEXTAUTH_SECRET  ? '✅ SET' : '❌ NOT SET',
      NEXTAUTH_URL:     nextauthUrl                   ? `✅ ${nextauthUrl}` : '⚠️ NOT SET (auto-detected)',
      VERCEL_URL:       vercelUrl                     ? `✅ ${vercelUrl}` : '❌ NOT SET',
      DATABASE_URL:     process.env.DATABASE_URL      ? '✅ SET' : '❌ NOT SET',
      REDIS_URL:        process.env.REDIS_URL         ? '✅ SET' : '❌ NOT SET',
    },
    providers: {
      github: {
        clientId:     githubId     ? `✅ ${githubId.substring(0, 6)}...` : '❌ NOT SET',
        clientSecret: githubSecret ? '✅ SET'                             : '❌ NOT SET',
        callbackUrl:  `${resolvedBaseUrl}/api/auth/callback/github`,
      },
      google: {
        clientId:     googleId     ? `✅ ${googleId.substring(0, 8)}...` : '❌ NOT SET',
        clientSecret: googleSecret ? '✅ SET'                             : '❌ NOT SET',
        callbackUrl:  `${resolvedBaseUrl}/api/auth/callback/google`,
      },
    },
    resolvedBaseUrl,
    checks: [
      !process.env.NEXTAUTH_SECRET && '❌ NEXTAUTH_SECRET missing — OAuth state verification will fail',
      !nextauthUrl && !vercelUrl && '❌ Neither NEXTAUTH_URL nor VERCEL_URL set — callback URLs will be wrong',
      !nextauthUrl && vercelUrl && '⚠️ NEXTAUTH_URL not set — using VERCEL_URL auto-detection. Set NEXTAUTH_URL=https://healify-sigma.vercel.app for reliability',
      !githubId && '❌ GitHub Client ID not set',
      !githubSecret && '❌ GitHub Client Secret not set',
      !googleId && '⚠️ Google Client ID not set',
      !googleSecret && '⚠️ Google Client Secret not set',
    ].filter(Boolean),
  })
}
