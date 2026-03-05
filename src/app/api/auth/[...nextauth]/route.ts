  // Helper to convert Prisma user to AdapterUser
  function toAdapterUser(user: any): AdapterUser {
    return {
      id: user.id,
      name: user.name ?? '',
      email: user.email ?? '',
      emailVerified: user.emailVerified ?? null,
      image: user.image ?? '',
    }
  }
import NextAuth, { NextAuthOptions } from 'next-auth'
import type { Adapter, AdapterUser, AdapterAccount, AdapterSession, VerificationToken } from 'next-auth/adapters'
import type { NextRequest } from 'next/server'
import { checkAuthRateLimit } from '@/lib/rate-limit'
import GitHubProvider from 'next-auth/providers/github'
import GoogleProvider from 'next-auth/providers/google'
import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { trackFunnelEvent } from '@/lib/funnel-analytics'

type UserCreateInput = Parameters<typeof db.user.create>[0]['data']
type AccountCreateInput = Prisma.AccountUncheckedCreateInput
type SessionCreateInput = Parameters<typeof db.session.create>[0]['data']
type SessionUpdateInput = Parameters<typeof db.session.update>[0]['data']
type VerificationTokenCreateInput = Parameters<typeof db.verificationToken.create>[0]['data']

// ═══════════════════════════════════════════════════════════════════════
// Custom Prisma Adapter — compatible with Prisma v6
// Replaces @next-auth/prisma-adapter v1.0.7 which has issues with Prisma v6.
// Every method is wrapped in try/catch with logging for diagnosability.
// ═══════════════════════════════════════════════════════════════════════
function HealifyPrismaAdapter() {
  return {
    async createUser(data: Omit<AdapterUser, "id">): Promise<AdapterUser> {
      try {
        console.log('[Adapter] createUser:', { email: data.email, name: data.name })
        const user = await db.user.create({
          data: {
            name: data.name,
            email: data.email,
            emailVerified: data.emailVerified,
            image: data.image,
          },
        })
        return toAdapterUser(user)
      } catch (err) {
        console.error('[Adapter] createUser FAILED:', err)
        throw err
      }
    },

    async getUser(id: string): Promise<AdapterUser | null> {
      try {
        const user = await db.user.findUnique({ where: { id } })
        return user ? toAdapterUser(user) : null
      } catch (err) {
        console.error('[Adapter] getUser FAILED:', err)
        throw err
      }
    },

    async getUserByEmail(email: string): Promise<AdapterUser | null> {
      try {
        if (!email) return null
        const user = await db.user.findUnique({ where: { email } })
        return user ? toAdapterUser(user) : null
      } catch (err) {
        console.error('[Adapter] getUserByEmail FAILED:', err)
        throw err
      }
    },

    async getUserByAccount({ provider, providerAccountId }: Pick<AdapterAccount, "provider" | "providerAccountId">): Promise<AdapterUser | null> {
      try {
        console.log('[Adapter] getUserByAccount:', { provider, providerAccountId })
        const account = await db.account.findFirst({
          where: { provider, providerAccountId },
          include: { user: true },
        })
        return account?.user ? toAdapterUser(account.user) : null
      } catch (err) {
        console.error('[Adapter] getUserByAccount FAILED:', err)
        throw err
      }
    },

    async updateUser(data: Partial<AdapterUser> & Pick<AdapterUser, "id">): Promise<AdapterUser> {
      try {
        const { id, ...rest } = data
        // Only update allowed AdapterUser fields
        const updateData: Record<string, any> = {}
        if (rest.name !== undefined) updateData.name = rest.name
        if (rest.email !== undefined) updateData.email = rest.email
        if (rest.emailVerified !== undefined) updateData.emailVerified = rest.emailVerified
        if (rest.image !== undefined) updateData.image = rest.image
        // If role is present and valid, cast to UserRole
        if (rest.role !== undefined && typeof rest.role === 'string' && ['USER', 'ADMIN'].includes(rest.role)) {
          updateData.role = rest.role as any // Prisma expects UserRole enum
        }
        const user = await db.user.update({ where: { id }, data: updateData })
        return toAdapterUser(user)
      } catch (err) {
        console.error('[Adapter] updateUser FAILED:', err)
        throw err
      }
    },

    async deleteUser(userId: string): Promise<void> {
      try {
        await db.user.delete({ where: { id: userId } })
      } catch (err) {
        console.error('[Adapter] deleteUser FAILED:', err)
        throw err
      }
    },

    async linkAccount(data: AdapterAccount): Promise<void> {
      try {
        console.log('[Adapter] linkAccount:', { provider: data.provider, userId: data.userId })
        await db.account.create({
          data: {
            userId: data.userId,
            type: data.type,
            provider: data.provider,
            providerAccountId: data.providerAccountId,
            refresh_token: data.refresh_token as string | undefined,
            access_token: data.access_token as string | undefined,
            expires_at: data.expires_at,
            token_type: data.token_type,
            scope: data.scope,
            id_token: data.id_token as string | undefined,
            session_state: data.session_state as string | undefined,
          },
        })
      } catch (err) {
        console.error('[Adapter] linkAccount FAILED:', err)
        throw err
      }
    },

    async unlinkAccount({ provider, providerAccountId }: Pick<AdapterAccount, "provider" | "providerAccountId">): Promise<void> {
      try {
        await db.account.deleteMany({ where: { provider, providerAccountId } })
      } catch (err) {
        console.error('[Adapter] unlinkAccount FAILED:', err)
        throw err
      }
    },

    async createSession(data: AdapterSession): Promise<AdapterSession> {
      try {
        return await db.session.create({ data })
      } catch (err) {
        console.error('[Adapter] createSession FAILED:', err)
        throw err
      }
    },

    async getSessionAndUser(sessionToken: string): Promise<{ session: AdapterSession; user: AdapterUser } | null> {
      try {
        const session = await db.session.findUnique({
          where: { sessionToken },
          include: { user: true },
        })
        if (!session) return null
        return { session, user: toAdapterUser(session.user) }
      } catch (err) {
        console.error('[Adapter] getSessionAndUser FAILED:', err)
        throw err
      }
    },

    async updateSession(data: Partial<AdapterSession> & Pick<AdapterSession, "sessionToken">): Promise<AdapterSession | null | undefined> {
      try {
        const { sessionToken, ...sessionData } = data
        return await db.session.update({
          where: { sessionToken },
          data: sessionData,
        })
      } catch (err) {
        console.error('[Adapter] updateSession FAILED:', err)
        throw err
      }
    },

    async deleteSession(sessionToken: string): Promise<void> {
      try {
        await db.session.delete({ where: { sessionToken } })
      } catch (err) {
        console.error('[Adapter] deleteSession FAILED:', err)
        throw err
      }
    },

    async createVerificationToken(data: VerificationToken): Promise<VerificationToken | null | undefined> {
      try {
        return await db.verificationToken.create({ data })
      } catch (err) {
        console.error('[Adapter] createVerificationToken FAILED:', err)
        throw err
      }
    },

    async useVerificationToken({ identifier, token }: { identifier: string; token: string }): Promise<VerificationToken | null> {
      try {
        return await db.verificationToken.delete({
          where: { identifier_token: { identifier, token } },
        })
      } catch (err) {
        console.error('[Adapter] useVerificationToken FAILED:', err)
        throw err
      }
    },
  } as Adapter
}

