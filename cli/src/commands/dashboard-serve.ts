import open from 'open'
import { createDashboardApp } from './dashboard-app'

export { createDashboardApp, type DashboardAppOptions } from './dashboard-app'
export { resolveUiDir } from './dashboard-static'
export {
  selectorId,
  buildSelectorSummaries,
  buildSelectorDetail,
  buildStatsOverview,
  type SelectorSummary,
  type SelectorSuggestion,
  type SelectorDetail,
  type StatsOverview,
} from './dashboard-data'

/**
 * `healify dashboard --serve` — el mismo dashboard de `healify dashboard` pero sobre un
 * servidor local, con las estadísticas de `~/.healify/stats.json` y los selectores
 * de `.healify/history.jsonl`. Sirve la UI React (`dashboard-web/dist`) y una API JSON.
 *
 * La lógica pura (agrupar, calcular timelines, resolver la UI) vive en dashboard-data.ts /
 * dashboard-app.ts, testeable sin servidor; el `app.listen` es lo único que toca la red.
 * Separado de `dashboard.ts` (que sigue generando el HTML offline) — patrón `commands/heal.ts`.
 */

export const DASHBOARD_DEFAULT_PORT = 5173

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

/** Levanta el servidor local del dashboard (UI estática + API JSON). Resuelve con el resultado o un close(). */
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
        const isAddrInUse = 'code' in err && err.code === 'EADDRINUSE'
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
