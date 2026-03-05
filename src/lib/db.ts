import { PrismaClient } from '@prisma/client'
// Validate required env vars as early as possible
import './env'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development'
      ? ['query', 'warn', 'error']
      : ['warn', 'error'],
    // Limit connections per serverless instance to prevent pool exhaustion (A-M2)
    datasourceUrl: appendConnectionLimit(process.env.DATABASE_URL),
  })

/** Append ?connection_limit=5 to DATABASE_URL if not already present */
function appendConnectionLimit(url: string | undefined): string | undefined {
  if (!url) return url
  if (url.includes('connection_limit')) return url
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}connection_limit=5`
}

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db