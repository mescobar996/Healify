/**
 * Job processor for the Railway worker.
 * Orchestrates: clone → detect → install → test → heal → PR → DB update.
 */

import type { Job } from 'bullmq'
import { db } from '../lib/db'
import { TestStatus, HealingStatus, SelectorType } from '../lib/enums'
import type { TestJobData } from '../lib/queue'
import { cloneRepository, detectTestFramework, installDependencies } from './lib/git-ops'
import { installPlaywrightBrowsers, runPlaywrightTests } from './lib/playwright-runner'
import { healTestFailure, createHealingPR, cleanupWorkDir } from './lib/healing-ops'
import { log, logError } from './lib/logger'
import type { ProcessJobResult } from './lib/types'

export async function processJob(job: Job<TestJobData>): Promise<ProcessJobResult> {
  const { projectId, commitSha, testRunId, branch, repository } = job.data
  const jobId = job.id ?? 'unknown'

  log(jobId, `Processing tests for project: ${projectId}`)
  log(jobId, `TestRun: ${testRunId}, Branch: ${branch}, Commit: ${commitSha}`)

  let workDir: string | null = null

  try {
    // ── 1. Mark run as started ──────────────────────────────────────
    await db.testRun.update({
      where: { id: testRunId },
      data: { status: TestStatus.RUNNING, startedAt: new Date() },
    })

    const project = await db.project.findUnique({ where: { id: projectId } })
    if (!project) throw new Error(`Project ${projectId} not found`)

    // ── 2. Clone repository ─────────────────────────────────────────
    workDir = await cloneRepository(
      jobId,
      repository || project.repository || '',
      branch,
      commitSha
    )

    const framework = await detectTestFramework(workDir)
    if (!framework.hasPlaywright) {
      throw new Error('Repository does not have Playwright installed')
    }

    // ── 3. Install dependencies + browsers ─────────────────────────
    await installDependencies(jobId, workDir, framework.packageManager)
    await installPlaywrightBrowsers(jobId, workDir)
    job.updateProgress(30)

    // ── 4. Run tests ────────────────────────────────────────────────
    const testStartTime = Date.now()
    const testResults = await runPlaywrightTests(
      jobId,
      workDir,
      framework.packageManager,
      framework.testCommand
    )
    const testDuration = Date.now() - testStartTime
    job.updateProgress(60)

    // ── 5. Heal failures ────────────────────────────────────────────
    let healedCount = 0

    for (const failure of testResults.failures) {
      const healing = await healTestFailure(jobId, failure, workDir)

      const healingEvent = await db.healingEvent.create({
        data: {
          testRunId,
          testName: failure.testName,
          testFile: failure.testFile,
          failedSelector: failure.failedSelector,
          selectorType: SelectorType.UNKNOWN,
          errorMessage: failure.errorMessage,
          stackTrace: failure.stackTrace,
          newSelector: healing.suggestion?.newSelector,
          confidence: healing.suggestion?.confidence,
          reasoning: healing.suggestion?.reasoning,
          status: healing.healed ? HealingStatus.HEALED_AUTO : HealingStatus.NEEDS_REVIEW,
        },
      })

      // ── 6. Create auto-PR for high-confidence heals ───────────────
      if (healing.healed && healing.suggestion) {
        const prUrl = await createHealingPR(jobId, project, failure, healing.suggestion)

        if (prUrl) {
          await db.healingEvent.update({
            where: { id: healingEvent.id },
            data: {
              prUrl,
              prBranch: `healify-fix-${Date.now()}`,
              actionTaken: 'auto_fixed',
              appliedAt: new Date(),
              appliedBy: 'system',
            },
          })
          healedCount++
        }
      }
    }

    job.updateProgress(90)

    // ── 7. Update final run status ──────────────────────────────────
    const finalStatus =
      testResults.failed === 0
        ? TestStatus.PASSED
        : healedCount === testResults.failed
          ? TestStatus.HEALED
          : TestStatus.PARTIAL

    await db.testRun.update({
      where: { id: testRunId },
      data: {
        status: finalStatus,
        totalTests: testResults.passed + testResults.failed,
        passedTests: testResults.passed,
        failedTests: testResults.failed,
        healedTests: healedCount,
        duration: testDuration,
        finishedAt: new Date(),
      },
    })

    log(jobId, `Test run completed: ${finalStatus}`)
    log(
      jobId,
      `Results: ${testResults.passed} passed, ${testResults.failed} failed, ${healedCount} healed`
    )

    return { success: true, passed: testResults.passed, failed: testResults.failed, healed: healedCount }
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    logError(jobId, `Job failed: ${err.message}`)

    await db.testRun.update({
      where: { id: testRunId },
      data: { status: TestStatus.FAILED, error: err.message, finishedAt: new Date() },
    })

    return { success: false, passed: 0, failed: 0, healed: 0, error: err.message }
  } finally {
    if (workDir) await cleanupWorkDir(workDir)
  }
}
