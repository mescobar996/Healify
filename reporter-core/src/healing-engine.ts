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
import { buildRoleSuggestion, buildGenericRoleHint, parseRoleSuggestion } from './role-locator'
import { findRepertoireMatch, type HistoryEntry } from './repertoire'

export interface HealRequest {
  selector: string
  htmlContext?: string
  testName?: string
  errorMessage?: string
  /** Sinónimos adicionales del proyecto — se mergean con los built-in EN/ES. */
  customSynonyms?: { actions?: Record<string, string>; fields?: Record<string, string> }
  /** Atributos de test-id adicionales del proyecto — se extienden con los 5 built-in
   * (data-testid, data-cy, data-qa, data-test, data-e2e). Solo se aceptan atributos que
   * empiecen con "data-"; los que no matcheen se ignoran silenciosamente. */
  customTestIds?: string[]
  /** Archivo donde vive el test — junto con `selector` es el criterio de coincidencia del
   * repertorio (mismo criterio que `defectId`). `undefined` en Selenium/WebdriverIO, que no
   * tienen esta granularidad en ningún otro lado del modelo. */
  testFile?: string
  /** Historial de curaciones ya confirmadas (`.healify/history.jsonl`), leído por el adapter.
   * `reporter-core` no toca el disco acá — el caller decide qué repertorio pasar. */
  repertoire?: HistoryEntry[]
  /** Cuántas alternativas devolver además de la principal (`recovery-tries` de Healenium).
   * Default: 3. */
  maxAlternatives?: number
}

export type SelectorType = 'CSS' | 'XPATH' | 'TESTID' | 'ROLE' | 'TEXT' | 'MIXED'

/** Type guard: si el string vino de un dato externo (repertorio, JSON), solo se acepta si
 * es un valor válido de `SelectorType` — sin `as`, sin aceptar ruido. */
function isSelectorType(value: string): value is SelectorType {
  switch (value) {
    case 'CSS':
    case 'XPATH':
    case 'TESTID':
    case 'ROLE':
    case 'TEXT':
    case 'MIXED':
      return true
    default:
      return false
  }
}

/** `SelectorAnalysis['type']` tiene valores que `SelectorType` no cubre (ID/CLASS/ATTRIBUTE/
 * COMPOUND clasifican como CSS en `SelectorType`). En el único punto donde se cruzan (estrategia
 * de locator moderno) el tipo es siempre ROLE/TEXT/TESTID/CSS — el switch las preserva tal cual */
function selectorTypeForStrategy(type: SelectorAnalysis['type']): SelectorType {
  switch (type) {
    case 'TESTID':
      return 'TESTID'
    case 'ROLE':
      return 'ROLE'
    case 'TEXT':
      return 'TEXT'
    case 'XPATH':
      return 'XPATH'
    default:
      return 'CSS'
  }
}

/**
 * `buildRoleSuggestion` devuelve `null` solo cuando el nombre accesible es vacío, y en los tres
 * puntos que la usan el nombre ya se sabe no vacío (acción con default 'Submit', o `real.name`
 * chequeado arriba) — el `null` es inalcanzable en la práctica. Este wrapper cierra el tipo sin
 * non-null assertion (`!`): si igualmente llegara un nombre vacío, cae a la pista genérica de
 * revisión (un `role('button')` legible) en vez de romper el tipado.
 */
function strictRoleSuggestion(role: string, name: string): string {
  return buildRoleSuggestion(role, name) ?? buildGenericRoleHint(role)
}

export interface HealResponse {
  /** true si la sugerencia se confrontó contra el árbol real de la página (esta corrida o,
   * vía repertorio, una anterior) y existe ahí. false = heurística a ciegas, el modo de siempre. */
  verified: boolean
  /** true si `verified` viene del repertorio (una corrida anterior), no de esta corrida. */
  fromRepertoire: boolean
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
  /** Selector compuesto con combinador CSS (`.padre > .hijo`, `.card .title`, `div + span`) —
   * depende de la relación exacta entre dos elementos en el DOM, no solo del elemento buscado. */
  isCompoundCombinator?: boolean
}

