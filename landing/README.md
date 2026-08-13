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
  Crónicos), generada con Playwright desde `scripts/dashboard-preview.html`.

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

Los números del footer (`1113 tests`) son reales del repo: si cambian, actualizalos en ambas
versiones (`index.html` y `es/index.html`).

## Pendiente documentado

- **GIF/video del CLI funcionando** (asciinema o similar): todavía no existe. Hoy el hero
  muestra una terminal estática de ejemplo; cuando se grabe un demo animado, sumalo como
  `cli-demo.gif` y reemplazá (o acompañá) la terminal del hero.
