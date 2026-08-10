import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { reportDefects } from '../agile'
import { startFakeJira, type FakeJira } from './helpers/fake-jira'
import type { LocalRun, LocalCaseResult, HealifyConfig } from '../index'

/**
 * El reporte a Jira, ejercitado por HTTP de verdad contra un servidor que se comporta como
 * Jira Cloud v3 (ver helpers/fake-jira.ts).
 *
 * `agile.test.ts` cubre lo mismo con el `fetch` mockeado, y esos tests son útiles para la
 * lógica de orquestación. Pero un mock devuelve lo que el test le dice, así que valida que el
 * código llame a lo que el test cree que corresponde — nunca que el otro lado lo acepte.
 * Con eso, esta feature tuvo 19 tests en verde mientras mandaba un cuerpo que Jira rechaza.
 */

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
    generatedAt: new Date('2026-08-05T12:00:00.000Z'),
    cases,
    environment: { os: 'win32', node: 'v22.0.0', framework: 'playwright', frameworkVersion: '1.49.0' },
    stats: { total: cases.length, passed: 0, failed: cases.length, healed: 0, review: 0, unresolved: cases.length },
  } as LocalRun
}

let jira: FakeJira

function config(): HealifyConfig {
  return {
    agile: {
      enabled: true,
      provider: 'jira',
      baseUrl: jira.url,
      email: 'qa@ejemplo.com',
      apiToken: 'token-de-prueba',
      project: 'QA',
      issueType: 'Bug',
    },
  } as HealifyConfig
}

beforeEach(async () => {
  jira = await startFakeJira()
})

afterEach(async () => {
  await jira.close()
})

describe('reportDefects contra un Jira que responde de verdad', () => {
  it('crea el issue', async () => {
    const result = await reportDefects(makeRun(), config())

    // El mensaje del outcome fallido es la pista más útil cuando esto se rompe.
    const failed = result.outcomes.find((o) => o.action === 'failed')
    expect(failed, failed && 'message' in failed ? failed.message : '').toBeUndefined()

    expect(result.outcomes[0].action).toBe('created')
    expect(jira.issues).toHaveLength(1)
    expect(jira.issues[0].summary).toContain('HLF-AABB11')
  })

  it('el issue creado queda con la descripción y la sugerencia como comentario', async () => {
    await reportDefects(makeRun([makeCase({ status: 'healed', fixedSelector: "role('button', { name: 'Comprar' })", confidence: 0.97 })]), config())

    expect(jira.issues).toHaveLength(1)
    expect(jira.issues[0].description).toBeTruthy()
    expect(jira.issues[0].comments).toHaveLength(1)
  })

  /**
   * El dedupe es la promesa central de esta feature: el mismo selector roto no puede abrir un
   * ticket nuevo en cada corrida, o el backlog se vuelve inusable en una semana.
   */
  it('no duplica: si el defectId ya existe, comenta en vez de crear', async () => {
    const primera = await reportDefects(makeRun(), config())
    expect(primera.outcomes[0].action).toBe('created')

    const segunda = await reportDefects(makeRun(), config())
    expect(segunda.outcomes[0].action).toBe('existing')
    expect(jira.issues).toHaveLength(1)
  })

  it('no usa el endpoint de búsqueda que Atlassian removió', async () => {
    await reportDefects(makeRun(), config())

    const viejo = jira.requests.filter((r) => r.path.startsWith('/rest/api/3/search?'))
    expect(viejo, 'sigue pegándole a /rest/api/3/search, que devuelve 410').toHaveLength(0)
  })

  it('reporta el error del servidor sin tirar la corrida cuando las credenciales no sirven', async () => {
    const malas = config()
    malas.agile!.apiToken = ''

    const result = await reportDefects(makeRun(), malas)
    const outcome = result.outcomes[0]

    expect(outcome.action).toBe('failed')
    expect('message' in outcome && outcome.message).toBeTruthy()
  })

  it('un defecto que falla no impide reportar el siguiente', async () => {
    const run = makeRun([makeCase({ defectId: 'HLF-000001' }), makeCase({ defectId: 'HLF-000002', testName: 'otro' })])
    const result = await reportDefects(run, config())

    expect(result.outcomes).toHaveLength(2)
    expect(jira.issues).toHaveLength(2)
  })
})

/**
 * Los dos pasos opcionales del reporte. Van despues de registrar el outcome y con su propio
 * try/catch: el defecto ya quedo reportado, y que falle subir un screenshot o que el workflow
 * no tenga la transicion no puede convertir un ticket creado con exito en un fallo.
 */
describe('evidencia y transiciones', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'healify-evidencia-'))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  function conEvidencia(): LocalCaseResult {
    const captura = join(dir, 'fallo.png')
    writeFileSync(captura, Buffer.from([0x89, 0x50, 0x4e, 0x47]))
    return makeCase({ attachments: [{ name: 'fallo.png', path: captura }] } as Partial<LocalCaseResult>)
  }

  it('con attachEvidence sube el archivo al ticket', async () => {
    const c = config()
    c.agile!.attachEvidence = true

    await reportDefects(makeRun([conEvidencia()]), c)

    expect(jira.issues[0].attachments).toEqual(['fallo.png'])
  })

  it('por default no sube nada: un screenshot puede tener datos de un entorno real', async () => {
    await reportDefects(makeRun([conEvidencia()]), config())
    expect(jira.issues[0].attachments).toEqual([])
  })

  it('un adjunto que ya no esta en disco no rompe el reporte', async () => {
    const c = config()
    c.agile!.attachEvidence = true
    const caso = makeCase({ attachments: [{ name: 'x.png', path: join(dir, 'no-existe.png') }] } as Partial<LocalCaseResult>)

    const result = await reportDefects(makeRun([caso]), c)

    // El mensaje del outcome fallido es la pista más útil cuando esto se rompe (mismo patrón
    // que el primer test del archivo): el adjunto faltante no debe convertir el ticket en `failed`.
    const failed = result.outcomes.find((o) => o.action === 'failed')
    expect(failed, failed && 'message' in failed ? failed.message : '').toBeUndefined()

    expect(result.outcomes[0].action).toBe('created')
    expect(jira.issues[0].attachments).toEqual([])
  })

  it('transiciona el ticket cuando Healify resolvio el selector y lo verifico', async () => {
    const c = config()
    c.agile!.transitionOnHealed = 'Done'

    await reportDefects(makeRun([makeCase({ status: 'healed', verified: true, fixedSelector: "role('button', { name: 'X' })" })]), c)

    expect(jira.issues[0].status).toBe('Done')
  })

  it('NO transiciona si la sugerencia no se verifico contra la pagina', async () => {
    const c = config()
    c.agile!.transitionOnHealed = 'Done'

    await reportDefects(makeRun([makeCase({ status: 'healed', verified: false, fixedSelector: 'algo' })]), c)

    expect(jira.issues[0].status).toBe('To Do')
  })

  it('una transicion que el workflow no tiene deja el ticket creado igual', async () => {
    const c = config()
    c.agile!.transitionOnHealed = 'Estado Inventado'

    const result = await reportDefects(makeRun([makeCase({ status: 'healed', verified: true, fixedSelector: 'x' })]), c)

    expect(result.outcomes[0].action).toBe('created')
    expect(jira.issues[0].status).toBe('To Do')
  })
})
