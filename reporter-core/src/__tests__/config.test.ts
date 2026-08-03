import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadConfig, resolveThresholds, DEFAULT_THRESHOLDS } from '../config'

let dir: string
const ENV_KEYS = [
  'HEALIFY_HEAL_ENABLED',
  'HEALIFY_MIN_CONFIDENCE',
  'HEALIFY_REVIEW_CONFIDENCE',
  'HEALIFY_MAX_ALTERNATIVES',
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
