import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import cors from 'cors'
import express, { type Express, type Request, type Response } from 'express'
import open from 'open'
import {
  buildDashboardStats,
  type HistoryEntry,
  type TimelinePoint,
} from '@healify/reporter-core'
import { readHistory } from '../history'
import { defaultStatsPath, readHealStats, type HealStats } from './heal'

/**
 * `healify dashboard --serve` — el mismo dashboard de `healify dashboard` pero sobre un
 * servidor local, con las estadísticas de `~/.healify/stats.json` y los selectores
 * de `.healify/history.jsonl`. Sirve la UI React (`dashboard-web/dist`) y una API JSON.
 *
 * La lógica pura (agrupar, calcular timelines, resolver la UI) vive acá, testeable sin
 * servidor; el `app.listen` es lo único que toca la red. Separado de `dashboard.ts`
 * (que sigue generando el HTML offline) — patrón `commands/heal.ts`.
 */

export const DASHBOARD_DEFAULT_PORT = 5173

export interface SelectorSummary {
  id: string
  selector: string
  testFile: string | null
  type: string
  failCount: number
  lastSuggestion: string | null
  lastHealed: string | null
  firstSeen: string
  lastSeen: string
  chronic: boolean
}

export interface SelectorSuggestion {
  timestamp: string
  testFile: string | null
  testName: string | null
  status: 'healed' | 'review' | 'unresolved'
  fixedSelector: string | null
  confidence: number | null
  verified: boolean | null
  cause: string | null
}

export interface SelectorDetail extends SelectorSummary {
  suggestions: SelectorSuggestion[]
  timeline: TimelinePoint[]
}

export interface StatsOverview {
  totalAnalyzed: number
  healed: number
  failed: number
  byType: Record<string, number>
  avgHealingMs: number
  totalHealingMs: number
  healRate: number
  history: {
    total: number
    healed: number
    review: number
    unresolved: number
    healedRate: number
    firstSeen: string | null
    lastSeen: string | null
    timeline: TimelinePoint[]
  }
}

/** Clave canónica de agrupación: archivo + selector, la misma que usa computeChronic. */
function selectorKey(entry: Pick<HistoryEntry, 'testFile' | 'selector'>): string {
  return `${entry.testFile ?? ''}\u0000${entry.selector}`
}

/** Id estable para la API: sha256(testFile+selector). Determinista, no depende del orden. */
export function selectorId(entry: Pick<HistoryEntry, 'testFile' | 'selector'>): string {
  return createHash('sha256').update(selectorKey(entry)).digest('hex')
}

function selectorTypeOf(entries: HistoryEntry[]): string {
  for (let i = entries.length - 1; i >= 0; i--) {
    const type = entries[i].selectorType
    if (type) return type.toLowerCase()
  }
  return 'unknown'
}

function statusOf(status: string): 'healed' | 'review' | 'unresolved' {
  if (status === 'healed' || status === 'review' || status === 'unresolved') return status
  return 'unresolved'
}

/** Agrupa por archivo+selector y calcula el resumen de cada uno, ordenado por roturas desc. */
export function buildSelectorSummaries(entries: HistoryEntry[]): SelectorSummary[] {
  const byKey = new Map<string, HistoryEntry[]>()
  for (const e of entries) {
    const key = selectorKey(e)
    const list = byKey.get(key)
    if (list) list.push(e)
    else byKey.set(key, [e])
  }

  const summaries: SelectorSummary[] = []
  for (const [key, list] of byKey) {
    const sorted = [...list].sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    const first = sorted[0]
    const last = sorted[sorted.length - 1]
    const lastHealed = [...sorted].reverse().find((e) => e.status === 'healed')?.timestamp ?? null
    const lastSuggestion = [...sorted].reverse().find((e) => e.fixedSelector)?.fixedSelector ?? null

    summaries.push({
      id: selectorId(first),
      selector: first.selector,
      testFile: first.testFile ?? null,
      type: selectorTypeOf(sorted),
      failCount: list.length,
      lastSuggestion,
      lastHealed,
      firstSeen: first.timestamp,
      lastSeen: last.timestamp,
      chronic: list.length >= 3,
    })
  }

  return summaries.sort((a, b) => b.failCount - a.failCount || a.selector.localeCompare(b.selector))
}

