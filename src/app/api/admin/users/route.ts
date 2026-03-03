/**
 * GET /api/admin/users  — paginated user list (admin only)
 * GET /api/admin/waitlist — waitlist entries (admin only)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth/session'
import { db } from '@/lib/db'

async function assertAdmin() {
  const user = await getSessionUser()
  if (!user?.id) return null
  // role is included in session via next-auth callbacks
  if (user.role !== 'admin') return null
  return user.id
}

export async function GET(req: NextRequest) {
  const adminId = await assertAdmin()
  if (!adminId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const url = new URL(req.url)
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1'))
  const limit = Math.min(100, parseInt(url.searchParams.get('limit') ?? '25'))
  const skip = (page - 1) * limit

  const [users, total] = await Promise.all([
    db.user.findMany({
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        _count: { select: { projects: true } },
      },
    }),
    db.user.count(),
  ])

  return NextResponse.json({ users, total, page, limit })
}
