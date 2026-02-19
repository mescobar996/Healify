import NextAuth from 'next-auth'
import GitHubProvider from 'next-auth/providers/github'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { db } from '@/lib/db'

export const authOptions = {
    adapter: PrismaAdapter(db),
    providers: [
        GitHubProvider({
            clientId: process.env.GITHUB_ID!,
            clientSecret: process.env.GITHUB_SECRET!,
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
}

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
