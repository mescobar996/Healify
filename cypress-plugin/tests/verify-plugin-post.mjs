import { readFileSync } from 'node:fs'

const captured = JSON.parse(readFileSync('captured-request.json', 'utf-8'))

if (captured.method !== 'POST') {
  console.error(`FAIL: expected POST, got ${captured.method}`)
  process.exit(1)
}
if (captured.url !== '/api/v1/report') {
  console.error(`FAIL: expected /api/v1/report, got ${captured.url}`)
  process.exit(1)
}
if (captured.headers['x-api-key'] !== 'hf_live_faketest') {
  console.error(`FAIL: expected x-api-key hf_live_faketest, got ${captured.headers['x-api-key']}`)
  process.exit(1)
}
if (captured.body.selector !== '#does-not-exist') {
  console.error(`FAIL: expected selector '#does-not-exist', got ${captured.body.selector}`)
  process.exit(1)
}

console.log('PASS: HealifyCypressPlugin posted the expected payload to the fake server')
