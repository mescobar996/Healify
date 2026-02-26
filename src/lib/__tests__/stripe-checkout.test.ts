import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHmac } from 'crypto'

/**
 * Tests de lógica de Stripe — checkout y webhook HMAC.
 * Sin llamadas reales a Stripe (completamente mockeados).
 */

// ── Simulated checkout validation logic ──────────────────────────────

function getValidPriceIds(env: Record<string, string | undefined>): Set<string> {
  return new Set(
    [env.STRIPE_STARTER_PRICE_ID, env.STRIPE_PRO_PRICE_ID, env.STRIPE_ENTERPRISE_PRICE_ID]
      .filter((id): id is string => !!id && !id.includes('mock'))
  )
}

function isStripeConfigured(env: Record<string, string | undefined>): boolean {
  return !!env.STRIPE_SECRET_KEY && !env.STRIPE_SECRET_KEY.includes('mock')
}

function validateCheckoutRequest(
  priceId: unknown,
  validIds: Set<string>
): { valid: boolean; error?: string } {
  if (!priceId || typeof priceId !== 'string') {
    return { valid: false, error: 'priceId is required' }
  }
  if (!validIds.has(priceId)) {
    return { valid: false, error: 'Invalid plan selected' }
  }
  return { valid: true }
}

// ── Stripe webhook HMAC verification ─────────────────────────────────

function verifyStripeWebhook(
  body: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature) return false
  // Stripe uses: t=timestamp,v1=hash format
  const parts = signature.split(',')
  const tPart  = parts.find(p => p.startsWith('t='))
  const v1Part = parts.find(p => p.startsWith('v1='))
  if (!tPart || !v1Part) return false

  const timestamp = tPart.slice(2)
  const expected  = v1Part.slice(3)
  const payload   = `${timestamp}.${body}`
  const hmac = createHmac('sha256', secret)
  hmac.update(payload, 'utf8')
  const digest = hmac.digest('hex')
  return digest === expected
}

function buildStripeSignature(body: string, secret: string, timestamp?: number): string {
  const t = timestamp ?? Math.floor(Date.now() / 1000)
  const payload = `${t}.${body}`
  const hmac = createHmac('sha256', secret)
  hmac.update(payload, 'utf8')
  const digest = hmac.digest('hex')
  return `t=${t},v1=${digest}`
}

// ── Tests ─────────────────────────────────────────────────────────────

const mockEnv = {
  STRIPE_SECRET_KEY:         'sk_test_abc123',
  STRIPE_STARTER_PRICE_ID:   'price_starter_123',
  STRIPE_PRO_PRICE_ID:       'price_pro_456',
  STRIPE_ENTERPRISE_PRICE_ID:'price_enterprise_789',
}

describe('Stripe — checkout validation', () => {

  it('Stripe configurado cuando secret key existe y no es mock', () => {
    expect(isStripeConfigured(mockEnv)).toBe(true)
  })

  it('Stripe NO configurado cuando secret key es mock', () => {
    expect(isStripeConfigured({ STRIPE_SECRET_KEY: 'sk_mock_test' })).toBe(false)
    expect(isStripeConfigured({})).toBe(false)
  })

  it('getValidPriceIds filtra correctamente los IDs válidos', () => {
    const ids = getValidPriceIds(mockEnv)
    expect(ids.has('price_starter_123')).toBe(true)
    expect(ids.has('price_pro_456')).toBe(true)
    expect(ids.has('price_enterprise_789')).toBe(true)
    expect(ids.size).toBe(3)
  })

  it('getValidPriceIds excluye IDs con "mock"', () => {
    const ids = getValidPriceIds({
      STRIPE_STARTER_PRICE_ID: 'price_mock_starter',
      STRIPE_PRO_PRICE_ID:     'price_real_pro',
    })
    expect(ids.has('price_mock_starter')).toBe(false)
    expect(ids.has('price_real_pro')).toBe(true)
    expect(ids.size).toBe(1)
  })

  it('priceId válido pasa la validación', () => {
    const ids = getValidPriceIds(mockEnv)
    expect(validateCheckoutRequest('price_starter_123', ids).valid).toBe(true)
    expect(validateCheckoutRequest('price_pro_456', ids).valid).toBe(true)
  })

  it('priceId inválido falla la validación', () => {
    const ids = getValidPriceIds(mockEnv)
    const result = validateCheckoutRequest('price_hacked_999', ids)
    expect(result.valid).toBe(false)
    expect(result.error).toBe('Invalid plan selected')
  })

  it('priceId ausente o vacío falla', () => {
    const ids = getValidPriceIds(mockEnv)
    expect(validateCheckoutRequest(null, ids).valid).toBe(false)
    expect(validateCheckoutRequest('',   ids).valid).toBe(false)
    expect(validateCheckoutRequest(123,  ids).valid).toBe(false)
  })

  it('no se puede inyectar un priceId de otro tipo', () => {
    const ids = getValidPriceIds(mockEnv)
    expect(validateCheckoutRequest({ priceId: 'price_starter_123' }, ids).valid).toBe(false)
    expect(validateCheckoutRequest(['price_starter_123'],            ids).valid).toBe(false)
  })
})

