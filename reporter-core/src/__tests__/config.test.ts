import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadConfig, resolveThresholds, resolveAgile, DEFAULT_THRESHOLDS, type HealifyConfig } from '../config'

let dir: string
const ENV_KEYS = [
  'HEALIFY_HEAL_ENABLED',
  'HEALIFY_MIN_CONFIDENCE',
  'HEALIFY_REVIEW_CONFIDENCE',
  'HEALIFY_MAX_ALTERNATIVES',
  'HEALIFY_AGILE_ENABLED',
  'HEALIFY_AGILE_PROVIDER',
  'JIRA_BASE_URL',
  'JIRA_EMAIL',
  'JIRA_API_TOKEN',
  'JIRA_PROJECT',
  'JIRA_ISSUE_TYPE',
  'HEALIFY_WEBHOOK_URL',
  'HEALIFY_GITHUB_TOKEN',
  'HEALIFY_GITHUB_REPOSITORY',
  // El runner de GitHub Actions la exporta en TODO workflow: sin limpiarla, estos tests pasan
  // en cualquier máquina y fallan en CI.
  'GITHUB_REPOSITORY',
] as const

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'healify-config-'))
  for (const key of ENV_KEYS) delete process.env[key]
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
  for (const key of ENV_KEYS) delete process.env[key]
})

describe('loadConfig — archivos', () => {
  it('sin ningún archivo devuelve config vacía', () => {
    expect(loadConfig(dir)).toEqual({})
  })

  it('lee healify.config.json', () => {
    writeFileSync(join(dir, 'healify.config.json'), JSON.stringify({ minConfidence: 0.95, healEnabled: false }))

    expect(loadConfig(dir)).toEqual({ minConfidence: 0.95, healEnabled: false })
  })

  it('lee healify.config.js en CommonJS', () => {
    writeFileSync(join(dir, 'healify.config.js'), 'module.exports = { minConfidence: 0.85, maxAlternatives: 1 }\n')

    expect(loadConfig(dir)).toEqual({ minConfidence: 0.85, maxAlternatives: 1 })
  })

  it('lee healify.config.cjs', () => {
    writeFileSync(join(dir, 'healify.config.cjs'), 'module.exports = { customTestIds: ["data-qa-id"] }\n')

    expect(loadConfig(dir)).toEqual({ customTestIds: ['data-qa-id'] })
  })

  it('el .js le gana al .json cuando están los dos', () => {
    writeFileSync(join(dir, 'healify.config.js'), 'module.exports = { minConfidence: 0.7 }\n')
    writeFileSync(join(dir, 'healify.config.json'), JSON.stringify({ minConfidence: 0.99 }))

    expect(loadConfig(dir).minConfidence).toBe(0.7)
  })

  it('un .js que en realidad es ESM no rompe la corrida — cae al siguiente candidato', () => {
    writeFileSync(join(dir, 'healify.config.js'), 'export default { minConfidence: 0.7 }\n')
    writeFileSync(join(dir, 'healify.config.json'), JSON.stringify({ minConfidence: 0.99 }))

    // Node >= 22 sabe require() de ESM; en versiones anteriores tira ERR_REQUIRE_ESM y se
    // usa el JSON. Cualquiera de los dos resultados es aceptable: lo que NO puede pasar es
    // que la corrida de tests del usuario se caiga por un archivo de config.
    expect([0.7, 0.99]).toContain(loadConfig(dir).minConfidence)
  })

  it('un JSON corrupto devuelve config vacía en vez de romper', () => {
    writeFileSync(join(dir, 'healify.config.json'), '{ esto no es json')

    expect(loadConfig(dir)).toEqual({})
  })

  it('lee la key healify de package.json cuando no hay archivo propio', () => {
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'x', healify: { maxAlternatives: 5 } }))

    expect(loadConfig(dir)).toEqual({ maxAlternatives: 5 })
  })
})

describe('loadConfig — validación', () => {
  it('descarta testIds que no empiezan con data-', () => {
    writeFileSync(join(dir, 'healify.config.json'), JSON.stringify({ customTestIds: ['data-qa', 'qa-id'] }))

    expect(loadConfig(dir).customTestIds).toEqual(['data-qa'])
  })

  it('descarta umbrales fuera de [0,1] o no numéricos', () => {
    writeFileSync(
      join(dir, 'healify.config.json'),
      JSON.stringify({ minConfidence: 1.5, reviewConfidence: 'alto', maxAlternatives: -2 })
    )

    expect(loadConfig(dir)).toEqual({})
  })

  it('recorta maxAlternatives a 10 y lo trunca a entero', () => {
    writeFileSync(join(dir, 'healify.config.json'), JSON.stringify({ maxAlternatives: 99.7 }))

    expect(loadConfig(dir).maxAlternatives).toBe(10)
  })
})

