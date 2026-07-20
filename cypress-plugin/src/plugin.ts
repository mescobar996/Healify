import { resolveConfig, reportFailure, extractSelectorFromError } from '@healify/reporter-core'

export function HealifyCypressPlugin(
  on: Cypress.PluginEvents,
  config: Cypress.PluginConfigOptions
): Cypress.PluginConfigOptions {
  const healifyConfig = resolveConfig()
  if (!healifyConfig) return config

  on('after:spec', async (spec, results) => {
    const reports = (results.tests ?? [])
      .filter((test) => test.state === 'failed')
      .map((test) => {
        const errorMessage = test.displayError ?? 'Unknown error'
        return reportFailure(healifyConfig, {
          testName: test.title.join(' > '),
          testFile: spec.relative,
          selector: extractSelectorFromError(errorMessage),
          error: errorMessage,
        })
      })
    await Promise.allSettled(reports)
  })

  return config
}
