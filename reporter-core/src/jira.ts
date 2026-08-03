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
      const data = (await request(
        'GET',
        `/rest/api/3/search?jql=${encodeURIComponent(jql)}&maxResults=1&fields=key`
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
          description: input.description,
          priority: { name: input.priority },
          labels: input.labels,
        },
      })) as { key?: string }
      if (!data?.key) throw new Error('Jira no devolvió una key al crear el issue.')
      return data.key
    },

    async addComment(issueKey: string, body: string): Promise<void> {
      await request('POST', `/rest/api/3/issue/${encodeURIComponent(issueKey)}/comment`, { body })
    },
  }
}
