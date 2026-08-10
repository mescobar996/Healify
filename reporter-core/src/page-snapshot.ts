/**
 * Lectura del árbol de accesibilidad que el framework capturó de la página real.
 *
 * Playwright escribe este árbol solo, en `error-context.md`, cada vez que un test falla
 * (ver `_snapshotForAI` en playwright/lib/index.js). Trae los roles y los nombres accesibles
 * REALES de lo que había en pantalla en ese momento — que es exactamente lo que al motor le
 * faltaba para dejar de adivinar nombres por diccionario.
 *
 * Formato real (capturado de una corrida, no inventado):
 *
 *     # Page snapshot
 *
 *     ```yaml
 *     - generic [active] [ref=e1]:
 *       - heading "Tienda" [level=1] [ref=e2]
 *       - navigation [ref=e3]:
 *         - link "Inicio" [ref=e4] [cursor=pointer]:
 *           - /url: /inicio
 *       - textbox "Correo" [ref=e7]
 *       - button "Comprar" [ref=e8]
 *     ```
 *
 * El parseo es por líneas y regex a propósito: no se agrega un parser de YAML ni de HTML.
 * `reporter-core` se bundlea dentro de los cinco paquetes públicos, así que cada dependencia
 * nueva se paga cinco veces.
 */

export interface PageElement {
  role: string
  /** Nombre accesible. Vacío para elementos que no exponen uno (`generic`, `navigation`). */
  name: string
  /**
   * Iframe donde vive el elemento (`iframe#checkout`, anidados con ` > `). Ausente para el
   * documento principal y para shadow DOM abierto — ese sí es el mismo contexto de locator.
   *
   * Importa porque un locator a nivel top NO encuentra lo que está adentro de un iframe: hay
   * que cambiar de contexto primero (`frameLocator()`, `switchTo().frame()`). Sugerir el
   * selector sin decirlo manda al usuario a un test que sigue fallando.
   */
  frame?: string
  /**
   * Valor del atributo de test-id presente en el elemento real (data-testid, data-cy, ...).
   * Solo lo trae el probe en vivo (`browser-probe.ts`) — el snapshot de accesibilidad de
   * Playwright no expone atributos. Lo usa el motor para sugerir ese testid como estrategia
   * sin inventarlo (regla "Cero Inventos").
   */
  testId?: string
  /**
   * Cuál atributo es (`data-testid`, `data-cy`, `data-qa`, `data-test`, `data-e2e`).
   * Se conserva para no reescribir la sugerencia a otro atributo que no existe en el DOM.
   */
  testIdAttr?: string
  /**
   * Cuántos shadow roots ABIERTOS hay que atravesar (pierce) para llegar al elemento.
   * Ausente (o 0) para light DOM; 1 = dentro de un shadow root; 2 = componente dentro de
   * componente (shadow anidado). Solo lo trae el probe en vivo (`browser-probe.ts`).
   *
   * Importa porque los selectores CSS/XPath NO atraviesan shadow DOM por especificación: un
   * locator plano no encuentra lo que vive adentro de un shadowRoot, hay que hacer pierce de
   * cada nivel primero. A diferencia del `frame`, el elemento sigue en el MISMO documento —
   * el shadow root es solo una frontera de acceso, no de contexto.
   */
  shadowDepth?: number
  /**
   * Cadena de componentes hosts desde el documento hasta el shadowRoot que contiene
   * directamente al elemento (`['x-card', 'inner-widget']`). El último elemento es el host
   * cuyo shadowRoot hay que abrir para llegar al elemento. Junto con `shadowDepth` le da al
   * motor la información exacta del pierce traversal (`.shadow()`, `.shadowRoot`,
   * locator encadenado). Solo lo trae el probe en vivo.
   */
  shadowPath?: string[]
}

/**
 * Inverso de `parsePageSnapshot`: convierte elementos ya extraídos (por ejemplo, de una
 * consulta en vivo al DOM real vía Selenium/WebdriverIO) al mismo formato de líneas que el
 * parser sabe leer. Así el motor recibe siempre el mismo tipo de dato, sin importar si vino de
 * un archivo que escribió Playwright o de una consulta hecha en el momento del fallo.
 */
