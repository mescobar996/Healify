/**
 * Motor de heurísticas de sanado — modo local.
 *
 * Migrado desde src/lib/engine/healing-engine.ts (sin tocar el archivo de
 * producción, mismo patrón que selector-extractor.ts). Sin dependencia de
 * zod: el paquete original la usaba para validar payloads de API HTTP, acá
 * no hay red, solo tipos.
 *
 * Importante para quien lo lea de nuevo — el motor tiene dos modos, y la
 * diferencia entre ellos es enorme:
 *
 * - **Sin `htmlContext`**: pattern-matching del texto del selector contra
 *   diccionarios fijos (login→Login, email→Email) más un ajuste determinístico
 *   por hash. No hay forma de saber si lo que propone existe: es una heurística
 *   de buena fe, y las sugerencias salen con `verified: false`.
 * - **Con `htmlContext`** (el árbol de accesibilidad que el framework capturó
 *   al fallar el test): las sugerencias de rol se confrontan contra lo que
 *   había de verdad en pantalla — se descarta lo que no existe y los nombres
 *   se leen de la página en vez de deducirse. Salen con `verified: true`.
 *
 * En ninguno de los dos modos hay IA, red ni servidor: es comparación de
 * strings contra datos que ya están en la máquina. Repórtalo como tal en
 * cualquier UI que consuma esto, y distinguí los dos modos: un usuario merece
 * saber si la sugerencia se comprobó o se dedujo.
 */

import { parsePageSnapshot, existsInPage, findMatches, bestElementFor, type PageElement } from './page-snapshot'

export interface HealRequest {
  selector: string
  htmlContext?: string
  testName?: string
  errorMessage?: string
  /** Sinónimos adicionales del proyecto — se mergean con los built-in EN/ES. */
  customSynonyms?: { actions?: Record<string, string>; fields?: Record<string, string> }
}

export type SelectorType = 'CSS' | 'XPATH' | 'TESTID' | 'ROLE' | 'TEXT' | 'MIXED'

export interface HealResponse {
  /** true si la sugerencia se confrontó contra el árbol real de la página y existe ahí.
   * false cuando no hubo árbol disponible (heurística a ciegas, el modo de siempre). */
  verified: boolean
  fixedSelector: string
  confidence: number
  explanation: string
  selectorType: SelectorType
  alternatives?: { selector: string; confidence: number }[]
  needsReview: boolean
  robustnessImprovement: number
  technicalDetails: {
    detectedIssue: string
    proposedSolution: string
    accessibilityCompliant: boolean
    stableAgainstDOMChanges: boolean
  }
}

interface SelectorAnalysis {
  type: 'ID' | 'CLASS' | 'TESTID' | 'ROLE' | 'TEXT' | 'XPATH' | 'ATTRIBUTE' | 'COMPOUND' | 'CSS'
  issues: string[]
  element: string
  action: string
  isDynamic: boolean
  isFragile: boolean
  /** Ya es un locator moderno de Playwright (getByRole/getByText/...) — no proponer downgrade. */
  isAlreadyModernLocator?: boolean
  /** Qué atributo genérico disparó el tipo ATTRIBUTE, para elegir la estrategia correcta. */
  attributeKind?: 'name' | 'aria-label'
}

interface HealingStrategy {
  selector: string
  type: HealResponse['selectorType']
  confidence: number
  explanation: string
  robustnessGain: number
  technicalReason: string
  /** Escalera de atributos estables: 1=testid, 3=name, 4=aria-label/role, 5=texto visible, 6=clase.
   * (2="id estable" no tiene candidato propio hoy — no existe ese caso en el motor.) */
  priority: number
}

// Atributos volátiles: generados por build tools (css-in-js, hashing) o por IDs con timestamp/hash —
// no sirven como base de un selector alternativo porque van a cambiar en el próximo build.
const VOLATILE_CLASS_RE = /^(css-|sc-|x[0-9a-f]{4,}|[a-z]{2,}_[a-z0-9]{5,})/i
const VOLATILE_ID_RE = /_\d{4,}$|-[a-f0-9]{6,}$/i

