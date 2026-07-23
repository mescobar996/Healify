# Feature 8 — Historial de curaciones (MVP) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que `healify fix` (corridas reales, sin `--dry-run`) grabe cada caso de cada corrida en `.healify/history.jsonl`, y que un nuevo comando `healify history` muestre en terminal los selectores que más se repiten y los que se rompieron de nuevo después de haber sido curados.

**Architecture:** Un módulo nuevo `cli/src/history.ts` con la capa de storage (append/read JSONL) y las dos agregaciones (top recurrentes, re-rotos). Un módulo nuevo `cli/src/commands/history.ts` que arma el reporte combinando ambas agregaciones — mismo patrón que ya usan `commands/init.ts`/`commands/doctor.ts`. Dos puntos de integración en `cli/src/index.ts`: `runFix()` graba en el historial cuando corresponde, y un nuevo comando `history` en el dispatcher imprime el reporte.

**Tech Stack:** TypeScript, Vitest, Node `fs` nativo (sin dependencias nuevas — igual que el resto del CLI).

**Spec de referencia:** `docs/superpowers/specs/2026-07-23-feature8-historical-report-design.md`

---

## Task 1: `cli/src/history.ts` — storage (append + read)

**Files:**
- Create: `cli/src/history.ts`
- Test: `cli/src/__tests__/history.test.ts`

- [ ] **Step 1: Escribir los tests que fallan**

