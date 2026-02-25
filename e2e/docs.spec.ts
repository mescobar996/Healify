import { test, expect } from '@playwright/test'

test.describe('Documentation Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/docs')
  })

  test('renders docs header with Documentation badge', async ({ page }) => {
    await expect(page.getByText('Documentation', { exact: false }).first()).toBeVisible()
  })

  test('Quick Start section is visible by default', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /quick start/i })).toBeVisible()
  })

  test('API Reference section has endpoint table', async ({ page }) => {
    const section = page.locator('#api-reference')
    await section.scrollIntoViewIfNeeded()
    await expect(section.getByText('POST /api/v1/report')).toBeVisible()

    // Request body table should have required fields
    await expect(section.getByText('testName')).toBeVisible()
    await expect(section.getByText('selector')).toBeVisible()
    await expect(section.getByText('error')).toBeVisible()
  })

  test('Playwright section has code examples', async ({ page }) => {
    const section = page.locator('#playwright')
    await section.scrollIntoViewIfNeeded()
    await expect(
      section.getByRole('heading', { name: /playwright integration/i })
    ).toBeVisible()
  })

  test('sidebar navigation links exist', async ({ page }) => {
    // Only visible on large screens
    const viewportSize = page.viewportSize()
    if (viewportSize && viewportSize.width >= 1024) {
      await expect(page.getByRole('link', { name: /quick start/i })).toBeVisible()
      await expect(page.getByRole('link', { name: /api reference/i })).toBeVisible()
      await expect(page.getByRole('link', { name: /rate limits/i })).toBeVisible()
    }
  })

  test('rate limits section shows 60 req/min', async ({ page }) => {
    const section = page.locator('#rate-limits')
    await section.scrollIntoViewIfNeeded()
    await expect(section.getByText('60 requests')).toBeVisible()
  })

  test('CTA section links to dashboard', async ({ page }) => {
    const cta = page.getByRole('link', { name: /go to dashboard/i })
    await cta.scrollIntoViewIfNeeded()
    await expect(cta).toBeVisible()
    await expect(cta).toHaveAttribute('href', '/dashboard/projects')
  })
})
