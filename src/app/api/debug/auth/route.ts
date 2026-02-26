import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'

// GET /api/debug/auth
// Solo disponible en desarrollo — en producción devuelve 404
export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const githubId = process.env.GITHUB_CLIENT_ID || process.env.GITHUB_ID
  const githubSecret = process.env.GITHUB_CLIENT_SECRET || process.env.GITHUB_SECRET

  return NextResponse.json({
    env: {
      GITHUB_ID:        githubId     ? `${githubId.substring(0, 8)}...`     : '❌ NOT SET',
      GITHUB_SECRET:    githubSecret ? 'SET (hidden)'                        : '❌ NOT SET',
      NEXTAUTH_URL:     process.env.NEXTAUTH_URL     || 'NOT SET',
      NEXTAUTH_SECRET:  process.env.NEXTAUTH_SECRET  ? 'SET (hidden)'       : '❌ NOT SET',
      DATABASE_URL:     process.env.DATABASE_URL     ? 'SET (hidden)'       : '❌ NOT SET',
      NODE_ENV:         process.env.NODE_ENV,
    },
    callbackUrl: process.env.NEXTAUTH_URL
      ? `${process.env.NEXTAUTH_URL}/api/auth/callback/github`
      : 'NEXTAUTH_URL not set',
    warnings: [
      !githubId         && '❌ GITHUB_ID not set',
      !githubSecret     && '❌ GITHUB_SECRET not set',
      !process.env.NEXTAUTH_SECRET && '❌ NEXTAUTH_SECRET not set',
      !process.env.DATABASE_URL    && '❌ DATABASE_URL not set',
    ].filter(Boolean),
  })
}
