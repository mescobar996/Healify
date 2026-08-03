import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockExecFileSync } = vi.hoisted(() => ({ mockExecFileSync: vi.fn() }))
vi.mock('node:child_process', () => ({ execFileSync: mockExecFileSync }))

import { detectGitHubCLI, createBranch, createCommit, createPRInstructions, createPRWithGH } from '../pr'

describe('PR workflow', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('detectGitHubCLI returns true when gh is available', () => {
    mockExecFileSync.mockImplementation((cmd: string) => {
      if (cmd === 'gh') return 'gh version 2.50.0'
      throw new Error('Command not found')
    })

    const result = detectGitHubCLI()
    expect(result).toBe(true)
  })

  it('detectGitHubCLI returns false when gh is not available', () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error('Command not found')
    })

    const result = detectGitHubCLI()
    expect(result).toBe(false)
  })

  it('createBranch creates branch with timestamp', () => {
    mockExecFileSync.mockImplementation(() => '')

    createBranch()
    
    expect(mockExecFileSync).toHaveBeenCalledWith(
      'git',
      ['checkout', '-b', expect.stringMatching(/^healify\/fix-\d{8}-\d{6}$/)],
      { stdio: 'ignore' }
    )
  })

  it('createCommit creates commit with correct message', () => {
    mockExecFileSync.mockImplementation(() => '')

    createCommit(3, ['a.spec.ts', 'b.spec.ts'])
    
    expect(mockExecFileSync).toHaveBeenCalledWith('git', ['add', 'a.spec.ts'], { stdio: 'ignore' })
    expect(mockExecFileSync).toHaveBeenCalledWith('git', ['add', 'b.spec.ts'], { stdio: 'ignore' })
    expect(mockExecFileSync).toHaveBeenCalledWith(
      'git',
      ['commit', '-m', 'healify: auto-fix 3 broken selectors'],
      { stdio: 'ignore' }
    )
  })

  it('createPRInstructions returns instructions for manual PR', () => {
    const instructions = createPRInstructions('healify/fix-20260802-143022')
    
    expect(instructions).toContain('git push origin healify/fix-20260802-143022')
    expect(instructions).toContain('gh pr create')
  })

  it('createPRWithGH creates PR using gh CLI', () => {
    mockExecFileSync.mockReturnValue('https://github.com/user/repo/pull/123')

    const result = createPRWithGH('healify: fix broken selectors', 'PR body')
    
    expect(mockExecFileSync).toHaveBeenCalledWith(
      'gh',
      ['pr', 'create', '--title', 'healify: fix broken selectors', '--body', 'PR body'],
      { encoding: 'utf-8' }
    )
    expect(result).toBe('https://github.com/user/repo/pull/123')
  })
})
