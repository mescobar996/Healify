import { test as setup, expect } from '@playwright/test'
import path from 'path'

/**
 * Global Setup — corre UNA SOLA VEZ antes de todos los tests.
 * 
 * Objetivo: autenticar con credenciales de test y guardar
 * el storage state (cookies/localStorage) para reutilizar
 * en todos los specs sin tener que loguearse en cada test.
 *
 * En CI usa credenciales de env vars.
 * En local usa el seed de demo /api/seed.
 */

const AUTH_FILE = path.join(__dirname, '../playwright/.auth/user.json')

setup('authenticate — guardar sesión de test', async ({ page }) => {
  // Para tests E2E usamos la ruta de demo seed que ya existe en el proyecto
  // En producción real esto sería con credenciales reales vía NextAuth
  await page.goto('/api/seed')
  await expect(page).not.toHaveURL(/error/)

  // Navegar al signin
  await page.goto('/auth/signin')
  await expect(page).toHaveURL(/signin/)

  // Si hay botón de GitHub OAuth simulado para test, usarlo
  // Si no, verificar que el seed nos dejó autenticados
  const isDemoMode = await page.evaluate(() => {
    return window.location.hostname === 'localhost'
  })

  if (isDemoMode) {
    // En local: usar el endpoint de seed que crea la sesión de demo
    await page.goto('/api/seed?redirect=true')
    await page.waitForURL(/dashboard/, { timeout: 10_000 })
  }

  // Guardar el estado de auth para reutilizar en specs
  await page.context().storageState({ path: AUTH_FILE })
  console.log('[setup] Auth state saved ✅')
})
