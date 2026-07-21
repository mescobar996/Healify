/**
 * AI healing + GitHub Pull Request creation for the Railway worker.
 */

import fs from 'fs/promises'
import path from 'path'
import { db } from '../../lib/db'
import { analyzeBrokenSelector } from '../../lib/ai/healing-service'
import { createPullRequest } from '../../lib/github/repos'
import type { TestFailure } from './types'
import { log, logError } from './logger'

// ── Healing ───────────────────────────────────────────────────────────────

export interface HealingSuggestion {
  newSelector: string
  confidence: number
  reasoning: string
}

export interface HealingResult {
  healed: boolean
  suggestion?: HealingSuggestion
}

/** Escapes a string for safe interpolation into a RegExp. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Reads the real test file from the cloned working directory and replaces the
 * exact quoted occurrence of `failedSelector` with `newSelector`.
 *
 * Returns null (instead of guessing) when the file can't be read, or when the
 * selector doesn't appear as an unambiguous quoted literal exactly once —
 * in that case the caller should leave the event as NEEDS_REVIEW rather than
 * risk corrupting the file.
 */
export async function buildHealedFileContent(
  workDir: string,
  failure: TestFailure,
  newSelector: string
): Promise<string | null> {
  const absolutePath = path.join(workDir, failure.testFile)

  let original: string
  try {
    original = await fs.readFile(absolutePath, 'utf-8')
  } catch {
    return null
  }

  // Match the selector only as a quoted string literal (how it appears in real
  // test code), never as a bare substring — avoids clobbering unrelated text.
  const pattern = new RegExp(`(['"])${escapeRegExp(failure.failedSelector)}\\1`, 'g')
  const matches = original.match(pattern)

  if (!matches || matches.length !== 1) {
    return null
  }

  return original.replace(pattern, `$1${newSelector}$1`)
}

/** Structured result returned by createHealingPR — used for rollback if DB write fails */
export interface PrCreationResult {
  prUrl: string
  prNumber: number
  owner: string
  repo: string
  accessToken: string
}

/**
 * Calls the AI healing service to analyze a test failure.
 * Returns a suggestion only when confidence >= 0.95.
 */
export async function healTestFailure(
  jobId: string,
  failure: TestFailure,
  _workDir: string
): Promise<HealingResult> {
  log(jobId, `Analyzing failure: ${failure.testName}`)

  const domSnapshot = failure.domSnapshot ?? '<html><body>DOM not captured</body></html>'

  const suggestion = await analyzeBrokenSelector(
    failure.failedSelector,
    failure.errorMessage,
    domSnapshot
  )

  if (!suggestion) return { healed: false }

  log(jobId, `Healing suggestion: ${suggestion.newSelector} (confidence: ${suggestion.confidence})`)

  return {
    healed: suggestion.confidence >= 0.95,
    suggestion: {
      newSelector: suggestion.newSelector,
      confidence: suggestion.confidence,
      reasoning: suggestion.reasoning,
    },
  }
}

// ── Auto-PR ───────────────────────────────────────────────────────────────

/**
 * Creates a GitHub PR with the healed selector fix.
 * Returns the PR URL or null if the PR could not be created.
 */
export async function createHealingPR(
  jobId: string,
  project: { id: string; repository: string | null },
  failure: TestFailure,
  suggestion: HealingSuggestion,
  workDir: string
): Promise<PrCreationResult | null> {
  const projectWithUser = await db.project.findUnique({
    where: { id: project.id },
    include: {
      user: {
        include: {
          accounts: { where: { provider: 'github' } },
        },
      },
    },
  })

  const githubAccount = projectWithUser?.user?.accounts?.[0]
  if (!githubAccount?.access_token) {
    log(jobId, 'No GitHub access token found for user, cannot create PR')
    return null
  }

  const accessToken = githubAccount.access_token
  const repoUrl = project.repository ?? ''
  const parts = repoUrl.replace('https://github.com/', '').split('/')
  const owner = parts[0]
  const repo = parts[1]

  if (!owner || !repo) {
    log(jobId, 'Invalid repository URL format')
    return null
  }

  const healedContent = await buildHealedFileContent(workDir, failure, suggestion.newSelector)
  if (healedContent === null) {
    log(
      jobId,
      `Could not safely locate a unique occurrence of "${failure.failedSelector}" in ${failure.testFile} — skipping auto-PR (needs manual review)`
    )
    return null
  }

  try {
    log(jobId, `Creating PR on ${owner}/${repo}...`)

    const pr = await createPullRequest(
      accessToken,
      owner,
      repo,
      'main',
      failure.testFile,
      healedContent,
      `🪄 Healify: Fix broken selector in ${failure.testName}`,
      [
        'Healify identified a broken selector and automatically fixed it.',
        '',
        `**Original:** \`${failure.failedSelector}\``,
        `**New:** \`${suggestion.newSelector}\``,
        `**Confidence:** ${(suggestion.confidence * 100).toFixed(1)}%`,
        '',
        `**Reasoning:** ${suggestion.reasoning}`,
        '',
        `**Error was:** ${failure.errorMessage}`,
      ].join('\n')
    )

    log(jobId, `PR created: ${pr.html_url}`)
    return { prUrl: pr.html_url, prNumber: pr.number, owner, repo, accessToken }
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    logError(jobId, `Failed to create PR: ${err.message}`)
    return null
  }
}

// ── PR Rollback ───────────────────────────────────────────────────────────────

/**
 * Closes a GitHub PR — used as rollback when the DB update fails after PR creation.
 */
export async function closePullRequest(
  accessToken: string,
  owner: string,
  repo: string,
  prNumber: number
): Promise<void> {
  const { getGitHubOctokit } = await import('../../lib/github/auth')
  const octokit = getGitHubOctokit(accessToken)
  await octokit.rest.pulls.update({ owner, repo, pull_number: prNumber, state: 'closed' })
}

// ── Cleanup ───────────────────────────────────────────────────────────────

/**
 * Removes the temporary working directory created for the job.
 */
export async function cleanupWorkDir(workDir: string): Promise<void> {
  try {
    await fs.rm(workDir, { recursive: true, force: true })
  } catch (error) {
    console.warn(`Failed to cleanup ${workDir}:`, error)
  }
}
