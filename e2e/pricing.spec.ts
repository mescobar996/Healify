import { test, expect } from '@playwright/test'

test.describe('Pricing Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/pricing')
  })

  test('renders pricing headline', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: /heal your tests/i })
    ).toBeVisible()
  })

  test('shows transparent pricing badge', async ({ page }) => {
    await expect(page.getByText(/simple, transparent pricing/i)).toBeVisible()
  })

  test('back link navigates to home', async ({ page }) => {
    const backLink = page.getByRole('link', { name: /volver/i })
    await expect(backLink).toBeVisible()
    await expect(backLink).toHaveAttribute('href', '/')
  })

  test('footer documentation link goes to /docs', async ({ page }) => {
    const footer = page.locator('footer')
    await footer.scrollIntoViewIfNeeded()
    const docsLink = footer.getByRole('link', { name: /documentation/i })
    await expect(docsLink).toHaveAttribute('href', '/docs')
  })
})
