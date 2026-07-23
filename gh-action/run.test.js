import { describe, it, expect } from 'vitest'
import { formatDoctor, formatFixOutput, buildComment, findOrCreateComment, postComment } from './run.js'

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

    const comment = buildComment(doctorOutput, '', '.')
    expect(comment).toContain('All Clear')
    expect(comment).toContain('<!-- healify-report -->')
  })

  it('includes doctor failures in the comment', () => {
    const doctorOutput = [
      '✅ Framework detectado: playwright',
      '❌ @healify/test-runner instalado',
      '   fix: npm install --save-dev @healify/test-runner',
    ].join('\n')

    const comment = buildComment(doctorOutput, '', '.')
    expect(comment).toContain('Issues Detected')
    expect(comment).toContain('@healify/test-runner instalado')
    expect(comment).toContain('npm install --save-dev @healify/test-runner')
  })

  it('includes broken selectors table', () => {
    const doctorOutput = '✅ Framework detectado: playwright'
    const fixOutput = '✓ e2e/login.spec.ts — #old → [data-testid="new"]'

    const comment = buildComment(doctorOutput, fixOutput, '.')
    expect(comment).toContain('Suggested Fixes')
    expect(comment).toContain('#old')
    expect(comment).toContain('[data-testid="new"]')
  })

  it('includes skipped items', () => {
    const doctorOutput = '✅ Framework detectado: playwright'
    const fixOutput = '⚠ e2e/home.spec.ts — saltado: ambiguo'

    const comment = buildComment(doctorOutput, fixOutput, '.')
    expect(comment).toContain('Needs Review')
    expect(comment).toContain('ambiguo')
  })

  it('includes info notes', () => {
    const doctorOutput = [
      '✅ Framework detectado: selenium',
      'ℹ️ Selenium/WebdriverIO curan en vivo, no generan reporte',
    ].join('\n')

    const comment = buildComment(doctorOutput, '', '.')
    expect(comment).toContain('Notes')
    expect(comment).toContain('Selenium/WebdriverIO curan en vivo')
  })

  it('includes local fix command hint', () => {
    const doctorOutput = '❌ Framework de test detectado'
    const comment = buildComment(doctorOutput, '', '.')
    expect(comment).toContain('npx @healify/cli fix')
  })

  it('handles empty inputs gracefully', () => {
    const comment = buildComment('', '', '.')
    expect(comment).toContain('<!-- healify-report -->')
    expect(comment).toContain('All Clear')
  })
})

describe('findOrCreateComment', () => {
  it('finds existing Healify comment by marker', async () => {
    const comments = [
      { id: 1, body: 'Some other comment' },
      { id: 2, body: '<!-- healify-report -->\n\n### Healify — All Clear ✅' },
      { id: 3, body: 'Another comment' },
    ]

    const octokit = {
      rest: {
        issues: {
          listComments: async () => ({ data: comments }),
        },
      },
    }

    const result = await findOrCreateComment(octokit, 'owner', 'repo', 1)
    expect(result).toBe(comments[1])
  })

  it('returns undefined when no Healify comment exists', async () => {
    const comments = [
      { id: 1, body: 'Some comment' },
    ]

    const octokit = {
      rest: {
        issues: {
          listComments: async () => ({ data: comments }),
        },
      },
    }

    const result = await findOrCreateComment(octokit, 'owner', 'repo', 1)
    expect(result).toBeUndefined()
  })
})

describe('postComment', () => {
  it('creates a new comment when none exists', async () => {
    const created = []
    const octokit = {
      rest: {
        issues: {
          listComments: async () => ({ data: [] }),
          createComment: async (args) => { created.push(args); return {} },
          updateComment: async () => { throw new Error('should not be called') },
        },
      },
    }

    const result = await postComment(octokit, 'owner', 'repo', 1, 'body')
    expect(result).toBe('created')
    expect(created).toHaveLength(1)
    expect(created[0].body).toBe('body')
  })

  it('updates existing Healify comment', async () => {
    const updated = []
    const octokit = {
      rest: {
        issues: {
          listComments: async () => ({ data: [{ id: 42, body: '<!-- healify-report --> old' }] }),
          updateComment: async (args) => { updated.push(args); return {} },
          createComment: async () => { throw new Error('should not be called') },
        },
      },
    }

    const result = await postComment(octokit, 'owner', 'repo', 1, 'body')
    expect(result).toBe('updated')
    expect(updated).toHaveLength(1)
    expect(updated[0].comment_id).toBe(42)
    expect(updated[0].body).toBe('body')
  })
})
