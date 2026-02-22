/**
 * Prisma enum re-exports
 * These match exactly the enums defined in prisma/schema.prisma
 * They are used as fallback when the generated @prisma/client doesn't export them yet.
 * After `prisma generate` runs, @prisma/client will export these directly.
 */

export const TestStatus = {
  PENDING: 'PENDING',
  RUNNING: 'RUNNING',
  PASSED: 'PASSED',
  FAILED: 'FAILED',
  HEALED: 'HEALED',
  PARTIAL: 'PARTIAL',
  CANCELLED: 'CANCELLED',
} as const
export type TestStatus = typeof TestStatus[keyof typeof TestStatus]

export const HealingStatus = {
  ANALYZING: 'ANALYZING',
  HEALED_AUTO: 'HEALED_AUTO',
  HEALED_MANUAL: 'HEALED_MANUAL',
  BUG_DETECTED: 'BUG_DETECTED',
  REMOVED_LEGIT: 'REMOVED_LEGIT',
  NEEDS_REVIEW: 'NEEDS_REVIEW',
  FAILED: 'FAILED',
  IGNORED: 'IGNORED',
} as const
export type HealingStatus = typeof HealingStatus[keyof typeof HealingStatus]

export const SelectorType = {
  CSS: 'CSS',
  XPATH: 'XPATH',
  TESTID: 'TESTID',
  ROLE: 'ROLE',
  TEXT: 'TEXT',
  MIXED: 'MIXED',
  UNKNOWN: 'UNKNOWN',
} as const
export type SelectorType = typeof SelectorType[keyof typeof SelectorType]

export const Plan = {
  FREE: 'FREE',
  STARTER: 'STARTER',
  PRO: 'PRO',
  ENTERPRISE: 'ENTERPRISE',
} as const
export type Plan = typeof Plan[keyof typeof Plan]