describe('loadConfig — overrides por entorno', () => {
  it('HEALIFY_HEAL_ENABLED=false pisa el archivo (análogo de -Dheal-enabled=false)', () => {
    writeFileSync(join(dir, 'healify.config.json'), JSON.stringify({ healEnabled: true }))
    process.env.HEALIFY_HEAL_ENABLED = 'false'

    expect(loadConfig(dir).healEnabled).toBe(false)
  })

  it('acepta 0/1 además de false/true', () => {
    process.env.HEALIFY_HEAL_ENABLED = '0'
    expect(loadConfig(dir).healEnabled).toBe(false)

    process.env.HEALIFY_HEAL_ENABLED = '1'
    expect(loadConfig(dir).healEnabled).toBe(true)
  })

  it('HEALIFY_MIN_CONFIDENCE pisa el archivo', () => {
    writeFileSync(join(dir, 'healify.config.json'), JSON.stringify({ minConfidence: 0.9 }))
    process.env.HEALIFY_MIN_CONFIDENCE = '0.95'

    expect(loadConfig(dir).minConfidence).toBe(0.95)
  })

  it('un valor de entorno que no parsea se ignora y queda lo del archivo', () => {
    writeFileSync(join(dir, 'healify.config.json'), JSON.stringify({ minConfidence: 0.9, healEnabled: true }))
    process.env.HEALIFY_MIN_CONFIDENCE = 'muy alto'
    process.env.HEALIFY_HEAL_ENABLED = 'quizás'

    expect(loadConfig(dir)).toEqual({ minConfidence: 0.9, healEnabled: true })
  })

  it('las env vars valen aunque no exista ningún archivo de config', () => {
    process.env.HEALIFY_MAX_ALTERNATIVES = '1'

    expect(loadConfig(dir)).toEqual({ maxAlternatives: 1 })
  })
})

describe('loadConfig — bloque agile', () => {
  it('un bloque agile válido en el .json se conserva', () => {
    writeFileSync(
      join(dir, 'healify.config.json'),
      JSON.stringify({
        agile: { enabled: true, provider: 'jira', baseUrl: 'https://acme.atlassian.net', project: 'QA' },
      })
    )

    expect(loadConfig(dir).agile).toEqual({
      enabled: true,
      provider: 'jira',
      baseUrl: 'https://acme.atlassian.net',
      project: 'QA',
    })
  })

  it('provider inválido se descarta — cae al default jira', () => {
    writeFileSync(join(dir, 'healify.config.json'), JSON.stringify({ agile: { provider: 'linear' } }))

    // Un bloque que queda vacío tras validar se descarta igual que una config vacía.
    expect(loadConfig(dir).agile).toBeUndefined()
    expect(resolveAgile(loadConfig(dir)).provider).toBe('jira')
  })

  it('valores no string (o vacíos) de baseUrl/email/apiToken se descartan', () => {
    writeFileSync(
      join(dir, 'healify.config.json'),
      JSON.stringify({ agile: { baseUrl: 42, email: '', apiToken: null, project: 'QA' } })
    )

    expect(loadConfig(dir).agile).toEqual({ project: 'QA' })
  })

  /**
   * `validateAgile` descarta todo campo que no reconozca, asi que agregar una opcion nueva sin
   * agregarla ahi la vuelve inutilizable desde el archivo de config — anda solo por variable de
   * entorno, que es el camino que menos gente usa. Paso exactamente eso con los tres campos del
   * provider github, y la doc ya mostraba ejemplos que no habrian funcionado.
   */
  it('los campos del provider github sobreviven a la validacion', () => {
    writeFileSync(
      join(dir, 'healify.config.json'),
      JSON.stringify({
        agile: { enabled: true, provider: 'github', repository: 'a/b', attachEvidence: true, transitionOnHealed: 'Done' },
      })
    )

    const resuelto = resolveAgile(loadConfig(dir))
    expect(resuelto.provider).toBe('github')
    expect(resuelto.repository).toBe('a/b')
    expect(resuelto.attachEvidence).toBe(true)
    expect(resuelto.transitionOnHealed).toBe('Done')
  })

  it('issueType y labels se sanean', () => {
    writeFileSync(
      join(dir, 'healify.config.json'),
      JSON.stringify({ agile: { issueType: '', labels: ['healify', '', 7] } })
    )

    expect(loadConfig(dir).agile).toEqual({ labels: ['healify'] })
  })

  it('priorityBySeverity conserva solo severidades conocidas con valores no vacíos', () => {
    writeFileSync(
      join(dir, 'healify.config.json'),
      JSON.stringify({ agile: { priorityBySeverity: { blocker: 'Critical', major: '', nope: 'X' } } })
    )

    expect(loadConfig(dir).agile?.priorityBySeverity).toEqual({ blocker: 'Critical' })
  })

  it('HEALIFY_AGILE_ENABLED=true activa el reporte sin archivo de config', () => {
    process.env.HEALIFY_AGILE_ENABLED = 'true'

    expect(loadConfig(dir).agile).toEqual({ enabled: true })
  })

  it('JIRA_EMAIL / JIRA_API_TOKEN / JIRA_PROJECT / JIRA_BASE_URL pueblan el bloque', () => {
    process.env.JIRA_EMAIL = 'qa@acme.com'
    process.env.JIRA_API_TOKEN = 'un-secreto'
    process.env.JIRA_PROJECT = 'QA'
    process.env.JIRA_BASE_URL = 'https://acme.atlassian.net'

    expect(loadConfig(dir).agile).toEqual({
      email: 'qa@acme.com',
      apiToken: 'un-secreto',
      project: 'QA',
      baseUrl: 'https://acme.atlassian.net',
    })
  })

  it('HEALIFY_AGILE_PROVIDER=webhook pisa el provider del archivo', () => {
    writeFileSync(join(dir, 'healify.config.json'), JSON.stringify({ agile: { provider: 'jira' } }))
    process.env.HEALIFY_AGILE_PROVIDER = 'webhook'

    expect(loadConfig(dir).agile?.provider).toBe('webhook')
  })

  /**
   * `GITHUB_REPOSITORY` la exporta el runner en TODO workflow de GitHub Actions. Si se leyera
   * siempre, la config resuelta cambiaria segun DONDE corre — poblada en CI, vacia en la
   * maquina de cualquiera — aunque el provider no tenga nada que ver con GitHub.
   *
   * Lo encontro CI: estos tests pasaban local y fallaban en el runner.
   */
  it('GITHUB_REPOSITORY se ignora cuando el provider no es github', () => {
    process.env.GITHUB_REPOSITORY = 'alguien/algo'
    expect(resolveAgile(loadConfig(dir)).repository).toBeUndefined()
  })

  it('GITHUB_REPOSITORY se usa cuando el provider SI es github', () => {
    process.env.HEALIFY_AGILE_PROVIDER = 'github'
    process.env.GITHUB_REPOSITORY = 'alguien/algo'
    expect(resolveAgile(loadConfig(dir)).repository).toBe('alguien/algo')
  })

  it('el token de GitHub sale de HEALIFY_GITHUB_TOKEN, no de JIRA_API_TOKEN', () => {
    process.env.HEALIFY_AGILE_PROVIDER = 'github'
    process.env.JIRA_API_TOKEN = 'token-de-jira'
    process.env.HEALIFY_GITHUB_TOKEN = 'token-de-github'
    expect(resolveAgile(loadConfig(dir)).apiToken).toBe('token-de-github')
  })

  it('HEALIFY_WEBHOOK_URL puebla webhookUrl', () => {
    process.env.HEALIFY_WEBHOOK_URL = 'https://hooks.zapier.com/x'

    expect(loadConfig(dir).agile?.webhookUrl).toBe('https://hooks.zapier.com/x')
  })
})

