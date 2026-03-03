/**
 * Exchange rate service — fetches USD→ARS rate from dolarapi.com
 * and caches it in Redis for 15 minutes to avoid hammering the API.
 *
 * Source: https://dolarapi.com/v1/dolares/blue  (blue/informal rate)
 *         https://dolarapi.com/v1/dolares/oficial (official rate)
 *
 * We use the "oficial" rate for MercadoPago pricing since MP is a
 * regulated payment processor and charges at the official rate.
 */

let memCache: { rate: number; ts: number } | null = null
const CACHE_TTL_MS = 15 * 60 * 1000 // 15 minutes

interface DolarApiResponse {
  moneda: string
  casa: string
  nombre: string
  compra: number
  venta: number
  fechaActualizacion: string
}

export async function getUsdToArsRate(): Promise<number> {
  const now = Date.now()

  // Memory cache (per-process, avoids Redis dependency for this)
  if (memCache && now - memCache.ts < CACHE_TTL_MS) {
    return memCache.rate
  }

  // Try Redis cache first
  try {
    const { redis } = await import('@/lib/redis')
    const cached = await redis.get('exchange_rate:usd_ars')
    if (cached) {
      const rate = parseFloat(cached)
      memCache = { rate, ts: now }
      return rate
    }
  } catch {
    // Redis unavailable — proceed to fetch
  }

  // Fetch from dolarapi.com
  try {
    const res = await fetch('https://dolarapi.com/v1/dolares/oficial', {
      next: { revalidate: 900 }, // 15 min Next.js cache
      signal: AbortSignal.timeout(5000),
    })

    if (res.ok) {
      const data: DolarApiResponse = await res.json()
      const rate = data.venta ?? data.compra ?? 1000
      memCache = { rate, ts: now }

      // Store in Redis
      try {
        const { redis } = await import('@/lib/redis')
        await redis.set('exchange_rate:usd_ars', String(rate), 'EX', 900)
      } catch { /* non-fatal */ }

      return rate
    }
  } catch (err) {
    console.warn('[ExchangeRate] Failed to fetch — using fallback', err)
  }

  // Fallback: return last known or hardcoded fallback
  return memCache?.rate ?? 1050
}

/** Convert a USD amount to ARS, rounded to nearest 100 */
export async function usdToArs(usd: number): Promise<number> {
  const rate = await getUsdToArsRate()
  return Math.round((usd * rate) / 100) * 100
}
