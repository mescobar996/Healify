# Landing de Healify

Landing estática (HTML/CSS/JS puro, sin build, sin framework) para
[healify-sigma.vercel.app](https://healify-sigma.vercel.app).

Diseño hecho con Claude Design y traducido a HTML/CSS/JS vanilla para que sea desplegable
como sitio estático (el formato original de Claude Design depende de un runtime propietario
que no corre en Vercel). Hereda el sistema de diseño del reporte HTML de la herramienta:
negro/violeta (`#8B5CF6`), tipografía system + JetBrains Mono, dark por defecto con toggle
a claro.

## Archivos

- `index.html` — la landing completa (autocontenida: CSS y JS inline, cero dependencias
  salvo Google Fonts, que degrada a monospace del sistema si no carga).
- `healify-mark.png` — el logo (usado en el nav y como favicon).
- `report-screenshot.png` — **falta**: un screenshot real de `healify-report.html`. Mientras
  no exista, la landing muestra un placeholder con link al reporte de ejemplo. Generá el
  screenshot y guardalo acá con ese nombre exacto.

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
