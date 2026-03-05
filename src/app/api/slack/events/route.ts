import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

// ═══════════════════════════════════════════════════════════════════════
// POST /api/slack/events — Slack Events API handler
//
// Handles:
//   1. URL verification challenge (onboarding)
//   2. app_mention events (when someone @healify in a channel)
//   3. message.im events (DMs to the bot)
// ═══════════════════════════════════════════════════════════════════════

function verifySlackSignature(req: NextRequest, rawBody: string): boolean {
  const secret = process.env.SLACK_SIGNING_SECRET
  if (!secret) return false

  const timestamp = req.headers.get('x-slack-request-timestamp') || ''
  const signature = req.headers.get('x-slack-signature') || ''

  const now = Math.floor(Date.now() / 1000)
  if (Math.abs(now - Number(timestamp)) > 300) return false

  const sigBasestring = `v0:${timestamp}:${rawBody}`
  const mySignature = 'v0=' + crypto.createHmac('sha256', secret).update(sigBasestring).digest('hex')

  return crypto.timingSafeEqual(Buffer.from(mySignature), Buffer.from(signature))
}

async function sendSlackMessage(channel: string, text: string, blocks?: unknown[]) {
  const token = process.env.SLACK_BOT_TOKEN
  if (!token) {
    console.warn('[Slack Events] SLACK_BOT_TOKEN not set')
    return
  }

  await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ channel, text, ...(blocks ? { blocks } : {}) }),
  })
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text()

    if (process.env.SLACK_SIGNING_SECRET && !verifySlackSignature(request, rawBody)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const payload = JSON.parse(rawBody)

    // ── URL Verification (Slack onboarding) ───────────────────────────
    if (payload.type === 'url_verification') {
      return NextResponse.json({ challenge: payload.challenge })
    }

    // ── Event Callback ────────────────────────────────────────────────
    if (payload.type === 'event_callback') {
      const event = payload.event

      // Ignore bot's own messages (prevent infinite loops)
      if (event.bot_id) return NextResponse.json({ ok: true })

      // Handle @healify mentions
      if (event.type === 'app_mention') {
        const text = (event.text || '').toLowerCase()

        if (text.includes('help') || text.includes('ayuda')) {
          await sendSlackMessage(event.channel,
            '🪄 *Healify Bot* — Usá `/healify help` para ver todos los comandos disponibles.',
          )
        } else if (text.includes('status') || text.includes('estado')) {
          await sendSlackMessage(event.channel,
            '📊 Para ver tu status, usá `/healify status` (respuesta privada por seguridad).',
          )
        } else {
          await sendSlackMessage(event.channel,
            '👋 ¡Hola! Soy *Healify Bot*. Usá `/healify help` para ver qué puedo hacer.\n\n' +
            'También te notifico automáticamente cuando un test se cura o falla 🔔',
          )
        }
      }

      // Handle DMs
      if (event.type === 'message' && event.channel_type === 'im') {
        await sendSlackMessage(event.channel,
          '👋 ¡Hola! Los comandos de Healify funcionan con `/healify` en cualquier canal.\n' +
          'Probá `/healify status` o `/healify help`.',
        )
      }
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[Slack Events] Error:', error)
    return NextResponse.json({ ok: true }) // Always return 200 to Slack
  }
}
