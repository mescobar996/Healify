# AGENTS.md — Healify

Healify es una monorepo npm (workspaces) en TypeScript que sana selectores de test rotos, 100% local.

## Datos verificados

- Version actual: 2.2.0 (Latest) — 757 tests passing, 60 archivos de test
- 7 paquetes publicados (todos `publishConfig: { access: "public" }`): reporter-core, test-runner, cypress-plugin, selenium-plugin, webdriverio-plugin, ai-local, cli
- Requiere Node >= 18.0.0 (.nvmrc / .node-version: 20.18.0)
- Autor: Matías Escobar (Rosario, Argentina) · Licencia MIT

## Comandos

- Tests: 538 en total (reporter-core 220, cypress 18, selenium 19, webdriverio 181, cli 46, ai-local 35, test-runner 19)
- Build/format/lint: ver package.json raíz (cada paquete define los suyos)

## Convenciones

- NO usar `git add -A`; stage dirigido de archivos
- No inventar features ni comandos que no existan en `cli/src/index.ts`
- `landing/` es estática (HTML/CSS/JS inline, dark, negro/violeta #8B5CF6); se despliega en Vercel (proyecto `healify`, `vercel.json` fuerza framework estático + headers de seguridad)
- Sitio live: https://healify-sigma.vercel.app
