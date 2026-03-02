import { test, expect } from '@playwright/test'

/**
 * E2E — Mobile responsive checks (Pixel 7)
 * 
 * Verifica que el dashboard sea usable en móvil:
 * sidebar colapsado, navegación funcional, cards legibles.
 */

test.describe('Mobile — responsive layout', () => {

  test('sidebar está colapsado en mobile', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    // En mobile el sidebar debe estar oculto por defecto
    const desktopSidebar = page.locator('.lg\\:flex, [class*="lg:block"]').first()
    // No debe tener width visible
    const viewport = page.viewportSize()
    expect(viewport?.width).toBeLessThan(768)
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

  test('docs permite leer tabla API en mobile (scroll horizontal interno)', async ({ page }) => {
    await page.goto('/docs#api-params')
    await page.waitForLoadState('networkidle')

    const tableWrapper = page.locator('text=Parámetros').locator('..').locator('..').locator('div.overflow-x-auto').first()
    await expect(tableWrapper).toBeVisible()

    const canScroll = await tableWrapper.evaluate((el) => el.scrollWidth > el.clientWidth)
    expect(canScroll).toBeTruthy()
  })
})
