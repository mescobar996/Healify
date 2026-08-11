import { describe, it, expect } from 'vitest'
import { analyzeAndHeal } from '../healing-engine'

describe('analyzeAndHeal', () => {
  it('is deterministic — same selector always yields the same confidence', () => {
    const a = analyzeAndHeal({ selector: '#login-btn' })
    const b = analyzeAndHeal({ selector: '#login-btn' })
    expect(a).toEqual(b)
  })

  it('proposes a TESTID selector for data-testid input, high confidence', () => {
    const result = analyzeAndHeal({ selector: "[data-testid='add-to-cart']" })
    expect(result.selectorType).toBe('TESTID')
    expect(result.confidence).toBeGreaterThanOrEqual(0.9)
    expect(result.needsReview).toBe(false)
  })

  it('flags XPath as fragile and proposes a role-based fallback', () => {
    const result = analyzeAndHeal({ selector: "//button[@class='remove-item']" })
    expect(result.selectorType).toBe('ROLE')
    expect(result.technicalDetails.stableAgainstDOMChanges).toBe(true)
  })

  it('keeps confidence within the documented 0.75–0.98 band', () => {
    const selectors = [
      '#a', '.b', '//c', "[data-testid='d']", '[role=button]', 'text=Hola',
      "getByRole('button', { name: 'Login' })", "[data-cy='e']", "[name='f']", "[aria-label='g']",
    ]
    for (const selector of selectors) {
      const result = analyzeAndHeal({ selector })
      expect(result.confidence).toBeGreaterThanOrEqual(0.75)
      expect(result.confidence).toBeLessThanOrEqual(0.98)
    }
  })

  it('does NOT flag an ordinary word ID as dynamic just because it contains a hyphenated a-f letter (regression)', () => {
    // "-exist" used to match /-[a-f0-9]+/ (the "e" in "exist" is a valid hex digit),
    // wrongly proposing a class-based fix for a perfectly ordinary, stable ID.
    const result = analyzeAndHeal({ selector: '#does-not-exist' })
    expect(result.explanation).not.toContain('ID dinámico')
    expect(result.technicalDetails.detectedIssue).not.toContain('Dynamic ID')
  })

  it('still flags a genuinely dynamic hashed ID (6+ hex chars after the hyphen)', () => {
    const result = analyzeAndHeal({ selector: '#thing-a3f9c1e0' })
    expect(result.explanation).toContain('ID dinámico')
    expect(result.selectorType).toBe('CSS')
  })

  it('recognizes Spanish action words for buttons (bilingual ACTIONS dictionary)', () => {
    const result = analyzeAndHeal({ selector: '#btn-guardar' })
    expect(result.selectorType).toBe('ROLE')
    expect(result.fixedSelector).toContain('Guardar')
  })

  it('recognizes Spanish field words for inputs (bilingual FIELDS dictionary)', () => {
    const result = analyzeAndHeal({ selector: 'input.campo-correo' })
    expect(result.fixedSelector).toContain('Correo')
  })

  it('does not downgrade a selector that already uses a modern Playwright locator', () => {
    const original = "getByRole('button', { name: 'Login' })"
    const result = analyzeAndHeal({ selector: original })
    expect(result.fixedSelector).toBe(original)
    expect(result.selectorType).toBe('ROLE')
    expect(result.robustnessImprovement).toBe(0)
  })

  it('preserves data-cy syntax instead of rewriting it to data-testid', () => {
    const result = analyzeAndHeal({ selector: "[data-cy='add-to-cart']" })
    expect(result.selectorType).toBe('TESTID')
    expect(result.fixedSelector).toBe("[data-cy='add-to-cart']")
    expect(result.fixedSelector).not.toContain('data-testid')
  })

  describe.each(['data-qa', 'data-test', 'data-e2e'])('convención de testid: %s', (attr) => {
    it('se reconoce como TESTID de alta confianza, sin reescribir al otro atributo', () => {
      const result = analyzeAndHeal({ selector: `[${attr}='add-to-cart']` })
      expect(result.selectorType).toBe('TESTID')
      expect(result.confidence).toBeGreaterThanOrEqual(0.9)
      expect(result.fixedSelector).toBe(`[${attr}='add-to-cart']`)
    })
  })

  describe('selector basado en posición (nth-child/nth-of-type)', () => {
    it('se marca como frágil e indica que depende del orden de hermanos', () => {
      const result = analyzeAndHeal({ selector: 'div:nth-child(3) > span:nth-of-type(2)' })
      expect(result.technicalDetails.detectedIssue).toContain('Position-based selector')
    })

    it('sin otra pista de elemento, propone un role genérico en vez de caer al fallback visible=', () => {
      const result = analyzeAndHeal({ selector: 'div:nth-child(3) > span:nth-of-type(2)' })
      expect(result.selectorType).toBe('ROLE')
      expect(result.fixedSelector).not.toMatch(/^visible=/)
    })

    it('si además hay una pista de elemento (button/input), esa estrategia sigue ganando', () => {
      const result = analyzeAndHeal({ selector: 'li:nth-child(2) button.btn-guardar' })
      expect(result.selectorType).toBe('ROLE')
      expect(result.fixedSelector).toContain('Guardar')
    })
  })

  describe('regresión: [type="submit"]/[type="button"] ya se clasifican como button (texto literal del atributo)', () => {
    it("[type='submit'] genera una sugerencia de rol de botón con acción Submit", () => {
      const result = analyzeAndHeal({ selector: "[type='submit']" })
      expect(result.selectorType).toBe('ROLE')
      expect(result.fixedSelector).toContain('Submit')
    })

    it("[type='button'] genera una sugerencia de rol de botón", () => {
      const result = analyzeAndHeal({ selector: "[type='button']" })
      expect(result.selectorType).toBe('ROLE')
    })
  })

  it('preserves a [name=] attribute selector with moderate confidence', () => {
    const result = analyzeAndHeal({ selector: "[name='email']" })
    expect(result.selectorType).toBe('CSS')
    expect(result.fixedSelector).toBe("[name='email']")
    expect(result.confidence).toBeGreaterThanOrEqual(0.75)
    expect(result.confidence).toBeLessThan(0.95)
  })

  it('preserves an [aria-label=] attribute selector with high confidence', () => {
    const result = analyzeAndHeal({ selector: "[aria-label='Cerrar']" })
    expect(result.selectorType).toBe('ROLE')
    expect(result.fixedSelector).toBe("[aria-label='Cerrar']")
    expect(result.confidence).toBeGreaterThanOrEqual(0.85)
  })

  describe('bug real: clase CSS-in-JS pegada a una clase semántica estable', () => {
    it('multi-clase pegada (.wrapper.css-hash) propone conservar solo la parte estable, no cae al fallback genérico', () => {
      const result = analyzeAndHeal({ selector: '.wrapper.css-1a2b3c4d5e' })
      expect(result.fixedSelector).toBe('.wrapper')
      expect(result.explanation).toContain('CSS-in-JS')
      expect(result.fixedSelector).not.toMatch(/^visible=/)
    })

    it('combinador antes de la clase volátil (.container > .css-hash) también se detecta', () => {
      const result = analyzeAndHeal({ selector: '.container > .css-1a2b3c4d' })
      expect(result.fixedSelector).toBe('.container')
      expect(result.fixedSelector).not.toMatch(/^visible=/)
    })
  })

  describe('combinador CSS compuesto (.padre > .hijo, .card .title, div + span)', () => {
    it('se marca como frágil e indica que depende de la ruta de ancestros/hermanos', () => {
      // Selector sin prefijo '#'/'.' (no dispara el issue de ID/CLASS primero) para que el
      // issue de combinador sea el primero de la lista.
      const result = analyzeAndHeal({ selector: 'div > span' })
      expect(result.technicalDetails.detectedIssue).toContain('Compound selector with a CSS combinator')
    })

    it('bug real que arregla: sin keyword de acción, antes caía al fallback visible= (roto: solo recortaba el primer punto de todo el selector)', () => {
      const result = analyzeAndHeal({ selector: '.card .price' })
      expect(result.fixedSelector).toBe('.price')
      expect(result.fixedSelector).not.toMatch(/^visible=/)
    })

    it('combinador explícito ">" — conserva solo el elemento objetivo', () => {
      const result = analyzeAndHeal({ selector: '.sidebar > .username' })
      expect(result.fixedSelector).toBe('.username')
    })

    it('si el objetivo tiene un keyword de acción reconocible, esa estrategia sigue ganando (sin cambio de comportamiento)', () => {
      const result = analyzeAndHeal({ selector: 'form.checkout > button.submit' })
      expect(result.selectorType).toBe('ROLE')
      expect(result.fixedSelector).toContain('Submit')
    })

    it('bug real que arregla: con dos testids compuestos, extrae el del elemento OBJETIVO, no el del ancestro (regex sin /g tomaba el primer match)', () => {
      const result = analyzeAndHeal({
        selector: '[data-testid="product-card"] [data-testid="add-to-cart-btn"]',
      })
      expect(result.fixedSelector).toBe("[data-testid='add-to-cart-btn']")
      expect(result.selectorType).toBe('TESTID')
    })

    it('sin nada estable en el objetivo (tag suelto), propone un role genérico en vez del fallback visible= roto', () => {
      const result = analyzeAndHeal({ selector: '.list > li > span' })
      expect(result.selectorType).toBe('ROLE')
      expect(result.fixedSelector).not.toMatch(/^visible=/)
    })

    it('un selector simple sin combinador no se marca como compuesto', () => {
      const result = analyzeAndHeal({ selector: '.price' })
      expect(result.technicalDetails.detectedIssue).not.toContain('Compound selector with a CSS combinator')
    })

    it('un espacio adentro de has-text(...) no se confunde con un combinador descendiente', () => {
      const result = analyzeAndHeal({ selector: "button:has-text('Add to cart')" })
      expect(result.technicalDetails.detectedIssue).not.toContain('Compound selector with a CSS combinator')
    })

    it('un espacio adentro del valor de un atributo no se confunde con un combinador descendiente', () => {
      const result = analyzeAndHeal({ selector: '[aria-label="Cerrar sesión"]' })
      expect(result.technicalDetails.detectedIssue).not.toContain('Compound selector with a CSS combinator')
    })
  })

  describe('custom synonyms (healify.config.json)', () => {
    it('usa un sinónimo de acción custom para generar la sugerencia', () => {
      const result = analyzeAndHeal({
        selector: '#btn-inspeccionar',
        customSynonyms: { actions: { inspeccionar: 'Inspeccionar' } },
      })
      expect(result.fixedSelector).toContain('Inspeccionar')
    })

    it('usa un sinónimo de campo custom para generar la sugerencia', () => {
      const result = analyzeAndHeal({
        selector: 'input.campo-matricula',
        customSynonyms: { fields: { matricula: 'Matrícula' } },
      })
      expect(result.fixedSelector).toContain('Matrícula')
    })

    it('los sinónimos custom no pisan los built-in (español sigue funcionando)', () => {
      const result = analyzeAndHeal({
        selector: '#btn-guardar',
        customSynonyms: { actions: { otro: 'Otro' } },
      })
      expect(result.fixedSelector).toContain('Guardar')
    })

    it('los sinónimos custom sí pisan built-in si tienen la misma key', () => {
      const result = analyzeAndHeal({
        selector: '#btn-guardar',
        customSynonyms: { actions: { guardar: 'Save (custom)' } },
      })
      expect(result.fixedSelector).toContain('Save (custom)')
    })

    it('sin customSynonyms: comportamiento idéntico al actual', () => {
      const without = analyzeAndHeal({ selector: '#btn-guardar' })
      const withEmpty = analyzeAndHeal({ selector: '#btn-guardar', customSynonyms: {} })
      expect(without.fixedSelector).toBe(withEmpty.fixedSelector)
    })

    it('custom synonyms vacíos no rompen nada', () => {
      const result = analyzeAndHeal({
        selector: '#btn-guardar',
        customSynonyms: { actions: {}, fields: {} },
      })
      expect(result.fixedSelector).toContain('Guardar')
    })
  })
})

