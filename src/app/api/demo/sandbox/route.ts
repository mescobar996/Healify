import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { HealingStatus, SelectorType, TestStatus } from '@/lib/enums'
import { initProjectApiKey } from '@/lib/api-key-service'

export async function POST() {
  try {
    const user = await getSessionUser()
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let project = await db.project.findFirst({
      where: {
        userId: user.id,
        name: 'Sandbox Demo',
      },
    })

    let created = false
    if (!project) {
      project = await db.project.create({
        data: {
          userId: user.id,
          name: 'Sandbox Demo',
          description: 'Proyecto demo interactivo para explorar Healify sin configuración',
          repository: 'https://github.com/healify/demo-project',
        },
      })
      await initProjectApiKey(project.id).catch(() => {})
      created = true
    }

    const existingRuns = await db.testRun.count({ where: { projectId: project.id } })

    if (existingRuns === 0) {
      const now = new Date()

      // ── Run 1: Most recent — healed
      const run1 = await db.testRun.create({
        data: {
          projectId: project.id,
          status: TestStatus.HEALED,
          branch: 'main',
          commitSha: 'demo-sandbox-001',
          commitMessage: 'fix: update checkout flow',
          triggeredBy: 'push',
          totalTests: 24,
          passedTests: 23,
          failedTests: 0,
          healedTests: 1,
          duration: 32000,
          finishedAt: new Date(now.getTime() - 1800000),
        },
      })

      // ── Run 2: Passed clean
      await db.testRun.create({
        data: {
          projectId: project.id,
          status: TestStatus.PASSED,
          branch: 'main',
          commitSha: 'demo-sandbox-002',
          commitMessage: 'feat: add user profile page',
          triggeredBy: 'push',
          totalTests: 24,
          passedTests: 24,
          failedTests: 0,
          healedTests: 0,
          duration: 28000,
          finishedAt: new Date(now.getTime() - 7200000),
        },
      })

      // ── Run 3: Healed with 2 fixes
      const run3 = await db.testRun.create({
        data: {
          projectId: project.id,
          status: TestStatus.HEALED,
          branch: 'feature/checkout-v2',
          commitSha: 'demo-sandbox-003',
          commitMessage: 'refactor: redesign cart component',
          triggeredBy: 'pull_request',
          totalTests: 18,
          passedTests: 16,
          failedTests: 0,
          healedTests: 2,
          duration: 45000,
          finishedAt: new Date(now.getTime() - 86400000),
        },
      })

      // ── Run 4: Failed (for data diversity)
      await db.testRun.create({
        data: {
          projectId: project.id,
          status: TestStatus.FAILED,
          branch: 'feature/login-redesign',
          commitSha: 'demo-sandbox-004',
          commitMessage: 'wip: login redesign',
          triggeredBy: 'push',
          totalTests: 12,
          passedTests: 10,
          failedTests: 2,
          healedTests: 0,
          duration: 18000,
          finishedAt: new Date(now.getTime() - 172800000),
        },
      })

      // ── Run 5: Older healed run
      const run5 = await db.testRun.create({
        data: {
          projectId: project.id,
          status: TestStatus.HEALED,
          branch: 'main',
          commitSha: 'demo-sandbox-005',
          commitMessage: 'fix: settings page selectors',
          triggeredBy: 'push',
          totalTests: 24,
          passedTests: 22,
          failedTests: 0,
          healedTests: 2,
          duration: 35000,
          finishedAt: new Date(now.getTime() - 259200000),
        },
      })

      // ── Healing Events (5 total across 3 runs)
      await db.healingEvent.create({
        data: {
          testRunId: run1.id,
          testName: 'Checkout should submit order',
          testFile: 'tests/checkout.spec.ts',
          failedSelector: '.checkout-submit-btn',
          selectorType: SelectorType.CSS,
          errorMessage: 'Element not found: .checkout-submit-btn',
          newSelector: '[data-testid="checkout-submit"]',
          newSelectorType: SelectorType.TESTID,
          confidence: 0.97,
          status: HealingStatus.HEALED_AUTO,
          reasoning: 'Se detectó data-testid estable en el botón de submit.',
          actionTaken: 'auto_fixed',
          appliedAt: new Date(now.getTime() - 1795000),
          appliedBy: 'system',
        },
      })

      await db.healingEvent.create({
        data: {
          testRunId: run3.id,
          testName: 'Cart should add item',
          testFile: 'tests/cart.spec.ts',
          failedSelector: '.cart-add-btn',
          selectorType: SelectorType.CSS,
          errorMessage: 'Element not found: .cart-add-btn',
          newSelector: '[data-testid="add-to-cart"]',
          newSelectorType: SelectorType.TESTID,
          confidence: 0.94,
          status: HealingStatus.HEALED_AUTO,
          reasoning: 'Botón refactorizado. Nuevo testid estable disponible.',
          actionTaken: 'auto_fixed',
          appliedAt: new Date(now.getTime() - 86350000),
          appliedBy: 'system',
        },
      })

      await db.healingEvent.create({
        data: {
          testRunId: run3.id,
          testName: 'Cart should display total',
          testFile: 'tests/cart.spec.ts',
          failedSelector: '#price-total',
          selectorType: SelectorType.CSS,
          errorMessage: 'Element not found: #price-total',
          newSelector: '[data-testid="cart-total"]',
          newSelectorType: SelectorType.TESTID,
          confidence: 0.91,
          status: HealingStatus.HEALED_AUTO,
          reasoning: 'ID eliminado en refactor. data-testid es más resiliente.',
          actionTaken: 'auto_fixed',
          appliedAt: new Date(now.getTime() - 86345000),
          appliedBy: 'system',
        },
      })

      await db.healingEvent.create({
        data: {
          testRunId: run5.id,
          testName: 'Dashboard should load metrics',
          testFile: 'tests/dashboard.spec.ts',
          failedSelector: '.metrics-container > div:nth-child(1)',
          selectorType: SelectorType.CSS,
          errorMessage: 'Element not found: positional CSS selector broke after layout change',
          newSelector: '[data-testid="metric-card-tests"]',
          newSelectorType: SelectorType.TESTID,
          confidence: 0.89,
          status: HealingStatus.HEALED_AUTO,
          reasoning: 'Selector posicional reemplazado por testid estable.',
          actionTaken: 'auto_fixed',
          appliedAt: new Date(now.getTime() - 259145000),
          appliedBy: 'system',
        },
      })

      await db.healingEvent.create({
        data: {
          testRunId: run5.id,
          testName: 'Settings should toggle notification',
          testFile: 'tests/settings.spec.ts',
          failedSelector: '#notif-toggle',
          selectorType: SelectorType.CSS,
          errorMessage: 'Element not found: #notif-toggle',
          newSelector: '[data-testid="notification-toggle"]',
          newSelectorType: SelectorType.TESTID,
          confidence: 0.96,
          status: HealingStatus.NEEDS_REVIEW,
          reasoning: 'ID renombrado, testid detectado. Requiere revisión manual.',
          actionTaken: 'suggested',
          appliedAt: null,
          appliedBy: null,
        },
      })

      await db.notification.create({
        data: {
          userId: user.id,
          type: 'success',
          title: 'Sandbox listo',
          message: 'Tu proyecto Sandbox Demo está listo con 5 test runs y 5 healing events para que explores.',
          link: '/dashboard/projects',
        },
      }).catch(() => {})
    }

    return NextResponse.json({
      success: true,
      projectId: project.id,
      created,
      seeded: existingRuns === 0,
    })
  } catch (error) {
    console.error('Sandbox setup error:', error)
    return NextResponse.json({ error: 'Failed to setup sandbox' }, { status: 500 })
  }
}
