import type { Reporter, TestCase, TestResult } from '@playwright/test/reporter'
import { resolveConfig, reportFailure, extractSelectorFromError, type HealifyConfig } from '@healify/reporter-core'

const ATTACHMENT_NAME = 'healify-dom'

export default class HealifyReporter implements Reporter {
  private config: HealifyConfig | null

  constructor() {
    this.config = resolveConfig()
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    if (!this.config) return
    if (result.status !== 'failed' && result.status !== 'timedOut') return

    const errorMessage = result.error?.message ?? result.errors[0]?.message ?? 'Unknown error'
    const domAttachment = result.attachments.find((a) => a.name === ATTACHMENT_NAME)
    const context = domAttachment?.body?.toString('utf-8')

    void reportFailure(this.config, {
      testName: test.titlePath().filter(Boolean).join(' > '),
      testFile: test.location.file,
      selector: extractSelectorFromError(errorMessage),
      error: errorMessage,
      context,
    })
  }
}
