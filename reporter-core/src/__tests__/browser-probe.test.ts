import { describe, it, expect } from 'vitest'
import { BROWSER_PROBE_SCRIPT, domContextFromProbeResult } from '../browser-probe'
import { parsePageSnapshot } from '../page-snapshot'

describe('BROWSER_PROBE_SCRIPT', () => {
  it('es un script válido: termina en return y no tiene una función sin invocar envolviéndolo', () => {
    // No es una función TS por diseño (ver comentario del módulo) — igual conviene una
    // verificación mínima de forma: el protocolo WebDriver ejecuta este string como CUERPO de
    // función, así que un `function() {...}` envolvente nunca se invocaría y devolvería undefined.
    expect(BROWSER_PROBE_SCRIPT.trim().startsWith('function')).toBe(false)
    expect(BROWSER_PROBE_SCRIPT.trim().endsWith('return results;')).toBe(true)
  })

  it('es JS sintácticamente válido como cuerpo de función', () => {
    expect(() => new Function(BROWSER_PROBE_SCRIPT)).not.toThrow()
  })
})

/**
 * DOM falso mínimo para correr el script de verdad, sin jsdom ni ninguna dependencia nueva
 * (`reporter-core` se bundlea dentro de los cinco paquetes públicos: cada dep se paga cinco
 * veces). El script referencia `document` como global, así que se lo inyectamos como parámetro
 * de la función: dentro del cuerpo, el parámetro gana.
 */
interface FakeElement {
  tagName: string
  getAttribute(name: string): string | null
  hasAttribute(name: string): boolean
  textContent: string
  value?: string
  shadowRoot?: FakeRoot
  readonly contentDocument?: FakeRoot | null
  __children: FakeElement[]
}

interface FakeRoot {
  querySelectorAll(selector: string): FakeElement[]
}

interface ElOptions {
  text?: string
  value?: string
  children?: FakeElement[]
  /** Contenido de un shadow root ABIERTO colgando de este elemento. */
  shadow?: FakeElement[]
  /** Contenido del documento embebido, para tags iframe/frame. */
  frameDoc?: FakeElement[]
  /** Simula cross-origin: el getter de contentDocument tira, como en un browser real. */
  frameThrows?: boolean
}

function root(children: FakeElement[]): FakeRoot {
  const flat: FakeElement[] = []
  const walk = (nodes: FakeElement[]) => {
    for (const node of nodes) {
      flat.push(node)
      walk(node.__children)
    }
  }
  walk(children)
  return { querySelectorAll: () => flat }
}

function el(tagName: string, attrs: Record<string, string> = {}, options: ElOptions = {}): FakeElement {
  const node: FakeElement = {
    tagName: tagName.toUpperCase(),
    getAttribute: (name) => attrs[name] ?? null,
    hasAttribute: (name) => name in attrs,
    textContent: options.text ?? '',
    __children: options.children ?? [],
  }
  if (options.value !== undefined) node.value = options.value
  if (options.shadow) node.shadowRoot = root(options.shadow)
  if (options.frameThrows) {
    Object.defineProperty(node, 'contentDocument', {
      get() {
        throw new Error('SecurityError: cross-origin frame')
      },
    })
  } else if (options.frameDoc) {
    Object.defineProperty(node, 'contentDocument', { value: root(options.frameDoc) })
  }
  return node
}

function runProbe(document: FakeRoot): { role: string; name: string; frame?: string }[] {
  return new Function('document', BROWSER_PROBE_SCRIPT)(document)
}