describe('evidencia de la página real (htmlContext)', () => {
  // Árbol tal cual lo escribe Playwright al fallar un test — mismo fixture que
  // page-snapshot.test.ts, capturado de una corrida real.
  const PAGINA = `# Page snapshot

\`\`\`yaml
- generic [active] [ref=e1]:
  - heading "Tienda" [level=1] [ref=e2]
  - navigation [ref=e3]:
    - link "Inicio" [ref=e4]:
      - /url: /inicio
  - textbox "Correo" [ref=e7]
  - button "Comprar" [ref=e8]
\`\`\`
`

  it('propone el nombre real del botón en vez de adivinarlo del diccionario', () => {
    const result = analyzeAndHeal({ selector: '#comprar-ahora-a1b2c3', htmlContext: PAGINA })

    expect(result.fixedSelector).toBe("role('button', { name: 'Comprar' })")
    expect(result.verified).toBe(true)
  })

  it('sin la página, el mismo selector no llega a esa sugerencia — es la diferencia que hace el dato', () => {
    const aCiegas = analyzeAndHeal({ selector: '#comprar-ahora-a1b2c3' })

    expect(aCiegas.verified).toBe(false)
    expect(aCiegas.fixedSelector).not.toBe("role('button', { name: 'Comprar' })")
  })

  it('una sugerencia verificada tiene confianza suficiente para aplicarse sola', () => {
    const result = analyzeAndHeal({ selector: '#comprar-ahora-a1b2c3', htmlContext: PAGINA })

    expect(result.confidence).toBeGreaterThanOrEqual(0.9)
    expect(result.needsReview).toBe(false)
  })

  it('lee el nombre real de un campo de texto', () => {
    const result = analyzeAndHeal({ selector: '#input-email-x7f2', htmlContext: PAGINA })

    expect(result.fixedSelector).toBe("role('textbox', { name: 'Correo' })")
  })

  it('avisa que el elemento no está en la página en vez de inventar un candidato', () => {
    // Un XPath solo genera estrategias de rol, así que si en la página no hay nada que
    // coincida no queda ningún candidato. Ahí el problema deja de ser el selector: lo que el
    // test buscaba no estaba en pantalla, y eso es lo que hay que decir.
    const result = analyzeAndHeal({ selector: '//div[3]/span[2]', htmlContext: '- heading "Tienda"' })

    expect(result.confidence).toBeLessThan(0.8)
    expect(result.explanation).toContain('página')
  })

  it('una sugerencia CSS no se descarta por la página: el árbol de accesibilidad no expone clases', () => {
    // Solo las sugerencias de rol se pueden confrontar. Una clase estable propuesta para un id
    // dinámico no se puede ni confirmar ni desmentir con este dato, así que sobrevive intacta.
    const result = analyzeAndHeal({ selector: '#acepto-terminos-9z8y', htmlContext: '- button "Comprar"' })

    expect(result.fixedSelector).toContain('acepto-terminos')
  })

  it('no se rompe con un árbol vacío o corrupto — degrada a la heurística de siempre', () => {
    const basura = analyzeAndHeal({ selector: '#comprar-ahora-a1b2c3', htmlContext: 'no es un snapshot' })
    const aCiegas = analyzeAndHeal({ selector: '#comprar-ahora-a1b2c3' })

    expect(basura.fixedSelector).toBe(aCiegas.fixedSelector)
    expect(basura.verified).toBe(false)
  })

  it('descarta un nombre que el motor propuso pero que no existe en la página', () => {
    // El diccionario traduce "login" → "Login", pero en esta página no hay ningún botón así.
    const soloComprar = `- button "Comprar"`
    const result = analyzeAndHeal({ selector: '#login-btn-a1b2c3', htmlContext: soloComprar })

    expect(result.fixedSelector).not.toContain("name: 'Login'")
  })

  describe('MEJORA 1: sugerir el data-testid real del DOM', () => {
    it('un elemento con data-testid genera una sugerencia TESTID — confianza 0.94, solo por debajo del role verificado', () => {
      const result = analyzeAndHeal({
        selector: '#comprar-ahora-a1b2c3',
        htmlContext: `- button "Comprar" [testid=add-to-cart]`,
      })

      // El role verificado en vivo (priority 0) gana; el testid (priority 1) es la primera alternativa.
      expect(result.verified).toBe(true)
      expect(result.fixedSelector).toBe("role('button', { name: 'Comprar' })")
      expect(result.alternatives?.[0]).toEqual({ selector: "[data-testid='add-to-cart']", confidence: 0.94 })
    })

    it('conserva el atributo real: data-cy no se reescribe a data-testid (Cero Inventos)', () => {
      const result = analyzeAndHeal({
        selector: '#comprar-ahora-a1b2c3',
        htmlContext: `- button "Comprar" [testid=add-to-cart] [testid-attr=data-cy]`,
      })

      expect(result.alternatives?.[0]).toEqual({ selector: "[data-cy='add-to-cart']", confidence: 0.94 })
    })

    it('sin testid en el elemento, no hay sugerencia TESTID — nada que leer del DOM', () => {
      const result = analyzeAndHeal({
        selector: '#comprar-ahora-a1b2c3',
        htmlContext: `- button "Comprar"`,
      })

      expect(result.alternatives?.some((a) => a.selector.startsWith('[data-')) ?? false).toBe(false)
    })
  })

  describe('MEJORA 2: deducir el rol del htmlContext y degradar el role sin nombre', () => {
    it('una clase .card sin keyword genera ROLE si el DOM lo permite', () => {
      const result = analyzeAndHeal({ selector: '.card', htmlContext: '- button "Card"' })

      expect(result.verified).toBe(true)
      expect(result.fixedSelector).toBe("role('button', { name: 'Card' })")
      expect(result.confidence).toBe(0.97)
      expect(result.needsReview).toBe(false)
    })

    it('un rol SIN nombre accesible y SIN testid se degrada a pista de revisión (confidence 0.7, priority 4)', () => {
      const result = analyzeAndHeal({ selector: '#btn-aceptar', htmlContext: '- button' })

      expect(result.verified).toBe(true)
      expect(result.fixedSelector).toBe("role('button')")
      expect(result.confidence).toBe(0.7)
      expect(result.needsReview).toBe(true)
    })

    it('un rol CON nombre accesible conserva confidence 0.97 y priority 0', () => {
      const result = analyzeAndHeal({ selector: '#comprar-ahora-a1b2c3', htmlContext: '- button "Comprar"' })

      expect(result.verified).toBe(true)
      expect(result.fixedSelector).toBe("role('button', { name: 'Comprar' })")
      expect(result.confidence).toBe(0.97)
      expect(result.needsReview).toBe(false)
    })

    it('sin nombre pero CON testid, el testid real se vuelve la sugerencia principal', () => {
      const result = analyzeAndHeal({ selector: '#btn-aceptar', htmlContext: '- button [testid=acepta-terminos]' })

      expect(result.verified).toBe(true)
      expect(result.fixedSelector).toBe("[data-testid='acepta-terminos']")
      expect(result.confidence).toBe(0.94)
    })
  })
})

