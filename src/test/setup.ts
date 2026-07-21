import '@testing-library/jest-dom'
import { vi } from 'vitest'

// ── ENCRYPTION_KEY: requerida antes de cualquier import ────────────
if (!process.env.ENCRYPTION_KEY) {
  process.env.ENCRYPTION_KEY = 'a'.repeat(64)
}

// ── Mock global de @prisma/client ─────────────────────────────────
// Evita "PrismaClient did not initialize yet. Please run prisma generate"
// en entornos sin los binarios de Prisma (CI, sandboxes, etc.)
// Los tests que necesitan comportamiento específico usan vi.mock('@/lib/db', ...)
vi.mock('@/lib/db', () => ({
  db: {
    project:      { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn() },
    user:         { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), count: vi.fn() },
    testRun:      { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), count: vi.fn() },
    healingEvent: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), count: vi.fn() },
    subscription: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    notification: { create: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    $transaction: vi.fn((ops: any[]) => Promise.all(ops)),
    $connect:     vi.fn(),
    $disconnect:  vi.fn(),
  },
}))
