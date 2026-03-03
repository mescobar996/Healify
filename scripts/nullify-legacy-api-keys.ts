/**
 * One-time migration script: nullify plaintext apiKey for all projects
 * that already have an apiKeyHash.
 *
 * Background: historically, some projects stored the raw API key in the
 * `apiKey` column alongside the hash in `apiKeyHash`. The `apiKeyHash` is
 * the authoritative credential; the plaintext copy is a security risk and
 * should be removed.
 *
 * Usage:
 *   npx tsx scripts/nullify-legacy-api-keys.ts
 *
 * Safe to run multiple times (idempotent).
 */

import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

async function main() {
  console.log('🔑 Nullifying plaintext apiKey for projects that have apiKeyHash...')

  const result = await db.project.updateMany({
    where: {
      apiKeyHash: { not: null },
      apiKey: { not: null },
    },
    data: { apiKey: null },
  })

  console.log(`✅ Done. Updated ${result.count} project(s).`)
}

main()
  .catch((err) => {
    console.error('❌ Migration failed:', err)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
