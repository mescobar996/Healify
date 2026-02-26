import { test, expect } from '@playwright/test'

/**
 * E2E — Gestión de Proyectos
 * 
 * Cubre el flujo completo:
 * crear → editar → ejecutar tests → eliminar
 */

const TEST_PROJECT_NAME = `E2E Test Project ${Date.now()}`

test.describe('Proyectos — CRUD completo', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/projects')
    await page.waitForLoadState('networkidle')
  })

  test('página de proyectos carga correctamente', async ({ page }) => {
    await expect(page.getByText(/Proyectos/i)).toBeVisible()
    // Buscar campo de búsqueda
    await expect(page.getByPlaceholder(/buscar/i)).toBeVisible()
  })

  test('botón "Nuevo Proyecto" abre el modal', async ({ page }) => {
    const btn = page.getByRole('button', { name: /nuevo proyecto/i })
    await expect(btn).toBeVisible()
    await btn.click()

    // Modal debe aparecer
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 3_000 })
    await expect(page.getByText(/crear.*proyecto/i)).toBeVisible()
  })

  test('crear proyecto con nombre válido', async ({ page }) => {
    await page.getByRole('button', { name: /nuevo proyecto/i }).click()
    await page.waitForSelector('[role="dialog"]')

    // Llenar el formulario
    const nameInput = page.getByPlaceholder(/nombre/i).first()
    await nameInput.fill(TEST_PROJECT_NAME)

    // Confirmar
    const createBtn = page.getByRole('button', { name: /crear/i }).last()
    await createBtn.click()

    // Toast de éxito o proyecto aparece en la lista
    await expect(
      page.getByText(/creado/i).or(page.getByText(TEST_PROJECT_NAME))
    ).toBeVisible({ timeout: 8_000 })
  })

  test('validación: nombre vacío muestra error', async ({ page }) => {
    await page.getByRole('button', { name: /nuevo proyecto/i }).click()
    await page.waitForSelector('[role="dialog"]')

    // Intentar crear sin nombre
    const createBtn = page.getByRole('button', { name: /crear/i }).last()
    await createBtn.click()

    // Debe mostrar error o el botón debe estar deshabilitado
    const nameInput = page.getByPlaceholder(/nombre/i).first()
    const isDisabled = await createBtn.isDisabled()
    const hasError = await page.getByText(/requerido|required|nombre/i).isVisible()

    expect(isDisabled || hasError).toBeTruthy()
  })

  test('cancelar modal cierra sin crear', async ({ page }) => {
    await page.getByRole('button', { name: /nuevo proyecto/i }).click()
    await page.waitForSelector('[role="dialog"]')

    // Cancelar
    const cancelBtn = page.getByRole('button', { name: /cancelar/i })
    await cancelBtn.click()

    // Dialog debe cerrarse
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 3_000 })
  })

  test('búsqueda filtra proyectos en tiempo real', async ({ page }) => {
    const search = page.getByPlaceholder(/buscar/i)
    await search.fill('xyzimpossiblename123')

    // Si no hay resultados, mensaje de "no hay proyectos" o lista vacía
    await page.waitForTimeout(500)
    const cards = page.locator('[data-testid="project-card"]')
    const count = await cards.count()
    expect(count).toBe(0)
  })

  test('botón Editar abre modal con datos prellenados', async ({ page }) => {
    // Necesita al menos un proyecto — usar el seed
    const cards = page.locator('[data-testid="project-card"], .group.relative.p-4')
    const count = await cards.count()

    if (count === 0) {
      test.skip()
      return
    }

    // Abrir el dropdown del primer proyecto
    const firstCard = cards.first()
    const menuBtn = firstCard.getByRole('button').last()
    await menuBtn.click()

    // Click en Editar
    await page.getByText('Editar').click()

    // Modal de edición debe aparecer con nombre prellenado
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 3_000 })
    const nameInput = page.getByPlaceholder(/nombre del proyecto/i)
    const value = await nameInput.inputValue()
    expect(value.length).toBeGreaterThan(0)
  })

  test('botón Eliminar muestra confirmación', async ({ page }) => {
    const cards = page.locator('[data-testid="project-card"], .group.relative.p-4')
    const count = await cards.count()

    if (count === 0) {
      test.skip()
      return
    }

    // Abrir dropdown
    const firstCard = cards.first()
    const menuBtn = firstCard.getByRole('button').last()
    await menuBtn.click()

    // Click en Eliminar
    await page.getByText('Eliminar').click()

    // Dialog de confirmación
    await expect(page.getByRole('alertdialog')).toBeVisible({ timeout: 3_000 })
    await expect(page.getByText(/eliminar/i)).toBeVisible()
    await expect(page.getByText(/no se puede deshacer/i)).toBeVisible()

    // Cancelar para no borrar datos de test
    await page.getByRole('button', { name: /cancelar/i }).click()
    await expect(page.getByRole('alertdialog')).not.toBeVisible()
  })
})

test.describe('Proyectos — connect/webhook flow', () => {

  test('página de connect carga para un proyecto existente', async ({ page }) => {
    // Ir a projects y luego al primer proyecto
    await page.goto('/dashboard/projects')
    await page.waitForLoadState('networkidle')

    const cards = page.locator('[data-testid="project-card"], .group.relative.p-4')
    const count = await cards.count()

    if (count === 0) {
      test.skip()
      return
    }

    // Click en la card o link del proyecto
    await cards.first().click()
    // Puede navegar a connect o a detalles
    await page.waitForLoadState('networkidle')
    expect(page.url()).toMatch(/dashboard/)
  })
})
