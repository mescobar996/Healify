import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { db } from '@/lib/db'

const ALLOWED_EVENTS = new Set([
  'onboarding_step_1_repo_connected',
  'onboarding_step_2_sdk_installed',
  'onboarding_step_3_first_healing',
  'search_open',
  'search_query',
  'search_result_click',
  'demo_scenario_selected',
])

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    const event = typeof body?.event === 'string' ? body.event.trim() : ''
    const metadata = body?.metadata && typeof body.metadata === 'object' ? body.metadata : {}

    if (!event || !ALLOWED_EVENTS.has(event)) {
      return NextResponse.json({ error: 'Invalid event' }, { status: 400 })
    }

    await db.analyticsEvent.create({
      data: {
        eventType: event,
        metadata: JSON.stringify({ userId: session.user.id, ...metadata }).slice(0, 2000),
      },
    })

    if (event.startsWith('onboarding_step_')) {
      await db.notification.create({
        data: {
          userId: session.user.id,
          type: 'info',
          title: `analytics_event:${event}`,
          message: JSON.stringify(metadata).slice(0, 1000),
          link: '/dashboard',
        },
      }).catch(() => {})
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[ANALYTICS][EVENTS] Error:', error)
    return NextResponse.json({ error: 'Failed to record analytics event' }, { status: 500 })
  }
}
