import { describe, it, expect, vi } from 'vitest'
import type { LocalRun, LocalCaseResult, HealifyConfig } from '../index'
import { buildAgileDefects, reportDefects } from '../agile'

function makeCase(overrides: Partial<LocalCaseResult> = {}): LocalCaseResult {
  return {
    testName: 'compra exprés',
    testFile: 'e2e/compra.spec.ts',
    selector: '#comprar-ahora-a1b2c3',
    errorMessage: 'NoSuchElementError: no se encontró #comprar-ahora-a1b2c3',
    status: 'unresolved',
    fixedSelector: '',
    confidence: 0,
    explanation: '',
    selectorType: 'ID',
    defectId: 'HLF-AABB11',
    severity: 'blocker',
    expected: 'El botón "Comprar ahora" es visible.',
    actual: 'No se encontró ningún elemento con #comprar-ahora-a1b2c3.',
    steps: ['Ir a /checkout', 'Hacer click en "Comprar ahora"'],
    ...overrides,
  }
}

function makeRun(cases: LocalCaseResult[] = [makeCase()]): LocalRun {
  return {
    project: 'Healify demo',
    framework: 'playwright',
    generatedAt: new Date('2026-08-03T12:00:00.000Z'),
    cases,
    environment: {
      os: 'win32',
      node: 'v22.0.0',
      framework: 'playwright',
      frameworkVersion: '1.49.0',
      baseURL: 'https://demo.local',
    },
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  } as unknown as Response
}

function jiraConfig(overrides: Partial<HealifyConfig['agile']> = {}): HealifyConfig {
  return {
    agile: {
      enabled: true,
      provider: 'jira',
      baseUrl: 'https://acme.atlassian.net',
      email: 'qa@acme.com',
      apiToken: 'un-secreto',
      project: 'QA',
      ...overrides,
    },
  }
}

describe('buildAgileDefects', () => {
  it('mapea un caso a un defecto con defectId, severidad y prioridad', () => {
    const [defect] = buildAgileDefects(makeRun())

    expect(defect.defectId).toBe('HLF-AABB11')
    expect(defect.severity).toBe('blocker')
    expect(defect.priority).toBe('Highest')
    expect(defect.title).toBe('[HLF-AABB11] compra exprés')
    expect(defect.labels).toEqual([])
  })

  it('la descripción incluye expected, actual, pasos, selector y defectId (clave de dedupe)', () => {
    const [defect] = buildAgileDefects(makeRun())

    expect(defect.description).toContain('El botón "Comprar ahora" es visible.')
    expect(defect.description).toContain('No se encontró ningún elemento con #comprar-ahora-a1b2c3.')
    expect(defect.description).toContain('1. Ir a /checkout')
    expect(defect.description).toContain('HLF-AABB11')
    expect(defect.description).toContain('#comprar-ahora-a1b2c3')
  })

  it('review → High y healed → Medium', () => {
    const run = makeRun([makeCase({ status: 'review', severity: 'major' }), makeCase({ status: 'healed', severity: 'minor', testName: 'x' })])
    const defects = buildAgileDefects(run)

    expect(defects[0].priority).toBe('High')
    expect(defects[1].priority).toBe('Medium')
  })

  it('priorityBySeverity custom pisa el default', () => {
    const config = { agile: { priorityBySeverity: { blocker: 'Critical' } } }
    const run = makeRun()
    const [defect] = buildAgileDefects(run, config)

    expect(defect.priority).toBe('Critical')
  })

  it('incluye filas de entorno (framework, browser, URL base)', () => {
    const [defect] = buildAgileDefects(makeRun())

    const rows = defect.environmentRows
    expect(rows.some((r) => r.label === 'Framework' && r.value.includes('playwright'))).toBe(true)
    expect(rows.some((r) => r.label === 'URL base')).toBe(true)
  })
})

