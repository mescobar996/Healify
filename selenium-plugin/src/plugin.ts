import type { WebDriver } from 'selenium-webdriver'
import { wrapDriver } from './wrap'
import type { HealifySeleniumOptions } from './types'

export class HealifySeleniumPlugin {
  private readonly options: HealifySeleniumOptions

  constructor(options: HealifySeleniumOptions = {}) {
    this.options = options
  }

  /** Devuelve un proxy sobre el driver — el original nunca se muta. */
  wrap(driver: WebDriver): WebDriver {
    return wrapDriver(driver, this.options)
  }
}
