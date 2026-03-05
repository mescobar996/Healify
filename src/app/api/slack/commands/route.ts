import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { db } from '@/lib/db'

// ═══════════════════════════════════════════════════════════════════════
// POST /api/slack/commands — Slack Slash Command handler
//
// Slack sends a POST with form-encoded body when a user types:
//   /healify status
//   /healify projects
//   /healify heal <project-name>
//   /healify help
//
// Required env vars:
//   SLACK_SIGNING_SECRET — for verifying request authenticity
//   SLACK_BOT_TOKEN      — for sending rich ephemeral responses
// ═══════════════════════════════════════════════════════════════════════

function verifySlackSignature(req: NextRequest, rawBody: string): boolean {
  const secret = process.env.SLACK_SIGNING_SECRET
  if (!secret) return false

  const timestamp = req.headers.get('x-slack-request-timestamp') || ''
  const signature = req.headers.get('x-slack-signature') || ''

  // Reject requests older than 5 minutes (replay attack protection)
  const now = Math.floor(Date.now() / 1000)
  if (Math.abs(now - Number(timestamp)) > 300) return false

  const sigBasestring = `v0:${timestamp}:${rawBody}`
  const mySignature = 'v0=' + crypto.createHmac('sha256', secret).update(sigBasestring).digest('hex')

  return crypto.timingSafeEqual(Buffer.from(mySignature), Buffer.from(signature))
}

// ── Lookup user by Slack-stored webhook URL or email ──────────────────
async function findUserBySlackTeam(teamId: string) {
  // Try to find user with slackWebhookUrl containing the team domain
  // Fallback: find first user (single-tenant for now)
  const user = await db.user.findFirst({
    where: { slackWebhookUrl: { not: null } },
    select: { id: true, name: true, email: true },
  })
  return user
}

// ── Command: /healify status ──────────────────────────────────────────
async function handleStatus(userId: string) {
  const [projectCount, testRunCount, healedCount, pendingCount] = await Promise.all([
    db.project.count({ where: { userId } }),
    db.testRun.count({ where: { project: { userId } } }),
    db.healingEvent.count({ where: { testRun: { project: { userId } } }, status: { in: ['HEALED_AUTO', 'HEALED_MANUAL'] } } as never),
    db.healingEvent.count({ where: { testRun: { project: { userId } } }, status: 'NEEDS_REVIEW' } as never),
  ])

  return {
    response_type: 'ephemeral' as const,
    blocks: [
      { type: 'header', text: { type: 'plain_text', text: '📊 Healify Status', emoji: true } },
      { type: 'section', fields: [
        { type: 'mrkdwn', text: `*Proyectos:*\n${projectCount}` },
        { type: 'mrkdwn', text: `*Test Runs:*\n${testRunCount}` },
        { type: 'mrkdwn', text: `*Tests Curados:*\n${healedCount}` },
        { type: 'mrkdwn', text: `*Pendientes:*\n${pendingCount}` },
      ]},
      { type: 'context', elements: [{ type: 'mrkdwn', text: '<https://healify-sigma.vercel.app/dashboard|Ver dashboard completo>' }] },
    ],
  }
}

// ── Command: /healify projects ────────────────────────────────────────
async function handleProjects(userId: string) {
  const projects = await db.project.findMany({
    where: { userId },
    include: { _count: { select: { testRuns: true } } },
    orderBy: { updatedAt: 'desc' },
    take: 10,
  })

  if (projects.length === 0) {
    return {
      response_type: 'ephemeral' as const,
      text: '📁 No tenés proyectos todavía. Creá uno en <https://healify-sigma.vercel.app/dashboard/projects|el dashboard>.',
    }
  }

  const projectBlocks = projects.map((p) => ({
    type: 'section' as const,
    text: {
      type: 'mrkdwn' as const,
      text: `*${p.name}*\n${p.repository || 'Sin repo'} · ${p._count.testRuns} test runs`,
    },
    accessory: {
      type: 'button' as const,
      text: { type: 'plain_text' as const, text: '▶️ Run Tests', emoji: true },
      action_id: `run_tests_${p.id}`,
      value: p.id,
    },
  }))

  return {
    response_type: 'ephemeral' as const,
    blocks: [
      { type: 'header', text: { type: 'plain_text', text: '📁 Tus Proyectos', emoji: true } },
      ...projectBlocks,
    ],
  }
}