describe('reportDefects', () => {
  it('apagado: no toca la red y reporta enabled: false', async () => {
    const fetchImpl = vi.fn()
    const result = await reportDefects(makeRun(), {}, fetchImpl)

    expect(result.enabled).toBe(false)
    expect(result.outcomes).toEqual([])
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('jira: defecto nuevo → busca, crea el issue y comenta la sugerencia', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ issues: [] }))
      .mockResolvedValueOnce(jsonResponse({ key: 'QA-11', id: '11011' }, 201))
      .mockResolvedValueOnce(jsonResponse({ id: '9001' }, 201))

    const result = await reportDefects(makeRun(), jiraConfig(), fetchImpl)

    expect(result.enabled).toBe(true)
    expect(result.provider).toBe('jira')
    expect(result.outcomes).toHaveLength(1)
    expect(result.outcomes[0].action).toBe('created')
    if (result.outcomes[0].action === 'created') expect(result.outcomes[0].key).toBe('QA-11')

    expect(fetchImpl).toHaveBeenCalledTimes(3)
    const calls = fetchImpl.mock.calls as [string, RequestInit][]
    expect(calls[0][0]).toContain('/rest/api/3/search')
    expect(calls[0][0]).toContain(encodeURIComponent('text ~ "HLF-AABB11" AND project = QA'))
    expect(calls[1][0]).toBe('https://acme.atlassian.net/rest/api/3/issue')
    expect(calls[2][0]).toBe('https://acme.atlassian.net/rest/api/3/issue/QA-11/comment')

    const createBody = JSON.parse(calls[1][1].body as string)
    expect(createBody.fields.project.key).toBe('QA')
    expect(createBody.fields.issuetype.name).toBe('Bug')
    expect(createBody.fields.summary).toContain('HLF-AABB11')
    expect(createBody.fields.priority.name).toBe('Highest')

    const commentBody = JSON.parse(calls[2][1].body as string)
    expect(commentBody.body).toContain('Sugerencia')
  })

  it('jira: el defectId ya existe → no crea nada (dedupe), outcome existing', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(jsonResponse({ issues: [{ key: 'QA-7', id: '7' }] }))

    const result = await reportDefects(makeRun(), jiraConfig(), fetchImpl)

    expect(result.outcomes[0].action).toBe('existing')
    if (result.outcomes[0].action === 'existing') expect(result.outcomes[0].key).toBe('QA-7')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('jira: la creación falla → outcome failed sin tirar la corrida', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ issues: [] }))
      .mockResolvedValueOnce(jsonResponse({ errorMessages: ['permisos insuficientes'] }, 403))

    const result = await reportDefects(makeRun(), jiraConfig(), fetchImpl)

    expect(result.outcomes[0].action).toBe('failed')
    if (result.outcomes[0].action === 'failed') expect(result.outcomes[0].message).toContain('403')
  })

  it('jira: sin baseUrl ni email/token el defecto falla con mensaje claro, sin romper', async () => {
    const fetchImpl = vi.fn()
    const config = jiraConfig({ baseUrl: '', email: '', apiToken: '' })

    const result = await reportDefects(makeRun(), config, fetchImpl)

    expect(result.outcomes[0].action).toBe('failed')
    if (result.outcomes[0].action === 'failed') expect(result.outcomes[0].message).toContain('baseUrl')
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('webhook: POSTea cada defecto y reporta sent', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(jsonResponse({ ok: true }, 200))

    const config = jiraConfig({ provider: 'webhook', webhookUrl: 'https://hooks.zapier.com/abc' })
    const result = await reportDefects(makeRun(), config, fetchImpl)

    expect(result.provider).toBe('webhook')
    expect(result.outcomes[0].action).toBe('sent')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const call = fetchImpl.mock.calls[0] as [string, RequestInit]
    expect(call[0]).toBe('https://hooks.zapier.com/abc')
    const body = JSON.parse(call[1].body as string)
    expect(body.defectId).toBe('HLF-AABB11')
  })

  it('webhook: respuesta no-2xx → outcome failed sin romper', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(jsonResponse({}, 500))

    const config = jiraConfig({ provider: 'webhook', webhookUrl: 'https://hooks.zapier.com/abc' })
    const result = await reportDefects(makeRun(), config, fetchImpl)

    expect(result.outcomes[0].action).toBe('failed')
    if (result.outcomes[0].action === 'failed') expect(result.outcomes[0].message).toContain('500')
  })
})
