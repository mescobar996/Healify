import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    if (req.nextUrl.pathname === '/' && req.nextauth.token) {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }
    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const publicPaths = ['/', '/auth/signin', '/auth/error', '/pricing']
        const isPublicPath = publicPaths.some(p =>
          req.nextUrl.pathname === p || req.nextUrl.pathname.startsWith('/auth/')
        )
        if (isPublicPath) return true
        if (req.nextUrl.pathname.startsWith('/dashboard')) return !!token
        return true
      },
    },
    pages: { signIn: '/auth/signin' },
  }
)

export const config = {
  matcher: ['/', '/dashboard/:path*'],
}
