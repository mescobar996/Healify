import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockExecSync } = vi.hoisted(() => ({ mockExecSync: vi.fn() }))
vi.mock('node:child_process', () => ({ execSync: mockExecSync }))

const { formatDoctor, formatFixOutput, buildComment, findOrCreateComment, postComment, run } = await import('./run.js')
const { createClient } = await import('./github-api.js')

beforeEach(() => {
  mockExecSync.mockReset()
})

describe('formatDoctor', () => {
  it('parses a passing doctor report', () => {
    const output = [
      '✅ Framework detectado: playwright',
      '✅ @healify/cli instalado',
      '✅ playwright.config.ts tiene Healify configurado',
      '✅ healify-report.json existe',
    ].join('\n')

    const checks = formatDoctor(output)
    expect(checks).toHaveLength(4)
    expect(checks.every((c) => c.icon === '✅')).toBe(true)
  })

  it('parses a failing doctor report with fix hints', () => {
    const output = [
      '❌ Framework de test detectado',
      '   fix: npx @healify/cli init',
    ].join('\n')

    const checks = formatDoctor(output)
    expect(checks).toHaveLength(1)
    expect(checks[0].icon).toBe('❌')
    expect(checks[0].text).toBe('Framework de test detectado')
    expect(checks[0].fix).toBe('npx @healify/cli init')
  })

  it('parses info checks', () => {
    const output = 'ℹ️ Selenium/WebdriverIO curan en vivo, no generan reporte'
    const checks = formatDoctor(output)
    expect(checks).toHaveLength(1)
    expect(checks[0].icon).toBe('ℹ️')
  })

  it('handles mixed check types', () => {
    const output = [
      '✅ Framework detectado: playwright',
      '❌ @healify/test-runner instalado',
      '   fix: npm install --save-dev @healify/test-runner',
      '✅ playwright.config.ts tiene Healify configurado',
      'ℹ️ Semver caret gotcha en @healify/cli',
    ].join('\n')

    const checks = formatDoctor(output)
    expect(checks).toHaveLength(4)
    expect(checks.filter((c) => c.icon === '✅')).toHaveLength(2)
    expect(checks.filter((c) => c.icon === '❌')).toHaveLength(1)
    expect(checks.filter((c) => c.icon === 'ℹ️')).toHaveLength(1)
    expect(checks[1].fix).toBe('npm install --save-dev @healify/test-runner')
  })

  it('returns empty array for empty input', () => {
    expect(formatDoctor('')).toEqual([])
  })
})

describe('formatFixOutput', () => {
  it('parses applied fixes', () => {
    const output = [
      'Healify fix — healify-report.json',
      '',
      '✓ e2e/login.spec.ts — #btn-old → [data-testid="btn-new"]',
      '✓ e2e/login.spec.ts — .old-class → .new-class',
      '',
      '2 selectors aplicados · 0 salteados',
    ].join('\n')

    const result = formatFixOutput(output)
    expect(result.applied).toHaveLength(2)
    expect(result.skipped).toHaveLength(0)
  })

  it('parses skipped fixes', () => {
    const output = [
      '⚠ e2e/login.spec.ts — saltado: \'#btn\' aparece más de una vez, ambiguo',
      '⚠ e2e/login.spec.ts — saltado: la sugerencia no es un valor de selector sustituible directamente',
    ].join('\n')

    const result = formatFixOutput(output)
    expect(result.applied).toHaveLength(0)
    expect(result.skipped).toHaveLength(2)
  })

  it('handles mixed applied and skipped', () => {
    const output = [
      '✓ e2e/login.spec.ts — #old → [data-testid="new"]',
      '⚠ e2e/home.spec.ts — saltado: ya no se encontró en el archivo',
    ].join('\n')

    const result = formatFixOutput(output)
    expect(result.applied).toHaveLength(1)
    expect(result.skipped).toHaveLength(1)
  })

  it('returns empty when no selectors found', () => {
    const result = formatFixOutput('No se pudo leer healify-report.json')
    expect(result.applied).toHaveLength(0)
    expect(result.skipped).toHaveLength(0)
  })
})