// ── Command: /healify heal <project> ──────────────────────────────────
async function handleHeal(userId: string, projectQuery: string) {
  if (!projectQuery.trim()) {
    return { response_type: 'ephemeral' as const, text: '⚠️ Uso: `/healify heal <nombre-del-proyecto>`' }
  }

  const project = await db.project.findFirst({
    where: {
      userId,
      name: { contains: projectQuery.trim(), mode: 'insensitive' as const },
    },
  })

  if (!project) {
    return { response_type: 'ephemeral' as const, text: `❌ Proyecto "${projectQuery}" no encontrado.` }
  }

  // Get recent healing events for this project
  const events = await db.healingEvent.findMany({
    where: { testRun: { projectId: project.id } },
    orderBy: { createdAt: 'desc' },
    take: 5,
  })

  if (events.length === 0) {
    return { response_type: 'ephemeral' as const, text: `✨ *${project.name}* — No hay healing events recientes. ¡Todo está sano!` }
  }

  const eventLines = events.map((e) => {
    const emoji = e.status === 'HEALED_AUTO' ? '✅' : e.status === 'NEEDS_REVIEW' ? '🔍' : e.status === 'FAILED' ? '❌' : '⏳'
    const conf = e.confidence ? `${Math.round(e.confidence * 100)}%` : '–'
    return `${emoji} *${e.testName}* — ${e.status} (${conf})`
  })

  return {
    response_type: 'ephemeral' as const,
    blocks: [
      { type: 'header', text: { type: 'plain_text', text: `🪄 Healing: ${project.name}`, emoji: true } },
      { type: 'section', text: { type: 'mrkdwn', text: eventLines.join('\n') } },
      { type: 'context', elements: [{ type: 'mrkdwn', text: `<https://healify-sigma.vercel.app/dashboard/healing|Ver todos los healing events>` }] },
    ],
  }
}

// ── Command: /healify help ────────────────────────────────────────────
function handleHelp() {
  return {
    response_type: 'ephemeral' as const,
    blocks: [
      { type: 'header', text: { type: 'plain_text', text: '🪄 Healify Bot — Comandos', emoji: true } },
      { type: 'section', text: { type: 'mrkdwn', text: [
        '`/healify status` — Resumen general (proyectos, tests, curaciones)',
        '`/healify projects` — Lista tus proyectos con botón de ejecutar tests',
        '`/healify heal <proyecto>` — Últimos healing events de un proyecto',
        '`/healify help` — Este menú',
      ].join('\n') } },
      { type: 'divider' },
      { type: 'context', elements: [{ type: 'mrkdwn', text: '💡 También recibís notificaciones automáticas cuando un test se cura o falla.' }] },
    ],
  }
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text()

    // Verify Slack request signature (skip in dev if no secret set)
    if (process.env.SLACK_SIGNING_SECRET && !verifySlackSignature(request, rawBody)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    // Parse form-encoded body
    const params = new URLSearchParams(rawBody)
    const command = params.get('command') ?? ''
    const text = params.get('text') ?? ''
    const teamId = params.get('team_id') ?? ''

    if (command !== '/healify') {
      return NextResponse.json({ text: 'Comando no reconocido.' })
    }

    // Find the Healify user associated with this Slack workspace
    const user = await findUserBySlackTeam(teamId)
    if (!user) {
      return NextResponse.json({
        response_type: 'ephemeral',
        text: '⚠️ No hay cuenta de Healify vinculada a este workspace. Configurá tu Slack Webhook en <https://healify-sigma.vercel.app/dashboard/settings|Settings>.',
      })
    }

    const [subcommand, ...args] = text.trim().split(/\s+/)

    let response
    switch (subcommand?.toLowerCase()) {
      case 'status':
        response = await handleStatus(user.id)
        break
      case 'projects':
        response = await handleProjects(user.id)
        break
      case 'heal':
        response = await handleHeal(user.id, args.join(' '))
        break
      case 'help':
      case '':
      case undefined:
        response = handleHelp()
        break
      default:
        response = { response_type: 'ephemeral' as const, text: `❓ Subcomando desconocido: "${subcommand}". Probá \`/healify help\`.` }
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('[Slack Commands] Error:', error)
    return NextResponse.json({ response_type: 'ephemeral', text: '❌ Error interno. Intentá de nuevo.' })
  }
}
