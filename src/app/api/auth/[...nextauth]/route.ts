import NextAuth, { NextAuthOptions } from 'next-auth'
import GitHubProvider from 'next-auth/providers/github'
import GoogleProvider from 'next-auth/providers/google'
import { PrismaAdapter } from '@next-auth/prisma-adapter'
import { db } from '@/lib/db'

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db),

  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID || process.env.GITHUB_ID || '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET || process.env.GITHUB_SECRET || '',
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
    async jwt({ token, user, profile }: any) {
      if (user) {
        token.id = user.id
        token.role = (user as any).role || 'user'
      }
      if (profile) {
        token.picture = (profile as any).avatar_url || (profile as any).picture || token.picture
        token.name = (profile as any).name || (profile as any).login || token.name
        token.email = (profile as any).email || token.email
      }
      return token
    },
    async session({ session, token }: any) {
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
        if (!apiKey || !user.email) return
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
      } catch (err) {
        console.warn('[Auth] Welcome email failed:', err)
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
export { handler as GET, handler as POST }
