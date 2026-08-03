import { execSync } from 'node:child_process'

export async function detectGitHubCLI(): Promise<boolean> {
  try {
    execSync('gh --version', { stdio: 'ignore' })
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

export async function createBranch(): Promise<string> {
  const branchName = `healify/fix-${getTimestamp()}`
  execSync(`git checkout -b ${branchName}`, { stdio: 'ignore' })
  return branchName
}

export async function createCommit(selectorCount: number): Promise<void> {
  execSync('git add -A', { stdio: 'ignore' })
  execSync(`git commit -m "healify: auto-fix ${selectorCount} broken selectors"`, { stdio: 'ignore' })
}

export async function createPRInstructions(branchName: string): Promise<string> {
  return `Branch '${branchName}' created and committed.

To create a PR, run:

  git push origin ${branchName}
  gh pr create --title "healify: fix broken selectors" --body "See healify-audit.json for details"

Or open https://github.com in your browser and create a PR manually from branch '${branchName}'.`
}

export async function createPRWithGH(title: string, body: string): Promise<string> {
  const result = execSync(`gh pr create --title "${title}" --body "${body}"`, { encoding: 'utf-8' })
  return result.trim()
}
