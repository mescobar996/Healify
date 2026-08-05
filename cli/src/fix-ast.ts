import { readFileSync } from 'node:fs'
import { Project, SyntaxKind, type CallExpression, type SourceFile } from 'ts-morph'
import { parseRoleSuggestion, type LocalRun, type LocalCaseResult } from '@healify/reporter-core'
import { isGitDirty } from './git-check'
import { maskComments, countOccurrences, validatePath, type FixOptions, type FixOutcome } from './fix'

/**
 * Solo `role('button', { name: 'X' })` necesita reescritura estructural — no es un valor
 * de selector pegable, hay que armar una llamada nueva (page.getByRole(...).click()). Las
 * sugerencias TEXT (`button:has-text('X')`) NO pasan por acá: son selectores CSS válidos
 * de verdad (Playwright soporta `:has-text()` como pseudo-clase en un string de selector),
 * el `fix` normal (reemplazo de texto) ya las aplica bien tal cual — el plan original de
 * esta feature asumía un formato `text('X')` que el motor real nunca genera (confirmado
 * leyendo reporter-core/src/healing-engine.ts: la única estrategia type TEXT usa
 * `button:has-text(...)`), así que ese camino se sacó por completo en vez de dejar código
 * muerto apuntando a un formato que no existe.
 */
function parseRoleSelector(fixedSelector: string): { role: string; name: string } | null {
  // Se delega en `parseRoleSuggestion` en vez de repetir el regex acá: el formato lo produce
  // `buildRoleSuggestion` y ahora escapa comillas simples (los nombres accesibles reales las
  // tienen: "L'Oréal"). Dos regex separados para el mismo formato es lo que hacía que este
  // camino se quedara atrás.
  const parsed = parseRoleSuggestion(fixedSelector)
  if (!parsed?.name) return null
  return { role: parsed.role, name: parsed.name }
}

/**
 * Escapa un valor para escribirlo entre comillas simples EN EL CÓDIGO DEL USUARIO.
 *
 * Acá no se está armando un string legible para un reporte: se está generando TypeScript que
 * se guarda en el archivo. Un nombre accesible con apóstrofe ("L'Oréal", "Guardar 'borrador'")
 * produciría `getByRole('button', { name: 'L'Oréal' })`, que no compila — `fix` dejaría el
 * archivo roto.
 *
 * Hasta ahora este camino no se alcanzaba nunca, porque el parseo de la sugerencia fallaba
 * antes por el mismo motivo. Al arreglar aquel, este pasó a ser alcanzable.
 */
function escapeForCode(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

// Método de Playwright -> cómo se arma la llamada final sobre el locator nuevo (sin el
// prefijo del objeto, eso se agrega aparte para no repetirlo en cada entrada).
const METHOD_TO_LOCATOR_CALL: Record<string, (role: string, name: string, args: string) => string> = {
  // .locator(selector) devuelve el Locator tal cual, sin encadenar ninguna acción (ej.
  // dentro de un expect(page.locator('#x')).toBeVisible()).
  locator: (role, name) => `getByRole('${escapeForCode(role)}', { name: '${escapeForCode(name)}' })`,
  click: (role, name) => `getByRole('${escapeForCode(role)}', { name: '${escapeForCode(name)}' }).click()`,
  fill: (role, name, args) => `getByRole('${escapeForCode(role)}', { name: '${escapeForCode(name)}' }).fill(${args})`,
  type: (role, name, args) => `getByRole('${escapeForCode(role)}', { name: '${escapeForCode(name)}' }).type(${args})`,
  check: (role, name) => `getByRole('${escapeForCode(role)}', { name: '${escapeForCode(name)}' }).check()`,
  uncheck: (role, name) => `getByRole('${escapeForCode(role)}', { name: '${escapeForCode(name)}' }).uncheck()`,
  selectOption: (role, name, args) => `getByRole('${escapeForCode(role)}', { name: '${escapeForCode(name)}' }).selectOption(${args})`,
  hover: (role, name) => `getByRole('${escapeForCode(role)}', { name: '${escapeForCode(name)}' }).hover()`,
  focus: (role, name) => `getByRole('${escapeForCode(role)}', { name: '${escapeForCode(name)}' }).focus()`,
  blur: (role, name) => `getByRole('${escapeForCode(role)}', { name: '${escapeForCode(name)}' }).blur()`,
  tap: (role, name) => `getByRole('${escapeForCode(role)}', { name: '${escapeForCode(name)}' }).tap()`,
  dblclick: (role, name) => `getByRole('${escapeForCode(role)}', { name: '${escapeForCode(name)}' }).dblclick()`,
  press: (role, name, args) => `getByRole('${escapeForCode(role)}', { name: '${escapeForCode(name)}' }).press(${args})`,
}

/**
 * Busca, dentro de un archivo, la única llamada tipo `page.click('#selector')` (o
 * `page.locator('#selector')` dentro de un `expect(...)`) que use exactamente ese
 * selector como primer argumento string, y la reescribe con el locator nuevo. Devuelve
 * false si no encuentra nada rewriteable (método sin mapeo, objeto que no es page/locator,
 * etc.) — el caller cae a 'not-substitutable', no rompe nada.
 */
function rewriteFileForSelector(filePath: string, selector: string, role: string, name: string): boolean {
  const project = new Project({ useInMemoryFileSystem: false })
  const sourceFile: SourceFile = project.addSourceFileAtPath(filePath)

  const callExprs = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)
  let target: { callExpr: CallExpression; methodName: string; objectText: string } | null = null

  for (const callExpr of callExprs) {
    const args = callExpr.getArguments()
    if (args.length === 0) continue
    const firstArg = args[0]
    if (firstArg.getKind() !== SyntaxKind.StringLiteral) continue
    if (firstArg.asKindOrThrow(SyntaxKind.StringLiteral).getLiteralValue() !== selector) continue

    const expr = callExpr.getExpression()
    if (expr.getKind() !== SyntaxKind.PropertyAccessExpression) continue
    const propAccess = expr.asKindOrThrow(SyntaxKind.PropertyAccessExpression)
    const obj = propAccess.getExpression()
    if (!/^(page|locator|\w+Locator)$/.test(obj.getText())) continue

    target = { callExpr, methodName: propAccess.getName(), objectText: obj.getText() }
    break
  }

  if (!target) return false

  const template = METHOD_TO_LOCATOR_CALL[target.methodName]
  if (!template) return false

  // Argumentos extra después del selector (ej. el valor de .fill('#x', 'valor')) se
  // preservan tal cual, como texto crudo de los args originales.
  const extraArgs = target.callExpr.getArguments().slice(1).map((a) => a.getText()).join(', ')
  const replacement = `${target.objectText}.${template(role, name, extraArgs)}`

  const fullText = sourceFile.getFullText()
  const newText = fullText.slice(0, target.callExpr.getStart()) + replacement + fullText.slice(target.callExpr.getEnd())
  sourceFile.replaceWithText(newText)
  sourceFile.saveSync()
  return true
}

