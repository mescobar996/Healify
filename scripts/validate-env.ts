import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const REQUIRED_VARS = [
  'DATABASE_URL',
  'NEXTAUTH_URL',
  'NEXTAUTH_SECRET',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GITHUB_ID',
  'GITHUB_CLIENT_SECRET',
  'REDIS_URL',
  'MERCADOPAGO_ACCESS_TOKEN',
  'MERCADOPAGO_WEBHOOK_SECRET',
  'CRON_SECRET',
  'ENCRYPTION_KEY',
  'RESEND_API_KEY',
  'GITHUB_WEBHOOK_SECRET',
] as const

const OPTIONAL_VARS = [
  'DIRECT_DATABASE_URL',
  'GITHUB_TOKEN',
  'MERCADOPAGO_ENTERPRISE_PLAN_ID',
  'MERCADOPAGO_PRO_PLAN_ID',
  'MERCADOPAGO_STARTER_PLAN_ID',
  'NEXT_PUBLIC_APP_URL',
] as const

function loadEnvFile(rootDir: string): Record<string, string> {
  const envPath = join(rootDir, '.env')
  if (!existsSync(envPath)) return {}

  const content = readFileSync(envPath, 'utf-8')
  const vars: Record<string, string> = {}

  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue

    const key = trimmed.slice(0, eqIdx).trim()
    let value = trimmed.slice(eqIdx + 1).trim()

    // Remove surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }

    vars[key] = value
  }

  return vars
}

export function validateEnv(rootDir: string = process.cwd()): { ok: boolean; missing: string[]; warnings: string[] } {
  const env = loadEnvFile(rootDir)
  const missing: string[] = []
  const warnings: string[] = []

  for (const varName of REQUIRED_VARS) {
    if (!env[varName] || env[varName].includes('replace-with') || env[varName].includes('your-')) {
      missing.push(varName)
    }
  }

  for (const varName of OPTIONAL_VARS) {
    if (!env[varName]) {
      warnings.push(varName)
    }
  }

  return { ok: missing.length === 0, missing, warnings }
}

// CLI entry point
if (require.main === module) {
  const result = validateEnv()

  if (result.ok) {
    console.log('✅ All required environment variables are set.')
  } else {
    console.error('❌ Missing required environment variables:')
    for (const v of result.missing) console.error(`   - ${v}`)
    process.exit(1)
  }

  if (result.warnings.length > 0) {
    console.log('\n⚠️  Optional variables not set (OK for local dev):')
    for (const v of result.warnings) console.log(`   - ${v}`)
  }
}
