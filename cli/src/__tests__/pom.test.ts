import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { collectCodeFiles } from '../pom'

let root: string

function touch(relativePath: string, content = '// x\n'): string {
  const full = join(root, relativePath)
  mkdirSync(join(full, '..'), { recursive: true })
  writeFileSync(full, content, 'utf-8')
  return full
}

function relativeNames(files: string[]): string[] {
  return files.map((f) => relative(root, f).split('\\').join('/')).sort()
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'healify-pom-'))
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('collectCodeFiles', () => {
  it('junta los archivos de código de todas las extensiones soportadas', () => {
    touch('pages/login.page.ts')
    touch('pages/home.page.js')
    touch('support/helpers.mjs')
    touch('README.md')
    touch('data/fixtures.json')

    expect(relativeNames(collectCodeFiles([root]))).toEqual([
      'pages/home.page.js',
      'pages/login.page.ts',
      'support/helpers.mjs',
    ])
  })

  it('no entra a node_modules ni a los directorios de build', () => {
    touch('pages/login.page.ts')
    touch('node_modules/algo/index.ts')
    touch('dist/bundle.js')
    touch('coverage/report.js')
    touch('playwright-report/trace.js')

    expect(relativeNames(collectCodeFiles([root]))).toEqual(['pages/login.page.ts'])
  })

  it('saltea directorios ocultos sin necesidad de listarlos uno por uno', () => {
    touch('pages/login.page.ts')
    touch('.git/hooks/pre-commit.js')
    touch('.next/static/chunk.js')
    touch('.healify/cache.js')

    expect(relativeNames(collectCodeFiles([root]))).toEqual(['pages/login.page.ts'])
  })

  it('respeta maxDepth', () => {
    touch('a/b/c/deep.ts')
    touch('a/shallow.ts')

    expect(relativeNames(collectCodeFiles([root], { maxDepth: 1 }))).toEqual(['a/shallow.ts'])
  })

  it('respeta maxFiles y corta siempre por el mismo lado', () => {
    touch('a.ts')
    touch('b.ts')
    touch('c.ts')

    const first = collectCodeFiles([root], { maxFiles: 2 })
    const second = collectCodeFiles([root], { maxFiles: 2 })

    expect(first).toHaveLength(2)
    expect(first).toEqual(second)
  })

  it('una raíz inexistente no rompe el scan de las demás', () => {
    touch('pages/login.page.ts')

    const files = collectCodeFiles([join(root, 'no-existe'), root])

    expect(relativeNames(files)).toEqual(['pages/login.page.ts'])
  })

  it('devuelve la lista ordenada, para que la decisión de fix sea reproducible', () => {
    touch('z.ts')
    touch('a.ts')
    touch('m.ts')

    const files = collectCodeFiles([root])

    expect(files).toEqual([...files].sort())
  })
})
