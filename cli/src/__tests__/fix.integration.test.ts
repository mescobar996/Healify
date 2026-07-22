import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { LocalRun } from '@healify/reporter-core'

const { mockIsGitDirty } = vi.hoisted(() => ({ mockIsGitDirty: vi.fn(() => false) }))
vi.mock('../git-check', () => ({ isGitDirty: mockIsGitDirty }))

import { fix } from '../fix'

describe('fix — flujo completo con un reporte realista', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'healify-fix-integration-'))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('aplica los casos healed, respeta los review, y avisa los ambiguos — en dos archivos distintos', () => {
    const checkoutSpec = join(dir, 'checkout.spec.ts')
    const loginSpec = join(dir, 'login.spec.ts')

    writeFileSync(
      checkoutSpec,
      [
        `test('agrega producto al carrito', async ({ page }) => {`,
        `  await page.click('#add-to-cart-btn')`,
        `})`,
      ].join('\n')
    )
    writeFileSync(
      loginSpec,
      [
        `test('inicia sesión', async ({ page }) => {`,
        `  await page.click('button.submit')`,
        `  await page.click('button.submit')`, // duplicado a propósito: ambiguo
        `})`,
      ].join('\n')
    )

    const run: LocalRun = {
      project: 'tienda-demo',
      framework: 'Playwright',
      generatedAt: new Date(),
      cases: [
        {
          testName: 'agrega producto al carrito',
          testFile: checkoutSpec,
          selector: '#add-to-cart-btn',
          errorMessage: "Waiting for selector '#add-to-cart-btn' failed",
          status: 'healed',
          fixedSelector: "[data-testid='add-to-cart']",
          confidence: 0.95,
          explanation: '',
          selectorType: 'TESTID',
        },
        {
          testName: 'inicia sesión',
          testFile: loginSpec,
          selector: 'button.submit',
          errorMessage: "Element not found: button.submit",
          status: 'healed',
          fixedSelector: "button:has-text('Ingresar')",
          confidence: 0.92,
          explanation: '',
          selectorType: 'ROLE',
        },
        {
          testName: 'aplica cupón',
          testFile: checkoutSpec,
          selector: '#promo-code',
          errorMessage: 'error',
          status: 'review',
          fixedSelector: "button:has-text('Aplicar')",
          confidence: 0.83,
          explanation: '',
          selectorType: 'TEXT',
        },
      ],
    }

    const outcomes = fix(run)

    // checkout.spec.ts: el caso healed se aplica, el "review" ni se intenta.
    const checkoutContent = readFileSync(checkoutSpec, 'utf-8')
    expect(checkoutContent).toContain("[data-testid='add-to-cart']")
    expect(checkoutContent).not.toContain('#add-to-cart-btn')
    expect(checkoutContent).not.toContain("button:has-text('Aplicar')")

    // login.spec.ts: el selector aparece 2 veces → ambiguo, archivo intacto.
    const loginContent = readFileSync(loginSpec, 'utf-8')
    expect(loginContent).toContain('button.submit')
    expect(loginContent).not.toContain('Ingresar')

    const applied = outcomes.filter((o) => o.status === 'applied')
    const skipped = outcomes.filter((o) => o.status === 'skipped')
    expect(applied).toHaveLength(1)
    expect(skipped).toHaveLength(1)
    expect(skipped[0]).toMatchObject({ selector: 'button.submit', reason: 'ambiguous' })
  })
})