describe('repertorio (memoria de curaciones verificadas)', () => {
  const REPERTORIO_VERIFICADO = [
    {
      timestamp: '2026-01-01T00:00:00.000Z',
      testFile: 'e2e/checkout.spec.ts',
      testName: 'compra un producto',
      selector: '#comprar-ahora-a1b2c3',
      status: 'healed' as const,
      fixedSelector: "role('button', { name: 'Comprar' })",
      selectorType: 'ROLE',
      confidence: 0.97,
      verified: true,
    },
  ]

  it('sin árbol de página, usa el repertorio si hay una entrada verificada para el mismo archivo+selector', () => {
    const result = analyzeAndHeal({
      selector: '#comprar-ahora-a1b2c3',
      testFile: 'e2e/checkout.spec.ts',
      repertoire: REPERTORIO_VERIFICADO,
    })

    expect(result.fixedSelector).toBe("role('button', { name: 'Comprar' })")
    expect(result.verified).toBe(true)
    expect(result.fromRepertoire).toBe(true)
  })

  it('la verificación en vivo de ESTA corrida gana por sobre el repertorio cuando compiten', () => {
    // El repertorio dice "Comprar" (de una corrida anterior), pero el texto del botón real
    // cambió a "Comprar ahora mismo" — la evidencia en vivo tiene que ganar, no la memoria.
    const paginaReal = `- button "Comprar ahora mismo"`

    const result = analyzeAndHeal({
      selector: '#comprar-ahora-a1b2c3',
      testFile: 'e2e/checkout.spec.ts',
      htmlContext: paginaReal,
      repertoire: REPERTORIO_VERIFICADO,
    })

    expect(result.fixedSelector).toBe("role('button', { name: 'Comprar ahora mismo' })")
    expect(result.fromRepertoire).toBe(false)
    expect(result.verified).toBe(true)
  })

  it('no matchea un repertorio de otro archivo — mismo selector, distinto testFile', () => {
    const result = analyzeAndHeal({
      selector: '#comprar-ahora-a1b2c3',
      testFile: 'e2e/otro-flujo.spec.ts',
      repertoire: REPERTORIO_VERIFICADO,
    })

    expect(result.fromRepertoire).toBe(false)
  })

  it('sin repertoire, el comportamiento es exactamente el de siempre', () => {
    const conRepertorioVacio = analyzeAndHeal({ selector: '#comprar-ahora-a1b2c3', testFile: 'e2e/checkout.spec.ts', repertoire: [] })
    const sinRepertorio = analyzeAndHeal({ selector: '#comprar-ahora-a1b2c3', testFile: 'e2e/checkout.spec.ts' })

    expect(conRepertorioVacio).toEqual(sinRepertorio)
  })

  it('una entrada no verificada del repertorio no se usa — recalcular a ciegas da lo mismo, no aporta', () => {
    const repertorioSinVerificar = [{ ...REPERTORIO_VERIFICADO[0], verified: false }]

    const result = analyzeAndHeal({
      selector: '#comprar-ahora-a1b2c3',
      testFile: 'e2e/checkout.spec.ts',
      repertoire: repertorioSinVerificar,
    })

    expect(result.fromRepertoire).toBe(false)
  })
})

describe('customTestIds (healify.config.json)', () => {
  it('un atributo custom data-cy-custom se reconoce como TESTID de alta confianza', () => {
    const result = analyzeAndHeal({
      selector: "[data-cy-custom='add-to-cart']",
      customTestIds: ['data-cy-custom'],
    })
    expect(result.selectorType).toBe('TESTID')
    expect(result.confidence).toBeGreaterThanOrEqual(0.9)
  })

  it('sin customTestIds, data-cy-custom NO es TESTID — se marca como frágil', () => {
    const result = analyzeAndHeal({ selector: "[data-cy-custom='add-to-cart']" })
    expect(result.selectorType).not.toBe('TESTID')
    expect(result.confidence).toBeLessThan(0.9)
  })

  it('customTestIds vacío usa solo los defaults', () => {
    const withEmpty = analyzeAndHeal({ selector: "[data-testid='x']", customTestIds: [] })
    const without = analyzeAndHeal({ selector: "[data-testid='x']" })
    expect(withEmpty.selectorType).toBe('TESTID')
    expect(withEmpty.fixedSelector).toBe(without.fixedSelector)
  })

  it('un atributo que no empieza con data- se descarta silenciosamente', () => {
    const result = analyzeAndHeal({
      selector: "[data-cy-custom='x']",
      customTestIds: ['id', 'class', 'data-cy-custom'],
    })
    expect(result.selectorType).toBe('TESTID')
    expect(result.confidence).toBeGreaterThanOrEqual(0.9)
  })

  it('los 5 defaults siguen funcionando con customTestIds presente', () => {
    const result = analyzeAndHeal({
      selector: "[data-testid='x']",
      customTestIds: ['data-cy-custom'],
    })
    expect(result.selectorType).toBe('TESTID')
    expect(result.fixedSelector).toBe("[data-testid='x']")
  })

  it('data-test-id custom se reconoce como TESTID', () => {
    const result = analyzeAndHeal({
      selector: "[data-test-id='submit']",
      customTestIds: ['data-test-id'],
    })
    expect(result.selectorType).toBe('TESTID')
  })

  it('customTestIds con caracteres especiales de regex se escapan (sin romper ni inyectar el patron)', () => {
    // Un sufijo como `a(b|c` interpolado sin escapar romperia `new RegExp(...)` o inyectaria
    // alternancia. Aqui se verifica que el motor lo trata como literal y reconoce el atributo.
    const result = analyzeAndHeal({
      selector: "[data-a(b|c='submit']",
      customTestIds: ['data-a(b|c'],
    })
    expect(result.selectorType).toBe('TESTID')
    expect(result.fixedSelector).toBe("[data-a(b|c='submit']")
  })
})

describe('elemento verificado dentro de un iframe', () => {
  it('avisa que hay que entrar al frame y baja la confianza', () => {
    const result = analyzeAndHeal({
      selector: '#pagar-btn-a1b2c3',
      htmlContext: '- link "Inicio"\n- button "Pagar" [frame=iframe#checkout]',
    })

    expect(result.verified).toBe(true)
    expect(result.fixedSelector).toBe("role('button', { name: 'Pagar' })")
    expect(result.confidence).toBe(0.88)
    expect(result.explanation).toContain('iframe#checkout')
    expect(result.explanation).toContain('frameLocator')
    expect(result.needsReview).toBe(false)
  })

  it('un elemento equivalente en el documento principal gana y no arrastra la advertencia', () => {
    const result = analyzeAndHeal({
      selector: '#pagar-btn-a1b2c3',
      htmlContext: '- button "Pagar" [frame=iframe#checkout]\n- button "Pagar"',
    })

    expect(result.confidence).toBe(0.97)
    expect(result.explanation).not.toContain('iframe')
  })

  it('iframes anidados: la cadena completa de frames va a frameLocator y baja la confianza', () => {
    const result = analyzeAndHeal({
      selector: '#pagar-btn-a1b2c3',
      htmlContext: '- button "Pagar" [frame=iframe#outer > iframe[name=pago]]',
    })

    expect(result.verified).toBe(true)
    expect(result.fixedSelector).toBe("role('button', { name: 'Pagar' })")
    expect(result.confidence).toBe(0.88)
    expect(result.explanation).toContain('iframe#outer > iframe[name=pago]')
    expect(result.explanation).toContain('frameLocator')
    expect(result.explanation).not.toContain('shadow')
    expect(result.needsReview).toBe(false)
  })
})

