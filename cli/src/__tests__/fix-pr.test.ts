import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockExecSync } = vi.hoisted(() => ({ mockExecSync: vi.fn() }))
vi.mock('node:child_process', () => ({ execSync: mockExecSync }))

import { detectGitHubCLI, createBranch, createCommit, createPRInstructions } from '../pr'

describe('PR workflow', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('detectGitHubCLI returns true when gh is available', async () => {
    mockExecSync.mockImplementation((cmd: string) => {
      if (cmd === 'gh --version') return 'gh version 2.50.0'
      throw new Error('Command not found')
    })

    const result = await detectGitHubCLI()
    expect(result).toBe(true)
  })

  it('detectGitHubCLI returns false when gh is not available', async () => {
    mockExecSync.mockImplementation(() => {
      throw new Error('Command not found')
    })

    const result = await detectGitHubCLI()
    expect(result).toBe(false)
  })

  it('createBranch creates branch with timestamp', async () => {
    mockExecSync.mockImplementation(() => '')

    await createBranch()
    
    expect(mockExecSync).toHaveBeenCalledWith(
      expect.stringMatching(/^git checkout -b healify\/fix-\d{8}-\d{6}$/),
      { stdio: 'ignore' }
    )
  })

  it('createCommit creates commit with correct message', async () => {
    mockExecSync.mockImplementation(() => '')

    await createCommit(3)
    
    expect(mockExecSync).toHaveBeenCalledWith('git add -A', { stdio: 'ignore' })
    expect(mockExecSync).toHaveBeenCalledWith(
      expect.stringMatching(/^git commit -m "healify: auto-fix 3 broken selectors"$/),
      { stdio: 'ignore' }
    )
  })

  it('createPRInstructions returns instructions for manual PR', async () => {
    const instructions = await createPRInstructions('healify/fix-20260802-143022')
    
    expect(instructions).toContain('git push origin healify/fix-20260802-143022')
    expect(instructions).toContain('gh pr create')
  })
})
