import { describe, it, expect } from 'vitest'
import { analyzeAndHeal } from '../healing-engine'

/**
 * Red de seguridad de la heurística.
 *
 * No verifica que cada salida sea "la correcta" — para eso están los tests específicos de
 * healing-engine.test.ts. Verifica que la salida del motor sobre un corpus fijo NO cambie
 * sin que alguien lo mire: cualquier retoque de estrategias, prioridades o wording rompe el
 * snapshot y obliga a revisar el diff a mano antes de aceptarlo.
 *
 * Al actualizar con `vitest -u`: leer el diff completo. Un cambio esperado toca pocas
 * entradas; si toca todas, probablemente se rompió algo transversal.
 *
 * Los selectores son patrones reales que aparecen en suites de E2E (IDs generados por
 * frameworks, clases hasheadas de CSS-in-JS/Tailwind, XPath absoluto de grabadores, etc.).
 */
const CORPUS = [
  // IDs — estables vs. generados en build/runtime
  '#login-button',
  '#submit',
  '#ember1234',
  '#mat-input-27',
  '#react-select-3-option-0',
  '#user_email_1a2b3c',

  // Clases — semánticas vs. hasheadas
  '.btn-primary',
  '.css-1x2y3z4',
  '.MuiButton-root-482',
  '.sc-bdVaJa',
  '.jsx-2847362913',
  '.flex.items-center.px-4',

  // Test IDs — los cinco atributos reconocidos
  '[data-testid="submit-button"]',
  '[data-cy="login-form"]',
  '[data-qa="user-menu"]',
  '[data-test="checkout-total"]',
  '[data-e2e="nav-profile"]',

  // Atributos genéricos
  '[name="email"]',
  '[aria-label="Cerrar"]',
  '[type="submit"]',
  '[type="button"]',
  'input[placeholder="Buscar"]',

  // XPath — absoluto y relativo
  '/html/body/div[2]/div/form/button',
  '//button[@id="save"]',
  '//*[@id="root"]/div/section[3]',

  // Basados en posición
  'div:nth-child(3) > span:nth-of-type(2)',
  'ul li:nth-child(1) a',
  'table tr:nth-of-type(4) td:nth-child(2)',

  // Locators modernos de Playwright — no se deben "curar" a algo peor
  'getByRole("button", { name: "Guardar" })',
  'getByText("Iniciar sesión")',
  'text=Continuar',

  // Compuestos y descendientes
  'form.checkout > button.submit',
  '.modal .footer button',
  'header nav ul li a.active',

  // Compuestos sin keyword de acción reconocible — antes caían al fallback `visible=` roto
  // (solo recortaba el primer '.'/'#' de todo el string, sin entender que había una ruta de
  // ancestros de por medio: '.card .price' → 'visible=card .price', ni CSS válido)
  '.card .price',
  '.sidebar > .username',

  // Compuesto con dos testids — antes extractTestid() (sin /g) tomaba el del ANCESTRO por ser
  // el primer match de todo el string, no el del elemento objetivo real
  '[data-testid="product-card"] [data-testid="add-to-cart-btn"]',
]

describe('corpus de heurística (snapshot)', () => {
  for (const selector of CORPUS) {
    it(`no cambia la salida para ${selector}`, () => {
      expect(analyzeAndHeal({ selector })).toMatchSnapshot()
    })
  }

  it('el corpus no tiene selectores duplicados', () => {
    expect(new Set(CORPUS).size).toBe(CORPUS.length)
  })
})
