import { NextResponse } from 'next/server'
import { tryOpenAutoPR } from '@/lib/github/auto-pr'
import { db } from '@/lib/db'
import { TestStatus, HealingStatus, SelectorType } from '@/lib/enums'

export async function POST() {
    try {
        // Get or create a demo project
        let project = await db.project.findFirst({
            where: { name: 'Demo Project' }
        })

        if (!project) {
            project = await db.project.findFirst()
            if (!project) {
                project = await db.project.create({
                    data: {
                        name: 'Demo Project',
                        description: 'Project used for interactive simulations',
                        repository: 'https://github.com/healify/demo-project',
                    },
                })
            }
        }

        // 1. Create a new TestRun in RUNNING status
        const testRun = await db.testRun.create({
            data: {
                projectId: project.id,
                status: TestStatus.RUNNING,
                branch: 'main',
                commitMessage: 'Demo: Simulating test execution',
                triggeredBy: 'manual',
                totalTests: 10,
                passedTests: 0,
                failedTests: 0,
                healedTests: 0,
            },
        })

        // 2. Simulate execution time (2 seconds)
        await new Promise((resolve) => setTimeout(resolve, 2000))

        // 3. Update TestRun to HEALED status
        const updatedRun = await db.testRun.update({
            where: { id: testRun.id },
            data: {
                status: TestStatus.HEALED,
                passedTests: 9,
                failedTests: 0,
                healedTests: 1,
                finishedAt: new Date(),
                duration: 2000,
            },
        })

        // 4. Create a HealingEvent for this run
        const demoEvents = [
            {
                testName: 'Login with valid credentials',
                selector: '#login-button',
                newSelector: 'button[type="submit"]',
                reason: 'The button ID changed from "#login-button" to a standard submit type. Found unique match in the new DOM snapshot.',
            },
            {
                testName: 'Add product to cart',
                selector: '.add-to-cart-btn',
                newSelector: '[data-testid="add-cart"]',
                reason: 'Class-based selector failed. Found a robust data-testid attribute on the same element.',
            }
        ]

        const randomEvent = demoEvents[Math.floor(Math.random() * demoEvents.length)]

        const createdHealingEvent = await db.healingEvent.create({
            data: {
                testRunId: updatedRun.id,
                testName: randomEvent.testName,
                testFile: 'tests/demo.spec.ts',
                failedSelector: randomEvent.selector,
                selectorType: SelectorType.CSS,
                errorMessage: `Element not found: ${randomEvent.selector}`,
                newSelector: randomEvent.newSelector,
                newSelectorType: randomEvent.newSelector.includes('[') ? SelectorType.TESTID : SelectorType.CSS,
                confidence: 0.94 + Math.random() * 0.05,
                status: HealingStatus.HEALED_AUTO,
                reasoning: randomEvent.reason,
                actionTaken: 'auto_fixed',
            },
        })

        // ── Bloque 8: Auto-PR si confidence >= 0.95 ─────────────────
        tryOpenAutoPR(createdHealingEvent.id).then(result => {
            console.log('[Demo Auto-PR]', result.opened ? `✅ ${result.prUrl}` : result.reason)
        }).catch(() => {})

        return NextResponse.json({
            message: 'Demo run completed',
            testRunId: updatedRun.id,
        })
    } catch (error) {
        console.error('Error running demo:', error)
        return NextResponse.json(
            { error: 'Failed to run demo simulation' },
            { status: 500 }
        )
    }
}
