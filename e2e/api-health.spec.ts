import { test, expect } from '@playwright/test'

/**
 * API health / smoke tests — verifies key endpoints respond correctly
 * without needing authentication.
 */
test.describe('API Health Checks', () => {
  test('GET / returns 200', async ({ request }) => {
    const res = await request.get('/')
    expect(res.status()).toBe(200)
  })

  test('GET /api returns health JSON', async ({ request }) => {
    const res = await request.get('/api')
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('status')
  })

  test('POST /api/v1/report without API key returns 401', async ({ request }) => {
    const res = await request.post('/api/v1/report', {
      data: {
        testName: 'e2e-test',
        selector: '#btn',
        error: 'not found',
      },
    })
    expect(res.status()).toBe(401)
  })

  test('POST /api/webhook/github without signature returns 401', async ({ request }) => {
    const res = await request.post('/api/webhook/github', {
      data: { action: 'push' },
    })
    expect(res.status()).toBe(401)
  })

  test('GET /api/projects without auth returns 401', async ({ request }) => {
    const res = await request.get('/api/projects')
    // Could be 401 or redirect depending on auth middleware
    expect([401, 302, 403]).toContain(res.status())
  })
})
