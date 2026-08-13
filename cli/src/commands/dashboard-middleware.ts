import cors from 'cors'
import type { Express } from 'express'

/**
 * Middleware compartido del dashboard. Hoy es CORS para que el dev server de dashboard-web
 * (vite, otro puerto) pueda llamar a la API; el punto único acá es que cualquier middleware
 * nuevo (logging, rate-limit, headers) se agregue en un solo lugar.
 */
export function applyDashboardMiddleware(app: Express): void {
  app.use(cors())
}
