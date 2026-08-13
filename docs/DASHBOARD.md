# Dashboard de Healify

Healify tiene dos formas de ver el histórico de curaciones:

1. **HTML offline** — `healify dashboard` genera `healify-dashboard.html` (misma estética que `healify-report.html`, 100% sin servidor). Es la que existe desde siempre.
2. **Servidor local con UI React** — `healify dashboard --serve` levanta un servidor Express en `http://127.0.0.1:5173` que sirve la app `dashboard-web/` y una API JSON. Es lo que se describe acá.

## Uso

```bash
healify dashboard --serve                 # puerto 5173 por defecto
healify dashboard --serve --port 8080     # otro puerto
healify dashboard --serve --open          # abre el navegador automáticamente
```

Flags:

- `--serve` — levanta el servidor en lugar de generar el HTML.
- `--port <n>` — puerto (default `5173`).
- `--open` — abre el navegador al arrancar.
- Ctrl+C cierra el servidor.

## Datos que muestra

Todo es 100% local, nada sale de la máquina:

| Fuente | Qué aporta |
| --- | --- |
| `~/.healify/stats.json` | Agregados acumulados de `healify heal`: total analizados, curados, fallas, por tipo, tiempo medio. |
| `.healify/history.jsonl` | Por selector: roturas, última sugerencia, última cura, primera/última aparición, si es crónico (3+ roturas), historial y tendencia. |

## Secciones de la UI

- **Resumen** (`/`) — tarjetas de stats.json, eficacia resumida y curaciones por día.
- **Selectores** (`/selectors`) — lista agregada por archivo+selector, ordenada por roturas.
- **🔥 Crónicos** (`/chronic`) — selectores con 3+ roturas.
- **🎯 Eficacia** (`/efficacy`) — aceptados vs rechazados vs sin confirmar (`healify confirm`),
  tasa por framework, tendencia de 7/30 días y desglose por causa de fallo. Todo agregado
  server-side; la entrada histórica sin `framework` se agrupa en "unknown".

## API JSON

El servidor expone tres endpoints:

```
GET /api/stats              → resumen: stats.json + resumen del histórico (incluye timeline y efficacyReport)
GET /api/selectors          → lista de selectores agregada, ordenada por roturas
GET /api/selectors/:id      → detalle de un selector (historial + tendencia)
```

`/api/stats` acepta `?efficacy-window=7|30` para ajustar la ventana de la tendencia de eficacia
(default 30; cualquier otro valor cae al default).

Ejemplos:

```bash
curl http://127.0.0.1:5173/api/stats
curl "http://127.0.0.1:5173/api/stats?efficacy-window=7"
curl http://127.0.0.1:5173/api/selectors
curl http://127.0.0.1:5173/api/selectors/<sha256>
```

`id` es `sha256(testFile + selector)` — estable entre corridas. Un selector desconocido responde `404`.

## UI (`dashboard-web/`)

Es una app Vite + React + TypeScript separada:

```bash
cd dashboard-web
npm install
npm run build     # → dashboard-web/dist
```

El servidor sirve `dashboard-web/dist` cuando existe. Sin la UI compilada, `--serve` igual responde la API y una página de fallback con links a los endpoints — el servidor nunca deja de servir datos por falta de UI.

La carpeta `dashboard-web` no depende de ningún otro workspace: `reporter-core` y `ai-local` no entran acá, el contrato es la API JSON de arriba.

## Tests

```bash
npm test --workspace=cli          # tests del servidor y la lógica de agregación
npm test --workspace=dashboard-web # tests de los componentes React
```
