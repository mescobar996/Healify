import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    // Si el usuario está autenticado y trata de acceder a la raíz, redirigir al dashboard
    if (req.nextUrl.pathname === '/' && req.nextauth.token) {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }
    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // Rutas públicas que no requieren autenticación
        const publicPaths = ['/', '/auth/signin', '/auth/error', '/pricing']
        const isPublicPath = publicPaths.includes(req.nextUrl.pathname)
        
        // Si es una ruta pública, permitir acceso
        if (isPublicPath) return true
        
        // Para rutas del dashboard, requerir autenticación
        if (req.nextUrl.pathname.startsWith('/dashboard')) {
          return !!token
        }
        
        return true
      },
    },
    pages: {
      signIn: '/auth/signin',
    },
  }
)

export const config = {
  matcher: ['/', '/dashboard/:path*'],
}