import express, { type Express } from 'express'
import { defaultStatsPath } from './heal'
import { applyDashboardMiddleware } from './dashboard-middleware'
import { registerApiRoutes } from './dashboard-routes'
import { registerUi, resolveUiDir } from './dashboard-static'

export interface DashboardAppOptions {
  /** cwd donde leer `.healify/history.jsonl`. Default: process.cwd(). */
  cwd?: string
  /** ruta de `stats.json`. Default: `~/.healify/stats.json`. */
  statsPath?: string
  /** carpeta de la UI compilada (dashboard-web/dist). `null` fuerza API-solo. */
  uiDir?: string | null
}

/** App Express del dashboard. Inyectable en tests sin abrir un puerto de verdad. */
export function createDashboardApp(options: DashboardAppOptions = {}): Express {
  const cwd = options.cwd ?? process.cwd()
  const statsPath = options.statsPath ?? defaultStatsPath()
  const uiDir = options.uiDir !== undefined ? options.uiDir : resolveUiDir(cwd)

  const app = express()
  applyDashboardMiddleware(app)
  registerApiRoutes(app, cwd, statsPath)
  registerUi(app, uiDir)

  return app
}
