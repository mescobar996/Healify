import { test as base } from '@playwright/test'

const MAX_DOM_CHARS = 8000
const ATTACHMENT_NAME = 'healify-dom'

/**
 * Drop-in replacement for `test` from '@playwright/test'. Captures the
 * page's HTML on failure and attaches it as `healify-dom`, which
 * HealifyReporter reads to send as `context` in the failure report.
 *
 * If capturing fails (page already closed/crashed), the error is swallowed —
 * the test already failed on its own; we must never add a second failure.
 */
export const test = base.extend({
  page: async ({ page }, use, testInfo) => {
    await use(page)

    if (testInfo.status !== testInfo.expectedStatus) {
      try {
        const html = await page.content()
        await testInfo.attach(ATTACHMENT_NAME, {
          body: html.slice(0, MAX_DOM_CHARS),
          contentType: 'text/html',
        })
      } catch {
        // Intentionally ignored — see doc comment above.
      }
    }
  },
})

export { expect } from '@playwright/test'