/**
 * `VOLATILE_CLASS_RE` está anclada al inicio de un nombre de clase individual — necesaria
 * para no confundir una clase semántica real que solo CONTIENE "css" en el medio. Pero un
 * selector real con multi-clase pegada (`.btn.css-1a2b3c4d5e`, común cuando
 * styled-components agrega su hash junto a una clase semántica) o con combinador
 * (`.container > .css-1a2b3c4d`) tiene el fragmento volátil en cualquier posición del
 * selector completo, no solo al principio. Se buscan todos los tokens de clase
 * (`.algo`) del selector y se testea cada uno individualmente.
 */
function hasVolatileClassToken(selector: string): boolean {
  const classTokens = selector.match(/\.[a-zA-Z0-9_-]+/g) ?? []
  return classTokens.some((token) => VOLATILE_CLASS_RE.test(token.slice(1)))
}

// Atributos de test-id conocidos, en orden de preferencia para testidAttributeName() cuando
// un selector (raro, pero posible) trae más de uno — data-testid/data-cy ya soportados,
// data-qa/data-test/data-e2e son convenciones equivalentes usadas por otros equipos/frameworks.
const TESTID_ATTRS = ['data-testid', 'data-cy', 'data-qa', 'data-test', 'data-e2e'] as const
type TestIdAttr = (typeof TESTID_ATTRS)[number]

