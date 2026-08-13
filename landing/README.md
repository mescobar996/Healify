# Landing de Healify

Landing estática (HTML/CSS/JS puro, sin build, sin framework) para
[healify-sigma.vercel.app](https://healify-sigma.vercel.app).

Diseño minimalista: gradiente verde-cian-azul sutil, glassmorphism ligero
(`backdrop-filter: blur(8px)`), CTA ámbar de contraste, secciones con aire generoso
(py-24). Sin dependencias externas: cero CDN, fuentes locales.

## Archivos

- `index.html` — landing en inglés; `es/index.html` — versión en español (misma estructura).
- `public/logos/` — logos oficiales de las tecnologías soportadas:
  - `playwright.svg` (descargado de playwright.dev), `selenium.png` y `webdriverio.png`
    (oficiales), `python.png` (python.org), `dotnet.svg` (Wikimedia, .NET Core).
  - `cypress.svg` y `java.svg` — extraídos de los SVGs oficiales que ya estaban embebidos
    en la versión anterior de la landing (path data auténtico).
- `healify-mark.png` — el logo (nav, favicon y OG image).
- `report-screenshot.png` — captura del dashboard local de Healify (vitals + 🔥 Selectores
  Crónicos), generada con Playwright desde `scripts/dashboard-preview.html`. Se usa en los
  README del repo; la landing usa las capturas de abajo.
- `dashboard-overview.png`, `dashboard-efficacy.png`, `dashboard-chronic.png` — capturas
  reales del dashboard servido con `healify dashboard --serve` (vistas Resumen, Eficacia y
  Crónicos), usadas en el carrusel de la landing.

## Interacciones (sin CDN, JS vanilla)

- **Selector de framework**: los logos de la sección "Funciona con" son botones; el clic
  actualiza un mini terminal con Install/Run/Fix por framework y un tooltip aparece al
  hover (oculto en táctil, donde el clic abre el terminal).
- **Carrusel del dashboard**: prev/next + dots, `aria-hidden` por slide.
- Los comandos mostrados son reales (`@healify/*` publicados, `healify fix`,
  `healify probe-script`, `healify heal`).

## Desplegar en Vercel

El proyecto Vercel dedicado es **`landing`** (producción: `landing-delta-seven-78.vercel.app`,
canónico de la página: `healify-sigma.vercel.app`). El link local ya apunta a `landing`
(`.vercel/project.json`), sin build command (estático — `vercel.json` fija `"framework": null`
para anular cualquier preset del proyecto). Desde la CLI:

```bash
cd landing
vercel --prod
```

> ⚠️ El proyecto `healify` es OTRO (framework Next.js) — no desplegar la landing ahí.
> Si el dominio canónico da 404 o muestra "Login - Vercel", revisá en el dashboard:
> Settings → Deployment Protection (desactivar para production) y Settings → Domains.

## Qué revisar antes de publicar

La landing NO menciona el modo cloud viejo (API key, servidor) porque ya no existe. Si
editás el copy, mantené esa línea: nada de features que la herramienta no tiene.

Los números del footer (`1153 tests`) son reales del repo: si cambian, actualizalos en ambas
versiones (`index.html` y `es/index.html`).

## Pendiente documentado

- **GIF/video del CLI funcionando** (asciinema o similar): todavía no existe. Hoy el hero
  muestra una terminal estática de ejemplo; cuando se grabe un demo animado, sumalo como
  `cli-demo.gif` y reemplazá (o acompañá) la terminal del hero.
