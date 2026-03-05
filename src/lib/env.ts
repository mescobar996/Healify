/**
 * Runtime environment variable validation.
 *
 * Import this module early (e.g. in db.ts or layout.tsx) so that missing
 * critical variables cause an immediate, descriptive error instead of
 * cryptic failures deep inside request handlers.
 *
 * Variables are split into two tiers:
 *   - `server`  → required on every deploy; missing = hard crash
 *   - `optional` → validated if present but never required
 */

import { z } from 'zod'

/* ------------------------------------------------------------------ */
/*  Schema                                                             */
/* ------------------------------------------------------------------ */

const serverSchema = z.object({
  DATABASE_URL:        z.string().min(1, 'DATABASE_URL is required'),
  NEXTAUTH_SECRET:     z.string().min(1, 'NEXTAUTH_SECRET is required'),
  // NEXTAUTH_URL — required in production for OAuth callback verification
  NEXTAUTH_URL:        z.string().url('NEXTAUTH_URL must be a valid URL (e.g. https://healify-sigma.vercel.app)').optional(),
  // GitHub OAuth – accept either GITHUB_CLIENT_ID or GITHUB_ID
  GITHUB_CLIENT_ID:    z.string().min(1).optional(),
  GITHUB_ID:           z.string().min(1).optional(),
  GITHUB_CLIENT_SECRET: z.string().min(1).optional(),
  GITHUB_SECRET:       z.string().min(1).optional(),
})
  .refine(
    (env) => !!env.NEXTAUTH_URL || process.env.VERCEL_URL,
    { message: 'NEXTAUTH_URL must be set (or VERCEL_URL must exist for auto-detection)' },
  )
  .refine(
    (env) => !!(env.GITHUB_CLIENT_ID || env.GITHUB_ID),
    { message: 'Either GITHUB_CLIENT_ID or GITHUB_ID must be set' },
  )
  .refine(
    (env) => !!(env.GITHUB_CLIENT_SECRET || env.GITHUB_SECRET),
    { message: 'Either GITHUB_CLIENT_SECRET or GITHUB_SECRET must be set' },
  )

const optionalSchema = z.object({
  NEXT_PUBLIC_APP_URL:         z.string().url().optional(),
  REDIS_URL:                   z.string().min(1).optional(),
  RESEND_API_KEY:              z.string().min(1).optional(),
  ENCRYPTION_KEY:              z.string().min(1).optional(),
  SENTRY_DSN:                  z.string().url().optional(),
  // Stripe
  STRIPE_SECRET_KEY:           z.string().min(1).optional(),
  STRIPE_WEBHOOK_SECRET:       z.string().min(1).optional(),
  STRIPE_STARTER_PRICE_ID:     z.string().min(1).optional(),
  STRIPE_PRO_PRICE_ID:         z.string().min(1).optional(),
  STRIPE_ENTERPRISE_PRICE_ID:  z.string().min(1).optional(),
  // MercadoPago
  MERCADOPAGO_ACCESS_TOKEN:    z.string().min(1).optional(),
  MERCADOPAGO_WEBHOOK_SECRET:  z.string().min(1).optional(),
  // AWS / S3
  AWS_S3_BUCKET:               z.string().min(1).optional(),
  AWS_REGION:                  z.string().min(1).optional(),
  AWS_ACCESS_KEY_ID:           z.string().min(1).optional(),
  AWS_SECRET_ACCESS_KEY:       z.string().min(1).optional(),
})

/* ------------------------------------------------------------------ */
/*  Validation (skipped at build time and in tests)                    */
/* ------------------------------------------------------------------ */

const isBuildTime =
  process.env.NEXT_PHASE === 'phase-production-build'

const isTest =
  process.env.NODE_ENV === 'test' || !!process.env.VITEST

const skipValidation = !!process.env.SKIP_ENV_VALIDATION

function validateEnv() {
  if (isBuildTime || isTest || skipValidation) return

  const serverResult = serverSchema.safeParse(process.env)
  if (!serverResult.success) {
    const formatted = serverResult.error.issues
      .map((i) => `  • ${i.message}`)
      .join('\n')

    if (process.env.NODE_ENV === 'production') {
      // Hard crash in production — missing vars = broken deploy
      throw new Error(
        `❌  Missing required environment variables:\n${formatted}\n\nCheck your .env / Vercel / Railway settings.`,
      )
    }
    // In development, warn loudly but don't crash (local devs may not have all vars)
    console.warn(
      `⚠️  Missing environment variables (non-critical in dev):\n${formatted}`,
    )
  }

  const optResult = optionalSchema.safeParse(process.env)
  if (!optResult.success) {
    const formatted = optResult.error.issues
      .map((i) => `  ⚠ ${i.path.join('.')}: ${i.message}`)
      .join('\n')
    console.warn(`[env] Optional env var warnings:\n${formatted}`)
  }
}

validateEnv()

export { validateEnv }
