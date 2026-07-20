import { readFileSync } from 'node:fs'

const report = JSON.parse(readFileSync('test-results/report.json', 'utf-8'))

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

const failedResult = findResult('fails on purpose')
const attachment = failedResult.attachments.find((a) => a.name === 'healify-dom')

if (!attachment) {
  console.error('FAIL: no healify-dom attachment found on the failed test')
  process.exit(1)
}
if (!attachment.body) {
  console.error('FAIL: healify-dom attachment has no body')
  process.exit(1)
}
const html = Buffer.from(attachment.body, 'base64').toString('utf-8')
if (!html.includes('real-button')) {
  console.error(`FAIL: captured DOM does not contain expected content. Got: ${html}`)
  process.exit(1)
}

const passedResult = findResult('passes, so the fixture must NOT capture')
const passedAttachment = passedResult.attachments.find((a) => a.name === 'healify-dom')
if (passedAttachment) {
  console.error('FAIL: healify-dom attachment should NOT exist on a passing test')
  process.exit(1)
}

console.log('PASS: healify-dom attached on failure, absent on success')
