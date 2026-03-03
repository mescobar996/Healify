import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/auth/session'
import { apiError } from '@/lib/api-response'

/**
 * GET  /api/user/notifications  — get current notification prefs
 * PUT  /api/user/notifications  — update Slack webhook + email prefs
 */

export async function GET(request: NextRequest) {
  const user = await getSessionUser()
  if (!user?.id) return apiError(request, 401, 'Unauthorized')

  const dbUser = await db.user.findUnique({
    where: { id: user.id },
    select: { slackWebhookUrl: true, email: true },
  })

  return NextResponse.json({
    slackWebhookUrl: dbUser?.slackWebhookUrl ?? null,
    email: dbUser?.email ?? null,
  })
}

export async function PUT(request: NextRequest) {
  const user = await getSessionUser()
  if (!user?.id) return apiError(request, 401, 'Unauthorized')

  const body = await request.json().catch(() => ({}))
  const { slackWebhookUrl } = body as { slackWebhookUrl?: string | null }

  // Validate Slack webhook URL if provided
  if (slackWebhookUrl !== undefined && slackWebhookUrl !== null && slackWebhookUrl !== '') {
    try {
      const url = new URL(slackWebhookUrl)
      if (!url.hostname.includes('hooks.slack.com')) {
        return apiError(request, 400, 'URL must be a valid Slack incoming webhook (hooks.slack.com)')
      }
    } catch {
      return apiError(request, 400, 'Invalid URL format')
    }
  }

  // Test the webhook by sending a ping if provided
  let testResult: { ok: boolean; error?: string } = { ok: true }
  if (slackWebhookUrl) {
    try {
      const res = await fetch(slackWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: '✅ *Healify* webhook connected successfully.',
        }),
        signal: AbortSignal.timeout(5000),
      })
      testResult = res.ok
        ? { ok: true }
        : { ok: false, error: `Slack returned ${res.status}` }
    } catch (err) {
      testResult = {
        ok: false,
        error: err instanceof Error ? err.message : 'Connection timeout',
      }
    }
  }

  if (!testResult.ok) {
    return apiError(request, 400, `Slack webhook test failed: ${testResult.error}`)
  }

  await db.user.update({
    where: { id: user.id },
    data: {
      slackWebhookUrl: slackWebhookUrl ?? null,
    },
  })

  return NextResponse.json({ ok: true, message: 'Notification preferences saved.' })
}
