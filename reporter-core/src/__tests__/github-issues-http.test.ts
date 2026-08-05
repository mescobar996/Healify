import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { reportDefects } from '../agile'
import { startFakeGithub, type FakeGithub } from './helpers/fake-github'
import type { LocalRun, LocalCaseResult, HealifyConfig } from '../index'

/**
 * El provider `github`, ejercitado por HTTP de verdad contra un servidor que se comporta como
 * la API de GitHub Issues (ver helpers/fake-github.ts).
 *
 * Nace ya con este nivel de verificación, y no con el `fetch` mockeado, justamente por lo que
 * pasó con Jira: 19 tests en verde sobre un cliente que ningún Jira real habría aceptado.
 */

const REPO = 'mescobar996/Healify'

function makeCase(overrides: Partial<LocalCaseResult> = {}): LocalCaseResult {
  return {
    testName: 'compra exprés',
    testFile: 'e2e/compra.spec.ts',
    selector: '#comprar-ahora-a1b2c3',
    errorMessage: 'no se encontró #comprar-ahora-a1b2c3',
    status: 'healed',
    fixedSelector: "role('button', { name: 'Comprar ahora' })",
    confidence: 0.97,
    verified: true,
    explanation: 'Verificado contra la página.',
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
    generatedAt: new Date('2026-08-05T12:00:00.000Z'),
    cases,
    environment: { os: 'win32', node: 'v22.0.0', framework: 'playwright', frameworkVersion: '1.49.0' },
    stats: { total: cases.length, passed: 0, failed: cases.length, healed: cases.length, review: 0, unresolved: 0 },
  } as LocalRun
}

let github: FakeGithub

function config(overrides: Record<string, unknown> = {}): HealifyConfig {
  return {
    agile: {
      enabled: true,
      provider: 'github',
      baseUrl: github.url,
      apiToken: 'ghp_token_de_prueba',
      repository: REPO,
      labels: ['healify', 'selector-roto'],
      ...overrides,
    },
  } as HealifyConfig
}

beforeEach(async () => {
  github = await startFakeGithub({ repository: REPO })
})

afterEach(async () => {
  await github.close()
})

describe('reportDefects contra GitHub Issues', () => {
  it('crea el issue con el defectId en el título', async () => {
    const result = await reportDefects(makeRun(), config())

    const failed = result.outcomes.find((o) => o.action === 'failed')
    expect(failed, failed && 'message' in failed ? failed.message : '').toBeUndefined()

    expect(result.outcomes[0].action).toBe('created')
    expect(github.issues).toHaveLength(1)
    expect(github.issues[0].title).toContain('HLF-AABB11')
  })

  it('el cuerpo lleva la evidencia y la sugerencia, en Markdown', async () => {
    await reportDefects(makeRun(), config())

    const body = github.issues[0].body
    expect(body).toContain('#comprar-ahora-a1b2c3')
    expect(body).toContain('e2e/compra.spec.ts')
    expect(body).toContain('Sugerencia de Healify')
    expect(body).toContain("role('button', { name: 'Comprar ahora' })")
  })

  it('aplica los labels configurados', async () => {
    await reportDefects(makeRun(), config())
    expect(github.issues[0].labels).toEqual(['healify', 'selector-roto'])
  })

  /**
   * Sin esto el backlog se vuelve inusable: un selector roto que nadie arregla abriría un issue
   * nuevo en cada corrida de CI.
   */
  it('no duplica: si el defectId ya existe, comenta en vez de crear', async () => {
    const primera = await reportDefects(makeRun(), config())
    expect(primera.outcomes[0].action).toBe('created')

    const segunda = await reportDefects(makeRun(), config())
    expect(segunda.outcomes[0].action).toBe('existing')

    expect(github.issues).toHaveLength(1)
    expect(github.issues[0].comments).toHaveLength(1)
  })

  it('el issue nuevo no genera comentario aparte: dos notificaciones para lo mismo', async () => {
    await reportDefects(makeRun(), config())
    expect(github.issues[0].comments).toHaveLength(0)
  })

  it('la búsqueda se limita al repo configurado', async () => {
    await reportDefects(makeRun(), config())

    const busqueda = github.requests.find((r) => r.path.startsWith('/search/issues'))
    expect(busqueda).toBeDefined()
    expect(decodeURIComponent(busqueda!.path)).toContain(`repo:${REPO}`)
  })

  it('sin token, el outcome falla con el mensaje del servidor', async () => {
    const result = await reportDefects(makeRun(), config({ apiToken: '' }))
    const outcome = result.outcomes[0]

    expect(outcome.action).toBe('failed')
    expect('message' in outcome && outcome.message).toContain('apiToken')
  })

  it('con un repo que no existe, el error lo dice', async () => {
    const result = await reportDefects(makeRun(), config({ repository: 'otro/repo' }))
    const outcome = result.outcomes[0]

    expect(outcome.action).toBe('failed')
    expect('message' in outcome && outcome.message).toMatch(/404|Not Found/)
  })

  it('reporta varios defectos y un fallo no frena al siguiente', async () => {
    const run = makeRun([makeCase({ defectId: 'HLF-000001' }), makeCase({ defectId: 'HLF-000002', testName: 'otro' })])
    const result = await reportDefects(run, config())

    expect(result.outcomes).toHaveLength(2)
    expect(github.issues).toHaveLength(2)
  })

  it('un caso sin candidato igual abre el issue, diciendo que necesita análisis manual', async () => {
    const run = makeRun([makeCase({ status: 'unresolved', fixedSelector: '', confidence: 0, verified: false })])
    await reportDefects(run, config())

    expect(github.issues).toHaveLength(1)
    expect(github.issues[0].body).toContain('análisis manual')
  })
})