export function formatPageElements(elements: PageElement[]): string {
  return elements
    .map((e) => {
      const base = e.name ? `- ${e.role} "${e.name.replace(/"/g, '\\"')}"` : `- ${e.role}`
      // El testid va antes del frame a propósito: FRAME_ATTR ancla al final de línea, y la
      // etiqueta del frame puede traer corchetes propios que no deben absorber el testid. Los
      // atributos de shadow (MEJORA 3) también van antes del frame, por el mismo motivo.
      const attrs: string[] = []
      if (e.testId) {
        attrs.push(`[testid=${e.testId}]`)
        if (e.testIdAttr) attrs.push(`[testid-attr=${e.testIdAttr}]`)
      }
      if (e.shadowDepth && e.shadowDepth > 0) {
        attrs.push(`[shadow-depth=${e.shadowDepth}]`)
        if (e.shadowPath && e.shadowPath.length > 0) attrs.push(`[shadow-path=${e.shadowPath.join('>')}]`)
      }
      if (e.frame) attrs.push(`[frame=${e.frame}]`)
      return attrs.length ? `${base} ${attrs.join(' ')}` : base
    })
    .join('\n')
}

/** Líneas de propiedad, no de elemento: `- /url: /inicio`. */
const PROPERTY_LINE = /^\s*-\s*\//
/** `- button "Comprar" [ref=e8]:` → role + nombre opcional, ignorando atributos y `:` final. */
const ELEMENT_LINE = /^\s*-\s+([a-zA-Z][\w-]*)\s*(?:"((?:[^"\\]|\\.)*)")?/
/** `- text: Correo` — nodo de texto suelto; el valor está después de los dos puntos. */
const TEXT_LINE = /^\s*-\s+text:\s*(.+?)\s*$/
/**
 * `[frame=iframe#checkout]` — lo escribe `formatPageElements`, no los snapshots de Playwright
 * (que usan `[ref=...]`, `[level=...]`, `[active]`, nunca `frame`).
 *
 * Anclada al final de línea y greedy a propósito: la etiqueta del iframe puede tener corchetes
 * propios (`iframe[name=pago]`), así que cortar en el primer `]` devolvería la mitad. Como
 * `formatPageElements` siempre pone este atributo último, el último `]` de la línea es el cierre.
 */
const FRAME_ATTR = /\[frame=(.+)\]\s*$/

/**
 * `[testid=add-to-cart]` y `[testid-attr=data-cy]` — los escribe `formatPageElements` a partir
 * del testid que trae el probe en vivo. `[testid-attr=...]` no puede colisionar con `[testid=...]`
 * (la regex pide el `=` pegado a `testid`), y ninguno de los dos existe en los snapshots de
 * Playwright, así que nada gana el campo por accidente.
 */
const TESTID_ATTR = /\[testid=([^\]]+)\]/
const TESTID_ATTR_NAME = /\[testid-attr=([^\]]+)\]/

/**
 * `[shadow-depth=2]` y `[shadow-path=outer-widget>inner-widget]` (MEJORA 3) — los escribe
 * `formatPageElements` a partir de los datos de shadow que trae el probe en vivo. Ninguno de
 * los dos existe en los snapshots de Playwright (que usan `[ref=...]`, `[level=...]`,
 * `[active]`, `[cursor=...]`), así que nada gana los campos por accidente. El path se
 * serializa unido con `>` (los hosts son tags o `#ids`, sin espacios ni corchetes) y se
 * vuelve a partir por `>` al parsear.
 */
const SHADOW_DEPTH_ATTR = /\[shadow-depth=(\d+)\]/
const SHADOW_PATH_ATTR = /\[shadow-path=([^\]]+)\]/

/**
 * Extrae los elementos del árbol. Tolerante por diseño: cualquier línea que no encaje se
 * saltea en silencio. Este dato viene de un archivo generado por otra herramienta, que puede
 * cambiar de formato entre versiones — si eso pasa, el motor tiene que degradar a la
 * heurística a ciegas, nunca romper la corrida del usuario.
 */
