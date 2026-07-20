import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { reportFailure, __resetWarnStateForTests, type ReportPayload } from '../http-client'
import type { HealifyConfig } from '../config'

const config: HealifyConfig = {
  apiKey: 'hf_live_test123',
  apiUrl: 'http://localhost:3000',
}

const basePayload: ReportPayload = {
  testName: 'should log in',
  selector: '#login-btn',
  error: "Waiting for selector '#login-btn' failed",
}

describe('reportFailure', () => {
  let mockFetch: ReturnType<typeof vi.fn>
  let warnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    mockFetch = vi.fn()
    vi.stubGlobal('fetch', mockFetch)
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    __resetWarnStateForTests()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    warnSpy.mockRestore()
  })

  it('POSTs to {apiUrl}/api/v1/report with the x-api-key header', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200 })

    await reportFailure(config, basePayload)

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toBe('http://localhost:3000/api/v1/report')
    expect(init.method).toBe('POST')
    expect(init.headers['x-api-key']).toBe('hf_live_test123')
    expect(init.headers['Content-Type']).toBe('application/json')

    const body = JSON.parse(init.body)
    expect(body.testName).toBe('should log in')
    expect(body.selector).toBe('#login-btn')
  })

  it('fills branch/commitSha from config when the payload does not set them', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200 })
    const configWithBranch: HealifyConfig = { ...config, branch: 'main', commitSha: 'abc123' }

    await reportFailure(configWithBranch, basePayload)

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.branch).toBe('main')
    expect(body.commitSha).toBe('abc123')
  })

  it('truncates context to 8000 characters', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200 })
    const longContext = 'x'.repeat(10000)

    await reportFailure(config, { ...basePayload, context: longContext })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.context.length).toBe(8000)
  })

  it('never throws when fetch rejects', async () => {
    mockFetch.mockRejectedValue(new Error('network down'))

    await expect(reportFailure(config, basePayload)).resolves.toBeUndefined()
    expect(warnSpy).toHaveBeenCalledTimes(1)
  })

  it('never throws when the response is not ok', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 })

    await expect(reportFailure(config, basePayload)).resolves.toBeUndefined()
    expect(warnSpy).toHaveBeenCalledTimes(1)
  })

  it('only warns once across multiple failed calls in the same run', async () => {
    mockFetch.mockRejectedValue(new Error('network down'))

    await reportFailure(config, basePayload)
    await reportFailure(config, basePayload)
    await reportFailure(config, basePayload)

    expect(warnSpy).toHaveBeenCalledTimes(1)
  })

  it('aborts the request after 3000ms and treats it as a failure', async () => {
    vi.useFakeTimers()
    try {
      mockFetch.mockImplementation((_url: string, init: RequestInit) => {
        return new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new Error('aborted')))
        })
      })

      const promise = reportFailure(config, basePayload)
      await vi.advanceTimersByTimeAsync(3000)
      await promise

      expect(warnSpy).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })
})
