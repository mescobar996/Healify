import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { db } from '@/lib/db'

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const q = (searchParams.get('q') || '').trim()

    if (q.length < 2) {
      return NextResponse.json({ query: q, projects: [], testRuns: [], healingEvents: [] })
    }

    const [projects, testRuns, healingEvents] = await Promise.all([
      db.project.findMany({
        where: {
          userId: session.user.id,
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
            { repository: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: { id: true, name: true, repository: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
        take: 6,
      }),
      db.testRun.findMany({
        where: {
          project: { userId: session.user.id },
          OR: [
            { commitMessage: { contains: q, mode: 'insensitive' } },
            { branch: { contains: q, mode: 'insensitive' } },
            { commitSha: { contains: q, mode: 'insensitive' } },
            { project: { name: { contains: q, mode: 'insensitive' } } },
          ],
        },
        select: {
          id: true,
          status: true,
          branch: true,
          commitMessage: true,
          startedAt: true,
          project: { select: { id: true, name: true } },
        },
        orderBy: { startedAt: 'desc' },
        take: 8,
      }),
      db.healingEvent.findMany({
        where: {
          testRun: { project: { userId: session.user.id } },
          OR: [
            { testName: { contains: q, mode: 'insensitive' } },
            { failedSelector: { contains: q, mode: 'insensitive' } },
            { newSelector: { contains: q, mode: 'insensitive' } },
            { testRun: { project: { name: { contains: q, mode: 'insensitive' } } } },
          ],
        },
        select: {
          id: true,
          testName: true,
          status: true,
          confidence: true,
          prUrl: true,
          createdAt: true,
          testRun: { select: { id: true, project: { select: { id: true, name: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
    ])

    return NextResponse.json({ query: q, projects, testRuns, healingEvents })
  } catch (error) {
    console.error('Search API error:', error)
    return NextResponse.json({ error: 'Failed to search' }, { status: 500 })
  }
}
