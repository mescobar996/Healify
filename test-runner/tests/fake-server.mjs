import { createServer } from 'node:http'
import { writeFileSync } from 'node:fs'

const server = createServer((req, res) => {
  let body = ''
  req.on('data', (chunk) => { body += chunk })
  req.on('end', () => {
    writeFileSync('test-results/captured-request.json', JSON.stringify({
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: JSON.parse(body),
    }))
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ success: true }))
  })
})

server.listen(4567, () => {
  console.log('fake healify server listening on :4567')
})
