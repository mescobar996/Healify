import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { scaffoldPlaywright, scaffoldCypress, scaffoldSelenium, scaffoldWebdriverio, type ScaffoldFile } from '../scaffold'

/**
 * Red de seguridad de los scaffolds.
 *
 * scaffold.test.ts verifica QUÉ archivos se escriben y qué contienen. Esto verifica algo
 * distinto y complementario: que lo que escribimos en el proyecto del usuario efectivamente
 * COMPILA. Un import mal escrito, un tipo que no existe o una API renombrada en una versión
 * nueva de Playwright/Cypress no se detectan comparando strings — solo pasándole el archivo
 * al compilador de verdad.
 *
 * Cada caso se escribe en su propia subcarpeta dentro de node_modules/ del repo, para que la
 * resolución de módulos hacia arriba encuentre las dependencias reales ya instaladas. Los
 * paquetes @healify/* se mapean a su código fuente (no a dist/) para no depender de un build
 * previo.
 */

const REPO_ROOT = resolve(__dirname, '..', '..', '..')
const WORK_DIR = join(REPO_ROOT, 'node_modules', '.healify-scaffold-check')
const TSC = join(REPO_ROOT, 'node_modules', 'typescript', 'bin', 'tsc')

interface Case {
  name: string
  files: ScaffoldFile[]
}

const CASES: Case[] = [
  { name: 'playwright-ts', files: scaffoldPlaywright('http://localhost:3000', 'ts', 'esm') },
  { name: 'playwright-js-esm', files: scaffoldPlaywright('http://localhost:3000', 'js', 'esm') },
  { name: 'playwright-js-cjs', files: scaffoldPlaywright('http://localhost:3000', 'js', 'cjs') },
  { name: 'cypress-ts', files: scaffoldCypress('http://localhost:3000', 'ts', 'esm') },
  { name: 'cypress-js-esm', files: scaffoldCypress('http://localhost:3000', 'js', 'esm') },
  { name: 'cypress-js-cjs', files: scaffoldCypress('http://localhost:3000', 'js', 'cjs') },
  { name: 'selenium-ts', files: scaffoldSelenium('ts') },
  { name: 'webdriverio-ts', files: scaffoldWebdriverio('ts') },
]

function tsconfigFor(caseName: string): string {
  return JSON.stringify(
    {
      compilerOptions: {
        noEmit: true,
        strict: true,
        skipLibCheck: true,
        target: 'ES2020',
        module: 'commonjs',
        moduleResolution: 'node',
        esModuleInterop: true,
        // reporter-core (mapeado a su fuente vía paths) importa sus diccionarios como JSON.
        resolveJsonModule: true,
        // webdriverio declara el namespace global WebdriverIO que usa su scaffold.
        types: ['node', 'webdriverio'],
        allowJs: true,
        // Los scaffolds .js son JavaScript plano para el usuario: nos interesa que parseen
        // sin errores de sintaxis, no type-checkearlos como si fueran TypeScript.
        checkJs: false,
        baseUrl: '.',
        paths: {
          '@healify/*': [join(REPO_ROOT, '*', 'src', 'index.ts').replace(/\\/g, '/')],
        },
      },
      include: ['**/*.ts', '**/*.js'],
    },
    null,
    2,
  )
}

beforeAll(() => {
  rmSync(WORK_DIR, { recursive: true, force: true })
  for (const testCase of CASES) {
    const caseDir = join(WORK_DIR, testCase.name)
    for (const file of testCase.files) {
      const target = join(caseDir, file.path)
      mkdirSync(dirname(target), { recursive: true })
      writeFileSync(target, file.content, 'utf8')
    }
    writeFileSync(join(caseDir, 'tsconfig.json'), tsconfigFor(testCase.name), 'utf8')
  }
})

afterAll(() => {
  rmSync(WORK_DIR, { recursive: true, force: true })
})

describe('los scaffolds compilan', () => {
  for (const testCase of CASES) {
    it(
      `${testCase.name} pasa tsc --noEmit`,
      () => {
        const caseDir = join(WORK_DIR, testCase.name)
        let output = ''
        let failed = false
        try {
          execFileSync(process.execPath, [TSC, '--project', caseDir], { encoding: 'utf8', stdio: 'pipe' })
        } catch (error) {
          failed = true
          const err = error as { stdout?: string; stderr?: string }
          output = `${err.stdout ?? ''}${err.stderr ?? ''}`.trim()
        }
        expect(failed ? output : '').toBe('')
      },
      120_000,
    )
  }
})
