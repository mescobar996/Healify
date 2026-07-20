import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { resolveConfig } from '../config'

const ENV_KEYS = ['HEALIFY_API_KEY', 'HEALIFY_API_URL', 'HEALIFY_BRANCH', 'HEALIFY_COMMIT_SHA'] as const

describe('resolveConfig', () => {
  const original: Record<string, string | undefined> = {}

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      original[key] = process.env[key]
      delete process.env[key]
    }
  })

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (original[key] === undefined) delete process.env[key]
      else process.env[key] = original[key]
    }
  })

  it('returns null when HEALIFY_API_KEY is not set', () => {
    expect(resolveConfig()).toBeNull()
  })

  it('resolves apiKey and defaults apiUrl when only the key is set', () => {
    process.env.HEALIFY_API_KEY = 'hf_live_test123'
    const config = resolveConfig()
    expect(config).not.toBeNull()
    expect(config?.apiKey).toBe('hf_live_test123')
    expect(config?.apiUrl).toBe('https://healify-sigma.vercel.app')
    expect(config?.branch).toBeUndefined()
    expect(config?.commitSha).toBeUndefined()
  })

  it('resolves all fields when all env vars are set', () => {
    process.env.HEALIFY_API_KEY = 'hf_live_test123'
    process.env.HEALIFY_API_URL = 'http://localhost:3000'
    process.env.HEALIFY_BRANCH = 'feature/x'
    process.env.HEALIFY_COMMIT_SHA = 'abc123'
    const config = resolveConfig()
    expect(config).toEqual({
      apiKey: 'hf_live_test123',
      apiUrl: 'http://localhost:3000',
      branch: 'feature/x',
      commitSha: 'abc123',
    })
  })
})
