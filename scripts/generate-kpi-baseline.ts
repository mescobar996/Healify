import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { db } from '../src/lib/db'

type KpiTargets = {
  activation24hPct: number
  timeToFirstHealingMinutes: number
  autoPrRatePct: number
}

const KPI_TARGETS: KpiTargets = {
  activation24hPct: 60,
  timeToFirstHealingMinutes: 15,
  autoPrRatePct: 35,
}

function pct(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0
  return Number(((numerator / denominator) * 100).toFixed(1))
}

function fmt(value: number | null): string {
  if (value === null || Number.isNaN(value)) return 'N/A'
  return String(value)
}

async function main() {
  const target = resolve(process.cwd(), 'docs', 'KPI_BASELINE_LATEST.md')

  if (!process.env.DATABASE_URL) {
    const now = new Date().toISOString()
    const pendingReport = `# Healify — KPI Baseline Report\n\nFecha de generación: ${now}\nEstado: pendiente por entorno\n\n## Motivo\n\nNo se encontró la variable de entorno \`DATABASE_URL\` en este entorno local.\n\n## Acción requerida\n\n1. Configurar \`DATABASE_URL\` del entorno objetivo.\n2. Ejecutar: \`npx tsx scripts/generate-kpi-baseline.ts\`\n\n## Nota\n\nEste archivo se genera automáticamente y se reemplaza cuando hay conexión a base de datos.\n`
    writeFileSync(target, pendingReport, 'utf-8')
    console.log(`KPI baseline pending report generated at: ${target}`)
    return
  }

  const days = 30
  const since = new Date()
  since.setDate(since.getDate() - days)

  const cohortUsers = await db.user.findMany({
    where: { createdAt: { gte: since } },
    select: { id: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  })

  const cohortIds = cohortUsers.map((user) => user.id)

  const [repoConnectedUsers, paidUsers, healedEvents, autoHealedEvents] = await Promise.all([
    db.user.findMany({
      where: {
        id: { in: cohortIds },
        projects: { some: {} },
      },
      select: {
        id: true,
        createdAt: true,
        projects: { select: { createdAt: true }, orderBy: { createdAt: 'asc' }, take: 1 },
      },
    }),
    db.subscription.count({
      where: {
        userId: { in: cohortIds },
        status: { not: 'canceled' },
        plan: { not: 'FREE' },
      },
    }),
    db.healingEvent.findMany({
      where: {
        createdAt: { gte: since },
        status: { in: ['HEALED_AUTO', 'HEALED_MANUAL'] },
      },
      select: {
        createdAt: true,
        testRun: { select: { project: { select: { userId: true } } } },
      },
      orderBy: { createdAt: 'asc' },
    }),
    db.healingEvent.count({
      where: {
        createdAt: { gte: since },
        status: 'HEALED_AUTO',
      },
    }),
  ])

  const firstHealingByUser = new Map<string, Date>()
  for (const event of healedEvents) {
    const userId = event.testRun.project.userId
    if (!userId) continue
    const current = firstHealingByUser.get(userId)
    if (!current || event.createdAt < current) {
      firstHealingByUser.set(userId, event.createdAt)
    }
  }

  const timeToFirstHealingMinutesList: number[] = []
  for (const user of cohortUsers) {
    const firstHealing = firstHealingByUser.get(user.id)
    if (!firstHealing) continue
    const minutes = Math.max(0, (firstHealing.getTime() - user.createdAt.getTime()) / 60000)
    timeToFirstHealingMinutesList.push(minutes)
  }

  const avgTimeToFirstHealingMinutes = timeToFirstHealingMinutesList.length
    ? Number((timeToFirstHealingMinutesList.reduce((acc, value) => acc + value, 0) / timeToFirstHealingMinutesList.length).toFixed(1))
    : null

  const activation24h = repoConnectedUsers.filter((user) => {
    const firstProject = user.projects[0]
    if (!firstProject) return false
    return firstProject.createdAt.getTime() - user.createdAt.getTime() <= 24 * 60 * 60 * 1000
  }).length

  const firstHealingUsers = firstHealingByUser.size
  const registered = cohortIds.length
  const repoConnected = repoConnectedUsers.length

  const conversionRegisteredToRepoPct = pct(repoConnected, registered)
  const conversionRepoToHealingPct = pct(firstHealingUsers, repoConnected)
  const conversionHealingToPaidPct = pct(paidUsers, firstHealingUsers)

  const activation24hPct = pct(activation24h, registered)
  const autoPrRatePct = pct(autoHealedEvents, healedEvents.length)

  const now = new Date().toISOString()

  const markdown = `# Healify — KPI Baseline Report\n\nFecha de generación: ${now}\nVentana analizada: últimos ${days} días\n\n## Funnel\n\n- registered: ${registered}\n- repoConnected: ${repoConnected}\n- firstHealing: ${firstHealingUsers}\n- paid: ${paidUsers}\n- conversionRegisteredToRepoPct: ${conversionRegisteredToRepoPct}%\n- conversionRepoToHealingPct: ${conversionRepoToHealingPct}%\n- conversionHealingToPaidPct: ${conversionHealingToPaidPct}%\n\n## KPI Targets vs Actuals\n\n| KPI | Target | Actual | Estado |\n|---|---:|---:|---|\n| activation24hPct | ${KPI_TARGETS.activation24hPct}% | ${activation24hPct}% | ${activation24hPct >= KPI_TARGETS.activation24hPct ? '✅' : '⚠️'} |\n| timeToFirstHealingMinutes | < ${KPI_TARGETS.timeToFirstHealingMinutes} | ${fmt(avgTimeToFirstHealingMinutes)} | ${avgTimeToFirstHealingMinutes !== null && avgTimeToFirstHealingMinutes < KPI_TARGETS.timeToFirstHealingMinutes ? '✅' : '⚠️'} |\n| autoPrRatePct | ${KPI_TARGETS.autoPrRatePct}% | ${autoPrRatePct}% | ${autoPrRatePct >= KPI_TARGETS.autoPrRatePct ? '✅' : '⚠️'} |\n\n## Notas\n\n- Fuente de verdad de definiciones: docs/METRICAS_Y_KPIS_2026.md\n- Este reporte se puede regenerar con: \`npx tsx scripts/generate-kpi-baseline.ts\`\n`

  writeFileSync(target, markdown, 'utf-8')
  console.log(`KPI baseline generated at: ${target}`)

  await db.$disconnect()
}

main().catch(async (error) => {
  console.error('Failed to generate KPI baseline:', error)
  await db.$disconnect()
  process.exit(1)
})
