import { describe, it, expect, afterEach } from 'vitest'
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { buildAuditEntry, writeAuditReport, appendAuditEntry } from '../audit'
import type { HealResponse, HealRequest } from '../healing-engine'
import type { FailureContext, AuditEntry } from '../audit'

describe('audit module', () => {
  const mockResponse: HealResponse = {
    verified: true,
    fromRepertoire: false,
    fixedSelector: "role('button', { name: 'Iniciar sesión' })",
    confidence: 0.97,
    explanation: 'Verificado contra la página',
    selectorType: 'ROLE',
    alternatives: [{ selector: "button:has-text('Iniciar sesión')", confidence: 0.85 }],
    needsReview: false,
    robustnessImprovement: 50,
    technicalDetails: {
      detectedIssue: 'ID selectors are brittle',
      proposedSolution: 'ARIA roles are stable',
      accessibilityCompliant: true,
      stableAgainstDOMChanges: true,
    },
  }

  const mockRequest: HealRequest = {
    selector: '#login-btn',
    testName: 'should login successfully',
    testFile: 'e2e/login.spec.ts',
    htmlContext: '<button id="login-btn">Iniciar sesión</button>',
  }

  const mockContext: FailureContext = {
    errorMessage: 'Element not found: #login-btn',
    domSnippet: '<button id="login-btn">Iniciar sesión</button>',
    screenshotPath: 'screenshots/login-fail.png',
    line: 15,
  }

  it('buildAuditEntry creates valid entry', () => {
    const entry = buildAuditEntry(mockResponse, mockRequest, mockContext)

    expect(entry.timestamp).toBeDefined()
    expect(entry.testName).toBe('should login successfully')
    expect(entry.testFile).toBe('e2e/login.spec.ts')
    expect(entry.line).toBe(15)
    expect(entry.originalSelector).toBe('#login-btn')
    expect(entry.fixedSelector).toBe("role('button', { name: 'Iniciar sesión' })")
    expect(entry.confidence).toBe(0.97)
    expect(entry.verified).toBe(true)
    expect(entry.domSnippet).toBe('<button id="login-btn">Iniciar sesión</button>')
    expect(entry.domHash).toBeDefined()
    expect(entry.screenshotPath).toBe('screenshots/login-fail.png')
    expect(entry.alternatives).toHaveLength(1)
    expect(entry.technicalDetails.accessibilityCompliant).toBe(true)
  })

  it('domHash is deterministic', () => {
    const entry1 = buildAuditEntry(mockResponse, mockRequest, mockContext)
    const entry2 = buildAuditEntry(mockResponse, mockRequest, mockContext)

    expect(entry1.domHash).toBe(entry2.domHash)
  })

  it('domHash changes when DOM changes', () => {
    const context1 = { ...mockContext, domSnippet: '<button id="login-btn">Login</button>' }
    const context2 = { ...mockContext, domSnippet: '<button id="login-btn">Iniciar sesión</button>' }

    const entry1 = buildAuditEntry(mockResponse, mockRequest, context1)
    const entry2 = buildAuditEntry(mockResponse, mockRequest, context2)

    expect(entry1.domHash).not.toBe(entry2.domHash)
  })

  describe('writeAuditReport', () => {
    let tmpDir: string

    afterEach(() => {
      if (tmpDir) rmSync(tmpDir, { recursive: true, force: true })
    })

    it('writes audit report to healify-audit.json', () => {
      tmpDir = mkdtempSync(join(tmpdir(), 'healify-audit-test-'))
      const entry = buildAuditEntry(mockResponse, mockRequest, mockContext)

      const path = writeAuditReport([entry], tmpDir, 'test-project', 'Playwright')

      expect(existsSync(path)).toBe(true)
      const content = JSON.parse(readFileSync(path, 'utf-8'))
      expect(content.project).toBe('test-project')
      expect(content.framework).toBe('Playwright')
      expect(content.totalCases).toBe(1)
      expect(content.entries).toHaveLength(1)
      expect(content.entries[0].originalSelector).toBe('#login-btn')
    })

    it('writes empty entries array', () => {
      tmpDir = mkdtempSync(join(tmpdir(), 'healify-audit-empty-'))

      const path = writeAuditReport([], tmpDir, 'test-project', 'Cypress')

      const content = JSON.parse(readFileSync(path, 'utf-8'))
      expect(content.totalCases).toBe(0)
      expect(content.entries).toHaveLength(0)
    })
  })

  describe('appendAuditEntry', () => {
    let tmpDir: string

    afterEach(() => {
      if (tmpDir) rmSync(tmpDir, { recursive: true, force: true })
    })

    it('appends entries to JSONL file', () => {
      tmpDir = mkdtempSync(join(tmpdir(), 'healify-audit-append-'))
      const entry1 = buildAuditEntry(mockResponse, mockRequest, mockContext)
      const entry2 = buildAuditEntry(
        { ...mockResponse, confidence: 0.85 },
        { ...mockRequest, selector: '#other-btn' },
        mockContext
      )

      appendAuditEntry(entry1, tmpDir)
      appendAuditEntry(entry2, tmpDir)

      const content = readFileSync(join(tmpDir, 'healify-audit.jsonl'), 'utf-8')
      const lines = content.trim().split('\n')
      expect(lines).toHaveLength(2)
      expect(JSON.parse(lines[0]).originalSelector).toBe('#login-btn')
      expect(JSON.parse(lines[1]).originalSelector).toBe('#other-btn')
    })
  })
})