const NTH_POSITION_RE = /:nth-(?:child|of-type)\(/

function analyzeSelector(selector: string): SelectorAnalysis {
  const analysis: SelectorAnalysis = {
    type: 'CSS',
    issues: [],
    element: 'element',
    action: 'interact',
    isDynamic: false,
    isFragile: false,
  }

  const modernLocatorMatch = selector.match(/^getBy(Role|Text|Label|Placeholder|TestId)\(/)
  if (modernLocatorMatch) {
    analysis.isAlreadyModernLocator = true
    const kind = modernLocatorMatch[1]
    analysis.type = kind === 'Role' ? 'ROLE' : kind === 'Text' ? 'TEXT' : kind === 'TestId' ? 'TESTID' : 'CSS'
    return analysis
  }

  if (selector.startsWith('#')) {
    analysis.type = 'ID'
    analysis.issues.push('ID selectors are brittle and can change')
    if (/\d+/.test(selector) || /-[a-f0-9]{6,}/i.test(selector) || VOLATILE_ID_RE.test(selector)) {
      analysis.isDynamic = true
      analysis.issues.push('Dynamic ID detected - will break on next build')
    }
  } else if (selector.startsWith('.')) {
    analysis.type = 'CLASS'
    analysis.issues.push('Class names can change during refactoring')
    if (/_[a-z]+_[a-z0-9]+/.test(selector) || /sc-[a-z]+/.test(selector) || hasVolatileClassToken(selector)) {
      analysis.isDynamic = true
      analysis.issues.push('Generated CSS class detected - unstable')
    }
  } else if (TESTID_ATTRS.some((attr) => selector.includes(`[${attr}=`))) {
    analysis.type = 'TESTID'
  } else if (selector.startsWith('//')) {
    analysis.type = 'XPATH'
    analysis.issues.push('XPath is fragile to DOM structure changes')
    analysis.isFragile = true
  } else if (selector.includes('[role=')) {
    analysis.type = 'ROLE'
  } else if (selector.includes('text=') || selector.includes('has-text')) {
    analysis.type = 'TEXT'
    analysis.issues.push('Text content can change with copy updates')
  } else if (selector.includes('[aria-label=')) {
    analysis.type = 'ATTRIBUTE'
    analysis.attributeKind = 'aria-label'
  } else if (selector.includes('[name=')) {
    analysis.type = 'ATTRIBUTE'
    analysis.attributeKind = 'name'
    analysis.issues.push('The name attribute may not be unique')
  }

  // Independiente del `type` detectado arriba (nth-child puede combinarse con CSS de clase,
  // de tag, o ir suelto) — depende del orden exacto de hermanos en el DOM, se rompe apenas
  // se agrega/quita/reordena un elemento vecino, sin que el elemento buscado haya cambiado.
  if (NTH_POSITION_RE.test(selector)) {
    analysis.isFragile = true
    analysis.issues.push('Position-based selector (nth-child/nth-of-type) depends on exact sibling order in the DOM')
  }

  if (/button|btn/i.test(selector)) {
    analysis.element = 'button'
    analysis.action = 'click'
  } else if (/input|field/i.test(selector)) {
    analysis.element = 'input'
    analysis.action = 'type'
  } else if (/link|anchor|a\[|nav/i.test(selector)) {
    analysis.element = 'link'
    analysis.action = 'click'
  } else if (/submit|form/i.test(selector)) {
    analysis.element = 'button'
    analysis.action = 'submit'
  } else if (/login|signin/i.test(selector)) {
    analysis.element = 'button'
    analysis.action = 'login'
  }

  return analysis
}

/** Ajuste determinístico por hash del selector — reemplaza Math.random() para resultados reproducibles. */
function deterministicAdjustment(selector: string): number {
  let hash = 0
  for (let i = 0; i < selector.length; i++) {
    hash = ((hash << 5) - hash + selector.charCodeAt(i)) | 0
  }
  return ((Math.abs(hash) % 100) / 1000) - 0.05
}

// Diccionarios EN/ES en reporter-core/src/dictionaries/ — editables sin leer el motor entero.
import enDictionary from './dictionaries/en.json'
import esDictionary from './dictionaries/es.json'

// Palabra de acción (login, guardar, submit...) → texto visible del botón/rol a buscar.
const ACTIONS: Record<string, string> = { ...enDictionary.ACTIONS, ...esDictionary.ACTIONS }

// Nombre de campo (email, contraseña, phone...) → label/placeholder visible a buscar.
const FIELDS: Record<string, string> = { ...enDictionary.FIELDS, ...esDictionary.FIELDS }

function extractActionFromSelector(selector: string, actions: Record<string, string>): string {
  for (const [key, value] of Object.entries(actions)) {
    if (selector.toLowerCase().includes(key)) return value
  }
  return 'Submit'
}

function extractFieldName(selector: string, fields: Record<string, string>): string {
  for (const [key, value] of Object.entries(fields)) {
    if (selector.toLowerCase().includes(key)) return value
  }
  return 'Field'
}

function extractTestid(selector: string): string {
  const match = selector.match(/data-(?:testid|cy|qa|test|e2e)=['"]([^'"]+)['"]/)
  return match ? match[1] : 'element'
}

/** Cada framework/equipo tiene su propia convención (data-cy en Cypress, data-qa/data-test/data-e2e
 * en otros) — reescribir a otro atributo rompería el selector, se conserva el que ya está presente. */
function testidAttributeName(selector: string): TestIdAttr {
  return TESTID_ATTRS.find((attr) => selector.includes(`[${attr}=`)) ?? 'data-testid'
}

function extractBaseClass(selector: string): string {
  return selector
    .replace(/[#.]/, '')
    .replace(/[-_]?\d+/g, '')
    .replace(/[-_][a-f0-9]{6,}/gi, '')
    .toLowerCase()
}

/** No proponer una clase como alternativa si sigue viéndose volátil tras limpiarla, o si el selector
 * original tiene demasiados fragmentos tipo hash/número — la "base" ya no es una base estable real. */
function isUnstableClassCandidate(selector: string, candidate: string): boolean {
  if (VOLATILE_CLASS_RE.test(candidate)) return true
  const volatileFragments = selector.match(/[a-f0-9]{4,}|\d{2,}/gi) ?? []
  return volatileFragments.length > 3
}

function generateHealingStrategies(selector: string, analysis: SelectorAnalysis, actions: Record<string, string>, fields: Record<string, string>): HealingStrategy[] {
  if (analysis.isAlreadyModernLocator) {
    return [{
      selector,
      type: analysis.type as HealResponse['selectorType'],
      confidence: 0.80,
      explanation: 'El selector ya usa un locator moderno de Playwright (getBy*), que es la práctica recomendada. No se propone downgrade — sin acceso al DOM real no se puede saber por qué dejó de encontrar el elemento; puede ser un cambio genuino de la UI que amerita revisión manual.',
      robustnessGain: 0,
      technicalReason: 'Modern Playwright locators are already best practice; the failure likely reflects a real UI change, not a selector quality issue',
      priority: 4,
    }]
  }

  const strategies: HealingStrategy[] = []

  if (analysis.attributeKind === 'aria-label') {
    strategies.push({
      selector,
      type: 'ROLE',
      confidence: 0.93,
      explanation: `El selector ya usa aria-label, un atributo de accesibilidad estable. Se conserva tal cual.`,
      robustnessGain: 0,
      technicalReason: 'aria-label is an accessibility attribute purpose-built for stable identification',
      priority: 4,
    })
  }

  if (analysis.attributeKind === 'name') {
    strategies.push({
      selector,
      type: 'CSS',
      confidence: 0.85,
      explanation: `El selector ya usa el atributo name, razonablemente estable aunque puede no ser único. Se conserva tal cual.`,
      robustnessGain: 0,
      technicalReason: 'The name attribute is usually stable but may not be unique across the page',
      priority: 3,
    })
  }

  if (analysis.element === 'button') {
    const action = extractActionFromSelector(selector, actions)
    strategies.push({
      selector: `role('button', { name: '${action}' })`,
      type: 'ROLE',
      confidence: 0.92,
      explanation: `Se detectó un ${analysis.type} inestable; se cambió por un selector basado en accesibilidad (ARIA role) para mayor robustez.`,
      robustnessGain: 45,
      technicalReason: 'ARIA roles are stable across refactors and DOM restructures',
      priority: 4,
    })
    strategies.push({
      selector: `button:has-text('${action}')`,
      type: 'TEXT',
      confidence: 0.85,
      explanation: `Selector basado en texto visible del botón. Es menos estable que el rol pero más intuitivo para debugging.`,
      robustnessGain: 30,
      technicalReason: 'Text-based selectors work well for user-facing elements',
      priority: 5,
    })
  }

  if (analysis.element === 'input') {
    const fieldName = extractFieldName(selector, fields)
    strategies.push({
      selector: `input[placeholder*='${fieldName}']`,
      type: 'CSS',
      confidence: 0.88,
      explanation: `Selector basado en el placeholder del campo. Los placeholders son más estables que los IDs generados automáticamente.`,
      robustnessGain: 35,
      technicalReason: 'Placeholder attributes are typically stable and semantic',
      priority: 5,
    })
    strategies.push({
      selector: `label:has-text('${fieldName}') + input`,
      type: 'CSS',
      confidence: 0.90,
      explanation: `Selector basado en la relación semántica entre label e input. Altamente resiliente a cambios de estructura.`,
      robustnessGain: 40,
      technicalReason: 'Label-input relationships are semantically meaningful',
      priority: 5,
    })
  }

  if (analysis.element === 'link') {
    strategies.push({
      selector: `role('link', { name: '${extractActionFromSelector(selector, actions)}' })`,
      type: 'ROLE',
      confidence: 0.91,
      explanation: `Selector por rol de enlace con texto. Muy estable y accesible.`,
      robustnessGain: 42,
      technicalReason: 'Link roles with names are the gold standard for navigation',
      priority: 4,
    })
  }

  if (analysis.type === 'TESTID') {
    const attr = testidAttributeName(selector)
    strategies.push({
      selector: `[${attr}='${extractTestid(selector)}']`,
      type: 'TESTID',
      confidence: 0.95,
      explanation: `El testid se mantiene pero se normaliza la sintaxis. Los atributos ${attr} son la opción más estable cuando están disponibles.`,
      robustnessGain: 50,
      technicalReason: `${attr} attributes are purpose-built for testing stability`,
      priority: 1,
    })
  }

  if (analysis.type === 'XPATH') {
    strategies.push({
      selector: `role('button')`,
      type: 'ROLE',
      confidence: 0.82,
      explanation: `Se reemplazó el XPath frágil por un selector de rol. Los XPath dependen de la estructura exacta del DOM que cambia frecuentemente.`,
      robustnessGain: 55,
      technicalReason: 'XPath is the most fragile selector type; ARIA roles are preferred',
      priority: 4,
    })
  }

  // Selector basado en posición (nth-child/nth-of-type) sin otro patrón reconocido (element
  // sigue en 'element' genérico): no hay pista de acción/campo para armar un role con name,
  // así que se propone un role genérico de baja confianza en vez de caer al fallback
  // 'visible=' — al menos señala accesibilidad como dirección, requiere revisión manual.
  if (NTH_POSITION_RE.test(selector) && analysis.element === 'element') {
    strategies.push({
      selector: `role('button')`,
      type: 'ROLE',
      confidence: 0.76,
      explanation: `Selector basado en posición (nth-child/nth-of-type) — depende del orden exacto de hermanos en el DOM, se rompe con solo agregar/quitar un elemento vecino. Se propone un selector de rol como punto de partida; revisar manualmente para afinar el name.`,
      robustnessGain: 40,
      technicalReason: 'Position-based selectors (nth-child/nth-of-type) break whenever sibling elements are added, removed, or reordered',
      priority: 6,
    })
  }

  // Clase compuesta con un token volátil pegado a uno semántico estable (ej.
  // `.btn.css-1a2b3c4d5e`, común con CSS-in-JS) — se propone conservar solo los tokens
  // estables. Sin esto, un selector así sin keyword de acción reconocible caía
  // silenciosamente al fallback genérico de abajo pese a que el motor ya detectaba el
  // fragmento volátil (bug real: isDynamic quedaba en true pero nada lo consumía para CLASS).
  if (analysis.isDynamic && analysis.type === 'CLASS') {
    const stableTokens = (selector.match(/\.[a-zA-Z0-9_-]+/g) ?? []).filter(
      (token) => !VOLATILE_CLASS_RE.test(token.slice(1))
    )
    if (stableTokens.length > 0) {
      const candidate = stableTokens.join('')
      if (!isUnstableClassCandidate(selector, candidate.slice(1))) {
        strategies.push({
          selector: candidate,
          type: 'CSS',
          confidence: 0.80,
          explanation: `Se detectó una clase generada (CSS-in-JS) pegada a una clase semántica estable. Se propone conservar solo la parte estable.`,
          robustnessGain: 35,
          technicalReason: 'Generated CSS-in-JS classes change between builds; the semantic class alongside it is preferred',
          priority: 6,
        })
      }
    }
  }

  if (analysis.isDynamic && analysis.type === 'ID') {
    const baseClass = extractBaseClass(selector)
    if (!isUnstableClassCandidate(selector, baseClass)) {
      strategies.push({
        selector: `.${baseClass}`,
        type: 'CSS',
        confidence: 0.78,
        explanation: `Se detectó un ID dinámico con hash o número aleatorio. Se propuso una clase estable como alternativa.`,
        robustnessGain: 38,
        technicalReason: 'Dynamic IDs change between builds; stable classes are preferred',
        priority: 6,
      })
    }
  }

  if (strategies.length === 0) {
    strategies.push({
      selector: `visible=${selector.replace(/[.#]/, '')}`,
      type: 'CSS',
      confidence: 0.75,
      explanation: `Selector compuesto con filtro de visibilidad. Mayor robustez contra elementos ocultos.`,
      robustnessGain: 25,
      technicalReason: 'Visibility filters prevent interaction with hidden elements',
      priority: 5,
    })
  }

  // Escalera de estabilidad primero (prioridad, menor = mejor), confidence como desempate dentro del mismo nivel.
  return strategies.sort((a, b) => a.priority - b.priority || b.confidence - a.confidence)
}

/** Tipo de elemento que detecta el motor → rol ARIA con el que aparece en el árbol de la página. */
const ELEMENT_TO_ARIA_ROLE: Record<string, string> = {
  button: 'button',
  link: 'link',
  input: 'textbox',
}

/**
 * `role('button', { name: 'X' })` o `role('button')` → sus partes, para confrontarlo con la
 * página. El motor genera las dos formas: la de XPath y la de selectores posicionales no
 * llevan nombre, y también hay que poder desmentirlas (si no hay ningún botón en pantalla,
 * proponer `role('button')` es igual de inútil).
 */
function parseRoleStrategy(selector: string): { role: string; name?: string } | null {
  const withName = selector.match(/^role\('([^']+)',\s*\{\s*name:\s*'([^']*)'\s*\}\s*\)$/)
  if (withName) return { role: withName[1], name: withName[2] }

  const roleOnly = selector.match(/^role\('([^']+)'\)$/)
  return roleOnly ? { role: roleOnly[1] } : null
}

/**
 * Confronta las estrategias contra lo que había de verdad en la pantalla.
 *
 * Es el paso que separa una sugerencia de una adivinanza. Hace dos cosas:
 *
 * 1. **Descarta lo que no existe.** El motor propone nombres accesibles a partir de
 *    diccionarios (`login` → `Login`), así que sin evidencia terminaba ofreciendo cosas como
 *    `role('link', { name: 'Submit' })` para un `<a>` cualquiera. Si ese par rol+nombre no
 *    está en la página, la estrategia se cae.
 * 2. **Propone desde lo real.** Busca en la página un elemento del rol esperado y usa su
 *    nombre accesible verdadero, con confianza alta porque ya no hay nada que adivinar.
 *
 * Solo toca estrategias de tipo ROLE: el árbol de accesibilidad no expone `data-testid` ni
 * clases, así que una sugerencia TESTID/CSS no se puede ni confirmar ni desmentir con este
 * dato y se deja intacta.
 */
function applyPageEvidence(
  strategies: HealingStrategy[],
  pageElements: PageElement[],
  selector: string,
  analysis: SelectorAnalysis
): { strategies: HealingStrategy[]; sawPage: boolean } {
  const expectedRole = ELEMENT_TO_ARIA_ROLE[analysis.element]

  const survivors = strategies.filter((strategy) => {
    const role = parseRoleStrategy(strategy.selector)
    if (!role) return true
    return role.name === undefined
      ? findMatches(pageElements, role.role).length > 0
      : existsInPage(pageElements, role.role, role.name)
  })

  // El rol esperado es solo una pista: si el motor no supo deducirlo del texto del selector,
  // `bestElementFor` igual busca entre los elementos interactivos de la página.
  const real = bestElementFor(pageElements, selector, expectedRole)
  if (real) {
    survivors.unshift({
      selector: `role('${real.role}', { name: '${real.name}' })`,
      type: 'ROLE',
      confidence: 0.97,
      explanation: `Verificado contra la página: hay un ${real.role} con el nombre accesible "${real.name}". El nombre se leyó del árbol de accesibilidad capturado cuando el test falló, no se dedujo del texto del selector.`,
      robustnessGain: 50,
      technicalReason: `Confirmed against the accessibility tree captured at failure time: role=${real.role}, name=${real.name}`,
      priority: 0,
    })
    return { strategies: survivors, sawPage: true }
  }

  if (survivors.length === 0) {
    // Ninguna sugerencia sobrevivió y tampoco hay un elemento del rol esperado. Eso no es un
    // problema de selector: lo que el test buscaba no estaba en la pantalla. Decirlo vale más
    // que ofrecer un candidato inventado.
    const roleNote = expectedRole ? ` No hay ningún ${expectedRole} en la página.` : ''
    return {
      strategies: [
        {
          selector,
          type: 'CSS',
          confidence: 0.5,
          explanation: `Ninguna sugerencia sobrevivió al contraste con la página real.${roleNote} Puede que el elemento ya no exista: revisá si la funcionalidad sigue estando, en vez de buscarle otro selector.`,
          robustnessGain: 0,
          technicalReason: 'No candidate matched the accessibility tree captured at failure time',
          priority: 9,
        },
      ],
      sawPage: true,
    }
  }

  return { strategies: survivors, sawPage: true }
}

/**
 * Analiza un selector fallido y propone una heurística de sanado.
 *
 * Sin `htmlContext` es pattern-matching puro sobre el texto del selector, igual que siempre.
 * Con `htmlContext` (el árbol de accesibilidad que el framework capturó al fallar), las
 * sugerencias se confrontan contra lo que había de verdad en pantalla — ver `applyPageEvidence`.
 */
export function analyzeAndHeal(request: HealRequest): HealResponse {
  const { selector, customSynonyms } = request
  const analysis = analyzeSelector(selector)

  // Merge built-in dictionaries with project-level custom synonyms.
  const actions = { ...ACTIONS, ...customSynonyms?.actions }
  const fields = { ...FIELDS, ...customSynonyms?.fields }

  let strategies = generateHealingStrategies(selector, analysis, actions, fields)

  // Sin árbol de página el comportamiento es exactamente el de siempre — de eso se encarga
  // el snapshot del corpus de selectores, que no debe moverse por este cambio.
  const pageElements = parsePageSnapshot(request.htmlContext)
  let verified = false
  if (pageElements.length > 0) {
    const evidence = applyPageEvidence(strategies, pageElements, selector, analysis)
    strategies = evidence.strategies
    verified = evidence.sawPage && strategies[0]?.priority === 0
  }

  const bestStrategy = strategies[0] ?? {
    selector: 'body',
    type: 'CSS' as const,
    confidence: 0.5,
    explanation: 'Unable to generate a reliable selector. Manual review required.',
    robustnessGain: 0,
    technicalReason: 'No suitable pattern found',
    priority: 9,
  }

  // El ajuste determinístico existe para desempatar entre adivinanzas parejas. Cuando la
  // sugerencia se confirmó contra la página no hay nada que desempatar: se respeta su
  // confianza tal cual, sin ruido de hash.
  const adjustedConfidence = verified
    ? bestStrategy.confidence
    : Math.max(0.75, Math.min(0.98, bestStrategy.confidence + deterministicAdjustment(selector)))
  const needsReview = adjustedConfidence < 0.80

  return {
    verified,
    fixedSelector: bestStrategy.selector,
    confidence: Math.round(adjustedConfidence * 100) / 100,
    explanation: bestStrategy.explanation,
    selectorType: bestStrategy.type,
    alternatives: strategies.slice(1, 4).map((s) => ({
      selector: s.selector,
      confidence: Math.round(s.confidence * 100) / 100,
    })),
    needsReview,
    robustnessImprovement: bestStrategy.robustnessGain,
    technicalDetails: {
      detectedIssue: analysis.issues[0] ?? 'Selector pattern analysis',
      proposedSolution: bestStrategy.technicalReason,
      accessibilityCompliant: bestStrategy.type === 'ROLE' || bestStrategy.type === 'TEXT',
      stableAgainstDOMChanges: bestStrategy.type !== 'XPATH',
    },
  }
}
