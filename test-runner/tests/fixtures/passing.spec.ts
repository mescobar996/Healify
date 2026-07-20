import { test } from '../../src/fixture'

test('passes, so the fixture must NOT capture the DOM', async ({ page }) => {
  await page.setContent('<html><body><button id="real-button">Click me</button></body></html>')
  await page.click('#real-button', { timeout: 1000 })
})
