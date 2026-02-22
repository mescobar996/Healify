import { NextResponse } from 'next/server'

export async function GET() {
  const githubId = process.env.GITHUB_CLIENT_ID || process.env.GITHUB_ID
  const githubSecret = process.env.GITHUB_CLIENT_SECRET || process.env.GITHUB_SECRET

  const envCheck = {
    // Verificar ambas variantes de nombre
    GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID ? `${process.env.GITHUB_CLIENT_ID.substring(0, 8)}...` : 'NOT SET',
    GITHUB_ID: process.env.GITHUB_ID ? `${process.env.GITHUB_ID.substring(0, 8)}...` : 'NOT SET',
    GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET ? 'SET (hidden)' : 'NOT SET',
    GITHUB_SECRET: process.env.GITHUB_SECRET ? 'SET (hidden)' : 'NOT SET',
    // Resolvido (el que usa authOptions)
    RESOLVED_CLIENT_ID: githubId ? `${githubId.substring(0, 8)}...` : '❌ NOT SET - OAuth WILL FAIL',
    RESOLVED_CLIENT_SECRET: githubSecret ? 'SET (hidden)' : '❌ NOT SET - OAuth WILL FAIL',
    NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'NOT SET',
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ? 'SET (hidden)' : 'NOT SET',
    DATABASE_URL: process.env.DATABASE_URL ? 'SET (hidden)' : 'NOT SET',
    NODE_ENV: process.env.NODE_ENV,
    VERCEL_URL: process.env.VERCEL_URL || 'NOT SET',
  }

  const expectedCallbackUrl = process.env.NEXTAUTH_URL
    ? `${process.env.NEXTAUTH_URL}/api/auth/callback/github`
    : 'Cannot determine - NEXTAUTH_URL not set'

  return NextResponse.json({
    status: 'Auth Debug Info',
    environment: envCheck,
    expectedGitHubCallbackUrl: expectedCallbackUrl,
    issues: [
      !githubId && '❌ GITHUB_CLIENT_ID (or GITHUB_ID) is not set → OAuth will fail with error=Callback',
      !githubSecret && '❌ GITHUB_CLIENT_SECRET (or GITHUB_SECRET) is not set → OAuth will fail',
      !process.env.NEXTAUTH_URL && '❌ NEXTAUTH_URL is not set',
      !process.env.NEXTAUTH_SECRET && '❌ NEXTAUTH_SECRET is not set → sessions will not work',
      !process.env.DATABASE_URL && '❌ DATABASE_URL is not set → DB will fail, auth adapter will fail',
    ].filter(Boolean),
  })
}
