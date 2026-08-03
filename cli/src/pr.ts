import { execFileSync } from 'node:child_process'

export function detectGitHubCLI(): boolean {
  try {
    execFileSync('gh', ['--version'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

function getTimestamp(): string {
  const now = new Date()
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
}

export function createBranch(): string {
  const branchName = `healify/fix-${getTimestamp()}`
  try {
    execFileSync('git', ['checkout', '-b', branchName], { stdio: 'ignore' })
  } catch (err) {
    throw new Error(`Failed to create branch '${branchName}': ${(err as Error).message}`)
  }
  return branchName
}

export function createCommit(selectorCount: number): void {
  try {
    execFileSync('git', ['add', '-A'], { stdio: 'ignore' })
  } catch (err) {
    throw new Error(`Failed to stage files: ${(err as Error).message}`)
  }
  try {
    execFileSync('git', ['commit', '-m', `healify: auto-fix ${selectorCount} broken selectors`], { stdio: 'ignore' })
  } catch (err) {
    throw new Error(`Failed to create commit: ${(err as Error).message}`)
  }
}

export function createPRInstructions(branchName: string): string {
  return `Branch '${branchName}' created and committed.

To create a PR, run:

  git push origin ${branchName}
  gh pr create --title "healify: fix broken selectors" --body "See healify-audit.json for details"

Or open https://github.com in your browser and create a PR manually from branch '${branchName}'.`
}

export function createPRWithGH(title: string, body: string): string {
  try {
    const result = execFileSync('gh', ['pr', 'create', '--title', title, '--body', body], { encoding: 'utf-8' })
    return result.trim()
  } catch (err) {
    throw new Error(`Failed to create pull request: ${(err as Error).message}`)
  }
}