interface HealingStrategy {
  selector: string
  type: HealResponse['selectorType']
  confidence: number
  explanation: string
  robustnessGain: number
  technicalReason: string
  /** Escalera de atributos estables: 0=role verificado en vivo, 1=testid real del DOM,
   * 3=name, 4=aria-label/role, 5=texto visible, 6=clase.
   * (2="id estable" no tiene candidato propio hoy — no existe ese caso en el motor.) */
  priority: number
  /**
   * Verdadero solo para estrategias que nacen de confrontar el selector contra la página real
   * (`applyPageEvidence`): el elemento existe y la sugerencia se basa en lo que había en
   * pantalla, no en adivinanzas del texto del selector. Es lo que decide `verified` — no la
   * priority: una pista degradada (rol sin nombre) vive en priority 4 pero sigue siendo
   * evidencia real, y así conserva su confidence sin re-ajustar.
   */
  pageVerified?: boolean
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

const NTH_POSITION_RE = /:nth-(?:child|of-type)\(/

// Selectores de tipo texto ya cubiertos por otras ramas: sus espacios internos (adentro de
// comillas o paréntesis) no son un combinador CSS, y ya tienen su propio tratamiento — no deben
// entrar a la detección de combinador compuesto.
const TEXT_LIKE_SELECTOR_RE = /has-text\(|text=|getBy|^role\(/

/**
 * Reemplaza el contenido entre comillas por 'x', preservando comillas y longitud — así un
 * índice calculado sobre el string "enmascarado" sigue apuntando al mismo lugar en el selector
 * original, y un espacio real DENTRO de un valor de atributo (`[data-testid="add to cart"]`) o
 * de un texto (`has-text('Add to cart')`) no se confunde con un combinador CSS real.
 */
function maskQuotedContent(selector: string): string {
  return selector.replace(/'[^']*'|"[^"]*"/g, (match) => match[0] + 'x'.repeat(match.length - 2) + match[match.length - 1])
}

const COMBINATOR_TOKEN_RE = /\s*[>+~]\s*|\s+/

/**
 * Combinador CSS compuesto (`.padre > .hijo`, `.card .title`, `div + span`) — a diferencia de
 * un selector simple, depende de la relación exacta entre dos elementos en el DOM: agregar un
 * wrapper, reordenar hermanos o achatar un nivel de anidamiento lo rompe aunque el elemento
 * buscado en sí no haya cambiado en nada.
 */
function hasCompoundCombinator(selector: string): boolean {
  if (selector.startsWith('//') || TEXT_LIKE_SELECTOR_RE.test(selector)) return false
  return COMBINATOR_TOKEN_RE.test(maskQuotedContent(selector))
}

/**
 * Último segmento del selector, después del combinador más a la derecha — el elemento que el
 * selector busca en definitiva, sin la ruta de ancestros/hermanos que lo precede.
 */
function extractCombinatorTarget(selector: string): string {
  const masked = maskQuotedContent(selector)
  const re = new RegExp(COMBINATOR_TOKEN_RE, 'g')
  let lastEnd = 0
  let match: RegExpExecArray | null
  while ((match = re.exec(masked)) !== null) {
    lastEnd = match.index + match[0].length
  }
  return selector.slice(lastEnd).trim()
}

function analyzeSelector(selector: string, testIds: readonly string[] = TESTID_ATTRS): SelectorAnalysis {
  const analysis: SelectorAnalysis = {
    type: 'CSS',
    issues: [],
    element: 'element',
    action: 'interact',
    isDynamic: false,
    isFragile: false,
  }

  const modern = detectModernLocator(selector)
  if (modern) return modern

  classifySelectorType(analysis, selector, testIds)
  detectFragilityFlags(analysis, selector)
  detectElementAndAction(analysis, selector)

  return analysis
}

/** Locators modernos de Playwright (getByRole/getByText/...) ya son la práctica recomendada: no proponer downgrade. */
function detectModernLocator(selector: string): SelectorAnalysis | null {
  const match = selector.match(/^getBy(Role|Text|Label|Placeholder|TestId)\(/)
  if (!match) return null
  const kind = match[1]
  return {
    type: kind === 'Role' ? 'ROLE' : kind === 'Text' ? 'TEXT' : kind === 'TestId' ? 'TESTID' : 'CSS',
    issues: [],
    element: 'element',
    action: 'interact',
    isDynamic: false,
    isFragile: false,
    isAlreadyModernLocator: true,
  }
}

/** Clasifica el tipo de selector por prefijo/atributos (ID, CLASS, TESTID, XPATH, ROLE, TEXT, ATTRIBUTE). */
function classifySelectorType(analysis: SelectorAnalysis, selector: string, testIds: readonly string[]): void {
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
  } else if (testIds.some((attr) => selector.includes(`[${attr}=`))) {
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
}

/** Marca fragilidad estructural (posiciones y combinadores) — independiente del tipo detectado arriba. */
function detectFragilityFlags(analysis: SelectorAnalysis, selector: string): void {
  if (NTH_POSITION_RE.test(selector)) {
    analysis.isFragile = true
    analysis.issues.push('Position-based selector (nth-child/nth-of-type) depends on exact sibling order in the DOM')
  }

  if (hasCompoundCombinator(selector)) {
    analysis.isFragile = true
    analysis.isCompoundCombinator = true
    analysis.issues.push('Compound selector with a CSS combinator (descendant/child/sibling) depends on the ancestor/sibling structure in the DOM')
  }
}

/** Infiere qué elemento busca el selector (botón, input, link...) y la acción asociada. */
function detectElementAndAction(analysis: SelectorAnalysis, selector: string): void {
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

/**
 * Escapa caracteres especiales de regex. Necesario porque `customTestIds` viene de la
 * configuración del proyecto (controlable por quien escribe el healify.config) y se interpola
 * directo en un `new RegExp(...)` en `extractTestid`: un sufijo como `foo(bar` o `a|b` sin
 * escapar rompería o inyectaría el patrón (ReDoS/inyección de regex). Se usa un escape propio
 * en vez de `RegExp.escape` para seguir funcionando en Node 18 (el `engines` del paquete).
 */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function extractTestid(selector: string, testIds: readonly string[] = TESTID_ATTRS): string {
  const suffixes = testIds.map((t) => t.replace('data-', '')).map(escapeRegExp)
  const match = selector.match(new RegExp(`data-(?:${suffixes.join('|')})=['"]([^'"]+)['"]`))
  return match ? match[1] : 'element'
}

/** Cada framework/equipo tiene su propia convención (data-cy en Cypress, data-qa/data-test/data-e2e
 * en otros) — reescribir a otro atributo rompería el selector, se conserva el que ya está presente. */
function testidAttributeName(selector: string, testIds: readonly string[] = TESTID_ATTRS): string {
  return testIds.find((attr) => selector.includes(`[${attr}=`)) ?? 'data-testid'
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

function generateHealingStrategies(selector: string, analysis: SelectorAnalysis, actions: Record<string, string>, fields: Record<string, string>, testIds: readonly string[] = TESTID_ATTRS): HealingStrategy[] {
  if (analysis.isAlreadyModernLocator) {
    return [{
      selector,
      type: selectorTypeForStrategy(analysis.type),
      confidence: 0.80,
      explanation: 'El selector ya usa un locator moderno de Playwright (getBy*), que es la práctica recomendada. No se propone downgrade — sin acceso al DOM real no se puede saber por qué dejó de encontrar el elemento; puede ser un cambio genuino de la UI que amerita revisión manual.',
      robustnessGain: 0,
      technicalReason: 'Modern Playwright locators are already best practice; the failure likely reflects a real UI change, not a selector quality issue',
      priority: 4,
    }]
  }

  const strategies: HealingStrategy[] = [
    stableAttributeStrategy(selector, analysis),
    buttonStrategy(selector, analysis, actions),
    inputStrategy(selector, analysis, fields),
    linkStrategy(selector, analysis, actions),
    testidStrategy(selector, analysis, testIds),
    xpathStrategy(selector, analysis),
    nthPositionStrategy(selector, analysis),
    dynamicClassStrategy(selector, analysis),
    dynamicIdStrategy(selector, analysis),
    compoundCombinatorStrategy(selector, analysis, testIds),
  ].flatMap((strategy) => (strategy ? strategy : []))

  // El fallback del compuesto solo aplica si NINGUNA estrategia anterior (ni la del propio
  // bloque) encontró algo: si ya hay un candidato, no tiene sentido pisarlo con un role genérico.
  if (analysis.isCompoundCombinator && strategies.length === 0) {
    strategies.push(...genericCompoundFallback(selector))
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

/** Selectores que ya usan un atributo de accesibilidad estable (aria-label/name): se conservan tal cual. */
function stableAttributeStrategy(selector: string, analysis: SelectorAnalysis): HealingStrategy[] | null {
  if (analysis.attributeKind === 'aria-label') {
    return [{
      selector,
      type: 'ROLE',
      confidence: 0.93,
      explanation: 'El selector ya usa aria-label, un atributo de accesibilidad estable. Se conserva tal cual.',
      robustnessGain: 0,
      technicalReason: 'aria-label is an accessibility attribute purpose-built for stable identification',
      priority: 4,
    }]
  }
  if (analysis.attributeKind === 'name') {
    return [{
      selector,
      type: 'CSS',
      confidence: 0.85,
      explanation: 'El selector ya usa el atributo name, razonablemente estable aunque puede no ser único. Se conserva tal cual.',
      robustnessGain: 0,
      technicalReason: 'The name attribute is usually stable but may not be unique across the page',
      priority: 3,
    }]
  }
  return null
}

/** Botones: role con la acción deducida del texto del selector + fallback por texto visible. */
function buttonStrategy(selector: string, analysis: SelectorAnalysis, actions: Record<string, string>): HealingStrategy[] | null {
  if (analysis.element !== 'button') return null
  const action = extractActionFromSelector(selector, actions)
  return [
    {
      selector: strictRoleSuggestion('button', action),
      type: 'ROLE',
      confidence: 0.92,
      explanation: `Se detectó un ${analysis.type} inestable; se cambió por un selector basado en accesibilidad (ARIA role) para mayor robustez.`,
      robustnessGain: 45,
      technicalReason: 'ARIA roles are stable across refactors and DOM restructures',
      priority: 4,
    },
    {
      selector: `button:has-text('${action}')`,
      type: 'TEXT',
      confidence: 0.85,
      explanation: 'Selector basado en texto visible del botón. Es menos estable que el rol pero más intuitivo para debugging.',
      robustnessGain: 30,
      technicalReason: 'Text-based selectors work well for user-facing elements',
      priority: 5,
    },
  ]
}

/** Inputs: placeholder y relación semántica label→input. */
function inputStrategy(selector: string, analysis: SelectorAnalysis, fields: Record<string, string>): HealingStrategy[] | null {
  if (analysis.element !== 'input') return null
  const fieldName = extractFieldName(selector, fields)
  return [
    {
      selector: `input[placeholder*='${fieldName}']`,
      type: 'CSS',
      confidence: 0.88,
      explanation: 'Selector basado en el placeholder del campo. Los placeholders son más estables que los IDs generados automáticamente.',
      robustnessGain: 35,
      technicalReason: 'Placeholder attributes are typically stable and semantic',
      priority: 5,
    },
    {
      selector: `label:has-text('${fieldName}') + input`,
      type: 'CSS',
      confidence: 0.90,
      explanation: 'Selector basado en la relación semántica entre label e input. Altamente resiliente a cambios de estructura.',
      robustnessGain: 40,
      technicalReason: 'Label-input relationships are semantically meaningful',
      priority: 5,
    },
  ]
}

/** Links: role de enlace con el texto deducido. */
function linkStrategy(selector: string, analysis: SelectorAnalysis, actions: Record<string, string>): HealingStrategy[] | null {
  if (analysis.element !== 'link') return null
  return [{
    selector: strictRoleSuggestion('link', extractActionFromSelector(selector, actions)),
    type: 'ROLE',
    confidence: 0.91,
    explanation: 'Selector por rol de enlace con texto. Muy estable y accesible.',
    robustnessGain: 42,
    technicalReason: 'Link roles with names are the gold standard for navigation',
    priority: 4,
  }]
}

/** Testid: se conserva el atributo pero se normaliza la sintaxis. */
function testidStrategy(selector: string, analysis: SelectorAnalysis, testIds: readonly string[]): HealingStrategy[] | null {
  if (analysis.type !== 'TESTID') return null
  const attr = testidAttributeName(selector, testIds)
  return [{
    selector: `[${attr}='${extractTestid(selector, testIds)}']`,
    type: 'TESTID',
    confidence: 0.95,
    explanation: `El testid se mantiene pero se normaliza la sintaxis. Los atributos ${attr} son la opción más estable cuando están disponibles.`,
    robustnessGain: 50,
    technicalReason: `${attr} attributes are purpose-built for testing stability`,
    priority: 1,
  }]
}

/** XPath frágil: se reemplaza por un role genérico. */
function xpathStrategy(selector: string, analysis: SelectorAnalysis): HealingStrategy[] | null {
  if (analysis.type !== 'XPATH') return null
  return [{
    selector: buildGenericRoleHint('button'),
    type: 'ROLE',
    confidence: 0.82,
    explanation: 'Se reemplazó el XPath frágil por un selector de rol. Los XPath dependen de la estructura exacta del DOM que cambia frecuentemente.',
    robustnessGain: 55,
    technicalReason: 'XPath is the most fragile selector type; ARIA roles are preferred',
    priority: 4,
  }]
}

/** Posición (nth-child/nth-of-type) sin pista de acción: role genérico de baja confianza como punto de partida. */
function nthPositionStrategy(selector: string, analysis: SelectorAnalysis): HealingStrategy[] | null {
  if (!NTH_POSITION_RE.test(selector) || analysis.element !== 'element') return null
  return [{
    selector: buildGenericRoleHint('button'),
    type: 'ROLE',
    confidence: 0.76,
    explanation: 'Selector basado en posición (nth-child/nth-of-type) — depende del orden exacto de hermanos en el DOM, se rompe con solo agregar/quitar un elemento vecino. Se propone un selector de rol como punto de partida; revisar manualmente para afinar el name.',
    robustnessGain: 40,
    technicalReason: 'Position-based selectors (nth-child/nth-of-type) break whenever sibling elements are added, removed, or reordered',
    priority: 6,
  }]
}

/** Clase CSS-in-JS con token volátil pegado a uno semántico estable: conservar solo la parte estable. */
function dynamicClassStrategy(selector: string, analysis: SelectorAnalysis): HealingStrategy[] | null {
  if (!analysis.isDynamic || analysis.type !== 'CLASS') return null
  const stableTokens = (selector.match(/\.[a-zA-Z0-9_-]+/g) ?? []).filter(
    (token) => !VOLATILE_CLASS_RE.test(token.slice(1))
  )
  if (stableTokens.length === 0) return null
  const candidate = stableTokens.join('')
  if (isUnstableClassCandidate(selector, candidate.slice(1))) return null
  return [{
    selector: candidate,
    type: 'CSS',
    confidence: 0.80,
    explanation: 'Se detectó una clase generada (CSS-in-JS) pegada a una clase semántica estable. Se propone conservar solo la parte estable.',
    robustnessGain: 35,
    technicalReason: 'Generated CSS-in-JS classes change between builds; the semantic class alongside it is preferred',
    priority: 6,
  }]
}

/** ID dinámico con hash: se propone la clase base estable como alternativa. */
function dynamicIdStrategy(selector: string, analysis: SelectorAnalysis): HealingStrategy[] | null {
  if (!analysis.isDynamic || analysis.type !== 'ID') return null
  const baseClass = extractBaseClass(selector)
  if (isUnstableClassCandidate(selector, baseClass)) return null
  return [{
    selector: `.${baseClass}`,
    type: 'CSS',
    confidence: 0.78,
    explanation: 'Se detectó un ID dinámico con hash o número aleatorio. Se propuso una clase estable como alternativa.',
    robustnessGain: 38,
    technicalReason: 'Dynamic IDs change between builds; stable classes are preferred',
    priority: 6,
  }]
}

/**
 * Selector compuesto con combinador CSS (`.padre > .hijo`, `.card .title`, `div + span`):
 * depende de la relación exacta entre dos elementos en el DOM, no solo del elemento buscado.
 * Se propone conservar solo el elemento objetivo (el último segmento, después del combinador
 * más a la derecha), sin la ruta de ancestros.
 */
function compoundCombinatorStrategy(selector: string, analysis: SelectorAnalysis, testIds: readonly string[]): HealingStrategy[] | null {
  if (!analysis.isCompoundCombinator) return null
  const target = extractCombinatorTarget(selector)
  const targetTestidAttr = testIds.find((attr) => target.includes(`[${attr}=`))

  if (targetTestidAttr) {
    // Confianza más alta que el testid "plano" (0.95) a propósito: acá además se identificó
    // y descartó una ruta de ancestros frágil, así que corresponde ganarle en el sort al
    // bloque TESTID genérico — que sobre un selector compuesto con DOS testids
    // (`[data-testid="card"] [data-testid="buy-btn"]`) extrae el del ancestro por error
    // (regex sin /g, toma el primer match de todo el string), no el del objetivo real.
    return [{
      selector: `[${targetTestidAttr}='${extractTestid(target, testIds)}']`,
      type: 'TESTID',
      confidence: 0.96,
      explanation: `Selector compuesto con combinador CSS — depende de la ruta de ancestros, no solo del elemento buscado. Se conserva el testid del elemento objetivo (${target}), descartando la ruta.`,
      robustnessGain: 50,
      technicalReason: 'Combinator-based selectors are brittle to markup restructuring; the target testid attribute is independent of ancestor structure',
      priority: 1,
    }]
  }

  if (target.startsWith('.') && !hasVolatileClassToken(target)) {
    return [{
      selector: target,
      type: 'CSS',
      confidence: 0.80,
      explanation: `Selector compuesto con combinador CSS — depende de la relación exacta entre ancestro y elemento objetivo, se rompe si se agrega un wrapper o se reordena el markup. Se propone conservar solo el elemento objetivo (${target}), sin la ruta de ancestros.`,
      robustnessGain: 35,
      technicalReason: 'Combinator-based selectors break when markup structure changes even if the target element itself is unchanged',
      priority: 6,
    }]
  }

  if (target.startsWith('#') && !VOLATILE_ID_RE.test(target)) {
    return [{
      selector: target,
      type: 'CSS',
      confidence: 0.80,
      explanation: `Selector compuesto con combinador CSS — depende de la relación exacta entre ancestro y elemento objetivo. Se propone conservar solo el elemento objetivo (${target}), sin la ruta de ancestros.`,
      robustnessGain: 35,
      technicalReason: 'Combinator-based selectors break when markup structure changes even if the target element itself is unchanged',
      priority: 6,
    }]
  }

  if (target.startsWith('#') && VOLATILE_ID_RE.test(target)) {
    const baseClass = extractBaseClass(target)
    if (!isUnstableClassCandidate(target, baseClass)) {
      return [{
        selector: `.${baseClass}`,
        type: 'CSS',
        confidence: 0.75,
        explanation: `Selector compuesto con combinador CSS, y el elemento objetivo (${target}) tiene un ID dinámico. Se propone una clase estable derivada, sin la ruta de ancestros.`,
        robustnessGain: 35,
        technicalReason: 'Combinator-based selectors are brittle; the target ID is additionally dynamic, so a stable class is proposed instead',
        priority: 6,
      }]
    }
  }

  return null
}

/**
 * Fallback del compuesto: ni testid, ni clase, ni ID estable en el objetivo (ej. un tag
 * suelto, `a`, `span`) — no hay nada estable para proponer directo. Se ofrece un role
 * genérico como punto de partida en vez de dejar caer al fallback `visible=` de abajo, que
 * solo recorta el PRIMER carácter `.`/`#` de todo el selector sin entender que hay una ruta
 * de ancestros de por medio (`.card .title` → `visible=card .title`, ni CSS válido).
 */
function genericCompoundFallback(selector: string): HealingStrategy[] {
  const target = extractCombinatorTarget(selector)
  return [{
    selector: buildGenericRoleHint('button'),
    type: 'ROLE',
    confidence: 0.74,
    explanation: `Selector compuesto con combinador CSS (\`${selector}\`) — depende de la ruta de ancestros/hermanos en el DOM, se rompe con cualquier cambio de markup aunque el elemento buscado no haya cambiado. El elemento objetivo (${target}) no tiene un atributo estable reconocible; se propone un selector de rol como punto de partida, revisar manualmente para afinar el name.`,
    robustnessGain: 30,
    technicalReason: 'Combinator-based selectors depend on ancestor/sibling structure; no stable attribute was found on the target element',
    priority: 6,
  }]
}

/** Tipo de elemento que detecta el motor → rol ARIA con el que aparece en el árbol de la página. */
const ELEMENT_TO_ARIA_ROLE: Record<string, string> = {
  button: 'button',
  link: 'link',
  input: 'textbox',
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
  const survivors = filterSurvivors(strategies, pageElements)

  // El rol esperado es solo una pista: si el motor no supo deducirlo del texto del selector,
  // `bestElementFor` igual busca entre los elementos interactivos de la página.
  const real = bestElementFor(pageElements, selector, expectedRole)
  if (real) {
    const ctx = shadowPierceContext(real)
    const inFrame = real.frame

    // MEJORA 3 — el elemento puede vivir dentro de shadow DOM. Un locator CSS/XPath plano NO
    // resuelve ahí: los selectores no atraviesan shadowRoots por especificación, hay que hacer
    // pierce de cada nivel. Igual que el frame, sugerirlo callado manda al usuario a un test
    // que sigue fallando; se avisa la cadena exacta (shadowDepth + shadowPath) para que sepa
    // qué pierce hacer. `pierceNote`/`pierceReason` van vacíos cuando el elemento está en
    // light DOM, así las ramas de abajo quedan exactamente como antes en ese caso.

    // El elemento tiene nombre accesible: se propone el role verificado en vivo (priority 0),
    // la sugerencia más confiable del motor. Su texto se leyó del árbol de accesibilidad
    // capturado cuando el test falló, no se dedujo del selector.
    const roleEvidence = verifiedRoleEvidence(real, inFrame, ctx)
    if (roleEvidence) survivors.unshift(roleEvidence)

    // MEJORA 1 — sugerir el data-testid REAL del DOM. El probe en vivo (Selenium/WebdriverIO/
    // Cypress) trae el atributo de test-id del elemento encontrado: si existe, se propone como
    // estrategia TESTID justo después del role verificado (priority 1), que es el único que lo
    // supera. El testid se lee del DOM, no se inventa (regla "Cero Inventos"), y se conserva el
    // atributo original (data-cy/data-test/...) para no reescribir a uno que no existe.
    //
    // MEJORA 2 — si el elemento NO tiene nombre accesible, el testid pasa a ser la sugerencia
    // principal (index 0): es la mejor señal estable disponible en ese caso.
    const testidEvidence = verifiedTestidEvidence(real, !real.name, ctx)
    if (testidEvidence) survivors.splice(!real.name ? 0 : 1, 0, testidEvidence)

    // MEJORA 2 — sin nombre accesible y sin testid: no hay ninguna señal estable que proponer.
    // Un role('X') a secas matchea de más y no tiene XPath ejecutable, así que se degrada a una
    // pista de revisión manual (confianza baja, priority alta) en vez de sugerirse como si
    // fuera un selector aplicable. Sigue siendo evidencia de que el elemento existe.
    const namelessEvidence = namelessRoleEvidence(real, ctx)
    if (namelessEvidence) survivors.unshift(namelessEvidence)

    return { strategies: survivors, sawPage: true }
  }

  if (survivors.length === 0) {
    // Ninguna sugerencia sobrevivió y tampoco hay un elemento del rol esperado. Eso no es un
    // problema de selector: lo que el test buscaba no estaba en la pantalla. Decirlo vale más
    // que ofrecer un candidato inventado.
    return { strategies: noEvidenceFallback(selector, expectedRole), sawPage: true }
  }

  return { strategies: survivors, sawPage: true }
}

/**
 * Conserva solo las estrategias ROLE cuyo rol+nombre existen en la página; las demás quedan
 * intactas (el árbol de accesibilidad no expone testid/clases, así que TESTID/CSS no se
 * pueden ni confirmar ni desmentir con este dato).
 */
function filterSurvivors(strategies: HealingStrategy[], pageElements: PageElement[]): HealingStrategy[] {
  return strategies.filter((strategy) => {
    const role = parseRoleSuggestion(strategy.selector)
    if (!role) return true
    return role.name === undefined
      ? findMatches(pageElements, role.role).length > 0
      : existsInPage(pageElements, role.role, role.name)
  })
}

/** Info del pierce de shadow DOM: cadena de ruta y notas en español/inglés para el reporte. Vacío en light DOM. */
function shadowPierceContext(real: PageElement): { inShadow: boolean; pierceNote: string; pierceReason: string } {
  const inShadow = (real.shadowDepth ?? 0) > 0
  if (!inShadow) return { inShadow, pierceNote: '', pierceReason: '' }
  const shadowChain = real.shadowPath?.length ? ` (${real.shadowPath.join(' > ')})` : ''
  return {
    inShadow,
    pierceNote: ` vive dentro de ${real.shadowDepth} shadow root${real.shadowDepth === 1 ? '' : 's'}${shadowChain} — los selectores CSS/XPath no atraviesan shadow DOM por especificación, hay que hacer pierce de cada nivel (\`.shadow()\` en Cypress, \`.shadowRoot\` en Selenium/WebdriverIO) antes de que el selector resuelva`,
    pierceReason: `; nested ${real.shadowDepth} shadow root${real.shadowDepth === 1 ? '' : 's'} deep (${real.shadowPath?.join(' > ') ?? '?'}): CSS/XPath cannot pierce shadow DOM, each shadowRoot must be pierced before the locator resolves`,
  }
}

/**
 * Sugerencia principal: el role verificado en vivo (priority 0). La confianza solo baja dentro
 * de un iframe: entrar a un frame requiere un paso extra que ningún locator de rol hace solo
 * (`frameLocator`/`switchTo().frame`). El shadow DOM NO penaliza — los locators de rol
 * atraviesan shadow roots por especificación — solo se avisa la cadena de pierce.
 */
function verifiedRoleEvidence(real: PageElement, inFrame: string | undefined, ctx: { inShadow: boolean; pierceNote: string; pierceReason: string }): HealingStrategy | null {
  if (!real.name) return null
  return {
    selector: strictRoleSuggestion(real.role, real.name),
    type: 'ROLE',
    confidence: inFrame ? 0.88 : 0.97,
    explanation: inFrame
      ? `Verificado contra la página: hay un ${real.role} con el nombre accesible "${real.name}", pero está DENTRO del iframe ${inFrame}. Un locator a nivel de página no lo encuentra: primero hay que entrar al frame (\`frameLocator('${inFrame}')\` en Playwright, \`switchTo().frame(...)\` en Selenium) y recién ahí aplicar el selector.${ctx.pierceNote ? ` Además${ctx.pierceNote}.` : ''}`
      : ctx.inShadow
        ? `Verificado contra la página: hay un ${real.role} con el nombre accesible "${real.name}", pero${ctx.pierceNote}.`
        : `Verificado contra la página: hay un ${real.role} con el nombre accesible "${real.name}". El nombre se leyó del árbol de accesibilidad capturado cuando el test falló, no se dedujo del texto del selector.`,
    robustnessGain: 50,
    technicalReason: inFrame
      ? `Confirmed against the accessibility tree captured at failure time, but inside iframe ${inFrame}: a frame switch is required before this locator resolves${ctx.pierceReason}`
      : `Confirmed against the accessibility tree captured at failure time: role=${real.role}, name=${real.name}${ctx.pierceReason}`,
    priority: 0,
    pageVerified: true,
  }
}

/** El data-testid real del DOM como estrategia TESTID, justo después del role verificado (o primero si no hay nombre). */
function verifiedTestidEvidence(real: PageElement, isPrimary: boolean, ctx: { pierceNote: string; pierceReason: string }): HealingStrategy | null {
  if (!real.testId) return null
  const attr = real.testIdAttr ?? 'data-testid'
  return {
    selector: `[${attr}='${real.testId}']`,
    type: 'TESTID',
    confidence: 0.94,
    explanation: isPrimary
      ? `Verificado contra la página: el elemento sigue presente pero NO expone nombre accesible; conserva el atributo ${attr}="${real.testId}", que es la señal más estable disponible en este caso.${ctx.pierceNote ? ` Además${ctx.pierceNote}.` : ''}`
      : `Verificado contra la página: el elemento sigue presente y conserva el atributo ${attr}="${real.testId}". Es el selector más estable disponible — solo el role verificado en vivo lo supera.${ctx.pierceNote ? ` Además${ctx.pierceNote}.` : ''}`,
    robustnessGain: 50,
    technicalReason: `The real DOM element still carries a stable ${attr} attribute${ctx.pierceReason}`,
    priority: 1,
    pageVerified: true,
  }
}

/** Sin nombre accesible ni testid: pista de revisión manual (confianza baja, priority alta), no un selector aplicable. */
function namelessRoleEvidence(real: PageElement, ctx: { pierceNote: string; pierceReason: string }): HealingStrategy | null {
  if (real.name || real.testId) return null
  return {
    selector: buildGenericRoleHint(real.role),
    type: 'ROLE',
    confidence: 0.7,
    explanation: `Verificado contra la página: hay un ${real.role} en pantalla, pero SIN nombre accesible. Un role('${real.role}') sin name matchearía todos los de ese tipo — requiere revisión manual antes de aplicar.${ctx.pierceNote ? ` Además${ctx.pierceNote}.` : ''}`,
    robustnessGain: 20,
    technicalReason: `The element exists but has no accessible name; a nameless role locator is ambiguous and requires manual review${ctx.pierceReason}`,
    priority: 4,
    pageVerified: true,
  }
}

/** Nada sobrevivió y tampoco hay un elemento del rol esperado: lo que el test buscaba no estaba en la pantalla. */
function noEvidenceFallback(selector: string, expectedRole: string | undefined): HealingStrategy[] {
  const roleNote = expectedRole ? ` No hay ningún ${expectedRole} en la página.` : ''
  return [{
    selector,
    type: 'CSS',
    confidence: 0.5,
    explanation: `Ninguna sugerencia sobrevivió al contraste con la página real.${roleNote} Puede que el elemento ya no exista: revisá si la funcionalidad sigue estando, en vez de buscarle otro selector.`,
    robustnessGain: 0,
    technicalReason: 'No candidate matched the accessibility tree captured at failure time',
    priority: 9,
  }]
}

/**
 * Analiza un selector fallido y propone una heurística de sanado.
 *
 * Sin `htmlContext` es pattern-matching puro sobre el texto del selector, igual que siempre.
 * Con `htmlContext` (el árbol de accesibilidad que el framework capturó al fallar), las
 * sugerencias se confrontan contra lo que había de verdad en pantalla — ver `applyPageEvidence`.
 */
export function analyzeAndHeal(request: HealRequest): HealResponse {
  const { allTestIds, actions, fields } = resolveRequestInputs(request)

  const analysis = analyzeSelector(request.selector, allTestIds)
  let strategies = generateHealingStrategies(request.selector, analysis, actions, fields, allTestIds)

  // Sin árbol de página el comportamiento es exactamente el de siempre — de eso se encarga
  // el snapshot del corpus de selectores, que no debe moverse por este cambio.
  const page = applyPageEvidenceIfAvailable(strategies, request, request.selector, analysis)
  strategies = page.strategies

  const repertoire = applyRepertoireIfUnverified(request, request.selector, strategies, page.verified)

  return finalizeResponse(repertoire.strategies, analysis, request, repertoire.verified, repertoire.fromRepertoire)
}

/** Merge de diccionarios del proyecto con los built-in, y filtro de testids válidos (`data-*`). */
function resolveRequestInputs(request: HealRequest): { allTestIds: readonly string[]; actions: Record<string, string>; fields: Record<string, string> } {
  const { customSynonyms, customTestIds } = request
  const allTestIds = customTestIds
    ? [...TESTID_ATTRS, ...customTestIds.filter((id) => id.startsWith('data-'))]
    : TESTID_ATTRS
  return {
    allTestIds,
    actions: { ...ACTIONS, ...customSynonyms?.actions },
    fields: { ...FIELDS, ...customSynonyms?.fields },
  }
}

/**
 * Si la corrida trajo el árbol de accesibilidad (`htmlContext`), confronta las estrategias
 * contra lo que había de verdad en pantalla — ver `applyPageEvidence`. `verified` se marca
 * con `pageVerified` y no con `priority === 0`: una pista degradada (rol sin nombre) vive en
 * priority 4 pero nace igual de la evidencia de la página, y así conserva su confidence.
 */
function applyPageEvidenceIfAvailable(
  strategies: HealingStrategy[],
  request: HealRequest,
  selector: string,
  analysis: SelectorAnalysis
): { strategies: HealingStrategy[]; verified: boolean } {
  const pageElements = parsePageSnapshot(request.htmlContext)
  if (pageElements.length === 0) return { strategies, verified: false }

  const evidence = applyPageEvidence(strategies, pageElements, selector, analysis)
  return {
    strategies: evidence.strategies,
    verified: evidence.sawPage && evidence.strategies[0]?.pageVerified === true,
  }
}

/**
 * El repertorio (historial de curaciones ya confirmadas) es un fallback, no una fuente
 * primaria: si la verificación en vivo de ESTA corrida ya confirmó algo, esa evidencia
 * manda siempre — la página de ahora es más confiable que la memoria de una corrida
 * anterior (el texto del botón pudo cambiar desde entonces). El repertorio solo entra
 * cuando esta corrida no tiene cómo verificar nada por su cuenta (Cypress, siempre; o
 * cualquier adapter si el snapshot/sondeo no estuvo disponible esa vez).
 */
function applyRepertoireIfUnverified(
  request: HealRequest,
  selector: string,
  strategies: HealingStrategy[],
  verified: boolean
): { strategies: HealingStrategy[]; verified: boolean; fromRepertoire: boolean } {
  if (verified || !request.repertoire) return { strategies, verified, fromRepertoire: false }

  const match = findRepertoireMatch(request.repertoire, selector, request.testFile)
  if (!match) return { strategies, verified, fromRepertoire: false }

  return {
    strategies: [
      {
        selector: match.fixedSelector,
        type: isSelectorType(match.selectorType) ? match.selectorType : 'MIXED',
        confidence: match.confidence,
        explanation: `Repertorio: esta misma corrección ya se confirmó contra la página en una corrida anterior (${match.timestamp}), aunque esta corrida no pudo verificarlo por su cuenta.`,
        robustnessGain: 50,
        technicalReason: `Reused from a previously verified fix recorded in .healify/history.jsonl (${match.timestamp})`,
        priority: 0,
      },
      ...strategies,
    ],
    verified: true,
    fromRepertoire: true,
  }
}

/** Elige la mejor estrategia, ajusta la confianza (hash determinístico, solo si no fue verificada) y arma la respuesta. */
function finalizeResponse(
  strategies: HealingStrategy[],
  analysis: SelectorAnalysis,
  request: HealRequest,
  verified: boolean,
  fromRepertoire: boolean
): HealResponse {
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
    : Math.max(0.75, Math.min(0.98, bestStrategy.confidence + deterministicAdjustment(request.selector)))
  const needsReview = adjustedConfidence < 0.80

  return {
    verified,
    fromRepertoire,
    fixedSelector: bestStrategy.selector,
    confidence: Math.round(adjustedConfidence * 100) / 100,
    explanation: bestStrategy.explanation,
    selectorType: bestStrategy.type,
    alternatives: strategies.slice(1, 1 + (request.maxAlternatives ?? 3)).map((s) => ({
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
