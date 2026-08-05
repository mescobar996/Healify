import type { ResolvedAgileConfig } from './config'

/**
 * Cliente mínimo de la API de GitHub Issues, con `fetch` y sin dependencias.
 *
 * Mismo patrón que `jira.ts` y que `gh-action/github-api.js`: `fetchImpl` inyectable, Node 18+
 * ya trae `fetch` global, y todo va contra el repo del usuario con SU token — nunca contra una
 * nube de Healify.
 *
 * A diferencia de Jira, acá el cuerpo es **Markdown plano**: la API de GitHub no tiene nada
 * parecido a ADF. Eso hace este provider bastante más simple, y también más fácil de leer para
 * quien recibe el ticket.
 *
 * El dedupe usa la búsqueda de issues por texto, con el mismo `defectId` (`HLF-XXXXXXXX`) que
 * el resto de Healify: el mismo selector roto encuentra siempre su propio issue.
 */

export interface CreateGithubIssueInput {
  title: string
  body: string
  labels: string[]
}

/** `owner/repo`, como viene en `agile.repository` o en `GITHUB_REPOSITORY`. */
function splitRepo(repository: string): { owner: string; repo: string } {
  const [owner, repo] = repository.split('/')
  return { owner: owner ?? '', repo: repo ?? '' }
}

export function createGithubIssuesClient(config: ResolvedAgileConfig, fetchImpl: typeof fetch = globalThis.fetch) {
  const apiBase = (config.baseUrl ?? 'https://api.github.com').replace(/\/+$/, '')
  const { owner, repo } = splitRepo(config.repository ?? '')

  async function request(method: string, path: string, body?: unknown): Promise<unknown> {
    const response = await fetchImpl(`${apiBase}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${config.apiToken ?? ''}`,
        accept: 'application/vnd.github+json',
        'x-github-api-version': '2022-11-28',
        // GitHub rechaza requests sin User-Agent con un 403 que no explica nada.
        'user-agent': 'healify',
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    })

    if (!response.ok) {
      // El cuerpo del error de GitHub distingue "token sin scope" de "repo inexistente"; sin él
      // el usuario solo ve un 403 pelado. Mismo criterio que el cliente de Jira.
      const detail = await response.text().catch(() => '')
      throw new Error(`GitHub API ${method} ${path} respondió ${response.status}: ${detail.slice(0, 300)}`)
    }

    return response.status === 204 ? null : response.json()
  }

  return {
    /**
     * Busca un issue por defectId. Se filtra por `repo:owner/name` para que la búsqueda global
     * no traiga un issue de otro proyecto que mencione el mismo id, e incluye los cerrados: si
     * un selector se vuelve a romper, corresponde reabrir la conversación en el issue que ya
     * existe, no empezar uno nuevo.
     */
    async searchByDefectId(defectId: string): Promise<number | null> {
      const query = `repo:${owner}/${repo} in:title ${defectId}`
      const data = (await request(
        'GET',
        `/search/issues?q=${encodeURIComponent(query)}&per_page=1`
      )) as { items?: { number?: number }[] }

      const first = Array.isArray(data?.items) ? data.items[0] : undefined
      return typeof first?.number === 'number' ? first.number : null
    },

    async createIssue(input: CreateGithubIssueInput): Promise<number> {
      const data = (await request('POST', `/repos/${owner}/${repo}/issues`, {
        title: input.title,
        body: input.body,
        labels: input.labels,
      })) as { number?: number }

      if (typeof data?.number !== 'number') throw new Error('GitHub no devolvió el número del issue creado.')
      return data.number
    },

    async addComment(issueNumber: number, body: string): Promise<void> {
      await request('POST', `/repos/${owner}/${repo}/issues/${issueNumber}/comments`, { body })
    },
  }
}
