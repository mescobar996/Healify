import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Servidor estático mínimo para el ejemplo. Sin dependencias a propósito: la gracia de este
 * repo es que se clone y ande con un solo `npm install`, sin arrastrar medio ecosistema para
 * servir un HTML.
 *
 * En un proyecto real esto es tu `npm run dev`.
 */
const PORT = 4321
const html = () => readFileSync(join(import.meta.dirname, 'app', 'index.html'), 'utf-8')

createServer((_req, res) => {
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
  res.end(html())
}).listen(PORT, '127.0.0.1', () => {
  console.log(`app del ejemplo en http://127.0.0.1:${PORT}`)
})
