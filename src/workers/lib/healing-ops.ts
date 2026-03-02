/**
 * AI healing + GitHub Pull Request creation for the Railway worker.
 */

import fs from 'fs/promises'
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
  suggestion: HealingSuggestion
): Promise<string | null> {
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

  const repoUrl = project.repository ?? ''
  const parts = repoUrl.replace('https://github.com/', '').split('/')
  const owner = parts[0]
  const repo = parts[1]

  if (!owner || !repo) {
    log(jobId, 'Invalid repository URL format')
    return null
  }

  try {
    log(jobId, `Creating PR on ${owner}/${repo}...`)

    const pr = await createPullRequest(
      githubAccount.access_token,
      owner,
      repo,
      'main',
      failure.testFile,
      `// Healed by Healify\nconst selector = '${suggestion.newSelector}';`,
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
    return pr.html_url
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    logError(jobId, `Failed to create PR: ${err.message}`)
    return null
  }
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
