# Healify — Diseño de la Experiencia de Primer Uso (`healify init`)

Fecha: 2026-08-13 · Autor: flujo Spec Kit 003 · Estado: Diseño aprobado para implementación

## 1. Análisis del estado actual (Fase 1)

### Qué hace hoy `healify init`

- Detecta frameworks (dependencias en package.json + archivos de config) — `cli/src/detect.ts`.
- Instala el paquete de Healify que falte (npm/yarn/pnpm) — `installPackage`.
- Configura sin intervención: CASO A (nada detectado → pregunta y scaffoldea), CASO B
  (framework sin config → scaffoldea config), CASO C (config existente → inyecta marcador
  idempotente) — `cli/src/commands/init.ts`.
- Chequea el puerto de baseURL (informativo, no bloquea).
- Imprime un reporte técnico por framework + snippet de test para copiar a mano.

### Fricciones (verificadas corriendo el binario real)

| # | Fricción | Evidencia |
|---|---|---|
| F1 | Output sin narrativa: no hay "paso 1/2/3" ni estado de progreso | dump de ✅/❌ sueltos |
| F2 | No queda un "siguiente paso" único y accionable | el snippet pide copiar y editar un archivo |
| F3 | No añade scripts npm (`healify`, `healify:dashboard`) | package.json intacto tras init |
| F4 | No cierra con verificación de salud (`healify doctor`) | hay que descubrir el comando solo |
| F5 | No sugiere el dashboard al terminar | cero mención de `dashboard --serve` |
| F6 | Multi-framework: instala todo lo detectado sin explicar el plan | sin resumen previo |

### Regla de oro (no negociable, CLAUDE.md/constitución)

> **"Cero Inventos: `init` NUNCA genera tests de prueba ni selectores falsos. Solo configura."**

El "modo demo con test de ejemplo" del brief original queda **fuera de alcance**: contradice
la regla más estricta del proyecto y la promesa pública ("Healify no te genera tests").
La alternativa honesta (implementada abajo): verificación instantánea con `healify doctor`
+ siguiente paso real contra los tests **que el usuario ya tiene**.

### Benchmark (lecciones, sin copiar nada)

| Herramienta | Qué hace bien | Qué no |
|---|---|---|
| `npm init playwright` | wizard con detección, genera config + ejemplo ejecutable, instala browsers | muchas preguntas |
| `npx cypress open` | ejemplo visual inmediato | pesado, descarga binario |
| `npx storybook init` | autodetección + stories ejemplo + resumen final | lento |
| `npm create vite` | 3 preguntas, respuesta instantánea | genérico |

Lecciones aplicables: detección sin preguntas (✅ ya la tenemos), salida narrativa por pasos,
resumen final "estás listo", un solo siguiente paso, verificación de salud al cierre.

## 2. Momentos mágicos (objetivo: ≤ 2 minutos a valor)

1. **"Ya sé qué usás"** — detección explícita: "Detectamos Playwright (`@playwright/test` +
   `playwright.config.ts`)". Nunca pregunta lo que puede saber.
2. **"Quedó todo conectado"** — instalación + config sin intervención, contadas como pasos.
3. **"Tu proyecto, tus comandos"** — scripts npm idempotentes:
   `healify` (`healify fix`), `healify:dry` (`healify fix --dry-run`),
   `healify:dashboard` (`healify dashboard --serve`).
4. **"Chequeo de salud al instante"** — al terminar, `init` corre `healify doctor` y muestra
   el veredicto completo (verde = todo conectado).
5. **"El dashboard te espera"** — cierre con el siguiente paso único:
   corré tus tests → `npm run healify` cuando algo se rompa → `npm run healify:dashboard`.

## 3. Flujo de interacción (mock del CLI, tal como lo verá el usuario)

```text
$ npx @healify/cli init

  Healify init — dejemos todo listo para tu primera curación.

  1/4  Detectando tu framework de tests…
       ✔ Playwright — @playwright/test + playwright.config.ts

  2/4  Instalando lo que falta…
       ✔ @healify/test-runner instalado

  3/4  Conectando Healify…
       ✔ playwright.config.ts actualizado (reporter listo)

  4/4  Scripts en tu package.json…
       ✔ "healify": "healify fix"
       ✔ "healify:dry": "healify fix --dry-run"
       ✔ "healify:dashboard": "healify dashboard --serve"

  Verificación instantánea (healify doctor):
  ✔ @healify/test-runner instalado
  ✔ playwright.config.ts configurado con Healify
  ✔ package.json con scripts de Healify

  🎉 Listo. Tu primer "momento Healify" es así:

     1. Corré tus tests (los tuyos — Healify no te genera tests).
     2. Cuando un selector se rompa, corré:  npm run healify
     3. Mirá lo que pasó:                   npm run healify:dashboard

  Tu primer fix real está a una corrida de distancia.
```

Flujos especiales (mismos pasos, textos distintos):

- **Sin framework detectado** (CASO A): "No detectamos ningún framework de e2e. Te armamos
  Playwright desde cero: config + paquete." (pregunta interactiva cuando hay TTY; default
  Playwright en no interactivo — comportamiento actual, sin cambios).
- **Selenium/WebdriverIO**: "no hay config que inyectar — dejamos el archivo de patrón para
  copiar a tu código real" (sin snippet de test, con referencia al ejemplo scaffolded).
- **Instalación fallida**: "❌ no pudimos instalar X — instalalo a mano: <comando>".
- **`--dry-run` (nuevo)**: muestra qué haría sin tocar nada. Útil para CI y para no asustar.

## 4. Cambios técnicos

| Archivo | Cambio |
|---|---|
| `cli/src/commands/init.ts` | + `addNpmScripts(cwd)`: añade los 3 scripts si faltan, idempotente, no toca scripts existentes, preserva formato JSON; exponer `scriptsAdded: string[]` y `detected: { framework, evidence }` en el reporte. + flag `--dry-run` (opts, sin side effects). |
| `cli/src/index.ts` | `printInitReport` rediseñado (pasos 1-4 + doctor al final). `runInit` parsea `--dry-run`. |
| `cli/src/__tests__/init.test.ts` | tests de `addNpmScripts` (añade, no pisa, sin package.json, dry-run no escribe). |
| `cli/src/__tests__/index.test.ts` | tests del output nuevo (pasos, doctor al final, dry-run). |
| `README.md` / `README.es.md` / `cli/README.md` (npm) | sección "Primer uso en 2 minutos" con el nuevo flujo. |
| `CHANGELOG.md` | entrada 2.8.0. |

Sin dependencias nuevas. Sin cambios en la API de `init()` (solo añade campos al reporte).

## 5. KPIs y métricas

- **Tiempo a valor**: init completo ≤ 60s (instalación dominante) + 1 corrida de tests del
  usuario = primer fix en < 2 min (midiendo: `doctor` verde al cierre como proxy verificable).
- **Tasa de finalización**: `init --dry-run` permite medir el flujo sin instalar; el reporte
  termina siempre con el mismo cierre accionable (sin puntos muertos).
- **Honestidad**: el output sigue sin prometer nada que Healify no haga — nada de tests
  inventados, nada de "IA", nada de nube.

## 6. Fuera de alcance (v1 del onboarding)

- Test de ejemplo generado por init (regla "cero inventos").
- GIF/video del flujo (queda en `landing/README.md` como pendiente; se puede grabar con
  asciinema después del lanzamiento).
- Detección de Vitest/Jest como framework de e2e (no aplican: no generan el reporte de
  Playwright/Cypress/Selenium que Healify consume).
