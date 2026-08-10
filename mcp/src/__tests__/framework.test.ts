import { describe, it, expect } from 'vitest'
import { adaptSelectorText, isTestFramework, TEST_FRAMEWORKS } from '../framework'

describe('isTestFramework', () => {
  it('acepta solo los cuatro frameworks', () => {
    for (const fw of TEST_FRAMEWORKS) expect(isTestFramework(fw)).toBe(true)
    expect(isTestFramework('nope')).toBe(false)
    expect(isTestFramework(undefined)).toBe(false)
    expect(isTestFramework(42)).toBe(false)
  })
})

describe('role suggestions', () => {
  const role = "role('button', { name: 'Ingresar' })"

  it('playwright usa getByRole', () => {
    expect(adaptSelectorText(role, 'playwright')).toBe("getByRole('button', { name: 'Ingresar' })")
  })

  it('cypress usa cy.contains', () => {
    expect(adaptSelectorText(role, 'cypress')).toBe("cy.contains('button', 'Ingresar')")
  })

  it('selenium usa By.xpath', () => {
    const out = adaptSelectorText(role, 'selenium')
    expect(out).toMatch(/^By\.xpath\("/)
    expect(out).toContain("normalize-space(.)='Ingresar'")
    expect(out).toContain('//button')
  })

  it('webdriverio usa $ con xpath', () => {
    const out = adaptSelectorText(role, 'webdriverio')
    expect(out).toMatch(/^\$\("/)
    expect(out).toContain('Ingresar')
  })

  it('rol sin nombre no inventa un texto', () => {
    const bare = "role('button')"
    expect(adaptSelectorText(bare, 'playwright')).toBe("getByRole('button')")
    expect(adaptSelectorText(bare, 'cypress')).toBe('cy.get(\'[role="button"]\')')
    expect(adaptSelectorText(bare, 'selenium')).toBe('By.xpath("//*[@role=\'button\']")')
    expect(adaptSelectorText(bare, 'webdriverio')).toBe('$("//*[@role=\'button\']")')
  })

  it('un nombre con apóstrofe se escapa, no rompe la sintaxis', () => {
    expect(adaptSelectorText("role('button', { name: 'Guardar borrador' })", 'cypress')).toBe(
      "cy.contains('button', 'Guardar borrador')"
    )
  })
})

describe('locators modernos de Playwright (getBy*)', () => {
  it('playwright los conserva tal cual', () => {
    expect(adaptSelectorText("getByText('Comprar')", 'playwright')).toBe("getByText('Comprar')")
    expect(adaptSelectorText("getByTestId('add-to-cart')", 'playwright')).toBe("getByTestId('add-to-cart')")
  })

  it('getByText se traduce', () => {
    expect(adaptSelectorText("getByText('Comprar')", 'cypress')).toBe("cy.contains('Comprar')")
    expect(adaptSelectorText("getByText('Comprar')", 'selenium')).toBe('By.xpath("//*[contains(text(),\'Comprar\')]")')
    expect(adaptSelectorText("getByText('Comprar')", 'webdriverio')).toBe('$("//*[contains(text(),\'Comprar\')]")')
  })

  it('getByTestId se traduce', () => {
    expect(adaptSelectorText("getByTestId('buy')", 'cypress')).toBe('cy.get(\'[data-testid="buy"]\')')
    expect(adaptSelectorText("getByTestId('buy')", 'selenium')).toBe('By.cssSelector(\'[data-testid="buy"]\')')
  })
})

describe('css y testid', () => {
  it('cypress envuelve en cy.get', () => {
    expect(adaptSelectorText('#btn-ingresar', 'cypress')).toBe("cy.get('#btn-ingresar')")
    expect(adaptSelectorText("[data-testid='add-to-cart']", 'cypress')).toBe('cy.get("[data-testid=\'add-to-cart\']")')
  })

  it('selenium usa By.cssSelector', () => {
    expect(adaptSelectorText('#btn-ingresar', 'selenium')).toBe('By.cssSelector(\'#btn-ingresar\')')
    expect(adaptSelectorText("[data-testid='add-to-cart']", 'selenium')).toBe('By.cssSelector("[data-testid=\'add-to-cart\']")')
  })

  it('playwright deja el CSS crudo', () => {
    expect(adaptSelectorText("[data-testid='add-to-cart']", 'playwright')).toBe("[data-testid='add-to-cart']")
  })
})

describe('xpath y formas de texto', () => {
  it('xpath se mantiene como xpath', () => {
    expect(adaptSelectorText('//div[3]/button', 'selenium')).toBe("By.xpath('//div[3]/button')")
    expect(adaptSelectorText('//div[3]/button', 'cypress')).toBe("cy.xpath('//div[3]/button')")
    expect(adaptSelectorText('//div[3]/button', 'webdriverio')).toBe("$('//div[3]/button')")
    expect(adaptSelectorText('//div[3]/button', 'playwright')).toBe('//div[3]/button')
  })

  it(':has-text se traduce a texto por tag', () => {
    expect(adaptSelectorText("button:has-text('Ingresar')", 'cypress')).toBe("cy.contains('button', 'Ingresar')")
    expect(adaptSelectorText("button:has-text('Ingresar')", 'selenium')).toBe(
      'By.xpath("//button[contains(text(),\'Ingresar\')]")'
    )
    expect(adaptSelectorText("button:has-text('Ingresar')", 'playwright')).toBe("button:has-text('Ingresar')")
  })

  it('label:has-text + input conserva la relación label→input', () => {
    const labelInput = "label:has-text('Correo') + input"
    expect(adaptSelectorText(labelInput, 'cypress')).toBe("cy.contains('label', 'Correo').siblings('input')")
    expect(adaptSelectorText(labelInput, 'selenium')).toBe(
      'By.xpath("//label[contains(text(),\'Correo\')]/following-sibling::input | //label[contains(text(),\'Correo\')]/input")'
    )
  })

  it('visible= se degrada a un get con filtro', () => {
    expect(adaptSelectorText('visible=.btn', 'cypress')).toBe("cy.get('.btn').filter(':visible')")
    expect(adaptSelectorText('visible=.btn', 'selenium')).toBe('By.cssSelector(\'.btn\')')
  })
})
