export interface HealifyConfig {
  apiKey: string
  apiUrl: string
  branch?: string
  commitSha?: string
}

/**
 * Resolves Healify config from environment variables. Returns null when
 * HEALIFY_API_KEY is not set — callers must treat this as "reporter disabled,
 * do nothing" rather than an error.
 */
export function resolveConfig(): HealifyConfig | null {
  const apiKey = process.env.HEALIFY_API_KEY
  if (!apiKey) return null

  return {
    apiKey,
    apiUrl: process.env.HEALIFY_API_URL || 'https://healify-sigma.vercel.app',
    branch: process.env.HEALIFY_BRANCH,
    commitSha: process.env.HEALIFY_COMMIT_SHA,
  }
}
