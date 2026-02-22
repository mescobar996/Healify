import NextAuth from 'next-auth'
import GitHubProvider from 'next-auth/providers/github'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { db } from '@/lib/db'

// Soportar GITHUB_ID (nombre antiguo) y GITHUB_CLIENT_ID (nombre nuevo en .env.example)
const githubClientId = process.env.GITHUB_CLIENT_ID || process.env.GITHUB_ID || ''
const githubClientSecret = process.env.GITHUB_CLIENT_SECRET || process.env.GITHUB_SECRET || ''

export const authOptions = {
    adapter: PrismaAdapter(db),
    providers: [
        GitHubProvider({
            clientId: githubClientId,
            clientSecret: githubClientSecret,
        }),
    ],
    callbacks: {
        async session({ session, user }: any) {
            if (session.user) {
                session.user.id = user.id
                session.user.role = user.role
            }
            return session
        },
    },
    pages: {
        signIn: '/auth/signin',
    },
    // Requerido para Vercel/producción — evita error "Callback"
    trustHost: true,
}

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }

