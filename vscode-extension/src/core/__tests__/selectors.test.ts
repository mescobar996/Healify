import { describe, it, expect } from 'vitest'
import { findSelectors, maskNonCode } from '../selectors'

describe('findSelectors', () => {
  it('encuentra el selector de un page.click de Playwright', () => {
    const found = findSelectors(`await page.click('#buy-btn-a1b2c3')`)
    expect(found).toEqual([{ value: '#buy-btn-a1b2c3', start: 18, end: 33 }])
  })

  it('devuelve posiciones que apuntan al valor, sin las comillas', () => {
    const source = `await page.click('#btn')`
    const [found] = findSelectors(source)
    expect(source.slice(found.start, found.end)).toBe('#btn')
  })

  it('encuentra selectores de Cypress, Selenium y WebdriverIO', () => {
    const source = [
      `cy.get('.item')`,
      `driver.findElement(By.css('#save'))`,
      `await $('#wdio-el')`,
      `cy.healifyGet('#pay-btn')`,
    ].join('\n')

    expect(findSelectors(source).map((f) => f.value)).toEqual(['.item', '#save', '#wdio-el', '#pay-btn'])
  })

  it('acepta comillas dobles y simples, pero no las mezcla', () => {
    expect(findSelectors(`page.click("#doble")`).map((f) => f.value)).toEqual(['#doble'])
  })

  it('preserva el valor con comillas escapadas adentro', () => {
    const found = findSelectors(`cy.get('[data-x=\\'y\\']')`)
    expect(found).toHaveLength(1)
  })

  /**
   * El caso que más ruido genera si se hace mal: marcar un selector nombrado dentro de un
   * comentario. El mismo criterio existe en `maskComments` del CLI, y ahí apareció porque
   * `fix` llegó a reemplazar texto dentro de un comentario.
   */
  it('ignora selectores que solo aparecen en comentarios', () => {
    expect(findSelectors(`// TODO: cambiar page.click('#viejo')`)).toEqual([])
    expect(findSelectors(`/* page.click('#viejo') */`)).toEqual([])
  })

  /**
   * Todo XPath empieza con `//`. Si el enmascarado de comentarios no sigue los strings, se
   * come el selector entero desde la primera barra y la extensión queda ciega justo a los
   * selectores más frágiles.
   */
  it('encuentra un XPath, sin confundir su // con un comentario', () => {
    expect(findSelectors(`page.click('//div[3]/button')`).map((f) => f.value)).toEqual(['//div[3]/button'])
    expect(findSelectors(`By.xpath("//button[text()='Pagar']")`).map((f) => f.value)).toEqual([
      "//button[text()='Pagar']",
    ])
  })

  it('sigue viendo el código que viene después de un string con //', () => {
    const source = `page.goto('//cdn.x.com'); page.click('#btn')`
    expect(findSelectors(source).map((f) => f.value)).toEqual(['#btn'])
  })

  it('ignora strings que no son el primer argumento de una llamada de selector', () => {
    const source = [
      `test('agrega un producto al carrito', async () => {})`,
      `await page.goto('http://localhost:3000')`,
      `const titulo = 'Mi tienda'`,
      `import { test } from '@playwright/test'`,
    ].join('\n')

    expect(findSelectors(source)).toEqual([])
  })

  it('ignora template literals: sin ejecutar no se sabe qué valor tienen', () => {
    expect(findSelectors('page.click(`#btn-${id}`)')).toEqual([])
  })

  it('encuentra varias ocurrencias del mismo selector', () => {
    const found = findSelectors(`page.click('#btn'); page.click('#btn')`)
    expect(found).toHaveLength(2)
    expect(found[0].start).not.toBe(found[1].start)
  })
})

describe('maskNonCode', () => {
  it('reemplaza comentarios por espacios y conserva las posiciones', () => {
    const source = `const a = 1 // nota\nconst b = 2`
    const masked = maskNonCode(source)
    expect(masked).toHaveLength(source.length)
    expect(masked.indexOf('const b')).toBe(source.indexOf('const b'))
  })

  it('tolera un comentario de bloque sin cerrar', () => {
    expect(() => maskNonCode('/* sin cerrar')).not.toThrow()
  })
})
