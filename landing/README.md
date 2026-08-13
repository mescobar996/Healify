# Landing de Healify

Landing estática (HTML/CSS/JS puro, sin build, sin framework) para
[healify-sigma.vercel.app](https://healify-sigma.vercel.app).

Diseño hecho con Claude Design y traducido a HTML/CSS/JS vanilla para que sea desplegable
como sitio estático (el formato original de Claude Design depende de un runtime propietario
que no corre en Vercel). Hereda el sistema de diseño del reporte HTML de la herramienta:
negro/violeta (`#8B5CF6`), tipografía system + JetBrains Mono, dark por defecto con toggle
a claro.

## Archivos

- `index.html` — la landing completa (CSS y JS inline; las secciones de estadísticas y el
  preview del dashboard usan Tailwind + Alpine por CDN, con CSS propio de respaldo si el CDN
  no carga).
- `es/index.html` — versión en español (misma estructura).
- `healify-mark.png` — el logo (usado en el nav y como favicon).
- `report-screenshot.png` — captura del dashboard local de Healify (vitals + 🔥 Selectores
  Crónicos), generada con Playwright a partir de un mockup fiel al diseño real. Se muestra
  en la sección "El dashboard" de `index.html` y `es/index.html`. Regenerala si cambia el
  diseño del dashboard: el mockup fuente vive en `scripts/dashboard-preview.html` (sin
  build, se abre y se captura el `.sheet`).

## Desplegar en Vercel

El proyecto Vercel `healify` ya existe. Apuntá su **Root Directory** a `landing` (Project
Settings → General → Root Directory → `landing`), sin build command (es estático). O desde
la CLI:

```bash
cd landing
vercel --prod
```

## Qué revisar antes de publicar

La landing NO menciona el modo cloud viejo (API key, servidor) porque ya no existe. Si
editás el copy, mantené esa línea: nada de features que la herramienta no tiene.

Los números de la sección de estadísticas y el footer (`1113 tests`, cobertura) son reales
del repo: si cambian, actualizalos también en `healifyStats()` y en el footer de ambas
versiones (`index.html` y `es/index.html`).
