import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { TestStatus, HealingStatus, SelectorType } from '@/lib/enums'
import { getSessionUser } from '@/lib/auth/session'

// GET /api/seed - Seed the database with sample data
export async function GET(request: Request) {
  try {
    const user = await getSessionUser()
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const reset = searchParams.get('reset') === 'true'

    if (reset) {
      return NextResponse.json(
        { error: 'Reset operation requires POST /api/seed with { "reset": true }' },
        { status: 405 }
      )
    }

    // Check if user already has data
    const existingProjectsCount = await db.project.count({
      where: { userId: user.id }
    })

    if (existingProjectsCount > 0) {
      return NextResponse.json({
        message: 'Database already seeded. Use POST /api/seed with {"reset": true} to re-seed.'
      })
    }

    // Create sample projects
    const project1 = await db.project.create({
      data: {
        name: 'E-Commerce Platform',
        description: 'Main e-commerce web application with checkout, cart, and product catalog',
        repository: 'https://github.com/healify/ecommerce-platform',
        userId: user.id,
      },
    })

    const project2 = await db.project.create({
      data: {
        name: 'Admin Dashboard',
        description: 'Internal admin panel for managing users, orders, and analytics',
        repository: 'https://github.com/healify/admin-dashboard',
        userId: user.id,
      },
    })

    const project3 = await db.project.create({
      data: {
        name: 'Mobile API',
        description: 'REST API backend for mobile applications',
        repository: 'https://github.com/healify/mobile-api',
        userId: user.id,
      },
    })

    // Create test runs with distributed dates across 7 days
    const now = new Date()
    const testRunsData: Array<{ id: string; status: string }> = []

    for (let i = 0; i < 15; i++) {
      const daysAgo = Math.floor(Math.random() * 7)
      const hoursAgo = Math.floor(Math.random() * 24)
      const date = new Date(now)
      date.setDate(date.getDate() - daysAgo)
      date.setHours(date.getHours() - hoursAgo)

      const projectId = [project1.id, project2.id, project3.id][i % 3]
      const status = Math.random() > 0.3 ? TestStatus.PASSED : (Math.random() > 0.5 ? TestStatus.HEALED : TestStatus.FAILED)

      const run = await db.testRun.create({
        data: {
          projectId,
          status,
          branch: 'main',
          startedAt: date,
          finishedAt: new Date(date.getTime() + 5 * 60000),
          duration: 300000,
          totalTests: 150,
          passedTests: status === TestStatus.PASSED ? 150 : 145,
          failedTests: status === TestStatus.FAILED ? 5 : 0,
          healedTests: status === TestStatus.HEALED ? 5 : 0,
        }
      })
      testRunsData.push(run)
    }

    // Create healing events for HEALED runs
    for (const run of testRunsData) {
      if (run.status === TestStatus.HEALED) {
        await db.healingEvent.create({
          data: {
            testRunId: run.id,
            testName: 'Element lookup simulation',
            testFile: 'tests/main.spec.ts',
            failedSelector: '#old-id',
            selectorType: SelectorType.CSS,
            errorMessage: 'Timeout waiting for element',
            newSelector: '.new-class',
            newSelectorType: SelectorType.CSS,
            confidence: 0.95,
            status: HealingStatus.HEALED_AUTO,
            reasoning: 'AI detected structural change and suggested an alternative CSS selector.',
            actionTaken: 'auto_fixed',
          }
        })
      }
    }

    return NextResponse.json({
      message: 'Database seeded successfully',
      projects: 3,
      testRuns: 9,
      healingEvents: 6,
    })
  } catch (error) {
    console.error('Error seeding database:', error)
    return NextResponse.json(
      { error: 'Failed to seed database' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUser()
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const reset = body?.reset === true

    if (!reset) {
      return NextResponse.json({ error: 'Invalid request. Expected {"reset": true}' }, { status: 400 })
    }

    await db.project.deleteMany({
      where: { userId: user.id }
    })

    return GET(request)
  } catch (error) {
    console.error('Error resetting seed data:', error)
    return NextResponse.json(
      { error: 'Failed to reset database seed' },
      { status: 500 }
    )
  }
}
