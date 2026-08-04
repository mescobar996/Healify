[← Documentación](README.md) · [Healify](../README.md)

---

# Instalación

> Cómo enchufar Healify a tu runner. Elegí el tuyo y copiá el snippet — es lo único que hay que agregar.

```bash
npm i -D @healify/cli
npx @healify/cli@latest doctor
npx @healify/cli@latest init
npx @healify/cli@latest fix --dry-run
```

## Playwright

```bash
npm i -D @healify/cli @healify/test-runner
```

En `playwright.config.ts`:

```typescript
import { defineConfig } from '@playwright/test'

export default defineConfig({
  reporter: [['@healify/test-runner/reporter', {}]],
})
```

## Cypress

```bash
npm i -D @healify/cypress-plugin
```

En `cypress.config.ts`:

```typescript
import { defineConfig } from 'cypress'
import { HealifyCypressPlugin } from '@healify/cypress-plugin'

export default defineConfig({
  e2e: {
    setupNodeEvents(on, config) {
      return HealifyCypressPlugin(on, config)
    },
  },
})
```

## Selenium

```bash
npm i -D @healify/selenium-plugin
```

```typescript
import { HealifySeleniumPlugin } from '@healify/selenium-plugin'
import { Builder } from 'selenium-webdriver'

const plugin = new HealifySeleniumPlugin()
const driver = await new Builder().forBrowser('chrome').build()
const wrappedDriver = plugin.wrap(driver)

// Usar wrappedDriver en vez de driver
await wrappedDriver.findElement(By.css('#submit'))
// Si #submit falla, Healify propone un alternativo

// Al final del test
plugin.flush() // escribe healify-report.json
```

## WebdriverIO

```bash
npm i -D @healify/webdriverio-plugin
```

```typescript
import { HealifyWebdriverIOPlugin } from '@healify/webdriverio-plugin'

const plugin = new HealifyWebdriverIOPlugin()
const wrappedBrowser = plugin.wrap(browser)

// Usar wrappedBrowser en vez de browser
await wrappedBrowser.$('#submit').click()

// Al final del test
plugin.flush()
```
