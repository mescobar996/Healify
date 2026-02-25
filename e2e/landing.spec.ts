import { test, expect } from '@playwright/test'

test.describe('Landing Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('renders hero headline and CTA', async ({ page }) => {
    // The typewriter renders this text
    await expect(page.locator('h1')).toBeVisible()

    // "Get Started Free" CTA button
    const cta = page.getByRole('button', { name: /get started free/i })
    await expect(cta).toBeVisible()
  })

  test('navbar has links to Docs and Pricing', async ({ page }) => {
    await expect(page.getByRole('link', { name: /docs/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /pricing/i })).toBeVisible()
  })

  test('features section is visible on scroll', async ({ page }) => {
    const features = page.getByText('Powerful Features')
    await features.scrollIntoViewIfNeeded()
    await expect(features).toBeVisible()
  })

  test('how it works section shows 3 steps', async ({ page }) => {
    const howItWorks = page.getByText('How it works')
    await howItWorks.scrollIntoViewIfNeeded()
    await expect(howItWorks).toBeVisible()

    // 3 steps: Connect, Detect, Heal
    await expect(page.getByText('Connect')).toBeVisible()
    await expect(page.getByText('Detect')).toBeVisible()
    await expect(page.getByText('Heal')).toBeVisible()
  })

  test('footer links are visible', async ({ page }) => {
    const footer = page.locator('footer')
    await footer.scrollIntoViewIfNeeded()
    await expect(footer.getByRole('link', { name: /documentation/i })).toBeVisible()
    await expect(footer.getByRole('link', { name: /github/i })).toBeVisible()
  })
})
