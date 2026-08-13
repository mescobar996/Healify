import { existsSync } from 'node:fs'
import { join } from 'node:path'
import express, { type Express, type Request, type Response } from 'express'

/**
 * Servir la UI del dashboard: la compilada de `dashboard-web/dist` cuando existe, o un
 * fallback con la API desnuda (la UI React es opcional; el servidor responde igual).
 */

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

/** Registra el estático (o el fallback) en la app. `uiDir` null = API-solo con fallback. */
export function registerUi(app: Express, uiDir: string | null): void {
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
}
