/**
 * MCP sobre stdio, implementado a mano.
 *
 * Por qué sin `@modelcontextprotocol/sdk`: seis de los siete paquetes de Healify tienen cero
 * dependencias de runtime, y la promesa del producto es que nada sale de tu máquina. El
 * transporte que hace falta es JSON-RPC 2.0 delimitado por saltos de línea sobre stdin/stdout,
 * con cuatro mensajes: `initialize`, `notifications/initialized`, `tools/list` y `tools/call`.
 * Eso entra en este archivo y se puede testear alimentándole líneas, sin levantar un cliente.
 *
 * Este módulo no sabe qué hace Healify: recibe una lista de herramientas y las despacha. La
 * separación es la misma que en la extensión de VS Code — el núcleo puro se testea solo, y la
 * capa que toca el mundo (stdin/stdout) queda tan fina que casi no tiene lógica.
 */

/** Versión del protocolo que se responde cuando el cliente no pide una. */
export const DEFAULT_PROTOCOL_VERSION = '2024-11-05'

export interface JsonRpcRequest {
  jsonrpc: '2.0'
  /** Ausente en las notificaciones — a esas no se les contesta nada. */
  id?: string | number
  method: string
  params?: Record<string, unknown>
}

export interface JsonRpcResponse {
  jsonrpc: '2.0'
  id: string | number
  result?: unknown
  error?: { code: number; message: string }
}

export interface ToolDefinition {
  name: string
  description: string
  /** JSON Schema de los argumentos, tal cual lo espera MCP. */
  inputSchema: Record<string, unknown>
  /** Devuelve el texto que ve el agente. Puede tirar: el error se traduce a `isError`. */
  handler: (args: Record<string, unknown>) => string | Promise<string>
}

export interface ServerInfo {
  name: string
  version: string
}

// Códigos de JSON-RPC 2.0.
const METHOD_NOT_FOUND = -32601
const INVALID_PARAMS = -32602
const INTERNAL_ERROR = -32603

function ok(id: string | number, result: unknown): JsonRpcResponse {
  return { jsonrpc: '2.0', id, result }
}

function fail(id: string | number, code: number, message: string): JsonRpcResponse {
  return { jsonrpc: '2.0', id, error: { code, message } }
}

/**
 * Contesta un mensaje. `null` significa "no se responde nada", que es lo correcto para las
 * notificaciones: contestarle a un mensaje sin `id` es un error de protocolo, no una cortesía.
 */
export async function handleMessage(
  message: JsonRpcRequest,
  tools: ToolDefinition[],
  serverInfo: ServerInfo
): Promise<JsonRpcResponse | null> {
  if (message.id === undefined) return null

  const { id, method, params } = message

  if (method === 'initialize') {
    // Se devuelve la versión que pidió el cliente cuando es una string: un servidor chico que
    // solo hace tools/* es compatible con todas las revisiones que importan, y forzar la
    // nuestra haría que clientes nuevos se desconecten sin motivo.
    const pedida = params?.protocolVersion
    return ok(id, {
      protocolVersion: typeof pedida === 'string' && pedida ? pedida : DEFAULT_PROTOCOL_VERSION,
      capabilities: { tools: {} },
      serverInfo,
    })
  }

  if (method === 'tools/list') {
    return ok(id, {
      tools: tools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
    })
  }

  if (method === 'tools/call') {
    const name = params?.name
    if (typeof name !== 'string') return fail(id, INVALID_PARAMS, 'Falta el nombre de la herramienta.')

    const tool = tools.find((t) => t.name === name)
    if (!tool) return fail(id, INVALID_PARAMS, `Herramienta desconocida: ${name}`)

    const args = (params?.arguments ?? {}) as Record<string, unknown>
    try {
      const text = await tool.handler(args)
      return ok(id, { content: [{ type: 'text', text }] })
    } catch (error) {
      // Un error de la herramienta NO es un error de JSON-RPC: el protocolo distingue "la
      // llamada falló" (isError, y el agente lo lee y reacciona) de "el mensaje estaba mal".
      // Devolverlo como error de transporte le esconde al agente lo que pasó.
      return ok(id, {
        content: [{ type: 'text', text: error instanceof Error ? error.message : String(error) }],
        isError: true,
      })
    }
  }

  if (method === 'ping') return ok(id, {})

  return fail(id, METHOD_NOT_FOUND, `Método no soportado: ${method}`)
}

/**
 * Parsea una línea. Devuelve `null` si no es JSON válido o no parece un mensaje JSON-RPC —
 * una línea rota no puede tirar abajo el servidor, misma política que `parseHistoryLines`.
 */
export function parseLine(line: string): JsonRpcRequest | null {
  const trimmed = line.trim()
  if (!trimmed) return null
  try {
    const parsed = JSON.parse(trimmed)
    if (!parsed || typeof parsed !== 'object') return null
    if (typeof parsed.method !== 'string') return null
    return parsed as JsonRpcRequest
  } catch {
    return null
  }
}

/**
 * Acumula lo que llega por stdin y emite mensajes completos por línea. stdin llega en chunks
 * arbitrarios: un mensaje puede venir partido en dos, o dos mensajes en un solo chunk.
 */
export function createLineReader(onLine: (line: string) => void): (chunk: string) => void {
  let buffer = ''
  return (chunk: string) => {
    buffer += chunk
    let idx: number
    while ((idx = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, idx)
      buffer = buffer.slice(idx + 1)
      onLine(line)
    }
  }
}

export { INTERNAL_ERROR, INVALID_PARAMS, METHOD_NOT_FOUND }
