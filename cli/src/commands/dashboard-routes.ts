import type { Express, Request, Response } from 'express'
import { readHistory } from '../history'
import { readHealStats } from './heal'
import { buildSelectorDetail, buildSelectorSummaries, buildStatsOverview } from './dashboard-data'

/**
 * Rutas de la API JSON del dashboard, servidas desde los datos locales:
 * stats.json (`~/.healify/stats.json`) + history.jsonl (`.healify/history.jsonl`).
 */
export function registerApiRoutes(app: Express, cwd: string, statsPath: string): void {
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
}