type OAuthProfileProjection = {
  avatar_url?: string
  picture?: string
  name?: string
  login?: string
  email?: string | null
}

export const authOptions: NextAuthOptions = {
  adapter: HealifyPrismaAdapter(),

  // Enable debug logging (visible in Vercel Function Logs)
  debug: process.env.NODE_ENV !== 'production' || !!process.env.NEXTAUTH_DEBUG,

  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID || process.env.GITHUB_ID || '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET || process.env.GITHUB_SECRET || '',
      allowDangerousEmailAccountLinking: true,
      profile(profile) {
        return {
          id: String(profile.id),
          name: profile.name || profile.login,
          email: profile.email ?? null,
          image: profile.avatar_url,
        }
      },
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      allowDangerousEmailAccountLinking: true,
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          image: profile.picture,
        }
      },
    }),
  ],

  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60,
  },

  callbacks: {
    async jwt({ token, user, profile }) {
      const typedProfile = (profile ?? {}) as OAuthProfileProjection
      if (user) {
        token.id = user.id
        token.role = ('role' in user ? user.role : undefined) || 'USER'
      }
      if (profile) {
        token.picture = typedProfile.avatar_url || typedProfile.picture || token.picture
        token.name = typedProfile.name || typedProfile.login || token.name
        token.email = typedProfile.email || token.email
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as string
        if (token.picture) session.user.image = token.picture as string
        if (token.name) session.user.name = token.name as string
        if (token.email) session.user.email = token.email as string
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
        if (apiKey && user.email) {
          const resend = new Resend(apiKey)
          await resend.emails.send({
            from: 'Healify <noreply@healify.dev>',
            to: user.email,
            subject: '¡Bienvenido a Healify! 🎉',
            html: `
              <div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;background:#0A0E1A;color:#E8F0FF;padding:32px;border-radius:12px">
                <h1 style="font-size:22px;font-weight:700;margin:0 0 8px">Hola${user.name ? ', ' + user.name.split(' ')[0] : ''} 👋</h1>
                <p style="color:#9CA3AF;margin:0 0 24px;line-height:1.6">
                  Tu cuenta en Healify está lista. Conectá tu primer repositorio y dejá que la IA autocure tus tests rotos automáticamente.
                </p>
                <a href="https://healify-sigma.vercel.app/dashboard/projects"
                   style="display:inline-block;background:#7B5EF8;color:#fff;font-weight:600;padding:12px 24px;border-radius:8px;text-decoration:none">
                  Crear mi primer proyecto →
                </a>
                <p style="color:#4A5568;font-size:12px;margin:32px 0 0">
                  Si no creaste esta cuenta, ignorá este email.
                </p>
              </div>
            `,
          })
          console.log(`[Auth] Welcome email sent to ${user.email}`)
        }
      } catch (err) {
        console.warn('[Auth] Welcome email failed:', err)
      }

      // ── Create 14-day free trial (STARTER plan) ───────────────────────────
      try {
        const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
        await db.subscription.create({
          data: {
            userId: user.id!,
            plan:   'STARTER',
            status: 'trial',
            trialEndsAt,
          },
        })
        console.log(`[Auth] 14-day trial created for user ${user.id} (ends ${trialEndsAt.toISOString()})`)
        void trackFunnelEvent('activation', { userId: user.id })
      } catch (err) {
        // May already exist if called twice — not fatal
        console.warn('[Auth] Trial subscription creation failed (may already exist):', err)
      }
    },
  },

  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },

  secret: process.env.NEXTAUTH_SECRET,
}

