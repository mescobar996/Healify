import { chromium, devices } from 'playwright'
import fs from 'node:fs/promises'
import path from 'node:path'

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000'
const OUT_DIR = path.resolve('public', 'screenshots', 'visual-audit')

const ROUTES = [
  '/',
  '/pricing',
  '/auth/signin',
  '/docs',
  '/support',
  '/refund',
  '/privacy',
  '/terms',
  '/dashboard',
  '/dashboard/projects',
  '/dashboard/tests',
  '/dashboard/settings',
]

const VIEWPORTS = [
  { name: 'desktop', viewport: { width: 1440, height: 2400 }, userAgent: devices['Desktop Chrome'].userAgent },
  { name: 'mobile', viewport: { width: 412, height: 2200 }, userAgent: devices['Pixel 7'].userAgent, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
]

const slugify = (route) => route === '/' ? 'home' : route.replace(/^\//, '').replaceAll('/', '-')

async function waitForReady(page) {
  await page.waitForLoadState('domcontentloaded')
  await page.waitForTimeout(900)
}

async function run() {
  await fs.mkdir(OUT_DIR, { recursive: true })

  const browser = await chromium.launch({ headless: true })

  try {
    for (const vp of VIEWPORTS) {
      const context = await browser.newContext({
        viewport: vp.viewport,
        userAgent: vp.userAgent,
        isMobile: vp.isMobile || false,
        hasTouch: vp.hasTouch || false,
        deviceScaleFactor: vp.deviceScaleFactor || 1,
      })

      const page = await context.newPage()

      for (const route of ROUTES) {
        const url = `${BASE_URL}${route}`
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 })
        await waitForReady(page)

        const file = path.join(OUT_DIR, `${vp.name}-${slugify(route)}.png`)
        await page.screenshot({ path: file, fullPage: true })
        console.log(`saved ${file}`)
      }

      await context.close()
    }
  } finally {
    await browser.close()
  }
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
