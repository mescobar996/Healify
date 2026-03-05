'use server'

/**
 * Barrel re-exports — backward-compatible entry point.
 *
 * The monolith was split into focused modules:
 *   actions/projects.ts   — getProjects, createProject
 *   actions/test-runs.ts  — getTestRuns, executeTestRun
 *   actions/healing.ts    — getHealingEvents, approveHealing, rejectHealing
 *   actions/dashboard.ts  — getDashboardStats
 *   actions/helpers.ts    — verifyProjectOwnership, verifyHealingEventOwnership, verifyTestRunOwnership
 *
 * Import directly from the sub-module for tree-shaking:
 *   import { createProject } from '@/lib/actions/projects'
 */

export { getProjects, createProject } from './actions/projects'
export { getTestRuns, executeTestRun } from './actions/test-runs'
export { getHealingEvents, approveHealing, rejectHealing } from './actions/healing'
export { getDashboardStats } from './actions/dashboard'

