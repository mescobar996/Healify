# Healify: Audit Logs + PR Workflow + Cypress Positioning

**Fecha:** 2026-08-02
**Estado:** Aprobado
**Enfoque:** B (módulo separado de audit)

## Resumen

Tres mejoras para Healify que responden a lo que la comunidad pide en 2026:

1. **Audit logs completos** — Cada healing event graba: timestamp, test name, archivo, línea, selector original/propuesto, confidence score, DOM snippet con hash SHA-256, screenshot, alternativas, y technical details
2. **PR workflow** — `healify fix --pr` crea branch, commit, y abre PR (con `gh` o instrucciones manuales)
3. **Cypress positioning** — Documentación + submission a Cypress plugin list en paralelo

## Contexto del mercado (datos del research)

- Locator maintenance consume 20-30% del tiempo total de QA (QAbyAI, n=26)
- 35% de equipos nombran selector maintenance como pain #1
- Cypress NO tiene healing open-source (su `cy.prompt` requiere AI proprietario)
- `pw-doctor` compite pero depende de Claude/GPT
- Healify es la única herramienta 100% local, sin API key, multi-framework

---

## 1. Audit Module (`reporter-core/src/audit.ts`)

### Tipos

```typescript
interface AuditEntry {
  // Identificación
  timestamp: string           // ISO 8601
  testName: string
  testFile?: string
  line?: number

  // Selector
  originalSelector: string
  fixedSelector: string
  selectorType: SelectorType
  confidence: number
  verified: boolean
  fromRepertoire: boolean

  // Contexto de fallo
  errorMessage: string
  domSnippet?: string         // HTML del elemento + padres (≈2000 chars)
  domHash?: string            // SHA-256 del snippet
  screenshotPath?: string     // Ruta relativa al screenshot

  // Motor
  alternatives: { selector: string; confidence: number }[]
  technicalDetails: {
    detectedIssue: string
    proposedSolution: string
    accessibilityCompliant: boolean
    stableAgainstDOMChanges: boolean
  }
}

interface AuditReport {
  project: string
  framework: string
  generatedAt: string
  totalCases: number
  entries: AuditEntry[]
}
```

### Funciones públicas

- `buildAuditEntry(response: HealResponse, request: HealRequest, context: FailureContext): AuditEntry` — Construye un entry desde los datos del pipeline
- `writeAuditReport(entries: AuditEntry[], outputDir: string): string` — Escribe `healify-audit.json` y devuelve la ruta
- `appendAuditEntry(entry: AuditEntry, outputDir: string): void` — Append incremental (para Selenium/WebdriverIO que no tienen hook de fin de corrida)

### Dependencias

Solo `node:crypto` (para SHA-256 del DOM). Sin dependencias externas.

### Flujo de datos

1. El adapter (Playwright/Cypress/Selenium/WebdriverIO) captura el DOM al fallar
2. Llama a `analyzeAndHeal()` como siempre
3. **Nuevo:** Llama a `buildAuditEntry()` con el response + el DOM crudo
4. Al final de la corrida, `writeAuditReport()` escribe el JSON

---

## 2. PR Workflow (`cli/src/fix.ts` + `cli/src/pr.ts`)

### Nuevo comando

`healify fix --pr`

### Flujo

1. Ejecuta `fix()` normal (aplica selectores healed al código)
2. Verifica si hay cambios (`git diff --quiet`)
3. Si no hay cambios → sale con mensaje "Nada que arreglar"
4. Si hay cambios:
   - Detecta `gh` en PATH
   - **Si `gh` existe:**
     - `git checkout -b healify/fix-<YYYYMMDD-HHmmss>`
     - `git add -A && git commit -m "healify: auto-fix <N> broken selectors"`
     - `gh pr create --title "healify: fix broken selectors" --body <audit-json>`
     - Muestra URL del PR
   - **Si `gh` no existe:**
     - `git checkout -b healify/fix-<YYYYMMDD-HHmmss>`
     - `git add -A && git commit -m "healify: auto-fix <N> broken selectors"`
     - Muestra instrucciones:
       ```
       git push origin healify/fix-<timestamp>
       gh pr create --title "healify: fix broken selectors"
       ```

### PR Body

```markdown
## Healify Auto-Fix

Resumen: N selectores arreglados, M necesitan revisión

### Selectores aplicados
| Original | Propuesto | Confianza | Verificado |
|----------|-----------|-----------|------------|
| #login-btn | role('button', { name: 'Iniciar sesión' }) | 97% | ✅ |
| .submit-btn | button:has-text('Enviar') | 85% | ⚠️ |

### Selectores que necesitan revisión
(los que confidence < 90%)

Audit completo: healify-audit.json
```

