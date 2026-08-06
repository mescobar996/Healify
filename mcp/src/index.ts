#!/usr/bin/env node
import { startServer } from './server'
import { TOOLS } from './tools'

/**
 * `healify-mcp` — servidor MCP de Healify, por stdio.
 *
 * Se configura en el cliente MCP (Claude Desktop, Claude Code, Cursor) apuntando a este binario
 * con el `cwd` del proyecto de tests. No abre puertos, no habla con la red y no necesita ninguna
 * credencial: todo lo que responde sale de heurística determinista y de archivos que ya están
 * en la máquina.
 */
const VERSION = '0.1.0'

startServer(TOOLS, { name: 'healify', version: VERSION }, {
  stdin: process.stdin,
  stdout: process.stdout,
  stderr: process.stderr,
})

// El proceso vive mientras el cliente mantenga stdin abierto; cuando lo cierra, se termina.
process.stdin.on('end', () => process.exit(0))
