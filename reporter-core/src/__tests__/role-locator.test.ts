import { describe, it, expect } from 'vitest'
import { buildRoleSuggestion, parseRoleSuggestion, roleSuggestionToXPath, roleSuggestionToPlaywrightSelector, resolveLocatorStrategy } from '../role-locator'

describe('parseRoleSuggestion', () => {
  it('extrae rol y nombre', () => {
    expect(parseRoleSuggestion("role('button', { name: 'Comprar' })")).toEqual({ role: 'button', name: 'Comprar' })
  })

  it('extrae solo el rol cuando no hay nombre', () => {
    expect(parseRoleSuggestion("role('button')")).toEqual({ role: 'button' })
  })

  it('acepta un nombre vacío explícito', () => {
    expect(parseRoleSuggestion("role('button', { name: '' })")).toEqual({ role: 'button', name: '' })
  })

  it('devuelve null para selectores que no son de rol', () => {
    expect(parseRoleSuggestion('#comprar-ahora')).toBeNull()
    expect(parseRoleSuggestion("[data-testid='x']")).toBeNull()
    expect(parseRoleSuggestion("button:has-text('X')")).toBeNull()
  })

  it('devuelve null para un formato de rol malformado', () => {
    expect(parseRoleSuggestion("role('button', name: 'X')")).toBeNull()
  })
})

describe('roleSuggestionToXPath', () => {
  it('button: busca por texto visible, aria-label o value de un input submit', () => {
    const xpath = roleSuggestionToXPath('button', 'Comprar')

    expect(xpath).toContain("//button[normalize-space(.)='Comprar']")
    expect(xpath).toContain("//button[@aria-label='Comprar']")
    expect(xpath).toContain("@value='Comprar'")
  })

  it('link: busca por texto visible o aria-label de un <a>', () => {
    const xpath = roleSuggestionToXPath('link', 'Inicio')

    expect(xpath).toContain("//a[normalize-space(.)='Inicio']")
  })

  it('textbox: busca por aria-label o placeholder, texto o textarea', () => {
    const xpath = roleSuggestionToXPath('textbox', 'Correo')

    expect(xpath).toContain("//input[@aria-label='Correo']")
    expect(xpath).toContain("//input[@placeholder='Correo']")
    expect(xpath).toContain("//textarea[@aria-label='Correo']")
  })

  it('checkbox y radio: buscan por aria-label', () => {
    expect(roleSuggestionToXPath('checkbox', 'Acepto')).toContain("//input[@type='checkbox'][@aria-label='Acepto']")
    expect(roleSuggestionToXPath('radio', 'Sí')).toContain("//input[@type='radio'][@aria-label='Sí']")
  })

  it('devuelve null para un rol sin mapeo conocido', () => {
    expect(roleSuggestionToXPath('heading', 'Tienda')).toBeNull()
  })

  it('devuelve null con nombre vacío — nada confiable para buscar', () => {
    expect(roleSuggestionToXPath('button', '')).toBeNull()
  })

  it('escapa un nombre con comilla simple', () => {
    expect(roleSuggestionToXPath('button', "L'Oreal")).toContain(`"L'Oreal"`)
  })

  it('escapa un nombre con comilla doble', () => {
    expect(roleSuggestionToXPath('button', 'Decí "hola"')).toContain(`'Decí "hola"'`)
  })

  it('arma un concat() cuando el nombre tiene los dos tipos de comilla', () => {
    const xpath = roleSuggestionToXPath('button', `L'Oreal dice "hola"`)

    expect(xpath).toContain('concat(')
  })
})

describe('resolveLocatorStrategy', () => {
  it('role con nombre → xpath', () => {
    const r = resolveLocatorStrategy("role('button', { name: 'Comprar' })")

    expect(r.strategy).toBe('xpath')
    expect(r.value).toContain("normalize-space(.)='Comprar'")
  })

  it('role sin nombre → unsupported, nada confiable para armar un xpath', () => {
    expect(resolveLocatorStrategy("role('button')")).toEqual({ strategy: 'unsupported', value: null })
  })

  it('CSS plano → css, tal cual', () => {
    expect(resolveLocatorStrategy('[data-testid="add-to-cart"]')).toEqual({ strategy: 'css', value: '[data-testid="add-to-cart"]' })
    expect(resolveLocatorStrategy('.stable-class')).toEqual({ strategy: 'css', value: '.stable-class' })
  })

  it('sintaxis Playwright-only sin rol (:has-text, visible=, getBy*) → unsupported', () => {
    expect(resolveLocatorStrategy("button:has-text('Add')")).toEqual({ strategy: 'unsupported', value: null })
    expect(resolveLocatorStrategy('visible=oldselector')).toEqual({ strategy: 'unsupported', value: null })
    expect(resolveLocatorStrategy("getByRole('button', { name: 'Add' })")).toEqual({ strategy: 'unsupported', value: null })
  })

  it('rol sin mapeo conocido, aunque tenga nombre → unsupported', () => {
    expect(resolveLocatorStrategy("role('heading', { name: 'Tienda' })")).toEqual({ strategy: 'unsupported', value: null })
  })
})

