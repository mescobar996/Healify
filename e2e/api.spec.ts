import { test, expect } from '@playwright/test'

/**
 * E2E — API tests (sin browser, solo HTTP)
 *
 * Cubre lo que queda tras el achique: la landing estática y el único
 * endpoint real, /api/v1/report (sin base de datos, auth por API key
 * compartida vía env var HEALIFY_API_KEY).
 */

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000'
const TEST_API_KEY = process.env.HEALIFY_API_KEY

test.describe('API — v1/report', () => {
  test('POST /api/v1/report sin API key → 401', async ({ request }) => {
    const res = await request.post(`${BASE}/api/v1/report`, {
      data: { testName: 'Test login', selector: '#login-btn', error: 'Element not found' },
    })
    expect(res.status()).toBe(401)
  })

  test('POST /api/v1/report con API key inválida → 401', async ({ request }) => {
    const res = await request.post(`${BASE}/api/v1/report`, {
      data: { testName: 'Test login', selector: '#login-btn', error: 'Element not found' },
      headers: { 'x-api-key': 'wrong-key' },
    })
    expect(res.status()).toBe(401)
  })

  test('POST /api/v1/report con API key válida y payload válido → 200 con sugerencia', async ({ request }) => {
    test.skip(!TEST_API_KEY, 'Requiere HEALIFY_API_KEY seteada en el entorno de test')
    const res = await request.post(`${BASE}/api/v1/report`, {
      data: { testName: 'Test login', selector: '#login-btn', error: "Waiting for selector '#login-btn' failed" },
      headers: { 'x-api-key': TEST_API_KEY! },
    })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.result.fixedSelector).toBeTruthy()
    expect(body.result.confidence).toBeGreaterThan(0)
  })

  test('POST /api/v1/report con payload inválido (falta selector) → 400', async ({ request }) => {
    test.skip(!TEST_API_KEY, 'Requiere HEALIFY_API_KEY seteada en el entorno de test')
    const res = await request.post(`${BASE}/api/v1/report`, {
      data: { testName: 'Test login', error: 'Element not found' },
      headers: { 'x-api-key': TEST_API_KEY! },
    })
    expect(res.status()).toBe(400)
  })
})

test.describe('Landing y metadatos', () => {
  test('GET / → 200 con headers de seguridad', async ({ request }) => {
    const res = await request.get(`${BASE}/`)
    expect(res.status()).toBe(200)
    const headers = res.headers()
    expect(headers['x-frame-options']).toBe('DENY')
    expect(headers['x-content-type-options']).toBe('nosniff')
    expect(headers['content-security-policy']).toBeTruthy()
  })

  test('rutas inexistentes → 404', async ({ request }) => {
    const res = await request.get(`${BASE}/ruta-que-no-existe-xyz`)
    expect(res.status()).toBe(404)
  })
})
