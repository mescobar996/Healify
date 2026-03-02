import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'

type SessionUser = {
  id?: string
  role?: string
  email?: string | null
  name?: string | null
  image?: string | null
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions)
  return session?.user ?? null
}

export async function requireSessionUser(): Promise<SessionUser> {
  const user = await getSessionUser()
  if (!user?.id) {
    throw new Error('UNAUTHORIZED')
  }
  return user
}