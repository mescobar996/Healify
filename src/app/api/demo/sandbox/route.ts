import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { db } from '@/lib/db'
import { HealingStatus, SelectorType, TestStatus } from '@/lib/enums'

export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let project = await db.project.findFirst({
      where: {
        userId: session.user.id,
        name: 'Sandbox Demo',
      },
    })

    let created = false
    if (!project) {
      project = await db.project.create({
        data: {
          userId: session.user.id,
          name: 'Sandbox Demo',
          description: 'Proyecto demo interactivo para explorar Healify sin configuración',
          repository: 'https://github.com/healify/demo-project',
        },
      })
      created = true
    }

    const existingRuns = await db.testRun.count({ where: { projectId: project.id } })

    if (existingRuns === 0) {
      const run = await db.testRun.create({
        data: {
          projectId: project.id,
          status: TestStatus.HEALED,
          branch: 'main',
          commitSha: 'demo-sandbox-001',
          commitMessage: 'Sandbox demo run',
          triggeredBy: 'sandbox',
          totalTests: 12,
          passedTests: 11,
          failedTests: 0,
          healedTests: 1,
          duration: 3200,
          finishedAt: new Date(),
        },
      })

      await db.healingEvent.create({
        data: {
          testRunId: run.id,
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
          appliedAt: new Date(),
          appliedBy: 'system',
        },
      })

      await db.notification.create({
        data: {
          userId: session.user.id,
          type: 'success',
          title: 'Sandbox listo',
          message: 'Tu proyecto Sandbox Demo está listo con datos iniciales.',
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
