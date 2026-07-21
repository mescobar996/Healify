/**
 * Cliente para un LLM open-source corriendo localmente vía Ollama
 * (https://ollama.com) — reemplaza la dependencia de la API de Claude.
 *
 * Requiere tener Ollama instalado y el modelo descargado:
 *   ollama pull qwen2.5-coder:7b
 *   ollama serve   (por defecto en http://localhost:11434)
 */

// No default a localhost: en entornos serverless (Vercel) "localhost" es el
// propio contenedor, nunca la máquina del desarrollador — un default silencioso
// haría que cada request intente conectarse durante REQUEST_TIMEOUT_MS a algo
// que nunca va a responder. Solo se intenta el LLM local si el entorno lo
// configuró explícitamente.
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5-coder:7b'
const REQUEST_TIMEOUT_MS = 30_000

export interface LocalLLMParams {
  system: string
  prompt: string
  temperature?: number
  maxTokens?: number
}

/** True si este entorno configuró explícitamente un LLM local (OLLAMA_BASE_URL). */
export function isLocalLLMConfigured(): boolean {
  return !!OLLAMA_BASE_URL
}

/**
 * Envía un chat completion a Ollama y devuelve el texto de la respuesta.
 * Lanza inmediatamente (sin intentar red) si OLLAMA_BASE_URL no está seteada
 * — evita que un entorno sin Ollama (ej. producción en Vercel) se quede
 * REQUEST_TIMEOUT_MS por request tratando de alcanzar un host inexistente.
 * También lanza si Ollama no está corriendo, el modelo no está descargado, o
 * la respuesta no trae contenido — el llamador decide qué hacer con eso
 * (en healing-service.ts, cae al fallback determinístico).
 */
export async function generateText(params: LocalLLMParams): Promise<string> {
  if (!OLLAMA_BASE_URL) {
    throw new Error('OLLAMA_BASE_URL no está configurada en este entorno — LLM local deshabilitado')
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        stream: false,
        messages: [
          { role: 'system', content: params.system },
          { role: 'user', content: params.prompt },
        ],
        options: {
          temperature: params.temperature ?? 0.2,
          num_predict: params.maxTokens ?? 512,
        },
      }),
      signal: controller.signal,
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`Ollama respondió ${res.status}: ${body.slice(0, 200)}`)
    }

    const data = (await res.json()) as { message?: { content?: string } }
    const content = data.message?.content
    if (typeof content !== 'string' || !content.trim()) {
      throw new Error('Ollama devolvió una respuesta sin contenido')
    }
    return content
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Ollama no respondió en ${REQUEST_TIMEOUT_MS}ms (¿está corriendo "ollama serve"?)`)
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

/** Extrae el primer bloque JSON válido de un texto (tolera fences ```json). */
export function extractJson<T = unknown>(text: string): T {
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('No se encontró JSON en la respuesta del modelo')
  return JSON.parse(jsonMatch[0]) as T
}