/**
 * Variante de `fix()` (ver fix.ts) que reescribe con AST vía ts-morph en vez de
 * reemplazo de texto — solo para sugerencias `role(...)`, las que `fix()` normal no
 * puede aplicar porque no son un valor de selector pegable. Mismas reglas de
 * conservadurismo: git limpio, selector único en el archivo (comentarios enmascarados),
 * más largo a más corto.
 */
export function fixAst(run: LocalRun, options: FixOptions = {}): FixOutcome[] {
  const casesByFile = new Map<string, LocalCaseResult[]>()
  for (const c of run.cases) {
    if (c.status !== 'healed' || !c.testFile) continue
    if (!/^role\(/.test(c.fixedSelector)) continue
    const list = casesByFile.get(c.testFile) ?? []
    list.push(c)
    casesByFile.set(c.testFile, list)
  }

  const outcomes: FixOutcome[] = []

  for (const [testFile, cases] of casesByFile) {
    let resolvedFile: string
    try {
      resolvedFile = validatePath(testFile, process.cwd())
    } catch {
      for (const c of cases) outcomes.push({ testFile, selector: c.selector, status: 'skipped', reason: 'not-found' })
      continue
    }

    if (!options.dryRun && !options.force && isGitDirty(resolvedFile)) {
      for (const c of cases) outcomes.push({ testFile, selector: c.selector, status: 'skipped', reason: 'dirty-git' })
      continue
    }

    let content: string
    try {
      content = readFileSync(resolvedFile, 'utf-8')
    } catch {
      for (const c of cases) outcomes.push({ testFile, selector: c.selector, status: 'skipped', reason: 'not-found' })
      continue
    }

    const sorted = [...cases].sort((a, b) => b.selector.length - a.selector.length)

    for (const c of sorted) {
      const parsed = parseRoleSelector(c.fixedSelector)
      if (!parsed) {
        outcomes.push({ testFile, selector: c.selector, status: 'skipped', reason: 'not-substitutable' })
        continue
      }

      const codeOnly = maskComments(content)
      const occurrences = countOccurrences(codeOnly, c.selector)
      if (occurrences === 0) {
        outcomes.push({ testFile, selector: c.selector, status: 'skipped', reason: 'not-found' })
        continue
      }
      if (occurrences > 1) {
        outcomes.push({ testFile, selector: c.selector, status: 'skipped', reason: 'ambiguous' })
        continue
      }

      if (options.dryRun) {
        outcomes.push({ testFile, selector: c.selector, fixedSelector: c.fixedSelector, status: 'applied' })
        continue
      }

      const rewritten = rewriteFileForSelector(resolvedFile, c.selector, parsed.role, parsed.name)
      if (!rewritten) {
        outcomes.push({ testFile, selector: c.selector, status: 'skipped', reason: 'not-substitutable' })
        continue
      }
      content = readFileSync(resolvedFile, 'utf-8')
      outcomes.push({ testFile, selector: c.selector, fixedSelector: c.fixedSelector, status: 'applied' })
    }
  }

  return outcomes
}
