const GITHUB_REPOSITORY_REGEX = /^https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/
const BRANCH_REGEX = /^[A-Za-z0-9._/-]{1,128}$/
const COMMIT_SHA_REGEX = /^[a-fA-F0-9]{7,40}$/

export function sanitizeGitHubRepositoryUrl(input: unknown): string | null {
    if (typeof input !== 'string') return null
    const value = input.trim()
    if (!value) return null

    const match = value.match(GITHUB_REPOSITORY_REGEX)
    if (!match) return null

    const owner = match[1]
    const repo = match[2]
    return `https://github.com/${owner}/${repo}`
}

export function sanitizeGitBranch(input: unknown): string | null {
    if (typeof input !== 'string') return null
    const value = input.trim()
    if (!value || !BRANCH_REGEX.test(value)) return null

    if (value.includes('..') || value.includes('@{') || value.endsWith('/') || value.startsWith('/')) {
        return null
    }

    return value
}

export function sanitizeCommitSha(input: unknown): string | null {
    if (typeof input !== 'string') return null
    const value = input.trim()
    if (!COMMIT_SHA_REGEX.test(value)) return null
    return value.toLowerCase()
}

export function extractBranchFromGitRef(ref: unknown): string | null {
    if (typeof ref !== 'string') return null
    if (!ref.startsWith('refs/heads/')) return null

    const branch = ref.slice('refs/heads/'.length)
    return sanitizeGitBranch(branch)
}