function timelinePerSelector(entries: HistoryEntry[]): TimelinePoint[] {
  return buildDashboardStats(entries).timeline
}

/** Detalle de un selector por id. undefined si no existe. */
export function buildSelectorDetail(entries: HistoryEntry[], id: string): SelectorDetail | undefined {
  const summaries = buildSelectorSummaries(entries)
  const summary = summaries.find((s) => s.id === id)
  if (!summary) return undefined

  const mine = entries.filter((e) => selectorId(e) === id).sort((a, b) => a.timestamp.localeCompare(b.timestamp))
  const suggestions: SelectorSuggestion[] = mine.map((e) => ({
    timestamp: e.timestamp,
    testFile: e.testFile ?? null,
    testName: e.testName ?? null,
    status: statusOf(e.status),
    fixedSelector: e.fixedSelector ?? null,
    confidence: typeof e.confidence === 'number' ? e.confidence : null,
    verified: typeof e.verified === 'boolean' ? e.verified : null,
    cause: e.cause ?? null,
  }))

  return { ...summary, suggestions, timeline: timelinePerSelector(mine) }
}

/** Vistazo general: stats.json + resumen del histórico de history.jsonl. */
export function buildStatsOverview(healStats: HealStats, entries: HistoryEntry[]): StatsOverview {
  const history = buildDashboardStats(entries)
  return {
    totalAnalyzed: healStats.totalAnalyzed,
    healed: healStats.healed,
    failed: healStats.failed,
    byType: healStats.byType,
    avgHealingMs: healStats.avgHealingMs,
    totalHealingMs: healStats.totalHealingMs,
    healRate: healStats.totalAnalyzed > 0 ? healStats.healed / healStats.totalAnalyzed : 0,
    history: {
      total: history.total,
      healed: history.healed,
      review: history.review,
      unresolved: history.unresolved,
      healedRate: history.healedRate,
      firstSeen: history.firstSeen,
      lastSeen: history.lastSeen,
      timeline: history.timeline,
    },
  }
}

export interface DashboardAppOptions {
  /** cwd donde leer `.healify/history.jsonl`. Default: process.cwd(). */
  cwd?: string
  /** ruta de `stats.json`. Default: `~/.healify/stats.json`. */
  statsPath?: string
  /** carpeta de la UI compilada (dashboard-web/dist). `null` fuerza API-solo. */
  uiDir?: string | null
}

/** Resuelve la carpeta de la UI: env, cwd o relativa al paquete del CLI. null si no existe. */
export function resolveUiDir(cwd: string): string | null {
  const candidates = [
    process.env.HEALIFY_DASHBOARD_WEB_DIST,
    join(cwd, 'dashboard-web', 'dist'),
    join(__dirname, '..', '..', 'dashboard-web', 'dist'),
  ].filter((p): p is string => typeof p === 'string' && p.length > 0)

  for (const candidate of candidates) {
    if (existsSync(join(candidate, 'index.html'))) return candidate
  }
  return null
}

const FALLBACK_HTML = `<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><title>Healify — Dashboard</title></head>
<body style="font-family:system-ui;background:#0A0A0A;color:#EDEDED;padding:40px;line-height:1.6">
  <h1>Healify — Dashboard</h1>
  <p>No se encontró la UI compilada (dashboard-web/dist). La API del dashboard sigue disponible:</p>
  <ul>
    <li><a href="/api/stats">/api/stats</a></li>
    <li><a href="/api/selectors">/api/selectors</a></li>
    <li><a href="/api/selectors/&lt;id&gt;">/api/selectors/&lt;id&gt;</a></li>
  </ul>
  <p>Para levantar la UI: <code>npm run build</code> en <code>dashboard-web/</code> y volvé a correr este comando.</p>
</body>
</html>`

