import { describe, expect, it } from 'vitest'
import {
  extractBranchFromGitRef,
  sanitizeCommitSha,
  sanitizeGitBranch,
  sanitizeGitHubRepositoryUrl,
} from '@/lib/repo-validation'

describe('repo-validation', () => {
  it('normaliza URLs válidas de GitHub', () => {
    expect(sanitizeGitHubRepositoryUrl('https://github.com/org/repo')).toBe('https://github.com/org/repo')
    expect(sanitizeGitHubRepositoryUrl('https://github.com/org/repo.git')).toBe('https://github.com/org/repo')
    expect(sanitizeGitHubRepositoryUrl(' https://github.com/org/repo/ ')).toBe('https://github.com/org/repo')
  })

  it('rechaza URLs inválidas o no-GitHub', () => {
    expect(sanitizeGitHubRepositoryUrl('git@github.com:org/repo.git')).toBeNull()
    expect(sanitizeGitHubRepositoryUrl('https://gitlab.com/org/repo')).toBeNull()
    expect(sanitizeGitHubRepositoryUrl('https://github.com/org')).toBeNull()
  })

  it('acepta y limpia branches válidos', () => {
    expect(sanitizeGitBranch('main')).toBe('main')
    expect(sanitizeGitBranch('feature/auth-v2')).toBe('feature/auth-v2')
    expect(sanitizeGitBranch(' release/1.0.0 ')).toBe('release/1.0.0')
  })

  it('rechaza branches peligrosos', () => {
    expect(sanitizeGitBranch('main; rm -rf /')).toBeNull()
    expect(sanitizeGitBranch('../main')).toBeNull()
    expect(sanitizeGitBranch('heads/main')).toBe('heads/main')
    expect(sanitizeGitBranch('')).toBeNull()
  })

  it('valida commit shas', () => {
    expect(sanitizeCommitSha('abc1234')).toBe('abc1234')
    expect(sanitizeCommitSha('ABCDEF1234')).toBe('abcdef1234')
    expect(sanitizeCommitSha('xyz1234')).toBeNull()
    expect(sanitizeCommitSha('short')).toBeNull()
  })

  it('extrae branch desde refs/heads/*', () => {
    expect(extractBranchFromGitRef('refs/heads/main')).toBe('main')
    expect(extractBranchFromGitRef('refs/heads/feature/login')).toBe('feature/login')
    expect(extractBranchFromGitRef('refs/tags/v1.0.0')).toBeNull()
  })
})