describe('BROWSER_PROBE_SCRIPT — recorrido del DOM', () => {
  it('encuentra los elementos interactivos del documento principal', () => {
    const document = root([
      el('div', {}, { children: [el('button', {}, { text: 'Comprar' }), el('a', { href: '/inicio' }, { text: 'Inicio' })] }),
      el('input', { placeholder: 'Correo' }),
    ])

    expect(runProbe(document)).toEqual([
      { role: 'button', name: 'Comprar' },
      { role: 'link', name: 'Inicio' },
      { role: 'textbox', name: 'Correo' },
    ])
  })

  it('atraviesa un shadow root abierto — el caso que antes devolvía lista vacía en apps con web components', () => {
    const document = root([
      el('my-checkout', {}, { shadow: [el('button', {}, { text: 'Pagar' })] }),
    ])

    expect(runProbe(document)).toEqual([{ role: 'button', name: 'Pagar' }])
  })

  it('atraviesa shadow roots anidados', () => {
    const document = root([
      el('outer-widget', {}, {
        shadow: [el('inner-widget', {}, { shadow: [el('button', {}, { text: 'Confirmar' })] })],
      }),
    ])

    expect(runProbe(document)).toEqual([{ role: 'button', name: 'Confirmar' }])
  })

  it('el shadow DOM NO se marca con frame — es el mismo contexto de locator que su documento', () => {
    const document = root([el('x-card', {}, { shadow: [el('button', {}, { text: 'Ver' })] })])

    expect(runProbe(document)[0].frame).toBeUndefined()
  })

  it('entra a un iframe same-origin y marca sus elementos con el frame', () => {
    const document = root([
      el('button', {}, { text: 'Volver' }),
      el('iframe', { id: 'checkout' }, { frameDoc: [el('button', {}, { text: 'Pagar' })] }),
    ])

    expect(runProbe(document)).toEqual([
      { role: 'button', name: 'Volver' },
      { role: 'button', name: 'Pagar', frame: 'iframe#checkout' },
    ])
  })

  it('etiqueta el iframe por id, name, src o índice, en ese orden', () => {
    const byName = root([el('iframe', { name: 'pago' }, { frameDoc: [el('button', {}, { text: 'A' })] })])
    const bySrc = root([el('iframe', { src: '/widget.html' }, { frameDoc: [el('button', {}, { text: 'B' })] })])
    const byIndex = root([el('iframe', {}, { frameDoc: [el('button', {}, { text: 'C' })] })])

    expect(runProbe(byName)[0].frame).toBe('iframe[name=pago]')
    expect(runProbe(bySrc)[0].frame).toBe('iframe[src=/widget.html]')
    expect(runProbe(byIndex)[0].frame).toBe('iframe:nth-of-type(1)')
  })

  it('encadena el path de iframes anidados', () => {
    const document = root([
      el('iframe', { id: 'outer' }, {
        frameDoc: [el('iframe', { id: 'inner' }, { frameDoc: [el('button', {}, { text: 'Pagar' })] })],
      }),
    ])

    expect(runProbe(document)[0].frame).toBe('iframe#outer > iframe#inner')
  })

  it('un iframe cross-origin no rompe el resto del scan', () => {
    const document = root([
      el('iframe', { id: 'ads' }, { frameThrows: true }),
      el('button', {}, { text: 'Comprar' }),
    ])

    expect(runProbe(document)).toEqual([{ role: 'button', name: 'Comprar' }])
  })

  it('corta la recursión a MAX_DEPTH=12 — una página patológica no puede colgar el probe', () => {
    let deepest = el('div', {}, { children: [el('button', {}, { text: 'nivel-15' })] })
    for (let level = 14; level >= 1; level--) {
      deepest = el('x-host', {}, { shadow: [el('button', {}, { text: `nivel-${level}` }), deepest] })
    }

    const names = runProbe(root([deepest])).map((e) => e.name)
    expect(names).toEqual(Array.from({ length: 12 }, (_, i) => `nivel-${i + 1}`))
  })

  it('respeta el mapeo de roles de input y saltea los hidden', () => {
    const document = root([
      el('input', { type: 'checkbox' }, { value: 'x' }),
      el('input', { type: 'submit', value: 'Enviar' }, { value: 'Enviar' }),
      el('input', { type: 'hidden' }, { value: 'token' }),
      el('a', {}, { text: 'ancla sin href' }),
      el('select', {}, { text: 'País' }),
    ])

    expect(runProbe(document)).toEqual([
      { role: 'checkbox', name: 'x' },
      { role: 'button', name: 'Enviar' },
      { role: 'combobox', name: 'País' },
    ])
  })
})

describe('domContextFromProbeResult', () => {
  it('formatea un resultado válido a líneas que parsePageSnapshot puede leer', () => {
    const domContext = domContextFromProbeResult([
      { role: 'button', name: 'Comprar' },
      { role: 'link', name: 'Inicio' },
    ])

    expect(domContext).toBeDefined()
    expect(parsePageSnapshot(domContext)).toEqual([
      { role: 'button', name: 'Comprar' },
      { role: 'link', name: 'Inicio' },
    ])
  })

  it('undefined con null — mismo criterio que Playwright sin el attachment', () => {
    expect(domContextFromProbeResult(null)).toBeUndefined()
  })

  it('undefined con un array vacío', () => {
    expect(domContextFromProbeResult([])).toBeUndefined()
  })

  it('undefined con cualquier cosa que no sea un array — un driver raro puede devolver cualquier cosa', () => {
    expect(domContextFromProbeResult('no es un array')).toBeUndefined()
    expect(domContextFromProbeResult(42)).toBeUndefined()
    expect(domContextFromProbeResult({ role: 'button', name: 'x' })).toBeUndefined()
    expect(domContextFromProbeResult(undefined)).toBeUndefined()
  })

  it('filtra elementos con forma inválida en vez de romper por uno solo', () => {
    const domContext = domContextFromProbeResult([
      { role: 'button', name: 'Comprar' },
      { role: 42, name: 'x' },
      { role: 'link' }, // sin name
      null,
      'basura',
      { role: 'link', name: 'Inicio' },
    ])

    expect(parsePageSnapshot(domContext)).toEqual([
      { role: 'button', name: 'Comprar' },
      { role: 'link', name: 'Inicio' },
    ])
  })

  it('undefined si después de filtrar no queda nada aprovechable', () => {
    expect(domContextFromProbeResult([{ role: 42 }, null, 'x'])).toBeUndefined()
  })
})
