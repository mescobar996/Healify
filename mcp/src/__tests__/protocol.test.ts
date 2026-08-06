import { describe, it, expect } from 'vitest'
import {
  handleMessage,
  parseLine,
  createLineReader,
  DEFAULT_PROTOCOL_VERSION,
  type JsonRpcRequest,
  type ToolDefinition,
} from '../protocol'

const SERVER_INFO = { name: 'healify', version: '0.1.0' }

const TOOLS: ToolDefinition[] = [
  {
    name: 'eco',
    description: 'devuelve lo que le mandan',
    inputSchema: { type: 'object', properties: { texto: { type: 'string' } }, required: ['texto'] },
    handler: (args) => String(args.texto),
  },
  {
    name: 'explota',
    description: 'siempre falla',
    inputSchema: { type: 'object', properties: {} },
    handler: () => {
      throw new Error('algo salió mal')
    },
  },
  {
    name: 'lento',
    description: 'asíncrono',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => 'listo',
  },
]

function req(method: string, params?: Record<string, unknown>, id: string | number = 1): JsonRpcRequest {
  return { jsonrpc: '2.0', id, method, params }
}

describe('handleMessage', () => {
  it('initialize devuelve capabilities de tools y los datos del servidor', async () => {
    const res = await handleMessage(req('initialize', { protocolVersion: '2025-06-18' }), TOOLS, SERVER_INFO)

    expect(res).toMatchObject({
      jsonrpc: '2.0',
      id: 1,
      result: { protocolVersion: '2025-06-18', capabilities: { tools: {} }, serverInfo: SERVER_INFO },
    })
  })

  it('initialize sin versión del cliente usa la propia', async () => {
    const res = await handleMessage(req('initialize', {}), TOOLS, SERVER_INFO)
    expect((res!.result as Record<string, unknown>).protocolVersion).toBe(DEFAULT_PROTOCOL_VERSION)
  })

  it('una notificación no recibe respuesta', async () => {
    // Contestarle a un mensaje sin id es un error de protocolo. Los clientes que lo reciben
    // suelen cortar la conexión, así que esto no es un detalle cosmético.
    const res = await handleMessage(
      { jsonrpc: '2.0', method: 'notifications/initialized' } as JsonRpcRequest,
      TOOLS,
      SERVER_INFO
    )
    expect(res).toBeNull()
  })

  it('tools/list expone nombre, descripción y schema — nunca el handler', async () => {
    const res = await handleMessage(req('tools/list'), TOOLS, SERVER_INFO)
    const tools = (res!.result as { tools: Record<string, unknown>[] }).tools

    expect(tools).toHaveLength(3)
    expect(Object.keys(tools[0]).sort()).toEqual(['description', 'inputSchema', 'name'])
  })

  it('tools/call devuelve el texto como content', async () => {
    const res = await handleMessage(req('tools/call', { name: 'eco', arguments: { texto: 'hola' } }), TOOLS, SERVER_INFO)
    expect(res!.result).toEqual({ content: [{ type: 'text', text: 'hola' }] })
  })

  it('un handler que tira devuelve isError, no un error de JSON-RPC', async () => {
    // El protocolo distingue "la herramienta falló" (el agente lo lee y reacciona) de "el
    // mensaje estaba mal formado". Devolverlo como error de transporte le esconde al agente
    // qué pasó y lo deja sin nada que hacer.
    const res = await handleMessage(req('tools/call', { name: 'explota' }), TOOLS, SERVER_INFO)

    expect(res!.error).toBeUndefined()
    expect(res!.result).toEqual({ content: [{ type: 'text', text: 'algo salió mal' }], isError: true })
  })

  it('soporta handlers asíncronos', async () => {
    const res = await handleMessage(req('tools/call', { name: 'lento' }), TOOLS, SERVER_INFO)
    expect(res!.result).toEqual({ content: [{ type: 'text', text: 'listo' }] })
  })

  it('una herramienta desconocida es un error de parámetros', async () => {
    const res = await handleMessage(req('tools/call', { name: 'no-existe' }), TOOLS, SERVER_INFO)
    expect(res!.error?.code).toBe(-32602)
    expect(res!.error?.message).toContain('no-existe')
  })

  it('tools/call sin nombre es un error de parámetros', async () => {
    const res = await handleMessage(req('tools/call', {}), TOOLS, SERVER_INFO)
    expect(res!.error?.code).toBe(-32602)
  })

  it('un método desconocido devuelve method not found', async () => {
    const res = await handleMessage(req('resources/list'), TOOLS, SERVER_INFO)
    expect(res!.error?.code).toBe(-32601)
  })

  it('responde ping', async () => {
    const res = await handleMessage(req('ping'), TOOLS, SERVER_INFO)
    expect(res!.result).toEqual({})
  })

  it('conserva el id del pedido, sea número o string', async () => {
    const res = await handleMessage(req('ping', undefined, 'abc-123'), TOOLS, SERVER_INFO)
    expect(res!.id).toBe('abc-123')
  })
})

describe('parseLine', () => {
  it('ignora líneas vacías, JSON roto y objetos sin method', () => {
    expect(parseLine('')).toBeNull()
    expect(parseLine('   ')).toBeNull()
    expect(parseLine('{no es json')).toBeNull()
    expect(parseLine('null')).toBeNull()
    expect(parseLine('{"jsonrpc":"2.0","id":1}')).toBeNull()
  })

  it('parsea un mensaje válido', () => {
    expect(parseLine('{"jsonrpc":"2.0","id":1,"method":"ping"}')).toMatchObject({ method: 'ping', id: 1 })
  })
})

describe('createLineReader', () => {
  it('junta un mensaje partido en varios chunks', () => {
    // stdin llega en pedazos arbitrarios: sin buffer, un mensaje partido al medio se pierde.
    const lineas: string[] = []
    const feed = createLineReader((l) => lineas.push(l))

    feed('{"jsonrpc":"2.0",')
    expect(lineas).toEqual([])
    feed('"id":1,"method":"ping"}\n')

    expect(lineas).toEqual(['{"jsonrpc":"2.0","id":1,"method":"ping"}'])
  })

  it('separa varios mensajes que llegan en un solo chunk', () => {
    const lineas: string[] = []
    const feed = createLineReader((l) => lineas.push(l))

    feed('uno\ndos\ntres\n')

    expect(lineas).toEqual(['uno', 'dos', 'tres'])
  })

  it('no emite una línea hasta que llega su salto', () => {
    const lineas: string[] = []
    const feed = createLineReader((l) => lineas.push(l))

    feed('sin salto todavia')

    expect(lineas).toEqual([])
  })
})
