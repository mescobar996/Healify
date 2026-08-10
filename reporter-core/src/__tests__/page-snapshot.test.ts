import { describe, it, expect } from 'vitest'
import { parsePageSnapshot, formatPageElements, findMatches, existsInPage, bestNameFor, bestElementFor, selectorTokens } from '../page-snapshot'

/**
 * Capturado tal cual de una corrida real de Playwright 1.58 (`test-results/.../
 * error-context.md`), no escrito a mano. Si el formato cambia en una versión futura, este
 * fixture es lo que hay que volver a capturar — no ajustar el parser a ciegas.
 */
const SNAPSHOT_REAL = `# Page snapshot

\`\`\`yaml
- generic [active] [ref=e1]:
  - heading "Tienda" [level=1] [ref=e2]
  - navigation [ref=e3]:
    - link "Inicio" [ref=e4] [cursor=pointer]:
      - /url: /inicio
    - link "Ofertas" [ref=e5] [cursor=pointer]:
      - /url: /ofertas
  - generic [ref=e6]:
    - text: Correo
    - textbox "Correo" [ref=e7]
    - button "Comprar" [ref=e8]
    - button "Cancelar" [ref=e9]
\`\`\`
`

describe('parsePageSnapshot', () => {
  it('lee los elementos del árbol real de Playwright', () => {
    const elements = parsePageSnapshot(SNAPSHOT_REAL)

    expect(elements).toContainEqual({ role: 'button', name: 'Comprar' })
    expect(elements).toContainEqual({ role: 'button', name: 'Cancelar' })
    expect(elements).toContainEqual({ role: 'link', name: 'Inicio' })
    expect(elements).toContainEqual({ role: 'textbox', name: 'Correo' })
    expect(elements).toContainEqual({ role: 'heading', name: 'Tienda' })
  })

  it('conserva los elementos sin nombre accesible', () => {
    expect(parsePageSnapshot(SNAPSHOT_REAL)).toContainEqual({ role: 'navigation', name: '' })
  })

  it('ignora las líneas de propiedad (/url:), que no son elementos', () => {
    const roles = parsePageSnapshot(SNAPSHOT_REAL).map((e) => e.role)

    expect(roles).not.toContain('url')
    expect(roles.every((r) => !r.startsWith('/'))).toBe(true)
  })

  it('no confunde la apertura del bloque de código con un elemento', () => {
    expect(parsePageSnapshot(SNAPSHOT_REAL).map((e) => e.role)).not.toContain('yaml')
  })

  it('lee los nodos de texto sueltos', () => {
    expect(parsePageSnapshot(SNAPSHOT_REAL)).toContainEqual({ role: 'text', name: 'Correo' })
  })

  it('devuelve vacío sin entrada, en vez de romper', () => {
    expect(parsePageSnapshot(undefined)).toEqual([])
    expect(parsePageSnapshot('')).toEqual([])
  })

  it('saltea la basura sin tirar — el formato lo genera otra herramienta y puede cambiar', () => {
    expect(() => parsePageSnapshot('cualquier cosa\n- \n-\n  ###\n- 123 "x"')).not.toThrow()
  })

  it('desescapa las comillas dentro de un nombre', () => {
    expect(parsePageSnapshot('- button "Decí \\"hola\\""')).toContainEqual({ role: 'button', name: 'Decí "hola"' })
  })
})

describe('existsInPage', () => {
  const elements = parsePageSnapshot(SNAPSHOT_REAL)

  it('reconoce un botón que está de verdad', () => {
    expect(existsInPage(elements, 'button', 'Comprar')).toBe(true)
  })

  it('rechaza un nombre que el motor podría haber inventado', () => {
    // Este es el caso que motivó todo el bloque: el motor proponía { name: 'Submit' }
    // sin ninguna evidencia de que ese texto existiera en la página.
    expect(existsInPage(elements, 'button', 'Submit')).toBe(false)
  })

  it('distingue el rol: el texto existe, pero no como botón', () => {
    expect(existsInPage(elements, 'button', 'Inicio')).toBe(false)
    expect(existsInPage(elements, 'link', 'Inicio')).toBe(true)
  })
})

describe('selectorTokens', () => {
  it('saca las palabras significativas de un id con sufijo generado', () => {
    expect(selectorTokens('#comprar-ahora-a1b2c3')).toEqual(['comprar', 'ahora'])
  })

  it('descarta los tramos puramente numéricos y los hashes', () => {
    expect(selectorTokens('#user_1234_9f8e7d6c')).toEqual(['user'])
  })

  it('devuelve vacío cuando no hay nada aprovechable', () => {
    expect(selectorTokens('#a1')).toEqual([])
  })
})

