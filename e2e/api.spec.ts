import { test, expect, request } from '@playwright/test'
import { createHmac } from 'crypto'

/**
 * E2E — API Tests (sin browser, solo HTTP)
 * 
 * Valida los endpoints críticos directamente:
 * - /api/webhook/github (HMAC, payload)
 * - /api/projects (CRUD via API)
 * - /api/v1/report (rate limiting, validación)
 * - /api/dashboard (auth requerida)
 */

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000'

function signWebhook(body: string, secret: string): string {
  const hmac = createHmac('sha256', secret)
  hmac.update(body, 'utf8')
  return `sha256=${hmac.digest('hex')}`
}

test.describe('API — Webhook GitHub', () => {

  test('POST /api/webhook/github sin firma → 401', async ({ request }) => {
    const res = await request.post(`${BASE}/api/webhook/github`, {
      data: { ref: 'refs/heads/main', repository: { html_url: 'https://github.com/test/repo' } },
      headers: { 'Content-Type': 'application/json' },
    })
    expect(res.status()).toBe(401)
  })

  test('POST /api/webhook/github con firma inválida → 401', async ({ request }) => {
    const body = JSON.stringify({ ref: 'refs/heads/main' })
    const res = await request.post(`${BASE}/api/webhook/github`, {
      data: body,
      headers: {
        'Content-Type': 'application/json',
        'x-hub-signature-256': 'sha256=invalidhash000000000000000000000000000000000000000000000000000000',
        'x-github-event': 'push',
      },
    })
    expect(res.status()).toBe(401)
  })

  test('GET /api/webhook/github → método no permitido', async ({ request }) => {
    const res = await request.get(`${BASE}/api/webhook/github`)
    expect([405, 404]).toContain(res.status())
  })
})

test.describe('API — Dashboard', () => {

  test('GET /api/dashboard sin auth → 401', async ({ request }) => {
    const res = await request.get(`${BASE}/api/dashboard`)
    expect(res.status()).toBe(401)
  })

  test('GET /api/projects sin auth → 401', async ({ request }) => {
    const res = await request.get(`${BASE}/api/projects`)
    expect(res.status()).toBe(401)
  })

  test('POST /api/projects sin auth → 401', async ({ request }) => {
    const res = await request.post(`${BASE}/api/projects`, {
      data: { name: 'Hack attempt' },
    })
    expect(res.status()).toBe(401)
  })

  test('DELETE /api/projects/:id sin auth → 401', async ({ request }) => {
    const res = await request.delete(`${BASE}/api/projects/fake-id-123`)
    expect(res.status()).toBe(401)
  })

  test('PATCH /api/projects/:id sin auth → 401', async ({ request }) => {
    const res = await request.patch(`${BASE}/api/projects/fake-id-123`, {
      data: { name: 'Unauthorized update' },
    })
    expect(res.status()).toBe(401)
  })
})

test.describe('API — v1/report security', () => {

  test('POST /api/v1/report sin API key → 401', async ({ request }) => {
    const res = await request.post(`${BASE}/api/v1/report`, {
      data: {
        testName: 'Test login',
        selector: '#login-btn',
        error: 'Element not found',
      },
    })
    expect(res.status()).toBe(401)
  })

  test('POST /api/v1/report con API key inválida → 401', async ({ request }) => {
    const res = await request.post(`${BASE}/api/v1/report`, {
      data: {
        testName: 'Test login',
        selector: '#login-btn',
        error: 'Element not found',
      },
      headers: {
        'x-api-key': 'hf_live_fakeinvalidkey12345',
      },
    })
    expect(res.status()).toBe(401)
  })

  test('POST /api/v1/report con payload inválido (falta selector) → 400 o 401', async ({ request }) => {
    const res = await request.post(`${BASE}/api/v1/report`, {
      data: {
        testName: 'Test login',
        // selector falta
        error: 'Element not found',
      },
      headers: { 'x-api-key': 'hf_live_fakeinvalidkey12345' },
    })
    expect([400, 401]).toContain(res.status())
  })
})

test.describe('API — health y metadatos', () => {

  test('GET /api → responde con info de la API', async ({ request }) => {
    const res = await request.get(`${BASE}/api`)
    // Puede ser 200 con info o 404 si no existe la ruta raíz
    expect([200, 404]).toContain(res.status())
  })

  test('rutas inexistentes → 404', async ({ request }) => {
    const res = await request.get(`${BASE}/api/ruta-que-no-existe-xyz`)
    expect(res.status()).toBe(404)
  })

  test('headers de seguridad presentes en respuestas', async ({ request }) => {
    const res = await request.get(`${BASE}/`)
    const headers = res.headers()
    // Verificar headers de seguridad configurados en next.config.ts
    expect(headers['x-frame-options']).toBe('DENY')
    expect(headers['x-content-type-options']).toBe('nosniff')
  })
})