describe('elemento verificado dentro de shadow DOM (MEJORA 3)', () => {
  it('avisa que hay que hacer pierce del shadow root pero conserva la confianza del rol', () => {
    const result = analyzeAndHeal({
      selector: '#pagar-btn-a1b2c3',
      htmlContext: '- button "Pagar" [shadow-depth=1] [shadow-path=x-checkout]',
    })

    expect(result.verified).toBe(true)
    expect(result.fixedSelector).toBe("role('button', { name: 'Pagar' })")
    expect(result.confidence).toBe(0.97)
    expect(result.explanation).toContain('x-checkout')
    expect(result.explanation).toContain('.shadow()')
    expect(result.explanation).toContain('no atraviesan shadow DOM')
    expect(result.needsReview).toBe(false)
  })

  it('shadow anidado: la explicación incluye la cadena completa de hosts a atravesar', () => {
    const result = analyzeAndHeal({
      selector: '#confirmar-x1y2',
      htmlContext: '- button "Confirmar" [shadow-depth=2] [shadow-path=outer-widget>inner-widget]',
    })

    expect(result.verified).toBe(true)
    expect(result.confidence).toBe(0.97)
    expect(result.explanation).toContain('2 shadow roots')
    expect(result.explanation).toContain('outer-widget > inner-widget')
  })

  it('sin nombre pero CON testid dentro de shadow: el testid principal avisa el pierce', () => {
    const result = analyzeAndHeal({
      selector: '#btn-pagar',
      htmlContext: '- button [testid=pago-final] [shadow-depth=1] [shadow-path=x-checkout]',
    })

    expect(result.verified).toBe(true)
    expect(result.fixedSelector).toBe("[data-testid='pago-final']")
    expect(result.confidence).toBe(0.94)
    expect(result.explanation).toContain('x-checkout')
    expect(result.explanation).toContain('.shadow()')
  })

  it('degradado (sin nombre y sin testid) dentro de shadow conserva 0.7 y avisa el pierce', () => {
    const result = analyzeAndHeal({
      selector: '#btn-aceptar',
      htmlContext: '- button [shadow-depth=1] [shadow-path=x-card]',
    })

    expect(result.verified).toBe(true)
    expect(result.fixedSelector).toBe("role('button')")
    expect(result.confidence).toBe(0.7)
    expect(result.explanation).toContain('x-card')
    expect(result.explanation).toContain('shadow')
  })

  it('frame + shadow combinados: avisa ambas fronteras de acceso', () => {
    const result = analyzeAndHeal({
      selector: '#pagar-btn-a1b2c3',
      htmlContext: '- button "Pagar" [shadow-depth=1] [shadow-path=x-checkout] [frame=iframe#checkout]',
    })

    expect(result.verified).toBe(true)
    expect(result.confidence).toBe(0.88)
    expect(result.explanation).toContain('iframe#checkout')
    expect(result.explanation).toContain('frameLocator')
    expect(result.explanation).toContain('shadow')
  })

  it('un elemento en light DOM no arrastra la advertencia de shadow', () => {
    const result = analyzeAndHeal({ selector: '#pagar-btn-a1b2c3', htmlContext: '- button "Pagar"' })

    expect(result.confidence).toBe(0.97)
    expect(result.explanation).not.toContain('shadow')
  })
})
