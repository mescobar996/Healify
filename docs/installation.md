[← Documentation](README.md) · [Healify](../README.md) · [Español](installation.es.md)

---

# Installation

> How to wire Healify into your runner. Pick yours and copy the snippet — that's the only thing you need to add.

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

In `playwright.config.ts`:

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

In `cypress.config.ts`:

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

// Use wrappedDriver instead of driver
await wrappedDriver.findElement(By.css('#submit'))
// If #submit fails, Healify proposes an alternative

// At the end of the test
plugin.flush() // writes healify-report.json
```

## WebdriverIO

```bash
npm i -D @healify/webdriverio-plugin
```

```typescript
import { HealifyWebdriverIOPlugin } from '@healify/webdriverio-plugin'

const plugin = new HealifyWebdriverIOPlugin()
const wrappedBrowser = plugin.wrap(browser)

// Use wrappedBrowser instead of browser
await wrappedBrowser.$('#submit').click()

// At the end of the test
plugin.flush()
```
