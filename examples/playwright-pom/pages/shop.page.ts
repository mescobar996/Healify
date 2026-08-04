import type { Page } from '@playwright/test'

/**
 * Page Object de la tienda.
 *
 * Acá está el punto entero del ejemplo: **los selectores viven en este archivo, no en el
 * spec**. Es la arquitectura estándar de e2e, y es exactamente el caso donde `healify fix`
 * antes se rendía — buscaba el selector solo en el archivo de test, no lo encontraba, y
 * reportaba "no se encontró en el archivo" para absolutamente todo.
 *
 * Desde 2.0.0, cuando el selector no está en el spec, `fix` lo busca en el resto del código
 * del proyecto y aplica el cambio acá, diciéndote en qué archivo lo tocó.
 */
export class ShopPage {
  // ⬇️ El selector que se rompe. El id lo genera el bundler y cambia en cada build.
  //    Después de correr `healify fix`, esta línea queda apuntando a algo estable.
  readonly addToCartSelector = '#buy-btn-a1b2c3'

  readonly quantitySelector = '#qty'
  readonly cartStatusSelector = '#cart-status'

  constructor(private readonly page: Page) {}

  async setQuantity(quantity: number): Promise<void> {
    await this.page.fill(this.quantitySelector, String(quantity))
  }

  async addToCart(): Promise<void> {
    await this.page.click(this.addToCartSelector)
  }

  async cartStatus(): Promise<string> {
    return (await this.page.textContent(this.cartStatusSelector)) ?? ''
  }
}
