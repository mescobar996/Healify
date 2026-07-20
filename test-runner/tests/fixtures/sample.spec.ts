import { test } from '../../src/fixture'

test('fails on purpose so the fixture captures the DOM', async ({ page }) => {
  await page.setContent('<html><body><button id="real-button">Click me</button></body></html>')
  await page.click('#does-not-exist', { timeout: 1000 })
})
