# Manual de Healify

Guía de punta a punta: qué es, cómo instalarlo, cómo funciona el motor por dentro, y cómo
resolver los problemas más comunes. Para referencia rápida de API de cada paquete, ver su
propio README (linkeados abajo) — esta guía es el recorrido completo, no un índice de API.

## Índice

1. [Qué es y qué no es Healify](#qué-es-y-qué-no-es-healify)
2. [Instalación por paquete](#instalación-por-paquete)
3. [Cómo funciona el motor heurístico](#cómo-funciona-el-motor-heurístico)
4. [El reporte HTML](#el-reporte-html)
5. [Cerrar el loop: aplicar sugerencias con `cli`](#cerrar-el-loop-aplicar-sugerencias-con-cli)
6. [Arquitectura del monorepo](#arquitectura-del-monorepo)
7. [Troubleshooting](#troubleshooting)

---

## Qué es y qué no es Healify

Healify corre junto a tus tests de Playwright, Cypress o Selenium. Cuando un test falla
porque un selector ya no encuentra el elemento en la página, Healify:

1. Extrae el selector que falló del mensaje de error.
2. Le aplica una heurística de **pattern-matching sobre el texto del selector** —
   reconoce IDs/clases generadas dinámicamente, atributos estables (`data-testid`,
   `aria-label`, `name`), locators modernos de Playwright, y diccionarios de
   acciones/campos en español e inglés.
3. Propone un selector alternativo con un puntaje de confianza (0–100%).

**Qué NO es:**

- **No es IA.** No hay modelo, no hay inferencia, no hay llamada a ningún servicio de
  lenguaje. Es una función determinística: mismo selector de entrada → misma sugerencia
  de salida, siempre.
- **No analiza el DOM en tiempo real.** El motor nunca abre un browser ni inspecciona el
  árbol de la página — decide todo por el texto del selector que falló. Esto es una
  limitación real y deliberada, no un detalle de implementación a esconder.
- **No tiene memoria entre tests.** Cada caso se evalúa aislado; no aprende de selectores
  que ya funcionaron en otros tests del mismo proyecto.
- **No hay servidor, no hay cuenta, no hay red.** Todo corre en el mismo proceso que tus
  tests. El código fuente del motor está en
  [`reporter-core/src/healing-engine.ts`](../../reporter-core/src/healing-engine.ts) —
  auditable, no una caja negra.

Si necesitás que Healify sepa cosas que no puede saber sin mirar el DOM real (por
ejemplo, "¿qué atributo estable tiene el elemento que reemplazó a este botón?"), la
heurística no te va a dar una respuesta mágica — te va a decir honestamente que no tiene
una sugerencia confiable, en vez de inventar una.

## Instalación por paquete

| Framework | Paquete | Instalación | Guía completa |
|---|---|---|---|
| Playwright | `@healify/test-runner` | `npm install --save-dev @healify/test-runner` | [README](../../test-runner/README.md) |
| Cypress | `@healify/cypress-plugin` | `npm install --save-dev @healify/cypress-plugin` | [README](../../cypress-plugin/README.md) |
| Selenium | `@healify/selenium-plugin` | `npm install --save-dev @healify/selenium-plugin selenium-webdriver` | [README](../../selenium-plugin/README.md) |
| — | `@healify/cli` | `npm install --save-dev @healify/cli` | [README](../../cli/README.md) |

Playwright y Cypress generan un reporte (`healify-report.html`/`.json`) al final de la
corrida. Selenium no tiene un hook de "fin de corrida" nativo, así que
`@healify/selenium-plugin` cura selectores **en vivo**, sin generar reporte — ver su
README para el detalle y las limitaciones específicas de ese modo.

## Cómo funciona el motor heurístico

Todo vive en `reporter-core/src/healing-engine.ts`, compartido por los cuatro paquetes.
Reglas, en el orden en que se evalúan:

| Patrón detectado | Ejemplo | Sugerencia |
|---|---|---|
| ID con dígitos o sufijo hexadecimal | `#user-a1b2c3` | Clase derivada del mismo nombre, sin el sufijo dinámico |
| Clase de CSS-modules o styled-components | `.btn_a1b2`, `.sc-x7f2` | Selector semántico alternativo (rol, texto, `data-testid`) |
| `data-testid` / `data-cy` | `[data-testid="x"]` | Se conserva y normaliza — el candidato de mayor confianza |
| XPath | `//div[3]/button` | Reemplazado por un selector de rol ARIA (XPath es el tipo más frágil) |
| `[name=]` / `[aria-label=]` | `[name="email"]` | Se conserva tal cual — ya son atributos razonablemente estables |
| Locator moderno de Playwright | `getByRole(...)`, `getByText(...)` | No se toca — se marca para revisión manual, sin DOM no se puede saber por qué dejó de matchear |

Para botones/inputs/links detectados por patrones en el texto del selector (`button`,
`input`, `login`, etc.), el motor arma la sugerencia con **diccionarios bilingües**
(`ACTIONS`/`FIELDS` en `healing-engine.ts`): `login`→`Login`/`Iniciar Sesión`,
`email`→`Email`/`Correo`, `guardar`→`Guardar`, etc.

**Confianza:** cada estrategia tiene un puntaje base, ajustado de forma determinística
(no aleatoria) por un hash del selector — mismo input, mismo resultado siempre. El
resultado final queda acotado entre 75% y 98%.

**Umbrales** (definidos en `reporter-core/src/local-mode.ts`):

| Confianza | Estado | Qué significa |
|---|---|---|
| ≥ 90% | `healed` | Auto-aplicable sin revisión — es lo que usa `@healify/cli fix` |
| 80–90% | `review` | Se muestra en el reporte, pero requiere que lo confirmes vos |
| < 80% | `unresolved` | Sin sugerencia — el motor prefiere no arriesgarse |

## El reporte HTML

`healify-report.html` (generado por `test-runner`/`cypress-plugin`) tiene dos secciones:

- **"Necesita tu atención"** — casos `review` y `unresolved`, ordenados por gravedad
  (sin sugerencia primero, después por confianza ascendente). Expandida por default.
- **"Sanados automáticamente"** — casos `healed`, colapsada por default.

Podés marcar casos como "arreglado" (persiste en `localStorage`, escopeado por proyecto y
corrida), copiar la sugerencia con un click, y cambiar entre tema claro/oscuro. Todo
corre en el HTML mismo, sin servidor — el archivo es 100% autocontenido.

## Cerrar el loop: aplicar sugerencias con `cli`

```bash
npx @healify/cli fix                # aplica los casos "healed" de ./healify-report.json
npx @healify/cli fix --dry-run       # muestra qué haría, sin escribir nada
```

Solo toca casos con ≥90% de confianza, nunca adivina en selectores ambiguos (2+
ocurrencias en el mismo archivo) ni toca archivos con cambios de git sin commitear (salvo
`--force`). Ver [`cli/README.md`](../../cli/README.md) para el detalle completo.

## Arquitectura del monorepo

```
reporter-core/     # Motor heurístico + tipos compartidos (privado)
  ├─ healing-engine.ts     # Las reglas de la tabla de arriba
  ├─ local-mode.ts          # Umbrales + runLocalHealing()
  ├─ local-report.ts        # Genera el HTML/JSON
  └─ selector-extractor.ts  # Parsea el selector desde el mensaje de error

test-runner/        # Adapter de Playwright (Reporter + fixture opcional)
cypress-plugin/      # Adapter de Cypress (setupNodeEvents)
selenium-plugin/     # Wrapper de Selenium WebDriver (Proxy sobre findElement)
cli/                  # Aplica sugerencias de un reporte a los archivos de test
```

Los cuatro paquetes de framework (`test-runner`, `cypress-plugin`, `selenium-plugin`,
`cli`) dependen de `reporter-core` pero nunca reimplementan sus reglas — si un selector
cura mal en un framework, el fix va en `healing-engine.ts`, no en el adapter.

npm workspaces, TypeScript estricto, Vitest para tests unitarios, `esbuild` para bundlear
`reporter-core` inline en cada paquete publicable (es privado, nunca se instala solo).

## Troubleshooting

**"El reporte dice `unresolved` en casi todos mis casos."** El motor no analiza el DOM —
si tus selectores no tienen ningún patrón reconocible (sin `data-testid`, sin `name`, sin
texto claro de acción), no tiene de dónde sacar una sugerencia confiable. Esto es
esperado, no un bug: agregar `data-testid` a los elementos que testeás es la forma más
confiable de subir la tasa de curado.

**"Instalé el paquete de npm y no tiene las mejoras que vi en el repo."** Los paquetes
publicados (`test-runner`/`cypress-plugin`) están en `0.1.0`, atrás del `0.2.0` de este
repo. Ver el aviso en el [README raíz](../../README.md#-paquetes).

**"El reporte menciona `Modo nube` / `HEALIFY_API_KEY` en versiones viejas de un
README."** Ese modo existió, pero el servidor que recibía esos reportes ya no existe en
este repo (se sacó junto con el SaaS completo, ver la sección "Historia" del README
raíz). Si ves esa mención en un README desactualizado, ignorala — Healify hoy es 100%
local.

**"`@healify/cli fix` saltó un caso con `role(...)`."** Es esperado — esas sugerencias
son texto legible para el reporte, no un selector pegable (`role('button', { name: 'X'
})` no es código válido de Playwright/Selenium). Aplicarlo tal cual corrompería el
archivo, así que se salta con aviso en vez de romper nada.
