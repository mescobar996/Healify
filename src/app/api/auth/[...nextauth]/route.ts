import NextAuth, { NextAuthOptions } from 'next-auth'
import { PrismaAdapter } from '@next-auth/prisma-adapter'
import GitHubProvider from 'next-auth/providers/github'
import GoogleProvider from 'next-auth/providers/google'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { emailWelcome } from '@/lib/email-templates'

// ─── Env vars ────────────────────────────────────────────────────────
const GITHUB_ID     = process.env.GITHUB_ID     || process.env.GITHUB_CLIENT_ID     || ''
const GITHUB_SECRET = process.env.GITHUB_SECRET || process.env.GITHUB_CLIENT_SECRET || ''
const GOOGLE_ID     = process.env.GOOGLE_CLIENT_ID     || ''
const GOOGLE_SECRET = process.env.GOOGLE_CLIENT_SECRET || ''

// ─── Providers ───────────────────────────────────────────────────────
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
  // ── PrismaAdapter: crea User en DB al primer login ────────────────
  // CRÍTICO: sin adapter, el User no existe en Postgres y todas las
  // operaciones que usan userId (crear proyecto, demo, etc.) fallan
  // con Foreign Key violation.
  //
  // ¿Por qué funciona con JWT al mismo tiempo?
  // NextAuth v4 soporta adapter + strategy:'jwt' en conjunto:
  // - El adapter se encarga de crear/actualizar User y Account en DB
  // - JWT maneja la sesión (no escribe en tabla Session)
  // - La tabla Session queda vacía — eso está bien, no es un error
  providers,
  adapter: PrismaAdapter(db),

  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 días
  },

  callbacks: {
    async jwt({ token, user, account }: any) {
      // En el primer login, `user` viene del adapter con el ID real de Postgres
      if (user) {
        token.id   = user.id    // ID real de la tabla User en Postgres
        token.role = user.role || 'user'
      }
      // Guardar provider para referencia futura
      if (account) {
        token.provider = account.provider
      }
      return token
    },
    async session({ session, token }: any) {
      if (session.user) {
        session.user.id       = token.id       as string  // ID de Postgres
        session.user.role     = token.role     as string
        session.user.provider = token.provider as string
      }
      return session
    },
  },

  events: {
    async createUser({ user }) {
      // Email de bienvenida al primer registro
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