const handler = NextAuth(authOptions)

async function rateLimitedHandler(
  req: NextRequest,
  ctx: { params: Promise<{ nextauth: string[] }> }
) {
  if (req.method === 'POST') {
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      req.headers.get('x-real-ip') ||
      'unknown'
    const allowed = await checkAuthRateLimit(ip)
    if (!allowed) {
      return new Response('Too Many Requests', {
        status: 429,
        headers: { 'Retry-After': '900', 'Content-Type': 'text/plain' },
      })
    }
  }
  // Await params before forwarding — Next.js 16+ makes params a Promise
  const resolvedCtx = { params: await ctx.params }

  // Diagnostic logging for OAuth callbacks
  const route = resolvedCtx.params.nextauth?.join('/') ?? ''
  if (route.startsWith('callback')) {
    console.log(`[Auth] OAuth callback: ${req.method} ${route}`, {
      url: req.url,
      hasCode: req.nextUrl.searchParams.has('code'),
      hasState: req.nextUrl.searchParams.has('state'),
      hasError: req.nextUrl.searchParams.get('error'),
      NEXTAUTH_URL_SET: !!process.env.NEXTAUTH_URL,
      VERCEL_URL: process.env.VERCEL_URL ?? 'NOT SET',
    })
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await (handler as any)(req, resolvedCtx)

    // Log redirect target for callbacks (helps diagnose silent errors)
    if (route.startsWith('callback') && response?.status >= 300 && response?.status < 400) {
      const location = response.headers?.get('location') ?? ''
      console.log(`[Auth] Callback redirect: ${response.status} → ${location}`)
      if (location.includes('error=')) {
        console.error(`[Auth] ⚠️ OAuth callback resulted in error redirect: ${location}`)
      }
    }

    return response
  } catch (err) {
    console.error(`[Auth] Handler error on ${req.method} /${route}:`, err)
    // Return a JSON error for API consumers, redirect for browser
    if (route.startsWith('callback')) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      console.error(`[Auth] ⚠️ CRITICAL — OAuth callback exception:`, errorMessage)
      // Still throw so NextAuth redirects to the error page
    }
    throw err
  }
}

export { rateLimitedHandler as GET, rateLimitedHandler as POST }