describe('buildComment', () => {
  it('returns all-clear comment when no issues', () => {
    const doctorOutput = [
      '✅ Framework detectado: playwright',
      '✅ @healify/cli instalado',
    ].join('\n')

    const comment = buildComment(doctorOutput, '')
    expect(comment).toContain('All Clear')
    expect(comment).toContain('<!-- healify-report -->')
  })

  it('includes doctor failures in the comment', () => {
    const doctorOutput = [
      '✅ Framework detectado: playwright',
      '❌ @healify/test-runner instalado',
      '   fix: npm install --save-dev @healify/test-runner',
    ].join('\n')

    const comment = buildComment(doctorOutput, '')
    expect(comment).toContain('Issues Detected')
    expect(comment).toContain('@healify/test-runner instalado')
    expect(comment).toContain('npm install --save-dev @healify/test-runner')
  })

  it('includes broken selectors table', () => {
    const doctorOutput = '✅ Framework detectado: playwright'
    const fixOutput = '✓ e2e/login.spec.ts — #old → [data-testid="new"]'

    const comment = buildComment(doctorOutput, fixOutput)
    expect(comment).toContain('Suggested Fixes')
    expect(comment).toContain('#old')
    expect(comment).toContain('[data-testid="new"]')
  })

  it('includes skipped items', () => {
    const doctorOutput = '✅ Framework detectado: playwright'
    const fixOutput = '⚠ e2e/home.spec.ts — saltado: ambiguo'

    const comment = buildComment(doctorOutput, fixOutput)
    expect(comment).toContain('Needs Review')
    expect(comment).toContain('ambiguo')
  })

  it('includes info notes', () => {
    const doctorOutput = [
      '✅ Framework detectado: selenium',
      'ℹ️ Selenium/WebdriverIO curan en vivo, no generan reporte',
    ].join('\n')

    const comment = buildComment(doctorOutput, '')
    expect(comment).toContain('Notes')
    expect(comment).toContain('Selenium/WebdriverIO curan en vivo')
  })

  it('includes local fix command hint', () => {
    const doctorOutput = '❌ Framework de test detectado'
    const comment = buildComment(doctorOutput, '')
    expect(comment).toContain('npx @healify/cli fix')
  })

  it('handles empty inputs gracefully', () => {
    const comment = buildComment('', '')
    expect(comment).toContain('<!-- healify-report -->')
    expect(comment).toContain('All Clear')
  })
})

/** Cliente falso con la misma forma que devuelve `createClient()`. */
function fakeClient(comments = [], calls = { created: [], updated: [] }) {
  return {
    listComments: async () => comments,
    createComment: async (owner, repo, issueNumber, body) => { calls.created.push({ owner, repo, issueNumber, body }); return {} },
    updateComment: async (owner, repo, commentId, body) => { calls.updated.push({ owner, repo, commentId, body }); return {} },
  }
}

describe('findOrCreateComment', () => {
  it('finds existing Healify comment by marker', async () => {
    const comments = [
      { id: 1, body: 'Some other comment' },
      { id: 2, body: '<!-- healify-report -->\n\n### Healify — All Clear ✅' },
      { id: 3, body: 'Another comment' },
    ]

    const result = await findOrCreateComment(fakeClient(comments), 'owner', 'repo', 1)
    expect(result).toBe(comments[1])
  })

  it('returns undefined when no Healify comment exists', async () => {
    const result = await findOrCreateComment(fakeClient([{ id: 1, body: 'Some comment' }]), 'owner', 'repo', 1)
    expect(result).toBeUndefined()
  })
})

describe('postComment', () => {
  it('creates a new comment when none exists', async () => {
    const calls = { created: [], updated: [] }

    const result = await postComment(fakeClient([], calls), 'owner', 'repo', 1, 'body')

    expect(result).toBe('created')
    expect(calls.created).toEqual([{ owner: 'owner', repo: 'repo', issueNumber: 1, body: 'body' }])
    expect(calls.updated).toHaveLength(0)
  })

  it('updates existing Healify comment', async () => {
    const calls = { created: [], updated: [] }
    const comments = [{ id: 42, body: '<!-- healify-report --> old' }]

    const result = await postComment(fakeClient(comments, calls), 'owner', 'repo', 1, 'body')

    expect(result).toBe('updated')
    expect(calls.updated).toEqual([{ owner: 'owner', repo: 'repo', commentId: 42, body: 'body' }])
    expect(calls.created).toHaveLength(0)
  })
})

