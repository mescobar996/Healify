import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { TestStatus, HealingStatus, SelectorType } from '@/lib/enums'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'

// GET /api/seed - Seed the database with sample data
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const reset = searchParams.get('reset') === 'true'

    // Check if user already has data
    const existingProjectsCount = await db.project.count({
      where: { userId: session.user.id }
    })

    if (existingProjectsCount > 0) {
      if (reset) {
        // Delete existing data for a clean reset
        await db.project.deleteMany({
          where: { userId: session.user.id }
        })
      } else {
        return NextResponse.json({
          message: 'Database already seeded. Use /api/seed?reset=true to re-seed.'
        })
      }
    }

    // Create sample projects
    const project1 = await db.project.create({
      data: {
        name: 'E-Commerce Platform',
        description: 'Main e-commerce web application with checkout, cart, and product catalog',
        repository: 'https://github.com/healify/ecommerce-platform',
        userId: session.user.id,
      },
    })

    const project2 = await db.project.create({
      data: {
        name: 'Admin Dashboard',
        description: 'Internal admin panel for managing users, orders, and analytics',
        repository: 'https://github.com/healify/admin-dashboard',
        userId: session.user.id,
      },
    })

    const project3 = await db.project.create({
      data: {
        name: 'Mobile API',
        description: 'REST API backend for mobile applications',
        repository: 'https://github.com/healify/mobile-api',
        userId: session.user.id,
      },
    })

    // Create test runs with distributed dates across 7 days
    const now = new Date()
    const testRunsData: any[] = []

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
