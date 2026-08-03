import { mkdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import type { Page, TestInfo } from '@playwright/test'

const SCREENSHOTS_DIR = 'screenshots'

/**
 * Captures a screenshot of the current page state and saves it to the screenshots directory.
 *
 * This helper is designed to be used in afterEach hooks to capture evidence when tests fail.
 * The screenshot is both saved to disk and attached to the test info for reporter access.
 *
 * @param page - The Playwright Page object
 * @param testInfo - The Playwright TestInfo object
 * @returns The relative path to the saved screenshot, or undefined if capture failed
 *
 * @example
 * ```ts
 * import { test, expect, captureScreenshot } from '@healify/test-runner'
 *
 * test.afterEach(async ({ page }, testInfo) => {
 *   if (testInfo.status !== testInfo.expectedStatus) {
 *     await captureScreenshot(page, testInfo)
 *   }
 * })
 * ```
 */
export async function captureScreenshot(
  page: Page,
  testInfo: TestInfo
): Promise<string | undefined> {
  try {
    const screenshotsDir = join(process.cwd(), SCREENSHOTS_DIR)
    mkdirSync(screenshotsDir, { recursive: true })

    const sanitizedName = testInfo.title
      .replace(/[^a-zA-Z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase()

    const filename = `${sanitizedName}-${Date.now()}.png`
    const fullPath = join(screenshotsDir, filename)

    const screenshot = await page.screenshot({ path: fullPath, fullPage: true })

    await testInfo.attach('healify-screenshot', {
      body: screenshot,
      contentType: 'image/png',
    })

    return relative(process.cwd(), fullPath).replace(/\\/g, '/')
  } catch {
    return undefined
  }
}
