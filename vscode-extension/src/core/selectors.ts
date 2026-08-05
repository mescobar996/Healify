/**
 * Encuentra selectores dentro de un archivo de test, con la posición exacta de cada uno.
 *
 * `cli/src/fix-ast.ts` ya hace algo parecido con ts-morph, pero devuelve nodos y no rangos, y
 * levantar un `Project` de ts-morph en cada tecla no es viable en un editor. Acá alcanza con
 * reconocer las llamadas donde un selector puede aparecer — que es un conjunto chico y
 * conocido — y quedarse con el primer argumento string.
 *
 * El criterio para no marcar de más: **solo cuenta si el string es el primer argumento de una
 * llamada que recibe selectores**. Un string suelto, el nombre de un test o una URL nunca
 * entran. Es preferible pasar por alto un selector escondido en una variable que subrayar
 * media pantalla.
 */

export interface FoundSelector {
  /** El valor del selector, sin las comillas. */
  value: string
  /** Offset del carácter donde empieza el valor (después de la comilla de apertura). */
  start: number
  /** Offset del carácter siguiente al valor (la comilla de cierre). */
  end: number
}

/**
 * Las mismas familias que reconoce el resto de Healify:
 * - Playwright: `page.click`, `page.locator`, `page.fill`, … (ver METHOD_TO_LOCATOR_CALL en
 *   cli/src/fix-ast.ts)
 * - Cypress: `cy.get`, `cy.find`, `cy.healifyGet`
 * - Selenium / WebdriverIO: `By.css`, `By.xpath`, `$`, `$$`, `findElement`
 *
 * `waitForSelector` y `querySelector` están incluidos aunque `fix` no sepa reescribirlos:
 * marcar que un selector es frágil es útil igual, y el Quick Fix solo se ofrece cuando la
 * sugerencia es aplicable.
 */
const SELECTOR_CALLS = [
  'click',
  'locator',
  'fill',
  'type',
  'check',
  'uncheck',
  'selectOption',
  'hover',
  'focus',
  'blur',
  'tap',
  'dblclick',
  'press',
  'waitForSelector',
  'querySelector',
  'querySelectorAll',
  'get',
  'find',
  'healifyGet',
  'css',
  'xpath',
  'className',
  'findElement',
  'findElements',
]

/**
 * `$` y `$$` de WebdriverIO van aparte del resto: `\b` no genera límite de palabra antes de
 * `$` (no es un carácter de palabra), así que metidos en la misma alternancia que los métodos
 * con nombre no matcheaban nunca. El lookbehind exige que no venga pegado a un identificador,
 * para no confundirse con `algo$('x')`.
 */
const DOLLAR_CALL = '(?<![\\w$])\\$\\$?'

/**
 * Una llamada `algo.metodo('...')` o `$('...')`.
 *
 * Las dos comillas van como alternativas separadas, cada una excluyendo solo la suya, en vez
 * de una captura `(['"])` con backreference: esa forma obliga a excluir AMBAS comillas del
 * cuerpo, y entonces `By.xpath("//button[text()='Pagar']")` se corta en la comilla simple
 * interna. Los XPath con predicados de texto son de los selectores que más importa reconocer.
 *
 * Los template literals quedan afuera a propósito: si tiene `${}` el valor no se conoce sin
 * ejecutar, y si no lo tiene, el autor eligió backticks para un string constante — caso raro
 * que no justifica el ruido.
 */
const CALL_WITH_STRING = new RegExp(
  `(?:(?:\\.|\\b)(?:${SELECTOR_CALLS.join('|')})|${DOLLAR_CALL})\\s*\\(\\s*(?:'((?:[^'\\\\]|\\\\.)*)'|"((?:[^"\\\\]|\\\\.)*)")`,
  'g'
)

/**
 * Enmascara comentarios conservando las posiciones (los reemplaza por espacios), para que un
 * selector nombrado dentro de un `// TODO: cambiar '#viejo'` no dispare un diagnóstico. Mismo
 * criterio que `maskComments` en cli/src/fix.ts, replicado acá porque esa función vive en el
 * CLI y la extensión no lo importa.
 *
 * Tiene que seguir los strings para saber dónde NO hay comentarios, y no es un detalle
 * teórico: **todo XPath empieza con `//`**. Una versión que solo busca `//` y `/*` deja
 * `page.click('//div[3]/button')` enmascarado desde la primera barra, y la extensión se
 * vuelve ciega justo a los selectores más frágiles que existen.
 */
export function maskNonCode(source: string): string {
  let out = ''
  let i = 0

  while (i < source.length) {
    const char = source[i]

    // Dentro de un string no hay comentarios: se copia tal cual hasta la comilla de cierre,
    // respetando escapes.
    if (char === "'" || char === '"' || char === '`') {
      const quote = char
      out += char
      i++
      while (i < source.length) {
        if (source[i] === '\\' && i + 1 < source.length) {
          out += source[i] + source[i + 1]
          i += 2
          continue
        }
        out += source[i]
        if (source[i] === quote) {
          i++
          break
        }
        i++
      }
      continue
    }

    const two = source.slice(i, i + 2)

    if (two === '//') {
      const end = source.indexOf('\n', i)
      const stop = end === -1 ? source.length : end
      out += ' '.repeat(stop - i)
      i = stop
      continue
    }

    if (two === '/*') {
      const end = source.indexOf('*/', i + 2)
      const stop = end === -1 ? source.length : end + 2
      out += ' '.repeat(stop - i)
      i = stop
      continue
    }

    out += char
    i++
  }

  return out
}

export function findSelectors(source: string): FoundSelector[] {
  const code = maskNonCode(source)
  const found: FoundSelector[] = []

  CALL_WITH_STRING.lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = CALL_WITH_STRING.exec(code)) !== null) {
    // Grupo 1 = comilla simple, grupo 2 = comilla doble. Solo uno de los dos matchea.
    const value = match[1] ?? match[2]
    if (!value) continue

    // La posición del valor dentro del match completo: todo lo que vino antes más la comilla.
    const valueStart = match.index + match[0].length - value.length - 1
    found.push({ value, start: valueStart, end: valueStart + value.length })
  }

  return found
}
