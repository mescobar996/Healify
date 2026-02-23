import NextAuth, { NextAuthOptions } from 'next-auth'
import GitHubProvider from 'next-auth/providers/github'
import GoogleProvider from 'next-auth/providers/google'

/**
 * Auth config — JWT only (no DB adapter)
 * Razón: Vercel es serverless, SQLite no funciona en Vercel.
 * La DB real (PostgreSQL) se configura por separado.
 * Con JWT puro el login funciona sin depender de ninguna DB.
 */
export const authOptions: NextAuthOptions = {
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
        token.role = 'user'
      }
      if (profile) {
        // GitHub usa avatar_url, Google usa picture
        token.picture = (profile as any).avatar_url || (profile as any).picture || token.picture
        token.name = (profile as any).name || (profile as any).login || token.name
        token.email = (profile as any).email || token.email
      }
      return token
    },
    async session({ session, token }: any) {
      if (session.user) {
        session.user.id = token.sub as string
        session.user.role = 'user'
        if (token.picture) session.user.image = token.picture as string
        if (token.name) session.user.name = token.name as string
        if (token.email) session.user.email = token.email as string
      }
      return session
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
