import { test, expect } from '@playwright/test'

/**
 * E2E — Dashboard principal
 * 
 * Cubre: carga, métricas, navegación, botones críticos.
 * No depende de datos reales — verifica estructura y UX.
 */

test.describe('Dashboard — carga y estructura', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')
  })

  test('título de la página es "Healify"', async ({ page }) => {
    await expect(page).toHaveTitle(/Healify/)
  })

  test('sidebar visible con todos los nav items', async ({ page }) => {
    const nav = page.locator('nav, [role="navigation"]').first()
    await expect(nav).toBeVisible()

    // Items de navegación principales
    await expect(page.getByText('Dashboard')).toBeVisible()
    await expect(page.getByText('Proyectos')).toBeVisible()
    await expect(page.getByText(/Tests/i)).toBeVisible()
    await expect(page.getByText(/Configuración/i)).toBeVisible()
  })

  test('logo Healify visible en el sidebar', async ({ page }) => {
    const logo = page.locator('img[alt="Healify"]').first()
    await expect(logo).toBeVisible()
  })

  test('las 4 tarjetas de métricas están presentes', async ({ page }) => {
    // Cards: Tests monitoreados, Tests Hoy, Autocuración, Bugs detectados
    await expect(page.getByText(/tests monitoreados/i)).toBeVisible()
    await expect(page.getByText(/tests hoy/i)).toBeVisible()
    await expect(page.getByText(/autocuración/i)).toBeVisible()
    await expect(page.getByText(/bugs detectados/i)).toBeVisible()
  })

  test('botón "Ejecutar Tests" es visible y clickeable', async ({ page }) => {
    const btn = page.getByRole('button', { name: /ejecutar tests/i })
    await expect(btn).toBeVisible()
    await expect(btn).toBeEnabled()
  })

  test('botón "Actualizar" refresca el dashboard', async ({ page }) => {
    const btn = page.getByRole('button', { name: /actualizar/i })
    await expect(btn).toBeVisible()
    await btn.click()
    // Verificar que no hay crash
    await expect(page.locator('body')).not.toContainText('Error')
    await expect(page.locator('body')).not.toContainText('500')
  })

  test('sección ROI visible', async ({ page }) => {
    await expect(page.getByText(/ROI/i)).toBeVisible()
    await expect(page.getByText(/horas ahorradas/i)).toBeVisible()
  })

  test('gráfico de tendencia visible', async ({ page }) => {
    await expect(page.getByText(/Tendencia de Curación/i)).toBeVisible()
  })

  test('no hay errores de consola críticos', async ({ page }) => {
    const errors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text())
    })
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    // Filtrar errores esperados (hot reload, etc.)
    const criticalErrors = errors.filter(e =>
      !e.includes('favicon') &&
      !e.includes('hot-update') &&
      !e.includes('__webpack')
    )
    expect(criticalErrors).toHaveLength(0)
  })
})

test.describe('Dashboard — navegación', () => {

  test('click en "Proyectos" navega correctamente', async ({ page }) => {
    await page.goto('/dashboard')
    await page.getByText('Proyectos').click()
    await expect(page).toHaveURL(/\/dashboard\/projects/)
  })

  test('click en "Tests" navega correctamente', async ({ page }) => {
    await page.goto('/dashboard')
    await page.getByText(/^Tests$/i).click()
    await expect(page).toHaveURL(/\/dashboard\/tests/)
  })

  test('click en "Configuración" navega correctamente', async ({ page }) => {
    await page.goto('/dashboard')
    await page.getByText(/Configuración/i).click()
    await expect(page).toHaveURL(/\/dashboard\/settings/)
  })

  test('ruta protegida — /dashboard redirige si no hay sesión', async ({ browser }) => {
    // Contexto limpio sin auth state
    const context = await browser.newContext()
    const page = await context.newPage()
    await page.goto('/dashboard')
    // Debe redirigir a signin
    await expect(page).toHaveURL(/signin|auth/, { timeout: 8_000 })
    await context.close()
  })
})
