import { handleMessage, parseLine, createLineReader, type ToolDefinition, type ServerInfo } from './protocol'

/**
 * La capa que toca el mundo: stdin, stdout, stderr. Deliberadamente fina — todo lo que se
 * puede testear sin procesos vive en `protocol.ts` y `tools.ts`.
 *
 * Una sola regla que no se puede romper: **en stdout solo van mensajes JSON-RPC**. Un
 * `console.log` suelto acá corrompe el stream y el cliente MCP se desconecta sin decir por qué.
 * Cualquier cosa para humanos va a stderr.
 */
export interface ServerIO {
  stdin: NodeJS.ReadableStream
  stdout: { write: (chunk: string) => unknown }
  stderr: { write: (chunk: string) => unknown }
}

export function startServer(tools: ToolDefinition[], serverInfo: ServerInfo, io: ServerIO): void {
  const escribir = (response: unknown): void => {
    io.stdout.write(JSON.stringify(response) + '\n')
  }

  // Las respuestas se encolan: un handler asíncrono no puede adelantarse a otro y dejar el
  // stream intercalado. JSON-RPC permite responder fuera de orden, pero serializar la escritura
  // hace el comportamiento reproducible y los tests deterministas.
  let cola: Promise<void> = Promise.resolve()

  const alRecibirLinea = (line: string): void => {
    const message = parseLine(line)
    if (!message) return

    cola = cola.then(async () => {
      try {
        const response = await handleMessage(message, tools, serverInfo)
        if (response) escribir(response)
      } catch (error) {
        io.stderr.write(`healify-mcp: error inesperado — ${error instanceof Error ? error.message : String(error)}\n`)
      }
    })
  }

  const alimentar = createLineReader(alRecibirLinea)

  io.stdin.setEncoding?.('utf-8')
  io.stdin.on('data', (chunk: string | Buffer) => alimentar(typeof chunk === 'string' ? chunk : chunk.toString('utf-8')))
}