### Seguridad

- Nunca hace `git push` automáticamente
- Nunca hace `npm publish`
- Branch name incluye timestamp para evitar colisiones
- Si el working tree está sucio, aborta con error claro

---

## 3. Cypress Positioning

### Paralelo documentación + submission

#### 1. README mejorado

Video demo de 2 min mostrando:
- `npm install --save-dev @healify/cypress-plugin`
- Cypress config (3 líneas)
- Test fallido → `healify fix` → test pasa
- Sin API key, sin internet, sin cuenta

#### 2. Submission a Cypress plugin list

- Abrir PR en `cypress-io/cypress` (repo de documentación)
- Sección: "Community Plugins" → "Testing"
- Formato: nombre, descripción, link a npm, link a GitHub
- Requisito: README claro + LICENSE MIT (ya existen)

#### 3. Post de demo

Publicar en:
- Cypress Discord (#plugins channel)
- r/Playwright (cross-post)
- Hacker News (Show HN)

---

## 4. Error Handling

### Audit module

- Si falla la escritura del JSON → `console.warn()` pero no bloquea el flujo principal
- Si el screenshot no se puede capturar → `screenshotPath` queda `undefined`, no falla
- Si el DOM snippet es muy largo → trunca a 2000 chars con `...`

### PR workflow

- `gh` no encontrado → fallback a instrucciones manuales
- Working tree sucio → aborta con error claro
- Git no configurado → error con instrucciones

---

## 5. Testing

### Audit tests (`reporter-core/src/__tests__/audit.test.ts`)

- `buildAuditEntry()` genera entry válido con todos los campos
- `writeAuditReport()` escribe JSON válido
- `appendAuditEntry()` agrega sin sobreescribir
- DOM hash es determinístico (mismo input = mismo hash)
- Screenshot path es relativo, no absoluto

### PR tests (`cli/src/__tests__/fix-pr.test.ts`)

- Detecta `gh` correctamente
- Crea branch con nombre único
- Commit message es correcto
- Si no hay cambios, no crea branch

### Integración

- **Playwright:** screenshot + DOM en hook de fallo
- **Cypress:** `after:spec` event + DOM de `cy.healifyGet()`
- **Selenium/WebdriverIO:** `appendAuditEntry()` post-healing

---

## 6. Cronograma

| Semana | Trabajo |
|--------|---------|
| 1 | Audit module + tests unitarios |
| 2 | Integración con Playwright adapter + tests de integración |
| 3 | Cypress adapter + Selenium/WebdriverIO adapter |
| 4 | PR workflow (`fix --pr`) |
| 5 | Cypress documentation + plugin list submission |
| 6 | Buffer + fixes |

---

## 7. Archivos a crear/modificar

### Nuevos

- `reporter-core/src/audit.ts`
- `reporter-core/src/__tests__/audit.test.ts`
- `cli/src/pr.ts`
- `cli/src/__tests__/fix-pr.test.ts`
- `docs/superpowers/specs/2026-08-02-healify-audit-pr-cypress-design.md` (este spec)

### Modificar

- `reporter-core/src/index.ts` (exportar audit)
- `reporter-core/src/local-mode.ts` (agregar AuditEntry al pipeline)
- `cli/src/fix.ts` (agregar opción `--pr`)
- `cli/src/index.ts` (registrar flag `--pr`)
- `test-runner/src/index.ts` (integrar audit)
- `cypress-plugin/src/support.ts` (integrar audit)
- `selenium-plugin/src/plugin.ts` (integrar audit)
- `webdriverio-plugin/src/plugin.ts` (integrar audit)

---

## 8. Decisiones clave

| Decisión | Razón |
|----------|-------|
| Módulo separado de audit (no acoplado al reporte HTML) | Flexibilidad para CI, limpieza, mantenibilidad |
| SHA-256 del DOM snippet | Detectar cambios entre corridas sin guardar el DOM completo |
| `gh` con fallback a instrucciones | No depende de herramientas extra, pero las aprovecha |
| Nunca `git push` automático | Ley de Healify: el usuario controla el deploy |
| Screenshot como opcional | Playwright/Cypress lo soportan, Selenium puede fallar |
| 6 semanas de cronograma | Realista con buffer para fixes |