export function parsePageSnapshot(markdown: string | undefined): PageElement[] {
  if (!markdown) return []

  const elements: PageElement[] = []

  for (const line of markdown.split('\n')) {
    if (PROPERTY_LINE.test(line)) continue

    const textMatch = line.match(TEXT_LINE)
    if (textMatch) {
      elements.push({ role: 'text', name: unescapeName(textMatch[1]) })
      continue
    }

    const match = line.match(ELEMENT_LINE)
    if (!match) continue

    const role = match[1]
    // `yaml` es la apertura del bloque de código, no un elemento de la página.
    if (role === 'yaml') continue

    const element: PageElement = { role, name: match[2] ? unescapeName(match[2]) : '' }
    const frameMatch = line.match(FRAME_ATTR)
    if (frameMatch) element.frame = frameMatch[1]
    const testIdMatch = line.match(TESTID_ATTR)
    if (testIdMatch) {
      element.testId = testIdMatch[1]
      const attrMatch = line.match(TESTID_ATTR_NAME)
      if (attrMatch) element.testIdAttr = attrMatch[1]
    }
    const shadowDepthMatch = line.match(SHADOW_DEPTH_ATTR)
    if (shadowDepthMatch) element.shadowDepth = parseInt(shadowDepthMatch[1], 10)
    const shadowPathMatch = line.match(SHADOW_PATH_ATTR)
    if (shadowPathMatch) element.shadowPath = shadowPathMatch[1].split('>')
    elements.push(element)
  }

  return elements
}

