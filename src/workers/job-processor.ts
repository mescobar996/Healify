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
import { publishTestRunEvent } from './lib/event-bus'
import { notifyJobCompleted, notifyJobFailed } from './lib/notify'
import type { ProcessJobResult } from './lib/types'

export async function processJob(job: Job<TestJobData>): Promise<ProcessJobResult> {
  const { projectId, commitSha, testRunId, branch, repository } = job.data
  const jobId = job.id ?? 'unknown'

  log(jobId, `Processing tests for project: ${projectId}`)
  log(jobId, `TestRun: ${testRunId}, Branch: ${branch}, Commit: ${commitSha}`)

  // Helper: publish + log in one call
  async function emit(type: Parameters<typeof publishTestRunEvent>[1], progress?: number, message?: string) {
    log(jobId, message ?? type)
    await publishTestRunEvent(testRunId, type, { progress, message })
  }

  let workDir: string | null = null

  try {
    // ── 1. Mark run as started ──────────────────────────────────────
    await db.testRun.update({
      where: { id: testRunId },
      data: { status: TestStatus.RUNNING, startedAt: new Date() },
    })
    await emit('started', 0, `Test run started for project ${projectId}`)

    const project = await db.project.findUnique({ where: { id: projectId } })
    if (!project) throw new Error(`Project ${projectId} not found`)

    // ── 2. Clone repository ─────────────────────────────────────────
    await emit('progress', 5, `Cloning repository${branch ? ` (${branch})` : ''}...`)
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
    await emit('progress', 10, `Installing dependencies (${framework.packageManager})...`)
    await installDependencies(jobId, workDir, framework.packageManager)
    await emit('progress', 20, 'Installing Playwright browsers...')
    await installPlaywrightBrowsers(jobId, workDir)
    job.updateProgress(30)
    await emit('progress', 30, 'Setup complete. Running tests...')

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

    await emit('progress', 60, `Tests done: ${testResults.passed} passed, ${testResults.failed} failed`)

    // Emit individual test results
    for (const failure of testResults.failures) {
      await publishTestRunEvent(testRunId, 'test_failed', {
        message: `FAILED: ${failure.testName}`,
        data: {
          testName: failure.testName,
          testFile: failure.testFile,
          selector: failure.failedSelector,
          error: failure.errorMessage,
        },
      })
    }

    // ── 5. Heal failures ────────────────────────────────────────────
    let healedCount = 0

    for (const failure of testResults.failures) {
      await emit('progress', undefined, `Analyzing selector: ${failure.failedSelector}`)
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

      if (healing.healed && healing.suggestion) {
        await publishTestRunEvent(testRunId, 'test_healed', {
          message: `HEALED: ${failure.testName} → ${healing.suggestion.newSelector} (${Math.round((healing.suggestion.confidence ?? 0) * 100)}% confidence)`,
          data: {
            testName: failure.testName,
            oldSelector: failure.failedSelector,
            newSelector: healing.suggestion.newSelector,
            confidence: healing.suggestion.confidence,
          },
        })

        // ── 6. Create auto-PR for high-confidence heals ───────────────
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
          await publishTestRunEvent(testRunId, 'pr_created', {
            message: `PR created: ${prUrl}`,
            data: { prUrl, testName: failure.testName },
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
    await publishTestRunEvent(testRunId, 'completed', {
      progress: 100,
      message: `Completed: ${testResults.passed} passed, ${testResults.failed} failed, ${healedCount} healed`,
      data: {
        status: finalStatus,
        passedTests: testResults.passed,
        failedTests: testResults.failed,
        healedTests: healedCount,
        duration: testDuration,
      },
    })

    await notifyJobCompleted(projectId, testResults.passed, testResults.failed, healedCount, testRunId)

    return { success: true, passed: testResults.passed, failed: testResults.failed, healed: healedCount }
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    logError(jobId, `Job failed: ${err.message}`)

    await db.testRun.update({
      where: { id: testRunId },
      data: { status: TestStatus.FAILED, error: err.message, finishedAt: new Date() },
    })

    await publishTestRunEvent(testRunId, 'failed', {
      progress: 100,
      message: `Job failed: ${err.message}`,
      data: { error: err.message },
    })

    await notifyJobFailed(projectId, err.message, testRunId)

    return { success: false, passed: 0, failed: 0, healed: 0, error: err.message }
  } finally {
    if (workDir) await cleanupWorkDir(workDir)
  }
}
