import NextAuth, { NextAuthOptions } from 'next-auth'
import { logger } from '@/lib/logger'
import { emailWelcome } from '@/lib/email-templates'
import GitHubProvider from 'next-auth/providers/github'
import GoogleProvider from 'next-auth/providers/google'

// ─── Unificación de nombres de env vars ──────────────────────────────
// En Vercel configurar: GITHUB_ID y GITHUB_SECRET
// También acepta GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET como fallback
const GITHUB_ID     = process.env.GITHUB_ID     || process.env.GITHUB_CLIENT_ID     || ''
const GITHUB_SECRET = process.env.GITHUB_SECRET || process.env.GITHUB_CLIENT_SECRET || ''
const GOOGLE_ID     = process.env.GOOGLE_CLIENT_ID     || ''
const GOOGLE_SECRET = process.env.GOOGLE_CLIENT_SECRET || ''

// Advertencias en desarrollo (no bloquean el build)
if (process.env.NODE_ENV !== 'production') {
  if (!GITHUB_ID)                   logger.warn('[Auth]', 'GITHUB_ID no configurado')
  if (!GITHUB_SECRET)               logger.warn('[Auth]', 'GITHUB_SECRET no configurado')
  if (!process.env.NEXTAUTH_SECRET) logger.warn('[Auth]', 'NEXTAUTH_SECRET no configurado')
  if (!GOOGLE_ID || !GOOGLE_SECRET) logger.warn('[Auth]', 'GOOGLE_CLIENT_ID/SECRET no configurados — Google OAuth deshabilitado')
}

// ─── Providers dinámicos ─────────────────────────────────────────────
// Google se activa solo si ambas vars están presentes.
// Esto evita el error "OAuthSignin" cuando Google no está configurado.
const providers: NextAuthOptions['providers'] = [
  GitHubProvider({
    clientId: GITHUB_ID,
    clientSecret: GITHUB_SECRET,
    profile(profile) {
      return {
        id: String(profile.id),
        name: profile.name || profile.login,
        email: profile.email ?? null,
        image: profile.avatar_url,
      }
    },
  }),
]

if (GOOGLE_ID && GOOGLE_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: GOOGLE_ID,
      clientSecret: GOOGLE_SECRET,
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          image: profile.picture,
        }
      },
    })
  )
}

export const authOptions: NextAuthOptions = {
  // ── Sin PrismaAdapter ─────────────────────────────────────────────
  // Razón: NextAuth v4 con PrismaAdapter + strategy:'jwt' simultáneos
  // causa un conflicto — el adapter intenta escribir en tabla Session
  // pero el JWT callback la ignora, rompiendo el login en el segundo
  // intento. JWT puro es serverless-safe y no requiere DB sessions.
  // Si en el futuro se quiere strategy:'database', activar el adapter
  // y eliminar los callbacks jwt/session (son mutuamente excluyentes).

  providers,

  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 días
  },

  callbacks: {
    async jwt({ token, user, profile }: any) {
      if (user) {
        token.id   = user.id
        token.role = (user as any).role || 'user'
      }
      if (profile) {
        token.picture = (profile as any).avatar_url || (profile as any).picture || token.picture
        token.name    = (profile as any).name || (profile as any).login || token.name
        token.email   = (profile as any).email || token.email
      }
      return token
    },
    async session({ session, token }: any) {
      if (session.user) {
        session.user.id    = token.id    as string
        session.user.role  = token.role  as string
        if (token.picture) session.user.image = token.picture as string
        if (token.name)    session.user.name  = token.name    as string
        if (token.email)   session.user.email = token.email   as string
      }
      return session
    },
  },

  events: {
    async createUser({ user }) {
      try {
        const { Resend } = await import('resend')
        const apiKey = process.env.RESEND_API_KEY
        if (!apiKey || !user.email) return
        const resend = new Resend(apiKey)
        const tpl = emailWelcome({ name: user.name || undefined })
        await resend.emails.send({
          from: 'Healify <noreply@healify.dev>',
          to: user.email,
          subject: tpl.subject,
          html: tpl.html,
        })
        logger.info('[Auth]', 'Welcome email sent', { email: user.email })
      } catch (err) {
        logger.warn('[Auth]', 'Welcome email failed (non-fatal)', { error: String(err) })
      }
    },
  },

  pages: {
    signIn: '/auth/signin',
    error:  '/auth/error',
  },

  secret: process.env.NEXTAUTH_SECRET,
}

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
