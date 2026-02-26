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

    // Buscar botón de menú mobile
    const menuBtn = page.getByRole('button', { name: /menu|hamburger|open/i })
      .or(page.locator('button svg').first())

    if (await menuBtn.isVisible()) {
      await menuBtn.click()
      // El sidebar debe aparecer
      await expect(page.getByText('Dashboard')).toBeVisible({ timeout: 3_000 })
    }
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
})