describe('Stripe — webhook HMAC verification', () => {

  const SECRET = 'whsec_test_secret_for_unit_testing'

  it('firma válida se verifica correctamente', () => {
    const body = JSON.stringify({ type: 'checkout.session.completed' })
    const sig  = buildStripeSignature(body, SECRET)
    expect(verifyStripeWebhook(body, sig, SECRET)).toBe(true)
  })

  it('firma inválida es rechazada', () => {
    const body    = JSON.stringify({ type: 'checkout.session.completed' })
    const badSig  = buildStripeSignature(body, 'wrong-secret')
    expect(verifyStripeWebhook(body, badSig, SECRET)).toBe(false)
  })

  it('firma null es rechazada', () => {
    const body = JSON.stringify({ type: 'payment_intent.succeeded' })
    expect(verifyStripeWebhook(body, null, SECRET)).toBe(false)
  })

  it('firma con formato incorrecto es rechazada', () => {
    const body = '{"event":"test"}'
    expect(verifyStripeWebhook(body, 'invalid-format', SECRET)).toBe(false)
    expect(verifyStripeWebhook(body, 'sha256=abc123',  SECRET)).toBe(false)
  })

  it('modificar el body después de firmar invalida la firma', () => {
    const body    = JSON.stringify({ amount: 100 })
    const sig     = buildStripeSignature(body, SECRET)
    const tampered = JSON.stringify({ amount: 999 })
    expect(verifyStripeWebhook(tampered, sig, SECRET)).toBe(false)
  })

  it('formato de firma Stripe: t=timestamp,v1=hash', () => {
    const body = '{"type":"customer.subscription.created"}'
    const sig  = buildStripeSignature(body, SECRET, 1700000000)
    expect(sig).toMatch(/^t=\d+,v1=[a-f0-9]{64}$/)
    expect(sig).toContain('t=1700000000')
  })

  it('misma firma es determinística con mismo timestamp', () => {
    const body = '{"event":"test"}'
    const ts   = 1700000000
    const sig1 = buildStripeSignature(body, SECRET, ts)
    const sig2 = buildStripeSignature(body, SECRET, ts)
    expect(sig1).toBe(sig2)
  })
})

describe('Stripe — plan hierarchy', () => {

  it('planes en orden correcto de precio', () => {
    const plans = [
      { id: 'FREE',       price: 0   },
      { id: 'STARTER',    price: 29  },
      { id: 'PRO',        price: 79  },
      { id: 'ENTERPRISE', price: 199 },
    ]
    for (let i = 1; i < plans.length; i++) {
      expect(plans[i].price).toBeGreaterThan(plans[i - 1].price)
    }
  })

  it('FREE plan tiene límite de 1 proyecto', () => {
    const PLAN_LIMITS = {
      FREE:       { projects: 1,  testRunsPerMonth: 50   },
      STARTER:    { projects: 5,  testRunsPerMonth: 100  },
      PRO:        { projects: -1, testRunsPerMonth: 1000 },
      ENTERPRISE: { projects: -1, testRunsPerMonth: -1   },
    }
    expect(PLAN_LIMITS.FREE.projects).toBe(1)
    expect(PLAN_LIMITS.PRO.projects).toBe(-1)   // -1 = unlimited
    expect(PLAN_LIMITS.ENTERPRISE.testRunsPerMonth).toBe(-1)
  })
})
