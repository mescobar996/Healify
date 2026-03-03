/**
 * Worker-side notification helper.
 * Uses direct DB + HTTP calls (no @/ alias for esbuild compatibility).
 *
 * Sends post-job notifications via:
 *   - In-app  (Notification table in DB)
 *   - Email   (Resend, if RESEND_API_KEY is set)
 *   - Slack   (user.slackWebhookUrl, if set)
 */

import { db } from '../../lib/db'

async function sendSlack(webhookUrl: string, title: string, body: string, emoji: string): Promise<void> {
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        blocks: [
          { type: 'header', text: { type: 'plain_text', text: `${emoji} ${title}`, emoji: true } },
          { type: 'section', text: { type: 'mrkdwn', text: body } },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `*Healify* · <${process.env.NEXT_PUBLIC_APP_URL ?? 'https://healify-sigma.vercel.app'}/dashboard|View dashboard>`,
              },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(5000),
    })
  } catch { /* non-fatal */ }
}

async function sendEmail(to: string, subject: string, body: string): Promise<void> {
  const key = process.env.RESEND_API_KEY
  if (!key) return

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Healify <notifications@healify-sigma.vercel.app>',
        to,
        subject,
        html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto">
<h2 style="color:#E8F0FF">${subject}</h2>
<p style="color:#AAB4C8">${body}</p>
<hr style="border-color:#2A3040"/>
<p style="font-size:11px;color:#607080">
  <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://healify-sigma.vercel.app'}/dashboard" style="color:#00F5C8">Open Healify</a>
</p></div>`,
      }),
      signal: AbortSignal.timeout(8000),
    })
  } catch { /* non-fatal */ }
}

async function saveInApp(userId: string, type: string, title: string, message: string, link?: string): Promise<void> {
  try {
    await db.notification.create({
      data: { userId, type, title, message, link },
    })
  } catch { /* non-fatal */ }
}

// ── Public helpers ─────────────────────────────────────────────────────────

export async function notifyJobCompleted(
  projectId: string,
  passed: number,
  failed: number,
  healed: number,
  testRunId: string
): Promise<void> {
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: { user: { select: { id: true, email: true, slackWebhookUrl: true } } },
  })
  if (!project?.user) return

  const { user } = project
  const link = `/dashboard/tests/${testRunId}`
  const allPassed = failed === 0
  const allHealed = failed > 0 && healed === failed

  const title = allPassed
    ? `✅ All tests passed — ${project.name}`
    : allHealed
      ? `✨ Tests healed — ${project.name}`
      : `⚠️ Tests failed — ${project.name}`

  const body = allPassed
    ? `${passed} tests passed.`
    : allHealed
      ? `${healed} of ${failed} failed tests were auto-healed. ${passed} tests passed.`
      : `${failed} test(s) failed, ${healed} healed, ${passed} passed.`

  const emoji = allPassed ? '✅' : allHealed ? '✨' : '⚠️'
  const notifType = allPassed ? 'success' : allHealed ? 'success' : 'error'

  await saveInApp(user.id, notifType, title, body, link)
  if (user.email) await sendEmail(user.email, title, body)
  if (user.slackWebhookUrl) await sendSlack(user.slackWebhookUrl, title, body, emoji)
}

export async function notifyJobFailed(
  projectId: string,
  error: string,
  testRunId: string
): Promise<void> {
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: { user: { select: { id: true, email: true, slackWebhookUrl: true } } },
  })
  if (!project?.user) return

  const { user } = project
  const title = `❌ Test run failed — ${project.name}`
  const body = `The test run could not complete: ${error.slice(0, 200)}`
  const link = `/dashboard/tests/${testRunId}`

  await saveInApp(user.id, 'error', title, body, link)
  if (user.email) await sendEmail(user.email, title, body)
  if (user.slackWebhookUrl) await sendSlack(user.slackWebhookUrl, title, body, '❌')
}
