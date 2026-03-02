/**
 * Git + dependency operations for the Railway worker.
 * Handles: clone, framework detection, dependency install.
 */

import { execSync, execFileSync } from 'child_process'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import {
  sanitizeCommitSha,
  sanitizeGitBranch,
  sanitizeGitHubRepositoryUrl,
} from '../../lib/repo-validation'
import { log, logError } from './logger'

// ── Repository cloning ────────────────────────────────────────────────────

/**
 * Clones the user's repository into a temporary directory and returns the path.
 */
export async function cloneRepository(
  jobId: string,
  repositoryUrl: string,
  branch = 'main',
  commitSha?: string
): Promise<string> {
  const workDir = path.join(os.tmpdir(), `healify-${jobId}-${Date.now()}`)
  const safeRepositoryUrl = sanitizeGitHubRepositoryUrl(repositoryUrl)
  const safeBranch = sanitizeGitBranch(branch) || 'main'
  const safeCommitSha = commitSha ? sanitizeCommitSha(commitSha) : null

  if (!safeRepositoryUrl) {
    throw new Error('Invalid repository URL. Only GitHub HTTPS URLs are allowed')
  }

  log(jobId, `Creating work directory: ${workDir}`)
  await fs.mkdir(workDir, { recursive: true })

  const githubToken = process.env.GITHUB_TOKEN || process.env.GH_PAT || ''
  let cloneUrl = safeRepositoryUrl

  if (githubToken && safeRepositoryUrl.startsWith('https://github.com/')) {
    const parsed = new URL(safeRepositoryUrl)
    parsed.username = 'x-access-token'
    parsed.password = githubToken
    cloneUrl = parsed.toString()
    log(jobId, 'Using authenticated GitHub clone URL (token provided)')
  }

  log(jobId, `Cloning repository: ${safeRepositoryUrl} (branch: ${safeBranch})`)

  try {
    execFileSync('git', ['clone', '--depth', '1', '--branch', safeBranch, cloneUrl, '.'], {
      cwd: workDir,
      stdio: 'pipe',
      timeout: 60_000,
    })

    if (safeCommitSha) {
      log(jobId, `Checking out commit: ${safeCommitSha}`)
      try {
        execFileSync('git', ['fetch', '--depth', '1', 'origin', safeCommitSha], {
          cwd: workDir,
          stdio: 'pipe',
        })
        execFileSync('git', ['checkout', safeCommitSha], {
          cwd: workDir,
          stdio: 'pipe',
        })
      } catch {
        log(jobId, `Could not checkout specific commit, using HEAD of ${safeBranch}`)
      }
    }

    return workDir
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    logError(jobId, `Failed to clone repository: ${err.message}`)
    throw new Error(`Failed to clone repository: ${err.message}`)
  }
}

// ── Framework detection ───────────────────────────────────────────────────

export interface FrameworkInfo {
  packageManager: 'npm' | 'yarn' | 'pnpm' | 'bun'
  testCommand: string
  hasPlaywright: boolean
}

/**
 * Detects package manager and test framework from the cloned repo.
 */
export async function detectTestFramework(workDir: string): Promise<FrameworkInfo> {
  const files = await fs.readdir(workDir)

  let packageManager: FrameworkInfo['packageManager'] = 'npm'
  if (files.includes('bun.lockb')) packageManager = 'bun'
  else if (files.includes('pnpm-lock.yaml')) packageManager = 'pnpm'
  else if (files.includes('yarn.lock')) packageManager = 'yarn'

  let hasPlaywright = false
  let testCommand = 'test'

  try {
    const pkgJson = JSON.parse(
      await fs.readFile(path.join(workDir, 'package.json'), 'utf-8')
    )
    const scripts: Record<string, string> = pkgJson.scripts || {}

    if (scripts['test:e2e']) testCommand = 'test:e2e'
    else if (scripts['test:playwright']) testCommand = 'test:playwright'
    else if (scripts['test']) testCommand = 'test'

    const deps = { ...pkgJson.dependencies, ...pkgJson.devDependencies }
    hasPlaywright = !!(deps['@playwright/test'] || deps['playwright'])
  } catch {
    // No package.json or invalid — leave defaults
  }

  return { packageManager, testCommand, hasPlaywright }
}

// ── Dependency installation ───────────────────────────────────────────────

const INSTALL_CMDS: Record<string, string> = {
  npm: 'npm ci --prefer-offline',
  yarn: 'yarn install --frozen-lockfile',
  pnpm: 'pnpm install --frozen-lockfile',
  bun: 'bun install --frozen-lockfile',
}

/**
 * Installs project dependencies using the detected package manager.
 */
export async function installDependencies(
  jobId: string,
  workDir: string,
  packageManager: string
): Promise<void> {
  log(jobId, `Installing dependencies with ${packageManager}...`)

  const installCmd = INSTALL_CMDS[packageManager] || 'npm install'

  try {
    execSync(installCmd, { cwd: workDir, stdio: 'pipe', timeout: 300_000 })
    log(jobId, 'Dependencies installed successfully')
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    logError(jobId, `Failed to install dependencies: ${err.message}`)
    throw new Error(`Failed to install dependencies: ${err.message}`)
  }
}
