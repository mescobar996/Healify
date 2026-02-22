import { NextResponse } from 'next/server'

export async function GET() {
  // Check environment variables (without exposing secrets)
  const envCheck = {
    GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID 
      ? `${process.env.GITHUB_CLIENT_ID.substring(0, 8)}...` 
      : 'NOT SET',
    GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET 
      ? 'SET (hidden)' 
      : 'NOT SET',
    NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'NOT SET',
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET 
      ? 'SET (hidden)' 
      : 'NOT SET',
    DATABASE_URL: process.env.DATABASE_URL 
      ? 'SET (hidden)' 
      : 'NOT SET',
    NODE_ENV: process.env.NODE_ENV,
    VERCEL_URL: process.env.VERCEL_URL || 'NOT SET',
  }

  // Expected callback URL
  const expectedCallbackUrl = process.env.NEXTAUTH_URL 
    ? `${process.env.NEXTAUTH_URL}/api/auth/callback/github`
    : 'Cannot determine - NEXTAUTH_URL not set'

  return NextResponse.json({
    status: 'Auth Debug Info',
    environment: envCheck,
    expectedGitHubCallbackUrl: expectedCallbackUrl,
    instructions: {
      githubOAuthConfig: 'Go to https://github.com/settings/developers',
      homepageUrl: process.env.NEXTAUTH_URL || 'https://healify-sigma.vercel.app',
      callbackUrl: expectedCallbackUrl,
    },
    issues: [
      !process.env.GITHUB_CLIENT_ID && 'GITHUB_CLIENT_ID is not set',
      !process.env.GITHUB_CLIENT_SECRET && 'GITHUB_CLIENT_SECRET is not set',
      !process.env.NEXTAUTH_URL && 'NEXTAUTH_URL is not set',
      !process.env.NEXTAUTH_SECRET && 'NEXTAUTH_SECRET is not set',
    ].filter(Boolean),
  })
}