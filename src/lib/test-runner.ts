import { chromium, Browser, Page } from 'playwright'
import { db } from '@/lib/db'
import { TestStatus, HealingStatus, SelectorType } from '@prisma/client'
import { getProjectConfig } from './test-config'
import path from 'path'
import fs from 'fs'

export interface TestResult {
    name: string
    status: 'passed' | 'failed'
    error?: string
    screenshotPath?: string
    domSnapshot?: string
}

export class TestRunner {
    private browser: Browser | null = null

    async init() {
        this.browser = await chromium.launch({ headless: true })
    }

    async close() {
        if (this.browser) {
            await this.browser.close()
        }
    }

    async runProjectTests(projectId: string, testRunId: string) {
        const config = getProjectConfig(projectId)
        const results: TestResult[] = []

        try {
            if (!this.browser) await this.init()
            const context = await this.browser!.newContext({ viewport: config.viewport })
            const page = await context.newPage()

            // For this MVP, we simulate running a "real" test provided by the project
            // In a production scenario, we would load test files from the repo

            const tests = [
                { name: 'Home page loads', url: config.baseUrl, selector: 'h1' },
                { name: 'Project list is visible', url: `${config.baseUrl}/`, selector: 'h2' },
            ]

            for (const test of tests) {
                try {
                    await page.goto(test.url, { waitUntil: 'networkidle' })
                    await page.waitForSelector(test.selector, { timeout: 5000 })
                    results.push({ name: test.name, status: 'passed' })
                } catch (error: any) {
                    const snapshot = await this.captureFailure(page, test.name, testRunId)
                    results.push({
                        name: test.name,
                        status: 'failed',
                        error: error.message,
                        ...snapshot
                    })
                }
            }

            await context.close()
            await this.updateTestRun(testRunId, results)
            return results

        } catch (error) {
            console.error('Test execution failed:', error)
            throw error
        }
    }

    private async captureFailure(page: Page, testName: string, testRunId: string) {
        const timestamp = Date.now()
        const screenshotDir = path.join(process.cwd(), 'public', 'screenshots', testRunId)

        if (!fs.existsSync(screenshotDir)) {
            fs.mkdirSync(screenshotDir, { recursive: true })
        }

        const screenshotPath = `/screenshots/${testRunId}/${testName.replace(/\s+/g, '_')}_${timestamp}.png`
        await page.screenshot({ path: path.join(process.cwd(), 'public', screenshotPath) })

        const domSnapshot = await page.content()

        // Record screenshot in DB
        await db.screenshot.create({
            data: {
                testRunId,
                testName,
                type: 'error',
                path: screenshotPath,
            }
        })

        return { screenshotPath, domSnapshot }
    }

    private async updateTestRun(testRunId: string, results: TestResult[]) {
        const passed = results.filter(r => r.status === 'passed').length
        const failed = results.filter(r => r.status === 'failed').length

        await db.testRun.update({
            where: { id: testRunId },
            data: {
                status: failed > 0 ? TestStatus.FAILED : TestStatus.PASSED,
                passedTests: passed,
                failedTests: failed,
                finishedAt: new Date(),
                duration: 0, // Should calculate real duration
            }
        })
    }
}

export const testRunner = new TestRunner()
