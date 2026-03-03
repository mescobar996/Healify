/**
 * GET /api/admin/waitlist — paginated waitlist entries (admin only)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth/session'
import { db } from '@/lib/db'

async function assertAdmin() {
  const user = await getSessionUser()
  if (!user?.id) return null
  if (user.role !== 'admin') return null
  return user.id
}

export async function GET(req: NextRequest) {
  const adminId = await assertAdmin()
  if (!adminId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const url = new URL(req.url)
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1'))
  const limit = Math.min(200, parseInt(url.searchParams.get('limit') ?? '50'))
  const skip = (page - 1) * limit

  const [entries, total] = await Promise.all([
    db.waitlistEntry.findMany({
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    db.waitlistEntry.count(),
  ])

  return NextResponse.json({ entries, total, page, limit })
}
