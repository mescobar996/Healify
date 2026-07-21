import { test } from '../../src/fixture'

// Deliberately run WITHOUT HEALIFY_API_KEY set (see tests/playwright.no-key.config.ts
// and tests/verify-no-key.mjs). Fails the same way as fixtures/sample.spec.ts, but here
// we assert the fixture must NOT attach healify-dom, since the reporter is disabled.
test('fails on purpose with no API key so the fixture must NOT capture the DOM', async ({ page }) => {
  await page.setContent('<html><body><button id="real-button">Click me</button></body></html>')
  await page.click('#does-not-exist', { timeout: 1000 })
})
