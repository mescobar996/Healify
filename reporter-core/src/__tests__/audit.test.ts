import { describe, it, expect } from 'vitest'
import { buildAuditEntry, writeAuditReport, appendAuditEntry } from '../audit'
import type { HealResponse, HealRequest } from '../healing-engine'
import type { FailureContext } from '../audit'

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
})
