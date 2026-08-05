/**
 * Cliente mínimo de la API de Jira Cloud, con `fetch` y sin dependencias.
 *
 * Mismo patrón que `gh-action/github-api.js`: `fetchImpl` inyectable para tests, Node 18+ ya
 * trae `fetch` global. Solo se usan tres endpoints de la API v3 (search, create issue, comment),
 * todos contra la instancia del usuario con sus credenciales — nunca contra una nube de Healify.
 */
import type { ResolvedAgileConfig } from './config'

export interface CreateIssueInput {
  project: string
  issueType: string
  summary: string
  description: string
  priority: string
  labels: string[]
}

/** Sin barra final: `https://acme.atlassian.net` + `/rest/...`. */
function apiBase(config: ResolvedAgileConfig): string {
  return (config.baseUrl ?? '').replace(/\/+$/, '')
}

function basicAuth(config: ResolvedAgileConfig): string {
  return `Basic ${Buffer.from(`${config.email}:${config.apiToken}`).toString('base64')}`
}

/** Escapa comillas/backslashes para meter un valor en un string de JQL. */
function jqlEscape(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

/**
 * Convierte texto plano a Atlassian Document Format.
 *
 * No es opcional ni cosmético: la API v3 **rechaza un string** en `description` y en el cuerpo
 * de los comentarios con un 400 (`"Operation value must be an Atlassian Document"`). Es la
 * diferencia principal entre la v2 y la v3, y el motivo por el que este cliente nunca pudo
 * crear un ticket — algo que 19 tests con el `fetch` mockeado no podían detectar, porque el
 * mock aceptaba cualquier cosa que se le mandara.
 *
 * https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issues/
 *
 * Las líneas en blanco separan párrafos; dentro de cada párrafo los saltos van como
 * `hardBreak`, que es como ADF representa un salto de línea sin abrir un párrafo nuevo.
 */
export function toAdf(text: string): Record<string, unknown> {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((block) => block.split('\n').filter((line) => line.length > 0))
    .filter((lines) => lines.length > 0)

  const content = paragraphs.map((lines) => ({
    type: 'paragraph',
    content: lines.flatMap((line, i) =>
      // ADF no acepta un nodo `text` con string vacío, por eso las líneas vacías ya se
      // filtraron arriba.
      i === 0 ? [{ type: 'text', text: line }] : [{ type: 'hardBreak' }, { type: 'text', text: line }]
    ),
  }))

  return {
    type: 'doc',
    version: 1,
    // Un doc sin contenido tambien es invalido; un parrafo vacio es el minimo aceptable.
    content: content.length > 0 ? content : [{ type: 'paragraph', content: [] }],
  }
}

export function createJiraClient(config: ResolvedAgileConfig, fetchImpl: typeof fetch = globalThis.fetch) {
  async function request(method: string, path: string, body?: unknown): Promise<unknown> {
    const response = await fetchImpl(`${apiBase(config)}${path}`, {
      method,
      headers: {
        authorization: basicAuth(config),
        accept: 'application/json',
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    })

    if (!response.ok) {
      // El cuerpo del error de Jira explica permisos/credenciales — sin él, el usuario solo ve
      // un 401/403 pelado. Mismo criterio que el 403 de GitHub en github-api.js.
      const detail = await response.text().catch(() => '')
      throw new Error(`Jira API ${method} ${path} respondió ${response.status}: ${detail.slice(0, 300)}`)
    }

    return response.status === 204 ? null : response.json()
  }

  return {
    /**
     * Busca un issue por defectId (que ya viene en el título y en la descripción). Es la clave
     * de dedupe: el mismo selector roto produce el mismo `HLF-XXXXXXXX` en cada corrida, así que
     * este JQL lo encuentra igual siempre y no se duplican tickets.
     */
    async searchByDefectId(project: string, defectId: string): Promise<string | null> {
      const jql = `text ~ "${jqlEscape(defectId)}" AND project = ${project}`
      // `/search/jql`, no `/search`: Atlassian removió el segundo y responde 410 pidiendo
      // migrar. Con el endpoint viejo el dedupe fallaba en toda corrida contra un Jira actual,
      // así que cada test roto abría un ticket nuevo cada vez.
      // https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-search/
      const data = (await request(
        'GET',
        `/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&maxResults=1&fields=key`
      )) as { issues?: { key?: string }[] }
      if (!Array.isArray(data?.issues) || data.issues.length === 0 || !data.issues[0]?.key) return null
      return data.issues[0].key as string
    },

    async createIssue(input: CreateIssueInput): Promise<string> {
      const data = (await request('POST', '/rest/api/3/issue', {
        fields: {
          project: { key: input.project },
          issuetype: { name: input.issueType },
          summary: input.summary,
          description: toAdf(input.description),
          priority: { name: input.priority },
          labels: input.labels,
        },
      })) as { key?: string }
      if (!data?.key) throw new Error('Jira no devolvió una key al crear el issue.')
      return data.key
    },

    async addComment(issueKey: string, body: string): Promise<void> {
      await request('POST', `/rest/api/3/issue/${encodeURIComponent(issueKey)}/comment`, { body: toAdf(body) })
    },

    /**
     * Sube un archivo al ticket (screenshot del fallo, trace, video).
     *
     * Hasta ahora la evidencia iba en la descripción como un link markdown a una ruta local —
     * `[captura](test-results/checkout/screenshot.png)` —, que para quien abre el ticket es
     * una ruta en el disco de otra persona. Inservible.
     *
     * Este endpoint es distinto al resto: `multipart/form-data` y **`X-Atlassian-Token:
     * no-check`** obligatorio (protección XSRF; sin ese header Jira devuelve 403 aunque las
     * credenciales sean correctas). No se le pasa `content-type` a mano a propósito: lo tiene
     * que poner `fetch` con el boundary que generó para el FormData.
     */
    async addAttachment(issueKey: string, fileName: string, content: Uint8Array): Promise<void> {
      const form = new FormData()
      form.append('file', new Blob([content as BlobPart]), fileName)

      const response = await fetchImpl(`${apiBase(config)}/rest/api/3/issue/${encodeURIComponent(issueKey)}/attachments`, {
        method: 'POST',
        headers: {
          authorization: basicAuth(config),
          accept: 'application/json',
          'x-atlassian-token': 'no-check',
        },
        body: form,
      })

      if (!response.ok) {
        const detail = await response.text().catch(() => '')
        throw new Error(`Jira API POST attachments respondió ${response.status}: ${detail.slice(0, 300)}`)
      }
    },

    /**
     * Mueve el ticket a otro estado. Jira no acepta el nombre del estado destino: hay que pasar
     * el **id de la transición**, y ese id varía por workflow, así que primero se pregunta qué
     * transiciones están disponibles desde el estado actual.
     *
     * Devuelve `false` si no existe una transición con ese nombre. No es un error: el workflow
     * del proyecto puede no tener un estado "Done" desde donde está el ticket, y eso no debe
     * hacer fallar el reporte de un defecto que sí se registró bien.
     */
    async transition(issueKey: string, transitionName: string): Promise<boolean> {
      const data = (await request('GET', `/rest/api/3/issue/${encodeURIComponent(issueKey)}/transitions`)) as {
        transitions?: { id?: string; name?: string; to?: { name?: string } }[]
      }

      const wanted = transitionName.toLowerCase()
      const match = (data?.transitions ?? []).find(
        (t) => t.name?.toLowerCase() === wanted || t.to?.name?.toLowerCase() === wanted
      )
      if (!match?.id) return false

      await request('POST', `/rest/api/3/issue/${encodeURIComponent(issueKey)}/transitions`, {
        transition: { id: match.id },
      })
      return true
    },
  }
}
