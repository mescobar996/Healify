import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock BullMQ Queue como constructor real ───────────────────────────
const mockJobAdd = vi.fn()
const mockJobGet  = vi.fn()

vi.mock('bullmq', () => {
  class MockQueue {
    add = mockJobAdd
    getJob = mockJobGet
  }
  return { Queue: MockQueue }
})

process.env.REDIS_URL = 'redis://localhost:6379'

const { addTestJob, getJobStatus, TEST_QUEUE_NAME } = await import('@/lib/queue')

// ══════════════════════════════════════════════════════════════════════
describe('TEST_QUEUE_NAME', () => {
  it('es un string no vacío', () => {
    expect(typeof TEST_QUEUE_NAME).toBe('string')
    expect(TEST_QUEUE_NAME.length).toBeGreaterThan(0)
  })
})

describe('addTestJob', () => {
  beforeEach(() => vi.clearAllMocks())

  it('llama queue.add con projectId, commitSha y testRunId', async () => {
    mockJobAdd.mockResolvedValue({ id: 'job-123' })
    const job = await addTestJob('proj-1', 'abc123', 'run-999')
    expect(job).not.toBeNull()
    expect(mockJobAdd).toHaveBeenCalledTimes(1)
    const [, jobData] = mockJobAdd.mock.calls[0]
    expect(jobData.projectId).toBe('proj-1')
    expect(jobData.commitSha).toBe('abc123')
    expect(jobData.testRunId).toBe('run-999')
  })

  it('incluye metadata de branch, autor y repository', async () => {
    mockJobAdd.mockResolvedValue({ id: 'job-456' })
    await addTestJob('proj-1', 'sha', 'run-1', {
      branch: 'main',
      commitAuthor: 'devuser',
      repository: 'https://github.com/org/repo',
    })
    const [, jobData] = mockJobAdd.mock.calls[0]
    expect(jobData.branch).toBe('main')
    expect(jobData.commitAuthor).toBe('devuser')
    expect(jobData.repository).toBe('https://github.com/org/repo')
  })

  it('jobId usa testRunId como prefijo "testrun-"', async () => {
    mockJobAdd.mockResolvedValue({ id: 'testrun-run-777' })
    await addTestJob('proj-1', 'sha', 'run-777')
    const [,, opts] = mockJobAdd.mock.calls[0]
    expect(opts?.jobId).toBe('testrun-run-777')
  })

  it('retorna el job devuelto por queue.add', async () => {
    mockJobAdd.mockResolvedValue({ id: 'job-returned' })
    const job = await addTestJob('proj-1', 'sha', 'run-1')
    expect(job?.id).toBe('job-returned')
  })
})

describe('getJobStatus', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retorna null si job no existe', async () => {
    mockJobGet.mockResolvedValue(null)
    const status = await getJobStatus('nonexistent')
    expect(status).toBeNull()
  })

  it('retorna state y progress cuando job existe', async () => {
    mockJobGet.mockResolvedValue({
      getState: vi.fn().mockResolvedValue('active'),
      progress: 45,
      failedReason: undefined,
      returnvalue: null,
    })
    const status = await getJobStatus('job-123')
    expect(status?.state).toBe('active')
    expect(status?.progress).toBe(45)
  })

  it('progress no-numérico → normaliza a 0', async () => {
    mockJobGet.mockResolvedValue({
      getState: vi.fn().mockResolvedValue('waiting'),
      progress: 'n/a',
      failedReason: undefined,
      returnvalue: null,
    })
    const status = await getJobStatus('job-123')
    expect(status?.progress).toBe(0)
  })

  it('incluye failedReason cuando el job falló', async () => {
    mockJobGet.mockResolvedValue({
      getState: vi.fn().mockResolvedValue('failed'),
      progress: 0,
      failedReason: 'Redis connection refused',
      returnvalue: null,
    })
    const status = await getJobStatus('job-fail')
    expect(status?.state).toBe('failed')
    expect(status?.failedReason).toBe('Redis connection refused')
  })
})