/** App Express del dashboard. Inyectable en tests sin abrir un puerto de verdad. */
export function createDashboardApp(options: DashboardAppOptions = {}): Express {
  const cwd = options.cwd ?? process.cwd()
  const statsPath = options.statsPath ?? defaultStatsPath()
  const uiDir = options.uiDir !== undefined ? options.uiDir : resolveUiDir(cwd)

  const app = express()
  app.use(cors())

  app.get('/api/stats', (_req: Request, res: Response) => {
    res.json(buildStatsOverview(readHealStats(statsPath), readHistory(cwd)))
  })

  app.get('/api/selectors', (_req: Request, res: Response) => {
    res.json(buildSelectorSummaries(readHistory(cwd)))
  })

  app.get('/api/selectors/:id', (req: Request, res: Response) => {
    const detail = buildSelectorDetail(readHistory(cwd), req.params.id)
    if (!detail) {
      res.status(404).json({ error: 'selector not found' })
      return
    }
    res.json(detail)
  })

  if (uiDir) {
    app.use(express.static(uiDir))
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(join(uiDir, 'index.html'))
    })
  } else {
    app.get('/', (_req: Request, res: Response) => {
      res.type('html').send(FALLBACK_HTML)
    })
  }

  return app
}

export interface DashboardServeResult {
  ok: boolean
  port?: number
  url?: string
  lines: string[]
  /** Cierra el servidor y resuelve cuando terminó. Solo cuando ok. */
  close?: () => Promise<void>
}

/** `healify dashboard --serve` — levanta el servidor, imprime la URL y queda escuchando.
 *  El proceso vive hasta que `close()` se llame (Ctrl+C lo cierra desde index.ts).
 *  Si el puerto está ocupado, prueba los siguientes (hasta MAX_PORT_RETRIES).
 *  --port 0 deja que el SO asigne un puerto efímero (sin retry). */
const MAX_PORT_RETRIES = 10

export function runDashboardServe(args: string[], cwd: string = process.cwd()): Promise<DashboardServeResult> {
  const portIndex = args.indexOf('--port')
  const portArg = portIndex >= 0 ? Number(args[portIndex + 1]) : NaN
  const requestedPort = Number.isInteger(portArg) && portArg > 0 ? portArg : DASHBOARD_DEFAULT_PORT
  const shouldOpen = args.includes('--open')

  return new Promise((resolve) => {
    const app = createDashboardApp({ cwd })

    let currentPort = requestedPort
    let attempt = 0

    const tryListen = () => {
      const server = app.listen(currentPort, '127.0.0.1', () => {
        const address = server.address()
        const actualPort = typeof address === 'object' && address ? address.port : currentPort
        const url = `http://127.0.0.1:${actualPort}`
        if (shouldOpen) open(url).catch(() => {})
        resolve({
          ok: true,
          port: actualPort,
          url,
          lines: [
            `Dashboard corriendo en ${url} — Ctrl+C para salir.`,
            `  API:  ${url}/api/stats · ${url}/api/selectors`,
            '  100% local: stats.json + history.jsonl, nada sale de la máquina.',
          ],
          close: () =>
            new Promise<void>((res) => {
              server.close(() => res())
            }),
        })
      })

      server.on('error', (err) => {
        const isAddrInUse = (err as NodeJS.ErrnoException).code === 'EADDRINUSE'
        if (isAddrInUse && requestedPort !== 0 && attempt < MAX_PORT_RETRIES - 1) {
          currentPort++
          attempt++
          tryListen()
          return
        }
        const detail = err instanceof Error ? err.message : String(err)
        resolve({
          ok: false,
          lines: [`No se pudo encontrar un puerto libre (intentados ${attempt + 1}): ${detail}`],
        })
      })
    }

    tryListen()
  })
}