describe('resolveAgile', () => {
  it('sin config: apagado, provider jira, issueType Bug, prioridades default, sin labels', () => {
    expect(resolveAgile({})).toEqual({
      enabled: false,
      provider: 'jira',
      baseUrl: undefined,
      email: undefined,
      apiToken: undefined,
      repository: undefined,
      project: undefined,
      issueType: 'Bug',
      priorityBySeverity: { blocker: 'Highest', major: 'High', minor: 'Medium' },
      labels: [],
      webhookUrl: undefined,
      // Los dos son opt-in aparte de `enabled`: subir un screenshot puede sacar datos de un
      // entorno real, y transicionar tickets es tocar el workflow de otro equipo.
      attachEvidence: false,
      transitionOnHealed: undefined,
    })
  })

  it('aplica lo configurado', () => {
    const config: HealifyConfig = {
      agile: {
        enabled: true,
        provider: 'jira',
        baseUrl: 'https://acme.atlassian.net',
        email: 'qa@acme.com',
        apiToken: 's3cret',
        project: 'QA',
        labels: ['healify'],
      },
    }

    const resolved = resolveAgile(config)
    expect(resolved.enabled).toBe(true)
    expect(resolved.project).toBe('QA')
    expect(resolved.labels).toEqual(['healify'])
    expect(resolved.issueType).toBe('Bug')
  })

  it('priorityBySeverity parcial usa defaults para el resto', () => {
    const resolved = resolveAgile({ agile: { priorityBySeverity: { blocker: 'Critical' } } })

    expect(resolved.priorityBySeverity).toEqual({ blocker: 'Critical', major: 'High', minor: 'Medium' })
  })
})

describe('resolveThresholds', () => {
  it('sin config devuelve los defaults de siempre', () => {
    expect(resolveThresholds()).toEqual(DEFAULT_THRESHOLDS)
    expect(DEFAULT_THRESHOLDS).toEqual({ healEnabled: true, minConfidence: 0.9, reviewConfidence: 0.8, maxAlternatives: 3 })
  })

  it('aplica lo configurado', () => {
    expect(resolveThresholds({ minConfidence: 0.95, maxAlternatives: 1 })).toEqual({
      healEnabled: true,
      minConfidence: 0.95,
      reviewConfidence: 0.8,
      maxAlternatives: 1,
    })
  })

  it('reviewConfidence nunca queda por encima de minConfidence', () => {
    // Con review > min no existiría el estado "review": un caso apenas por debajo del corte
    // de healed desaparecería como unresolved, lo contrario de lo que buscaba subir el umbral.
    expect(resolveThresholds({ minConfidence: 0.7, reviewConfidence: 0.9 }).reviewConfidence).toBe(0.7)
  })
})