function unescapeName(raw: string): string {
  return raw.replace(/\\"/g, '"').replace(/\\\\/g, '\\')
}

/** Elementos de un rol dado; con `name`, solo los que tienen exactamente ese nombre. */
export function findMatches(elements: PageElement[], role: string, name?: string): PageElement[] {
  return elements.filter((e) => e.role === role && (name === undefined || e.name === name))
}

/** ¿Existe de verdad en la página un elemento con este rol y este nombre accesible? */
export function existsInPage(elements: PageElement[], role: string, name: string): boolean {
  return findMatches(elements, role, name).length > 0
}

/** Palabras significativas de un selector: `#comprar-ahora-a1b2c3` → ['comprar', 'ahora']. */
export function selectorTokens(selector: string): string[] {
  return selector
    .toLowerCase()
    .split(/[^a-z0-9áéíóúñ]+/i)
    .filter((token) => token.length >= 3 && !/^\d+$/.test(token) && !/^[0-9a-f]{6,}$/.test(token))
}

/**
 * De todos los elementos reales de un rol, cuál corresponde al selector que se rompió.
 *
 * Devuelve `null` sin un ganador claro — preferimos no sugerir nada antes que mandar al
 * usuario a un elemento equivocado, que es peor que no sugerir: rompe la confianza y encima
 * puede hacer que el test pase probando otra cosa.
 *
 * - Un solo elemento de ese rol en la página: es ese, sin más vueltas.
 * - Varios: gana el que comparte alguna palabra con el selector roto
 *   (`#comprar-ahora-a1b2c3` → botón "Comprar"). Si empatan dos, no se elige.
 */
/**
 * Roles con los que un test interactúa. Se usan para buscar el elemento cuando el motor no
 * pudo deducir del texto del selector qué tipo de cosa era (`#comprar-ahora-a1b2c3` no cae en
 * ningún diccionario, pero en la página hay un `button "Comprar"` que coincide de sobra).
 */
const INTERACTIVE_ROLES = ['button', 'link', 'textbox', 'checkbox', 'radio', 'combobox', 'menuitem', 'tab', 'option', 'searchbox', 'switch']

/**
 * Busca en la página el elemento que corresponde al selector roto, sin depender de que el
 * motor haya adivinado bien el tipo de elemento.
 *
 * Prioriza el rol esperado si el motor pudo deducir uno; si ahí no hay un ganador claro,
 * busca entre todos los roles interactivos. Que la evidencia mande por sobre el diccionario
 * es justamente el punto: `#comprar-ahora-a1b2c3` no activa ninguna palabra conocida, pero el
 * botón "Comprar" de la página lo resuelve solo.
 */
/**
 * Dos pasadas: primero solo el documento principal (y el shadow DOM abierto, que es el mismo
 * contexto de locator), y recién si ahí no hay ganador claro se reintenta incluyendo lo que
 * vive dentro de iframes. Un elemento alcanzable directo siempre le gana a uno que exige
 * cambiar de contexto — si hay un "Pagar" arriba y otro adentro del iframe del checkout, el de
 * arriba es el que el test estaba buscando.
 */
export function bestElementFor(
  elements: PageElement[],
  selector: string,
  preferredRole?: string
): PageElement | null {
  const topLevel = elements.filter((e) => !e.frame)
  const fromTop = bestElementIn(topLevel, selector, preferredRole)
  if (fromTop) return fromTop
  if (topLevel.length === elements.length) return null
  return bestElementIn(elements, selector, preferredRole)
}

function bestElementIn(
  elements: PageElement[],
  selector: string,
  preferredRole?: string
): PageElement | null {
  if (preferredRole) {
    const name = bestNameIn(elements, preferredRole, selector)
    // Se devuelve el elemento real (no uno reconstruido) para no perder `frame` en el camino.
    if (name !== null) return findMatches(elements, preferredRole, name)[0] ?? { role: preferredRole, name }
    // Sin un nombre accesible ganador, si hay UN solo elemento de ese rol, es el buscado
    // aunque no tenga nombre. El rol esperado es pista suficiente cuando no hay ambigüedad:
    // un botón sin nombre en la página sigue siendo el botón que el selector buscaba.
    const roleMatches = findMatches(elements, preferredRole)
    if (roleMatches.length === 1) return roleMatches[0]
  }

  const tokens = selectorTokens(selector)
  if (tokens.length === 0) return null

  const scored = elements
    .filter((e) => INTERACTIVE_ROLES.includes(e.role) && (e.name.length > 0 || (e.testId?.length ?? 0) > 0))
    .map((element) => {
      const nameTokens = selectorTokens(element.name)
      // Un testid real del DOM también cuenta como identidad: un elemento sin nombre pero con
      // `[testid=acepta-terminos]` puede coincidir con `#acepta-terminos-...` por su testid.
      const idTokens = element.testId ? selectorTokens(element.testId) : []
      const score = [...nameTokens, ...idTokens].filter((token) =>
        tokens.some((t) => t === token || t.startsWith(token) || token.startsWith(t))
      ).length
      return { element, score }
    })
    .filter((s) => s.score > 0)

  if (scored.length === 0) return null

  const best = scored.reduce((a, b) => (b.score > a.score ? b : a))
  if (scored.filter((s) => s.score === best.score).length > 1) return null

  return best.element
}

/** Igual que `bestElementFor`: el documento principal manda, los iframes son el fallback. */
export function bestNameFor(elements: PageElement[], role: string, selector: string): string | null {
  const topLevel = elements.filter((e) => !e.frame)
  const fromTop = bestNameIn(topLevel, role, selector)
  if (fromTop !== null) return fromTop
  if (topLevel.length === elements.length) return null
  return bestNameIn(elements, role, selector)
}

function bestNameIn(elements: PageElement[], role: string, selector: string): string | null {
  const candidates = findMatches(elements, role).filter((e) => e.name.length > 0)
  if (candidates.length === 0) return null
  if (candidates.length === 1) return candidates[0].name

  const tokens = selectorTokens(selector)
  if (tokens.length === 0) return null

  const scored = candidates.map((candidate) => {
    const nameTokens = selectorTokens(candidate.name)
    const score = nameTokens.filter((nameToken) =>
      tokens.some((token) => token === nameToken || token.startsWith(nameToken) || nameToken.startsWith(token))
    ).length
    return { name: candidate.name, score }
  })

  const best = scored.reduce((a, b) => (b.score > a.score ? b : a))
  if (best.score === 0) return null
  if (scored.filter((s) => s.score === best.score).length > 1) return null

  return best.name
}