describe('bestNameFor', () => {
  const elements = parsePageSnapshot(SNAPSHOT_REAL)

  it('encuentra el botón real a partir del selector roto', () => {
    expect(bestNameFor(elements, 'button', '#comprar-ahora-a1b2c3')).toBe('Comprar')
  })

  it('elige el único elemento del rol sin necesitar pistas del selector', () => {
    expect(bestNameFor(elements, 'textbox', '#campo-x9y8z7')).toBe('Correo')
  })

  it('no elige nada si el selector no se parece a ninguno — mejor callarse que mandar al lugar equivocado', () => {
    expect(bestNameFor(elements, 'button', '#zzz-qqq-www')).toBeNull()
  })

  it('no elige nada si no hay elementos de ese rol', () => {
    expect(bestNameFor(elements, 'checkbox', '#acepto-terminos')).toBeNull()
  })

  it('no desempata al azar entre dos candidatos igual de plausibles', () => {
    const empate = parsePageSnapshot('- button "Guardar"\n- button "Guardar"')

    expect(bestNameFor(empate, 'button', '#guardar-todo')).toBeNull()
  })
})

describe('findMatches', () => {
  it('filtra por rol', () => {
    expect(findMatches(parsePageSnapshot(SNAPSHOT_REAL), 'button')).toHaveLength(2)
  })

  it('filtra por rol y nombre', () => {
    expect(findMatches(parsePageSnapshot(SNAPSHOT_REAL), 'button', 'Comprar')).toHaveLength(1)
  })
})

describe('formatPageElements', () => {
  it('formatea de vuelta al mismo formato que parsePageSnapshot lee (ida y vuelta)', () => {
    const elements = [
      { role: 'button', name: 'Comprar' },
      { role: 'link', name: 'Inicio' },
    ]

    expect(parsePageSnapshot(formatPageElements(elements))).toEqual(elements)
  })

  it('un elemento sin nombre no lleva comillas colgando', () => {
    const formatted = formatPageElements([{ role: 'navigation', name: '' }])

    expect(formatted).toBe('- navigation')
    expect(parsePageSnapshot(formatted)).toEqual([{ role: 'navigation', name: '' }])
  })

  it('escapa comillas dobles dentro del nombre', () => {
    const formatted = formatPageElements([{ role: 'button', name: 'Decí "hola"' }])

    expect(parsePageSnapshot(formatted)).toEqual([{ role: 'button', name: 'Decí "hola"' }])
  })

  it('array vacío da string vacío', () => {
    expect(formatPageElements([])).toBe('')
  })
})