describe('roleSuggestionToPlaywrightSelector()', () => {
  it('convierte a la sintaxis del motor de selectores de Playwright', () => {
    expect(roleSuggestionToPlaywrightSelector("role('button', { name: 'Agregar al carrito' })"))
      .toBe('role=button[name="Agregar al carrito"]')
  })

  it('sirve para cualquier rol, no solo los que tienen mapeo a XPath', () => {
    expect(roleSuggestionToPlaywrightSelector("role('heading', { name: 'Tienda' })"))
      .toBe('role=heading[name="Tienda"]')
  })

  it('escapa las comillas dobles del nombre accesible', () => {
    expect(roleSuggestionToPlaywrightSelector(`role('button', { name: 'Decí "hola"' })`))
      .toBe('role=button[name="Decí \\"hola\\""]')
  })

  it('null sin nombre accesible — `role=button` a secas matchea de más', () => {
    // Sustituir por algo ambiguo es peor que dejar el caso para revisión manual: el test
    // pasaría probando otro elemento, que es el peor resultado posible de una curación.
    expect(roleSuggestionToPlaywrightSelector("role('button')")).toBeNull()
    expect(roleSuggestionToPlaywrightSelector("role('button', { name: '' })")).toBeNull()
  })

  it('null si no es una sugerencia de rol', () => {
    expect(roleSuggestionToPlaywrightSelector("[data-testid='x']")).toBeNull()
    expect(roleSuggestionToPlaywrightSelector("button:has-text('Add')")).toBeNull()
  })
})

/**
 * Los nombres accesibles salen del DOM de la pagina bajo test, y un apostrofe ahi no tiene
 * nada de exotico: "L'Oreal", "Guardar 'borrador'", cualquier texto en frances.
 *
 * Interpolarlos crudos producia `role('button', { name: 'Guardar 'borrador'' })`, que
 * parseRoleSuggestion no podia volver a leer. El efecto era silencioso y total: no se curaba
 * ningun elemento con apostrofe en el nombre, y el reporte mostraba un selector que no
 * funcionaba si lo copiabas.
 */
describe('nombres con comillas', () => {
  const conApostrofe = "Guardar 'borrador'"

  it('build y parse son inversas', () => {
    const s = buildRoleSuggestion('button', conApostrofe)
    expect(parseRoleSuggestion(s)).toEqual({ role: 'button', name: conApostrofe })
  })

  it('escapa la comilla al construir', () => {
    // El valor real lleva \' donde el nombre tenía '
    expect(buildRoleSuggestion('button', conApostrofe)).toBe("role('button', { name: 'Guardar \\'borrador\\'' })")
  })

  it('sobrevive a un backslash literal en el nombre', () => {
    const raro = 'C:\\ruta\\rara'
    expect(parseRoleSuggestion(buildRoleSuggestion('button', raro))).toEqual({ role: 'button', name: raro })
  })

  it('llega entero al selector de Playwright', () => {
    const s = buildRoleSuggestion('button', conApostrofe)
    expect(roleSuggestionToPlaywrightSelector(s)).toBe(`role=button[name="${conApostrofe}"]`)
  })

  it('llega entero al XPath: con solo comilla simple, se envuelve en dobles', () => {
    const parsed = parseRoleSuggestion(buildRoleSuggestion('button', conApostrofe))!
    const xpath = roleSuggestionToXPath(parsed.role, parsed.name!)

    expect(xpath).toContain(`"${conApostrofe}"`)
  })

  /** XPath 1.0 no puede escapar comillas: con las dos, el literal se arma con `concat()`. */
  it('con comilla simple Y doble, el XPath usa concat()', () => {
    const mixto = `Decí 'hola' y "chau"`
    const parsed = parseRoleSuggestion(buildRoleSuggestion('button', mixto))!
    const xpath = roleSuggestionToXPath(parsed.role, parsed.name!)

    expect(xpath).toContain('concat(')
    expect(xpath).toContain('hola')
  })

  it('resolveLocatorStrategy devuelve xpath, no unsupported', () => {
    const resuelto = resolveLocatorStrategy(buildRoleSuggestion('button', conApostrofe))
    expect(resuelto.strategy).toBe('xpath')
    expect(resuelto.value).toBeTruthy()
  })

  it('sin nombre devuelve null — un role sin nombre no es una sugerencia aplicable (MEJORA 2)', () => {
    expect(buildRoleSuggestion('button')).toBeNull()
  })
})
