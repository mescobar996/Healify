import { Builder, By } from 'selenium-webdriver'
import chrome from 'selenium-webdriver/chrome.js'
import { HealifySeleniumPlugin } from '@healify/selenium-plugin'

/**
 * El punto de este ejemplo: **no se toca el test**.
 *
 * `plugin.wrap(driver)` devuelve el mismo driver de siempre. La única diferencia aparece
 * cuando un `findElement` no encuentra nada: ahí Healify sondea el DOM real (atravesando
 * shadow roots abiertos) y reintenta con lo que encontró de verdad, en vez de tirar
 * NoSuchElementError.
 *
 * El botón que busca este test vive dentro del shadow root de `<save-panel>`, y su id cambió.
 */
const plugin = new HealifySeleniumPlugin()

const options = new chrome.Options().addArguments('--headless=new', '--no-sandbox')
const driver = await new Builder().forBrowser('chrome').setChromeOptions(options).build()

// ⬇️ Lo único que se agrega en un proyecto real.
const healed = plugin.wrap(driver)

try {
  await healed.get('http://127.0.0.1:4323')

  await (await healed.findElement(By.css('#nombre'))).clear()
  await (await healed.findElement(By.css('#nombre'))).sendKeys('Mi proyecto')

  // 💥 El id real es #save-btn-4f2a9c. Este ya no existe, y además el botón está dentro
  //    de un shadow root: document.querySelector no lo encuentra ni con el id correcto.
  await (await healed.findElement(By.css('#save-btn-a1b2c3'))).click()

  const estado = await (await healed.findElement(By.css('#estado'))).getText()

  if (estado !== 'Cambios guardados') {
    console.error(`FALLO: se esperaba "Cambios guardados" y se obtuvo "${estado}"`)
    process.exitCode = 1
  } else {
    console.log('OK: el test paso con el selector roto — Healify lo curo en vivo')
  }
} catch (error) {
  console.error('FALLO:', error.message)
  process.exitCode = 1
} finally {
  await driver.quit()
  plugin.flush() // escribe healify-report.json con lo que se curo
}
