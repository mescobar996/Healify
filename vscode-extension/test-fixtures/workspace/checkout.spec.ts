// Fixture de los tests de integración. Cada selector cubre un caso distinto:
//
//   #buy-btn-a1b2c3  → está en healify-report.json como healed + verified → Error + Quick Fix
//   //div[3]/button  → XPath posicional, sin reporte → Warning, sin fix
//   [data-testid=x]  → estable, no se marca
//
// No usa @playwright/test de verdad a propósito: no hace falta que compile ni corra, solo que
// VS Code lo abra como TypeScript.
declare const page: {
  click(selector: string): Promise<void>
  locator(selector: string): unknown
}

export async function checkout(): Promise<void> {
  await page.click('#buy-btn-a1b2c3')
  await page.click('//div[3]/button')
  await page.click('[data-testid="confirmar"]')
}