Crear `cli/src/__tests__/history.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { LocalRun, LocalCaseResult } from '@healify/reporter-core'
import { appendHistory, readHistory } from '../history'

function makeCase(overrides: Partial<LocalCaseResult> = {}): LocalCaseResult {
  return {
    testName: 'un test',
    testFile: 'e2e/login.spec.ts',
    selector: '#old',
    errorMessage: 'error',
    status: 'healed',
    fixedSelector: "[data-testid='new']",
    confidence: 0.95,
    explanation: '',
    selectorType: 'TESTID',
    ...overrides,
  }
}

function makeRun(cases: LocalCaseResult[]): LocalRun {
  return { project: 'test', framework: 'Playwright', generatedAt: new Date(), cases }
}

describe('appendHistory + readHistory', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'healify-history-'))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('crea .healify/history.jsonl si no existe y graba una línea por caso', () => {
    appendHistory(makeRun([makeCase(), makeCase({ selector: '#other' })]), dir)

    expect(existsSync(join(dir, '.healify', 'history.jsonl'))).toBe(true)
    const entries = readHistory(dir)
    expect(entries).toHaveLength(2)
    expect(entries[0].selector).toBe('#old')
    expect(entries[1].selector).toBe('#other')
  })

  it('agrega (append) sin pisar lo que ya había', () => {
    appendHistory(makeRun([makeCase({ selector: '#first' })]), dir)
    appendHistory(makeRun([makeCase({ selector: '#second' })]), dir)

    const entries = readHistory(dir)
    expect(entries.map((e) => e.selector)).toEqual(['#first', '#second'])
  })

  it('readHistory devuelve [] si el archivo no existe todavía', () => {
    expect(readHistory(dir)).toEqual([])
  })

  it('readHistory ignora líneas corruptas sin reventar', () => {
    appendHistory(makeRun([makeCase({ selector: '#valid' })]), dir)
    const historyPath = join(dir, '.healify', 'history.jsonl')
    const raw = readFileSync(historyPath, 'utf-8')
    writeFileSync(historyPath, raw + 'esto no es json\n')

    const entries = readHistory(dir)
    expect(entries).toHaveLength(1)
    expect(entries[0].selector).toBe('#valid')
  })

  it('cada línea tiene timestamp ISO y los campos de LocalCaseResult relevantes', () => {
    appendHistory(makeRun([makeCase()]), dir)

    const [entry] = readHistory(dir)
    expect(entry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
    expect(entry.testFile).toBe('e2e/login.spec.ts')
    expect(entry.testName).toBe('un test')
    expect(entry.status).toBe('healed')
    expect(entry.fixedSelector).toBe("[data-testid='new']")
    expect(entry.selectorType).toBe('TESTID')
    expect(entry.confidence).toBe(0.95)
  })
})
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `npm test --workspace=cli -- history.test.ts`
Expected: FAIL — `Cannot find module '../history'` (el archivo todavía no existe).

- [ ] **Step 3: Implementar `cli/src/history.ts` (storage)**

```ts
import { existsSync, mkdirSync, appendFileSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { LocalRun, LocalCaseResult } from '@healify/reporter-core'

export interface HistoryEntry {
  timestamp: string
  testFile?: string
  testName: string
  selector: string
  status: LocalCaseResult['status']
  fixedSelector: string
  selectorType: string
  confidence: number
}

const HISTORY_RELATIVE_PATH = join('.healify', 'history.jsonl')

/**
 * Graba TODOS los casos de la corrida (healed/review/unresolved), no solo lo que fix()
 * pudo aplicar — así "recurrente"/"re-roto" reflejan selectores rotos reales, no solo los
 * auto-aplicables. Si falla la escritura (permisos, disco lleno), solo avisa por consola —
 * el historial es un complemento, nunca debe bloquear el flujo principal de fix().
 */
export function appendHistory(run: LocalRun, cwd: string = process.cwd()): void {
  const fullPath = join(cwd, HISTORY_RELATIVE_PATH)
  const now = new Date().toISOString()

  const lines = run.cases
    .map((c) => {
      const entry: HistoryEntry = {
        timestamp: now,
        testFile: c.testFile,
        testName: c.testName,
        selector: c.selector,
        status: c.status,
        fixedSelector: c.fixedSelector,
        selectorType: c.selectorType,
        confidence: c.confidence,
      }
      return JSON.stringify(entry)
    })
    .join('\n') + '\n'

  try {
    mkdirSync(dirname(fullPath), { recursive: true })
    appendFileSync(fullPath, lines, 'utf-8')
  } catch (error) {
    console.warn(`⚠ no se pudo escribir el historial (${HISTORY_RELATIVE_PATH}): ${error instanceof Error ? error.message : String(error)}`)
  }
}

/** [] si el archivo no existe o no se puede leer. Líneas corruptas se ignoran, no revientan el resto. */
export function readHistory(cwd: string = process.cwd()): HistoryEntry[] {
  const fullPath = join(cwd, HISTORY_RELATIVE_PATH)
  if (!existsSync(fullPath)) return []

  let raw: string
  try {
    raw = readFileSync(fullPath, 'utf-8')
  } catch {
    return []
  }

  const entries: HistoryEntry[] = []
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue
    try {
      entries.push(JSON.parse(line))
    } catch {
      // línea corrupta (ej. escritura interrumpida a mitad) — se ignora.
    }
  }
  return entries
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `npm test --workspace=cli -- history.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add cli/src/history.ts cli/src/__tests__/history.test.ts
git commit -m "feat(cli): storage de historial (.healify/history.jsonl)"
```

---

## Task 2: `cli/src/history.ts` — trends (top recurrentes + re-rotos)

**Files:**
- Modify: `cli/src/history.ts`
- Test: `cli/src/__tests__/history.test.ts`

- [ ] **Step 1: Agregar los tests que fallan**

Agregar al final de `cli/src/__tests__/history.test.ts`:

```ts
import { computeTopRecurrent, computeRebroken, type HistoryEntry } from '../history'

function makeEntry(overrides: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    timestamp: '2026-07-01T00:00:00.000Z',
    testFile: 'e2e/login.spec.ts',
    testName: 'un test',
    selector: '#old',
    status: 'healed',
    fixedSelector: "[data-testid='new']",
    selectorType: 'TESTID',
    confidence: 0.95,
    ...overrides,
  }
}

describe('computeTopRecurrent', () => {
  it('cuenta apariciones por selector y ordena de mayor a menor', () => {
    const entries = [
      makeEntry({ selector: '#a' }),
      makeEntry({ selector: '#b' }),
      makeEntry({ selector: '#a' }),
      makeEntry({ selector: '#a' }),
    ]

    expect(computeTopRecurrent(entries)).toEqual([
      { selector: '#a', count: 3 },
      { selector: '#b', count: 1 },
    ])
  })

  it('respeta el límite (top N)', () => {
    const entries = ['#a', '#b', '#c'].map((selector) => makeEntry({ selector }))
    expect(computeTopRecurrent(entries, 2)).toHaveLength(2)
  })

  it('devuelve [] si no hay entradas', () => {
    expect(computeTopRecurrent([])).toEqual([])
  })
})

describe('computeRebroken', () => {
  it('marca un selector como re-roto si su primera aparición fue healed y volvió a aparecer', () => {
    const entries = [
      makeEntry({ selector: '#a', status: 'healed', timestamp: '2026-07-01T00:00:00.000Z' }),
      makeEntry({ selector: '#a', status: 'review', timestamp: '2026-07-08T00:00:00.000Z' }),
    ]

    expect(computeRebroken(entries)).toEqual([
      { selector: '#a', count: 2, firstHealedAt: '2026-07-01T00:00:00.000Z' },
    ])
  })

  it('no marca un selector que solo aparece una vez', () => {
    const entries = [makeEntry({ selector: '#a', status: 'healed' })]
    expect(computeRebroken(entries)).toEqual([])
  })

  it('no marca un selector cuya primera aparición nunca fue healed', () => {
    const entries = [
      makeEntry({ selector: '#a', status: 'review', timestamp: '2026-07-01T00:00:00.000Z' }),
      makeEntry({ selector: '#a', status: 'review', timestamp: '2026-07-08T00:00:00.000Z' }),
    ]
    expect(computeRebroken(entries)).toEqual([])
  })

  it('ordena por cantidad de apariciones descendente', () => {
    const entries = [
      makeEntry({ selector: '#a', status: 'healed', timestamp: '2026-07-01T00:00:00.000Z' }),
      makeEntry({ selector: '#a', status: 'review', timestamp: '2026-07-08T00:00:00.000Z' }),
      makeEntry({ selector: '#b', status: 'healed', timestamp: '2026-07-01T00:00:00.000Z' }),
      makeEntry({ selector: '#b', status: 'review', timestamp: '2026-07-05T00:00:00.000Z' }),
      makeEntry({ selector: '#b', status: 'review', timestamp: '2026-07-08T00:00:00.000Z' }),
    ]
    expect(computeRebroken(entries).map((r) => r.selector)).toEqual(['#b', '#a'])
  })
})
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `npm test --workspace=cli -- history.test.ts`
Expected: FAIL — `computeTopRecurrent`/`computeRebroken` no exportados todavía.

- [ ] **Step 3: Agregar las agregaciones al final de `cli/src/history.ts`**

```ts
export interface RecurrentSelector {
  selector: string
  count: number
}

/** Agrupa por selector exacto, cuenta apariciones en todo el historial, top N desc. */
export function computeTopRecurrent(entries: HistoryEntry[], limit: number = 10): RecurrentSelector[] {
  const counts = new Map<string, number>()
  for (const e of entries) counts.set(e.selector, (counts.get(e.selector) ?? 0) + 1)
  return [...counts.entries()]
    .map(([selector, count]) => ({ selector, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}

export interface RebrokenSelector {
  selector: string
  count: number
  firstHealedAt: string
}

/**
 * Aproximación, no medición exacta: el historial no sabe si fix() realmente aplicó el
 * selector al archivo (pudo saltarse por ambiguous/dirty-git/not-substitutable) — solo
 * sabe que el motor lo curó con confianza suficiente (status 'healed') la primera vez que
 * apareció, y que el mismo selector volvió a aparecer roto después.
 */
export function computeRebroken(entries: HistoryEntry[]): RebrokenSelector[] {
  const bySelector = new Map<string, HistoryEntry[]>()
  for (const e of entries) {
    const list = bySelector.get(e.selector) ?? []
    list.push(e)
    bySelector.set(e.selector, list)
  }

  const result: RebrokenSelector[] = []
  for (const [selector, list] of bySelector) {
    if (list.length < 2) continue
    const sorted = [...list].sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    if (sorted[0].status !== 'healed') continue
    result.push({ selector, count: list.length, firstHealedAt: sorted[0].timestamp })
  }
  return result.sort((a, b) => b.count - a.count)
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `npm test --workspace=cli -- history.test.ts`
Expected: PASS (12 tests: 5 de storage + 7 de trends)

- [ ] **Step 5: Commit**

```bash
git add cli/src/history.ts cli/src/__tests__/history.test.ts
git commit -m "feat(cli): trends de historial (top recurrentes, re-rotos)"
```

---

## Task 3: `cli/src/commands/history.ts` — reporte combinado

**Files:**
- Create: `cli/src/commands/history.ts`
- Test: `cli/src/__tests__/history-command.test.ts`

- [ ] **Step 1: Escribir el test que falla**

Crear `cli/src/__tests__/history-command.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { LocalRun, LocalCaseResult } from '@healify/reporter-core'
import { appendHistory } from '../history'
import { history } from '../commands/history'

function makeCase(overrides: Partial<LocalCaseResult> = {}): LocalCaseResult {
  return {
    testName: 'un test',
    testFile: 'e2e/login.spec.ts',
    selector: '#old',
    errorMessage: 'error',
    status: 'healed',
    fixedSelector: "[data-testid='new']",
    confidence: 0.95,
    explanation: '',
    selectorType: 'TESTID',
    ...overrides,
  }
}

function makeRun(cases: LocalCaseResult[]): LocalRun {
  return { project: 'test', framework: 'Playwright', generatedAt: new Date(), cases }
}

describe('history()', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'healify-history-cmd-'))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('hasHistory: false cuando nunca se grabó nada', () => {
    expect(history(dir)).toEqual({ hasHistory: false, topRecurrent: [], rebroken: [] })
  })

  it('hasHistory: true y calcula ambas vistas cuando hay historial', () => {
    appendHistory(makeRun([makeCase({ selector: '#a' }), makeCase({ selector: '#a' })]), dir)

    const report = history(dir)

    expect(report.hasHistory).toBe(true)
    expect(report.topRecurrent).toEqual([{ selector: '#a', count: 2 }])
    expect(report.rebroken).toEqual([])
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npm test --workspace=cli -- history-command.test.ts`
Expected: FAIL — `Cannot find module '../commands/history'`.

- [ ] **Step 3: Implementar `cli/src/commands/history.ts`**

```ts
import { readHistory, computeTopRecurrent, computeRebroken, type RecurrentSelector, type RebrokenSelector } from '../history'

export interface HistoryReport {
  hasHistory: boolean
  topRecurrent: RecurrentSelector[]
  rebroken: RebrokenSelector[]
}

/** Lee .healify/history.jsonl y arma las dos vistas — no modifica nada. */
export function history(cwd: string = process.cwd()): HistoryReport {
  const entries = readHistory(cwd)
  if (entries.length === 0) return { hasHistory: false, topRecurrent: [], rebroken: [] }
  return { hasHistory: true, topRecurrent: computeTopRecurrent(entries), rebroken: computeRebroken(entries) }
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npm test --workspace=cli -- history-command.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add cli/src/commands/history.ts cli/src/__tests__/history-command.test.ts
git commit -m "feat(cli): comando history() combina storage + trends"
```

---

## Task 4: Wirear `appendHistory` en `runFix()`

**Files:**
- Modify: `cli/src/index.ts`

No hay `index.test.ts` en este repo (el dispatch de `main()`/`runFix()` se verifica corriendo el binario real, mismo patrón que se usó para verificar `--ast` en la Feature 7) — la lógica de storage/trends ya quedó cubierta por los tests de las Tasks 1-3. Este task se verifica manualmente en el Step 3.

- [ ] **Step 1: Agregar el import**

En `cli/src/index.ts`, la línea 5 actual es:
```ts
import { fixAst } from './fix-ast'
```
Agregar debajo:
```ts
import { appendHistory } from './history'
```

- [ ] **Step 2: Grabar el historial en `runFix()` cuando no es `--dry-run`**

En `cli/src/index.ts`, dentro de `runFix()`, el bloque actual es:
```ts
  console.log(`Healify fix — ${reportPath}${ast ? ' (--ast)' : ''}\n`)

  // --ast es aditivo, no reemplaza a fix(): primero corre el reemplazo de texto normal
```
Reemplazar por:
```ts
  console.log(`Healify fix — ${reportPath}${ast ? ' (--ast)' : ''}\n`)

  // Se graba ANTES de aplicar los fixes, con el estado real del reporte (todos los casos,
  // no solo lo que fix() termina aplicando) — así "recurrente"/"re-roto" reflejan selectores
  // rotos de verdad, no solo los auto-aplicables. --dry-run nunca graba: el gh-action corre
  // `fix --dry-run` en cada PR, y si eso grabara el historial se llenaría de ruido de CI que
  // no representa corridas reales de un dev.
  if (!dryRun) appendHistory(run, process.cwd())

  // --ast es aditivo, no reemplaza a fix(): primero corre el reemplazo de texto normal
```

- [ ] **Step 3: Verificación manual con el binario real**

```bash
npm run build --workspace=cli
```
Expected: build sin errores.

Crear un reporte de prueba y correr `fix` sin `--dry-run`:
```bash
cd /tmp && mkdir healify-history-check && cd healify-history-check
node -e "
const fs = require('fs')
fs.writeFileSync('a.spec.ts', \"page.click('#old-btn')\")
fs.writeFileSync('report.json', JSON.stringify({
  project: 'demo', framework: 'Playwright', generatedAt: new Date(),
  cases: [{ testName: 't', testFile: 'a.spec.ts', selector: '#old-btn',
    errorMessage: 'e', status: 'healed', fixedSelector: \"[data-testid='new']\",
    confidence: 0.95, explanation: '', selectorType: 'TESTID' }]
}))
"
node /ruta/a/Healify/cli/dist/index.js fix report.json
cat .healify/history.jsonl
```
Expected: `.healify/history.jsonl` existe y tiene una línea con `"selector":"#old-btn"`.

Repetir con `--dry-run` sobre un directorio limpio nuevo y confirmar que `.healify/` **no** se crea.

- [ ] **Step 4: Commit**

```bash
git add cli/src/index.ts
git commit -m "feat(cli): fix graba en el historial (excepto --dry-run)"
```

---

## Task 5: Comando `healify history`

**Files:**
- Modify: `cli/src/index.ts`

- [ ] **Step 1: Agregar el import**

En `cli/src/index.ts`, la línea actual:
```ts
import { doctor, type DoctorReport } from './commands/doctor'
```
Agregar debajo:
```ts
import { history, type HistoryReport } from './commands/history'
```

- [ ] **Step 2: Agregar `printHistoryReport()`**

Insertar después de la función `printDoctorReport` (justo antes de `function printHelp(): void {`):

```ts
function printHistoryReport(report: HistoryReport): void {
  console.log('Healify history\n')

  if (!report.hasHistory) {
    console.log('Todavía no hay historial — corré healify fix (sin --dry-run) al menos una vez para empezar a registrar selectores rotos.')
    return
  }

  console.log('Top selectores recurrentes:')
  for (const r of report.topRecurrent) {
    console.log(`  ${r.count}x  ${r.selector}`)
  }

  console.log('\nSelectores re-rotos (aproximado: se curaron con confianza antes y volvieron a aparecer rotos después):')
  if (report.rebroken.length === 0) {
    console.log('  ninguno todavía')
  } else {
    for (const r of report.rebroken) {
      console.log(`  ${r.count}x  ${r.selector} (curado por primera vez ${r.firstHealedAt})`)
    }
  }
}

```

- [ ] **Step 3: Documentar el comando en `printHelp()`**

El bloque actual de `printHelp()`:
```ts
function printHelp(): void {
  console.log(`Uso: healify <comando>

Comandos:
  init                                       Detecta tu framework (o te pregunta cuál armar si no hay ninguno), instala lo que falte y configura el reporter/plugin (sin generar tests)
  doctor                                     Verifica que Healify esté instalado y bien configurado
  fix [reporte.json] [--dry-run] [--force] [--ast]   Aplica las sugerencias de mayor confianza directo en tus archivos de test
                                                       --ast (experimental) también reescribe sugerencias role(...) vía AST`)
}
```
Reemplazar por:
```ts
function printHelp(): void {
  console.log(`Uso: healify <comando>

Comandos:
  init                                       Detecta tu framework (o te pregunta cuál armar si no hay ninguno), instala lo que falte y configura el reporter/plugin (sin generar tests)
  doctor                                     Verifica que Healify esté instalado y bien configurado
  fix [reporte.json] [--dry-run] [--force] [--ast]   Aplica las sugerencias de mayor confianza directo en tus archivos de test
                                                       --ast (experimental) también reescribe sugerencias role(...) vía AST
  history                                    Muestra selectores recurrentes y re-rotos de .healify/history.jsonl (se graba en cada fix real, no en --dry-run)`)
}
```

- [ ] **Step 4: Agregar el dispatch en `main()`**

El bloque actual de `main()`:
```ts
  if (command === 'init') return runInit()
  if (command === 'doctor') return printDoctorReport(doctor())
  if (command === 'fix') return runFix(args)
```
Reemplazar por:
```ts
  if (command === 'init') return runInit()
  if (command === 'doctor') return printDoctorReport(doctor())
  if (command === 'fix') return runFix(args)
  if (command === 'history') return printHistoryReport(history())
```

- [ ] **Step 5: Verificación manual con el binario real**

```bash
npm run build --workspace=cli
```
Expected: build sin errores.

Sobre el mismo directorio de prueba del Task 4 (que ya tiene `.healify/history.jsonl` con una entrada):
```bash
node /ruta/a/Healify/cli/dist/index.js history
```
Expected: imprime "Top selectores recurrentes:" con `1x  #old-btn`, y "Selectores re-rotos..." con "ninguno todavía".

Sobre un directorio limpio sin `.healify/`:
```bash
node /ruta/a/Healify/cli/dist/index.js history
```
Expected: imprime el mensaje de "Todavía no hay historial...", sin error.

```bash
node /ruta/a/Healify/cli/dist/index.js --help
```
Expected: el bloque de ayuda incluye la línea de `history`.

- [ ] **Step 6: Commit**

```bash
git add cli/src/index.ts
git commit -m "feat(cli): comando healify history"
```

---

## Task 6: Verificación final, CHANGELOG, versión, commit

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `cli/package.json`
- Modify: `ROADMAP.md`

- [ ] **Step 1: Build + verify completo del monorepo**

**Importante:** correr con Git Bash real, no con el `bash` que resuelve PowerShell en Windows (resuelve a WSL, un filesystem distinto al del repo — ver nota en `CHANGELOG.md` sección "Sin publicar (post-0.7.0)").

```bash
cd /ruta/a/Healify && npm run verify
```
Expected: `✅ reporter-core (44) / ✅ test-runner (8) / ✅ cypress-plugin (7) / ✅ cli (123) / ✅ selenium-plugin (35) / ✅ webdriverio-plugin (23)`
(123 en cli = 106 actuales + 12 de Task 1-2 + 2 de Task 3 + 3 nuevos casos si se agregaron — ajustar el número exacto al conteo real que devuelva vitest, no asumirlo.)

```bash
npm audit
```
Expected: `found 0 vulnerabilities`

- [ ] **Step 2: Bump de versión**

En `cli/package.json`, cambiar:
```json
  "version": "0.7.0",
```
por:
```json
  "version": "0.8.0",
```

- [ ] **Step 3: Actualizar `CHANGELOG.md`**

Agregar una nueva entrada al principio del archivo (antes de `## Sin publicar (post-0.7.0)` o fusionada con ella si todavía no se publicó esa versión — verificar `npm view @healify/cli version` para decidir si esto es parte de la misma versión sin publicar o una nueva):

```markdown
## 0.8.0 — Feature #8: historial de curaciones (MVP)

`healify fix` (sin `--dry-run`) ahora graba cada caso de la corrida en
`.healify/history.jsonl`. Nuevo comando `healify history` muestra en terminal los
selectores más recurrentes y los que se rompieron de nuevo después de haber sido curados.

Sin sistema de config, sin export HTML/JSON, sin retención automática — MVP acotado tras
corregir el spec original contra el código real (asumía `cli/src/commands/fix.ts` y
`cli/src/config.ts`, que no existen). Detalle completo en
`docs/superpowers/specs/2026-07-23-feature8-historical-report-design.md`.

`--dry-run` nunca graba (evita ensuciar el historial con las corridas del gh-action en
cada PR). "Re-roto" es una aproximación documentada: se basa en si la primera aparición
del selector fue `status: 'healed'`, no en si `fix()` realmente lo aplicó al archivo.
```

- [ ] **Step 4: Marcar Feature 8 como implementada en `ROADMAP.md`**

En `ROADMAP.md`, el título actual de la sección:
```markdown
### 8. Reporte histórico (no solo el último run)
```
Reemplazar por:
```markdown
### 8. Reporte histórico (no solo el último run) ✅
```
Y agregar al final de esa sección (antes de la sección `### 9.`):
```markdown
**Implementado (MVP)**: `.healify/history.jsonl` append-only + comando `healify history`
(top recurrentes, re-rotos). Sin config subsystem, sin export HTML/JSON, sin retención —
el spec original tenía supuestos falsos sobre el código real, corregido y recortado tras
brainstorming (ver `docs/superpowers/specs/2026-07-23-feature8-historical-report-design.md`).
```

- [ ] **Step 5: Commit final**

```bash
git add CHANGELOG.md cli/package.json ROADMAP.md
git commit -m "docs: CHANGELOG + ROADMAP + bump cli 0.8.0 (Feature 8 MVP completa)"
```

No hacer `git push` ni `npm publish` — esperar pedido explícito del usuario en esa sesión, regla vigente desde el inicio de este proyecto.

---

## Resumen de tests nuevos

| Archivo | Tests |
|---|---|
| `cli/src/__tests__/history.test.ts` | 12 (5 storage + 7 trends) |
| `cli/src/__tests__/history-command.test.ts` | 2 |
| **Total** | **14** |

`cli` pasa de 106 a 120 tests. Monorepo total pasa de 231 a 245.
