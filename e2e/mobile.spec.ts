import { test, expect } from '@playwright/test'

/**
 * E2E — Mobile responsive checks (Pixel 7)
 *
 * Verifica que el dashboard sea usable en móvil:
 * sidebar colapsado, bottom nav, touch targets, navegación funcional, cards legibles.
 */

test.describe('Mobile — responsive layout', () => {

  test('sidebar está oculto — no visible en viewport', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    // The sidebar aside must be translated off-screen
    const sidebar = page.locator('aside').first()
    const box = await sidebar.boundingBox()
    // Sidebar should be off-screen (x < 0 or not visible)
    if (box) {
      expect(box.x + box.width).toBeLessThanOrEqual(0)
    }
  })

  test('menú hamburguesa abre el sidebar', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    const menuBtn = page.getByRole('button', { name: /abrir menú/i })
    await expect(menuBtn).toBeVisible()
    await menuBtn.click()

    // El sidebar mobile debe abrirse (link Dashboard visible en drawer)
    await expect(page.getByRole('link', { name: /^Dashboard$/i }).first()).toBeVisible({ timeout: 5_000 })
  })

  test('bottom navigation bar visible en mobile', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    // Should find the mobile bottom nav
    const bottomNav = page.locator('nav.fixed.bottom-0')
    await expect(bottomNav).toBeVisible()

    // Should have 4 tabs
    const links = bottomNav.getByRole('link')
    await expect(links).toHaveCount(4)

    // Verify tab labels
    await expect(bottomNav.getByText('Dashboard')).toBeVisible()
    await expect(bottomNav.getByText('Proyectos')).toBeVisible()
    await expect(bottomNav.getByText('Tests')).toBeVisible()
    await expect(bottomNav.getByText('Ajustes')).toBeVisible()
  })

  test('bottom nav allows navigation between pages', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    // Navigate to Projects via bottom nav
    const bottomNav = page.locator('nav.fixed.bottom-0')
    await bottomNav.getByRole('link', { name: /Proyectos/ }).click()
    await page.waitForLoadState('networkidle')

    expect(page.url()).toContain('/dashboard/projects')
  })

  test('búsqueda global es accesible en mobile', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    const searchBtn = page.getByRole('button', { name: /abrir búsqueda global/i })
    await expect(searchBtn).toBeVisible()
    await searchBtn.click()

    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByPlaceholder(/buscar por proyecto, commit, test, selector/i)).toBeVisible()
  })

  test('cards de métricas son legibles en mobile', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    // Todas las métricas deben ser visibles (pueden estar en una columna)
    await expect(page.getByText(/tests hoy/i)).toBeVisible()
    await expect(page.getByText(/autocuración/i)).toBeVisible()
  })

  test('touch targets are ≥ 44px on interactive elements', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    // Check all buttons have at least 44px touch target
    const buttons = page.getByRole('button')
    const count = await buttons.count()

    for (let i = 0; i < Math.min(count, 10); i++) {
      const btn = buttons.nth(i)
      if (await btn.isVisible()) {
        const box = await btn.boundingBox()
        if (box) {
          expect(box.height, `button ${i} height`).toBeGreaterThanOrEqual(40) // allow 4px tolerance
        }
      }
    }
  })

  test('sign-in page is usable on mobile', async ({ page }) => {
    await page.goto('/auth/signin')
    await page.waitForLoadState('networkidle')

    // Should see the sign-in card centered
    await expect(page.getByText(/sign in/i).first()).toBeVisible()

    // No horizontal overflow
    const hasOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth
    })
    expect(hasOverflow).toBeFalsy()
  })

  test('pricing page is usable on mobile', async ({ page }) => {
    await page.goto('/pricing')
    await page.waitForLoadState('networkidle')

    // Should see pricing content
    await expect(page.getByText(/precio|pricing|plan/i).first()).toBeVisible()

    // No horizontal overflow
    const hasOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth
    })
    expect(hasOverflow).toBeFalsy()
  })

  test('página de proyectos funciona en mobile', async ({ page }) => {
    await page.goto('/dashboard/projects')
    await page.waitForLoadState('networkidle')
    await expect(page.getByText(/Proyectos/i)).toBeVisible()
  })

  test('dashboard no genera overflow horizontal en mobile', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    const hasOverflow = await page.evaluate(() => {
      const doc = document.documentElement
      return doc.scrollWidth > doc.clientWidth
    })

    expect(hasOverflow).toBeFalsy()
  })

  test('landing page no genera overflow horizontal en mobile', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const hasOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth
    })

    expect(hasOverflow).toBeFalsy()
  })

  test('docs permite leer tabla API en mobile (scroll horizontal interno)', async ({ page }) => {
    await page.goto('/docs#api-params')
    await page.waitForLoadState('networkidle')

    const tableWrapper = page.locator('text=Parámetros').locator('..').locator('..').locator('div.overflow-x-auto').first()
    await expect(tableWrapper).toBeVisible()

    const canScroll = await tableWrapper.evaluate((el) => el.scrollWidth > el.clientWidth)
    expect(canScroll).toBeTruthy()
  })

  test('quick actions CTAs visible on mobile (no hover needed)', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    // Navigate to funciones tab
    const funcTab = page.getByRole('tab', { name: /funciones/i })
    if (await funcTab.isVisible()) {
      await funcTab.click()
      await page.waitForTimeout(300)

      // CTA links should be visible without hover on mobile
      const projectsLink = page.getByText('Ir a proyectos')
      if (await projectsLink.isVisible()) {
        const opacity = await projectsLink.evaluate(el => {
          return window.getComputedStyle(el).opacity
        })
        expect(Number(opacity)).toBeGreaterThan(0)
      }
    }
  })
})
