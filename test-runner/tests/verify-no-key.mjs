import { readFileSync } from 'node:fs'

// Proves the fix for: fixture.ts must be a total no-op (no DOM capture, no
// healify-dom attachment) when HEALIFY_API_KEY is unset, per design spec §5
// ("No-op sin API key ... cero overhead"). Must be run against a test run
// executed WITHOUT HEALIFY_API_KEY set (see playwright.no-key.config.ts).

if (process.env.HEALIFY_API_KEY) {
  console.error('FAIL: HEALIFY_API_KEY is set in this shell — this check requires it to be unset')
  process.exit(1)
}

const report = JSON.parse(readFileSync('test-results/report-no-key.json', 'utf-8'))

function findResult(titleSubstring) {
  for (const suite of report.suites) {
    for (const spec of suite.specs) {
      if (spec.title.includes(titleSubstring)) {
        return spec.tests[0].results[0]
      }
    }
  }
  throw new Error(`No spec found matching "${titleSubstring}"`)
}

const failedResult = findResult('fails on purpose with no API key')
if (failedResult.status !== 'failed' && failedResult.status !== 'timedOut') {
  console.error(`FAIL: expected test to fail, got status "${failedResult.status}"`)
  process.exit(1)
}

const attachment = failedResult.attachments.find((a) => a.name === 'healify-dom')
if (attachment) {
  console.error('FAIL: healify-dom attachment should NOT exist when HEALIFY_API_KEY is unset')
  process.exit(1)
}

console.log('PASS: no healify-dom attachment when HEALIFY_API_KEY is unset, even on failure')
