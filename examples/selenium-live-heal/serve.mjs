import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/** Servidor estatico minimo, sin dependencias. En tu proyecto real esto es tu `npm run dev`. */
const PORT = 4323
createServer((_req, res) => {
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
  res.end(readFileSync(join(import.meta.dirname, 'app', 'index.html'), 'utf-8'))
}).listen(PORT, '127.0.0.1', () => console.log(`app del ejemplo en http://127.0.0.1:${PORT}`))