describe('createClient', () => {
  function fakeFetch(responses) {
    const calls = []
    const fetchImpl = async (url, init) => {
      calls.push({ url, init })
      const next = responses.shift()
      return {
        ok: next.status < 400,
        status: next.status,
        json: async () => next.body,
        text: async () => JSON.stringify(next.body ?? ''),
      }
    }
    return { fetchImpl, calls }
  }

  it('autentica con el token y manda los headers que pide la API', async () => {
    const { fetchImpl, calls } = fakeFetch([{ status: 200, body: [] }])

    await createClient('tok123', fetchImpl).listComments('o', 'r', 7)

    expect(calls[0].url).toBe('https://api.github.com/repos/o/r/issues/7/comments?per_page=100&page=1')
    expect(calls[0].init.headers.authorization).toBe('Bearer tok123')
    expect(calls[0].init.headers['x-github-api-version']).toBe('2022-11-28')
  })

  it('pagina hasta juntar todos los comentarios', async () => {
    const full = Array.from({ length: 100 }, (_, i) => ({ id: i, body: 'x' }))
    const { fetchImpl, calls } = fakeFetch([
      { status: 200, body: full },
      { status: 200, body: [{ id: 999, body: '<!-- healify-report -->' }] },
    ])

    const comments = await createClient('t', fetchImpl).listComments('o', 'r', 7)

    expect(comments).toHaveLength(101)
    expect(calls).toHaveLength(2)
    expect(calls[1].url).toContain('page=2')
  })

  it('corta la paginación cuando la página viene incompleta', async () => {
    const { fetchImpl, calls } = fakeFetch([{ status: 200, body: [{ id: 1, body: 'x' }] }])

    await createClient('t', fetchImpl).listComments('o', 'r', 7)

    expect(calls).toHaveLength(1)
  })

  it('un error de la API incluye el detalle: sin eso el usuario solo ve un 403 pelado', async () => {
    const { fetchImpl } = fakeFetch([{ status: 403, body: { message: 'Resource not accessible by integration' } }])

    await expect(createClient('t', fetchImpl).createComment('o', 'r', 7, 'hola')).rejects.toThrow(
      /403.*Resource not accessible by integration/
    )
  })

  it('createComment y updateComment mandan el método y el body correctos', async () => {
    const { fetchImpl, calls } = fakeFetch([
      { status: 201, body: {} },
      { status: 200, body: {} },
    ])
    const client = createClient('t', fetchImpl)

    await client.createComment('o', 'r', 7, 'nuevo')
    await client.updateComment('o', 'r', 42, 'editado')

    expect(calls[0].init.method).toBe('POST')
    expect(JSON.parse(calls[0].init.body)).toEqual({ body: 'nuevo' })
    expect(calls[1].url).toBe('https://api.github.com/repos/o/r/issues/comments/42')
    expect(calls[1].init.method).toBe('PATCH')
    expect(JSON.parse(calls[1].init.body)).toEqual({ body: 'editado' })
  })

  it('respeta GITHUB_API_URL (GitHub Enterprise)', async () => {
    const original = process.env.GITHUB_API_URL
    process.env.GITHUB_API_URL = 'https://ghe.example.com/api/v3'
    try {
      const { fetchImpl, calls } = fakeFetch([{ status: 200, body: [] }])
      await createClient('t', fetchImpl).listComments('o', 'r', 1)
      expect(calls[0].url).toContain('https://ghe.example.com/api/v3/repos/o/r/')
    } finally {
      if (original === undefined) delete process.env.GITHUB_API_URL
      else process.env.GITHUB_API_URL = original
    }
  })
})

describe('run', () => {
  it('pasa el project-path como cwd real del comando (no queda sin efecto)', () => {
    mockExecSync.mockReturnValue('✅ ok')

    run('npx @healify/cli doctor', 'packages/app')

    expect(mockExecSync).toHaveBeenCalledWith(
      'npx @healify/cli doctor',
      expect.objectContaining({ cwd: 'packages/app' })
    )
  })

  it('usa "." como cwd por defecto cuando no se pasa project-path', () => {
    mockExecSync.mockReturnValue('✅ ok')

    run('npx @healify/cli doctor')

    expect(mockExecSync).toHaveBeenCalledWith(
      'npx @healify/cli doctor',
      expect.objectContaining({ cwd: '.' })
    )
  })
})
