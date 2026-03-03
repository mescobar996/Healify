/**
 * Tests for payment abstraction layer:
 *   - LemonSqueezy webhook signature verification
 *   - LemonSqueezy webhook payload parsing
 *   - MercadoPago webhook signature verification
 *   - Exchange rate helpers
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHmac } from 'crypto'

// ─── LemonSqueezy helpers (re-implemented for pure unit testing) ──────────────

function verifyLsSignature(rawBody: string, signature: string, secret: string): boolean {
  try {
    const digest = createHmac('sha256', secret).update(rawBody).digest('hex')
    return digest === signature
  } catch {
    return false
  }
}

type LsPayloadStatus = 'active' | 'past_due' | 'cancelled' | 'expired' | 'on_trial' | 'paused' | 'unpaid'

interface LsPayload {
  meta: {
    event_name: string
    custom_data?: { userId?: string }
  }
  data: {
    id: string
    attributes: {
      status: LsPayloadStatus
      variant_id?: number | string
      customer_id?: number | string
      user_email?: string
      renews_at?: string | null
      ends_at?: string | null
    }
  }
}

const STATUS_MAP: Record<LsPayloadStatus, string> = {
  active:   'active',
  past_due: 'past_due',
  unpaid:   'past_due',
  cancelled: 'canceled',
  expired:   'canceled',
  on_trial:  'active',
  paused:    'canceled',
}

// Inline pure version of parseWebhookPayload from lemonsqueezy.ts
function parseLsPayload(
  payload: LsPayload,
  envProVariantId = '999',
  envEnterpriseVariantId = '1000',
): { planId: string; status: string; userId?: string; currency: string } | null {
  const { event_name, custom_data } = payload.meta
  const attr = payload.data.attributes

  const supported = ['subscription_created','subscription_updated','subscription_cancelled',
    'subscription_expired','subscription_resumed','order_created']
  if (!supported.includes(event_name)) return null

  const variantId = String(attr.variant_id ?? '')
  let planId = 'starter'
  if (variantId === envEnterpriseVariantId) planId = 'enterprise'
  else if (variantId === envProVariantId)   planId = 'pro'

  return {
    userId:   custom_data?.userId,
    planId,
    status:   STATUS_MAP[attr.status] ?? 'active',
    currency: 'USD',
  }
}

// ─── MercadoPago helpers ───────────────────────────────────────────────────

function verifyMpSignature(
  xSignature: string,
  xRequestId: string,
  dataId: string,
  ts: string,
  secret: string,
): boolean {
  try {
    const parts = xSignature.split(',').reduce<Record<string, string>>((acc, part) => {
      const [k, v] = part.split('=')
      if (k && v) acc[k] = v
      return acc
    }, {})
    const receivedHash = parts['v1']
    if (!receivedHash) return false

    const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`
    const digest = createHmac('sha256', secret).update(manifest).digest('hex')
    return digest === receivedHash
  } catch {
    return false
  }
}

// ─── Exchange rate helpers ──────────────────────────────────────────────────

function usdToArs(usd: number, rate: number): number {
  return Math.round((usd * rate) / 100) * 100
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('LemonSqueezy — verifyWebhookSignature', () => {
  const SECRET = 'test-ls-secret'

  it('accepts a valid HMAC-SHA256 signature', () => {
    const body = JSON.stringify({ meta: { event_name: 'subscription_created' } })
    const sig  = createHmac('sha256', SECRET).update(body).digest('hex')
    expect(verifyLsSignature(body, sig, SECRET)).toBe(true)
  })

  it('rejects a tampered body', () => {
    const body   = JSON.stringify({ meta: { event_name: 'subscription_created' } })
    const sig    = createHmac('sha256', SECRET).update(body).digest('hex')
    const tamped = body + 'X'
    expect(verifyLsSignature(tamped, sig, SECRET)).toBe(false)
  })

  it('rejects a wrong secret', () => {
    const body = JSON.stringify({ alpha: 1 })
    const sig  = createHmac('sha256', 'other-secret').update(body).digest('hex')
    expect(verifyLsSignature(body, sig, SECRET)).toBe(false)
  })

  it('rejects an empty signature', () => {
    const body = '{"event":"test"}'
    expect(verifyLsSignature(body, '', SECRET)).toBe(false)
  })
})

describe('LemonSqueezy — parseWebhookPayload', () => {
  function makePayload(partial: Partial<{
    event: string
    userId: string
    status: LsPayloadStatus
    variantId: string
  }>): LsPayload {
    return {
      meta: {
        event_name: partial.event ?? 'subscription_created',
        custom_data: { userId: partial.userId ?? 'user-abc' },
      },
      data: {
        id: 'sub-42',
        attributes: {
          status:     partial.status ?? 'active',
          variant_id: partial.variantId ?? '111',
          customer_id: 777,
          renews_at: '2025-12-31T00:00:00.000Z',
        },
      },
    }
  }

  it('returns null for unrecognized events', () => {
    const p = makePayload({ event: 'invoice_paid' })
    expect(parseLsPayload(p)).toBeNull()
  })

  it('maps subscription_created → active, starter (unknown variant)', () => {
    const result = parseLsPayload(makePayload({ event: 'subscription_created', status: 'active', variantId: '123' }))
    expect(result).not.toBeNull()
    expect(result!.planId).toBe('starter')
    expect(result!.status).toBe('active')
    expect(result!.currency).toBe('USD')
  })

  it('maps pro variant correctly', () => {
    const result = parseLsPayload(makePayload({ event: 'subscription_updated', status: 'active', variantId: '999' }), '999', '1000')
    expect(result!.planId).toBe('pro')
  })

  it('maps enterprise variant correctly', () => {
    const result = parseLsPayload(makePayload({ event: 'subscription_updated', status: 'active', variantId: '1000' }), '999', '1000')
    expect(result!.planId).toBe('enterprise')
  })

  it('maps cancelled → canceled status', () => {
    const result = parseLsPayload(makePayload({ event: 'subscription_cancelled', status: 'cancelled' }))
    expect(result!.status).toBe('canceled')
  })

  it('maps expired → canceled status', () => {
    const result = parseLsPayload(makePayload({ event: 'subscription_expired', status: 'expired' }))
    expect(result!.status).toBe('canceled')
  })

  it('maps on_trial → active status', () => {
    const result = parseLsPayload(makePayload({ event: 'subscription_created', status: 'on_trial' }))
    expect(result!.status).toBe('active')
  })

  it('passes userId from custom_data', () => {
    const result = parseLsPayload(makePayload({ userId: 'user-xyz' }))
    expect(result!.userId).toBe('user-xyz')
  })

  it('handles missing userId gracefully', () => {
    const p: LsPayload = {
      meta: { event_name: 'subscription_created' }, // no custom_data
      data: { id: 'sub-1', attributes: { status: 'active' } },
    }
    const result = parseLsPayload(p)
    expect(result!.userId).toBeUndefined()
  })

  it('handles subscription_resumed correctly', () => {
    const result = parseLsPayload(makePayload({ event: 'subscription_resumed', status: 'active' }))
    expect(result!.status).toBe('active')
  })
})

describe('MercadoPago — verifyWebhookSignature', () => {
  const SECRET  = 'mp-webhook-secret'
  const DATA_ID = 'preapproval-abc123'
  const REQ_ID  = 'req-uuid-1234'
  const TS      = '1719424877'

  function makeSignature(dataId: string, reqId: string, ts: string): string {
    const manifest = `id:${dataId};request-id:${reqId};ts:${ts};`
    const hash = createHmac('sha256', SECRET).update(manifest).digest('hex')
    return `ts=${ts},v1=${hash}`
  }

  it('accepts a valid signature', () => {
    const sig = makeSignature(DATA_ID, REQ_ID, TS)
    expect(verifyMpSignature(sig, REQ_ID, DATA_ID, TS, SECRET)).toBe(true)
  })

  it('rejects a tampered data ID', () => {
    const sig = makeSignature(DATA_ID, REQ_ID, TS)
    expect(verifyMpSignature(sig, REQ_ID, 'wrong-id', TS, SECRET)).toBe(false)
  })

  it('rejects a tampered request ID', () => {
    const sig = makeSignature(DATA_ID, REQ_ID, TS)
    expect(verifyMpSignature(sig, 'wrong-req', DATA_ID, TS, SECRET)).toBe(false)
  })

  it('rejects a tampered timestamp', () => {
    const sig = makeSignature(DATA_ID, REQ_ID, TS)
    expect(verifyMpSignature(sig, REQ_ID, DATA_ID, '9999999999', SECRET)).toBe(false)
  })

  it('rejects a wrong secret', () => {
    const sig = makeSignature(DATA_ID, REQ_ID, TS)
    expect(verifyMpSignature(sig, REQ_ID, DATA_ID, TS, 'wrong-secret')).toBe(false)
  })

  it('rejects missing v1 hash', () => {
    expect(verifyMpSignature(`ts=${TS}`, REQ_ID, DATA_ID, TS, SECRET)).toBe(false)
  })
})

describe('Exchange rate — usdToArs', () => {
  it('converts USD to ARS rounded to nearest 100', () => {
    expect(usdToArs(49, 1000)).toBe(49000)
    expect(usdToArs(99, 1000)).toBe(99000)
    expect(usdToArs(499, 1050)).toBe(524000)   // 499*1050=523950 → /100=5239.5 → round=5240 → *100=524000
  })

  it('rounds to nearest 100 for fractional rates', () => {
    // 10 USD * 1050.5 = 10505 → nearest 100 = 10500
    expect(usdToArs(10, 1050.5)).toBe(10500)
  })

  it('handles zero gracefully', () => {
    expect(usdToArs(0, 1050)).toBe(0)
  })

  it('starter at 1050 rate', () => {
    expect(usdToArs(49, 1050)).toBe(51500)   // 49 * 1050 = 51450 → nearest 100 = 51500
  })

  it('pro at 1050 rate', () => {
    // 99 * 1050 = 103950 → /100 = 1039.5 → Math.round = 1040 → * 100 = 104000
    expect(usdToArs(99, 1050)).toBe(104000)
  })
})
