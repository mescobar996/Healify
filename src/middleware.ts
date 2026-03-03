import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Healify — Route Protection Middleware
 *
 * Protects all dashboard routes at the edge level.
 * API routes handle their own auth via getSessionUser() / API key checks.
 *
 * Public paths (no token needed):
 *   /                — landing page
 *   /pricing         — pricing page
 *   /docs/*          — documentation
 *   /privacy         — privacy policy
 *   /terms           — terms of service
 *   /auth/*          — sign-in / sign-out
 *   /api/auth/*      — NextAuth endpoints
 *   /api/health      — uptime / Railway health check
 *   /api/v1/*        — external API (API-key authenticated per route)
 *   /api/badge/*     — public badge SVG
 *   /api/waitlist    — waitlist form
 *   /api/openapi     — OpenAPI spec (public)
 */
export default withAuth(
  function middleware(req: NextRequest) {
    // All token checks passed — allow the request through
    return NextResponse.next()
  },
  {
    callbacks: {
      authorized({ token }) {
        // Token present = authorized for protected routes
        return !!token
      },
    },
    pages: {
      signIn: '/auth/signin',
    },
  }
)

export const config = {
  matcher: [
    /*
     * Match only dashboard paths.
     * API routes manage their own auth (session or API key).
     * NextAuth public paths are excluded by default via the pattern.
     */
    '/dashboard/:path*',
  ],
}
