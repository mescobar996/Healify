import { test, expect } from '@playwright/test'
import { ShopPage } from '../pages/shop.page'

/**
 * Notá que en este archivo **no hay un solo selector**. Todos viven en `pages/shop.page.ts`.
 * Así se escribe e2e en la vida real, y así es como `healify fix` se quedaba sin nada que
 * hacer antes de la 2.0.0.
 */
test('agrega un producto al carrito', async ({ page }) => {
  const shop = new ShopPage(page)

  await page.goto('/')
  await shop.setQuantity(2)
  await shop.addToCart() // 💥 acá revienta: el id del botón cambió en el último deploy

  expect(await shop.cartStatus()).toBe('2 en el carrito')
})