describe('elementos dentro de iframes', () => {
  it('formatea y vuelve a parsear el frame sin perderlo', () => {
    const elements = [
      { role: 'button', name: 'Volver' },
      { role: 'button', name: 'Pagar', frame: 'iframe#checkout' },
    ]

    expect(formatPageElements(elements)).toBe('- button "Volver"\n- button "Pagar" [frame=iframe#checkout]')
    expect(parsePageSnapshot(formatPageElements(elements))).toEqual(elements)
  })

  it('conserva el frame en un elemento sin nombre accesible', () => {
    const formatted = formatPageElements([{ role: 'generic', name: '', frame: 'iframe:nth-of-type(1)' }])

    expect(formatted).toBe('- generic [frame=iframe:nth-of-type(1)]')
    expect(parsePageSnapshot(formatted)).toEqual([{ role: 'generic', name: '', frame: 'iframe:nth-of-type(1)' }])
  })

  it('una etiqueta de frame con corchetes propios sobrevive el round-trip', () => {
    const elements = [{ role: 'button', name: 'Pagar', frame: 'iframe#outer > iframe[name=pago]' }]

    expect(parsePageSnapshot(formatPageElements(elements))).toEqual(elements)
  })

  describe('testid real del DOM (MEJORA 1)', () => {
    it('formatea y vuelve a parsear el testid con su atributo', () => {
      const elements = [{ role: 'button', name: 'Comprar', testId: 'add-to-cart', testIdAttr: 'data-testid' }]

      expect(formatPageElements(elements)).toBe('- button "Comprar" [testid=add-to-cart] [testid-attr=data-testid]')
      expect(parsePageSnapshot(formatPageElements(elements))).toEqual(elements)
    })

    it('convive con el frame: testid antes de [frame=...] para que el parser ancle bien', () => {
      const elements = [
        { role: 'button', name: 'Pagar', testId: 'pago-final', testIdAttr: 'data-qa', frame: 'iframe#checkout' },
      ]

      expect(formatPageElements(elements)).toBe('- button "Pagar" [testid=pago-final] [testid-attr=data-qa] [frame=iframe#checkout]')
      expect(parsePageSnapshot(formatPageElements(elements))).toEqual(elements)
    })

    it('los snapshots de Playwright no traen testid — nada gana el campo por accidente', () => {
      expect(parsePageSnapshot('- button "Comprar" [ref=e8] [cursor=pointer]')).toEqual([
        { role: 'button', name: 'Comprar' },
      ])
    })

    it('un elemento con testid pero sin nombre accesible no pierde el testid', () => {
      const elements = [{ role: 'generic', name: '', testId: 'contenedor', testIdAttr: 'data-testid' }]

      expect(parsePageSnapshot(formatPageElements(elements))).toEqual(elements)
    })
  })

  it('los snapshots de Playwright no traen [frame=...], así que nada gana el campo por accidente', () => {
    const parsed = parsePageSnapshot('- button "Comprar" [ref=e8] [cursor=pointer]')

    expect(parsed).toEqual([{ role: 'button', name: 'Comprar' }])
  })

  it('bestElementFor prefiere el elemento del documento principal por sobre el homónimo del iframe', () => {
    const elements = [
      { role: 'button', name: 'Pagar ahora', frame: 'iframe#checkout' },
      { role: 'button', name: 'Pagar ahora' },
    ]

    expect(bestElementFor(elements, '#pagar-ahora-a1b2c3', 'button')).toEqual({ role: 'button', name: 'Pagar ahora' })
  })

  it('cae al elemento del iframe cuando no hay nada equivalente arriba', () => {
    const elements = [
      { role: 'link', name: 'Inicio' },
      { role: 'button', name: 'Pagar ahora', frame: 'iframe#checkout' },
    ]

    expect(bestElementFor(elements, '#pagar-ahora-a1b2c3', 'button')).toEqual({
      role: 'button',
      name: 'Pagar ahora',
      frame: 'iframe#checkout',
    })
  })

  it('bestNameFor sigue el mismo criterio: primero el documento principal', () => {
    const elements = [
      { role: 'button', name: 'Comprar embebido', frame: 'iframe#widget' },
      { role: 'button', name: 'Comprar' },
    ]

    expect(bestNameFor(elements, 'button', '#comprar-x9y8')).toBe('Comprar')
  })
})

describe('shadow DOM anidado (MEJORA 3)', () => {
  it('formatea y vuelve a parsear shadowDepth y shadowPath', () => {
    const elements = [
      { role: 'button', name: 'Confirmar', shadowDepth: 2, shadowPath: ['outer-widget', 'inner-widget'] },
    ]

    expect(formatPageElements(elements)).toBe('- button "Confirmar" [shadow-depth=2] [shadow-path=outer-widget>inner-widget]')
    expect(parsePageSnapshot(formatPageElements(elements))).toEqual(elements)
  })

  it('convive con testid y frame: shadow va antes de [frame=...] para que el parser ancle bien', () => {
    const elements = [
      {
        role: 'button',
        name: 'Pagar',
        testId: 'pago-final',
        testIdAttr: 'data-qa',
        shadowDepth: 1,
        shadowPath: ['x-card'],
        frame: 'iframe#checkout',
      },
    ]

    expect(formatPageElements(elements)).toBe(
      '- button "Pagar" [testid=pago-final] [testid-attr=data-qa] [shadow-depth=1] [shadow-path=x-card] [frame=iframe#checkout]'
    )
    expect(parsePageSnapshot(formatPageElements(elements))).toEqual(elements)
  })

  it('conserva el shadowPath de un elemento sin nombre accesible', () => {
    const elements = [{ role: 'generic', name: '', shadowDepth: 1, shadowPath: ['x-card'] }]

    expect(parsePageSnapshot(formatPageElements(elements))).toEqual(elements)
  })

  it('los snapshots de Playwright no traen [shadow-depth=...], así que nada gana el campo por accidente', () => {
    const parsed = parsePageSnapshot('- button "Comprar" [ref=e8] [level=3] [cursor=pointer]')

    expect(parsed).toEqual([{ role: 'button', name: 'Comprar' }])
    expect(parsed[0].shadowDepth).toBeUndefined()
    expect(parsed[0].shadowPath).toBeUndefined()
  })

  it('bestElementFor encuentra igual al elemento dentro de shadow: mismo documento, sin frame', () => {
    const elements = [{ role: 'button', name: 'Pagar', shadowDepth: 1, shadowPath: ['x-card'] }]

    expect(bestElementFor(elements, '#pagar-ahora-a1b2c3', 'button')).toEqual(elements[0])
  })
})
