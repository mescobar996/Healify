import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildDashboardStats, renderDashboardHtml, type DashboardStats } from '@healify/reporter-core'
import { readHistory } from '../history'
import type { DashboardServeResult } from './dashboard-serve'

export type { DashboardServeResult }
export { runDashboardServe, createDashboardApp, resolveUiDir, buildSelectorSummaries, buildSelectorDetail, buildStatsOverview } from './dashboard-serve'

export interface DashboardCommandResult {
  ok: boolean
  outPath?: string
  stats: DashboardStats
  lines: string[]
}

/**
 * `healify dashboard [--out <path>] [--serve] [--port <n>] [--open]` — la vista HTML del
 * histórico que `healify history` solo muestra en texto plano, o, con `--serve`, el mismo
 * dashboard como servidor local con UI React + API JSON.
 *
 * La lógica vive acá, separada de `index.ts` (que solo imprime) — patrón `commands/history.ts`.
 * El render es del paquete `reporter-core` (puro, testeado); este comando solo lee el
 * historial y escribe el archivo. `--serve` delega en `dashboard-serve.ts`.
 */
export function runDashboard(args: string[], cwd: string = process.cwd()): DashboardCommandResult {
  const outIndex = args.indexOf('--out')
  const outArg = outIndex >= 0 ? args[outIndex + 1] : undefined
  const outPath = outArg && !outArg.startsWith('--') ? outArg : 'healify-dashboard.html'

  const entries = readHistory(cwd)
  if (entries.length === 0) {
    return {
      ok: true,
      stats: buildDashboardStats([]),
      lines: [
        'Todavía no hay historial — corré healify fix (sin --dry-run) al menos una vez para empezar a registrar selectores rotos.',
      ],
    }
  }

  const stats = buildDashboardStats(entries)
  const fullPath = join(cwd, outPath)
  try {
    writeFileSync(fullPath, renderDashboardHtml(stats), 'utf-8')
  } catch (error) {
    return {
      ok: false,
      stats,
      lines: [`No se pudo escribir ${outPath}: ${error instanceof Error ? error.message : String(error)}`],
    }
  }

  return {
    ok: true,
    outPath,
    stats,
    lines: [
      `Dashboard generado en ${outPath} — abrirlo con el browser (100% offline).`,
      `${stats.total} entradas · ${Math.round(stats.healedRate * 100)}% curadas · ${stats.rebroken.length} re-rotos.`,
    ],
  }
}
