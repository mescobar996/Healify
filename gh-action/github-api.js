/**
 * Cliente mínimo de la API de GitHub, con `fetch` y sin dependencias.
 *
 * Reemplaza a `@octokit/action`, que era la ÚNICA dependencia de runtime de la action y que
 * además nunca podía resolverse: una action de tipo `node20` ejecuta `main` directamente,
 * GitHub **no** corre `npm install` por vos. Como `gh-action/node_modules` no está versionado
 * ni bundleado, el `await import('@octokit/action')` de `run.js` tiraba ERR_MODULE_NOT_FOUND en
 * la primera PR real que usara la action. Sacar la dependencia es más barato que agregar un
 * paso de bundling, y además deja a la action alineada con el resto del proyecto: cero deps.
 *
 * Solo se usan tres endpoints, todos de la API de issues (una PR es un issue para comentarios).
 */

const DEFAULT_API_URL = 'https://api.github.com'
/** Tope de páginas al listar comentarios: una PR con más de 1000 comentarios no existe en la
 * práctica, y sin tope un bug de paginación sería un loop infinito dentro de un job de CI. */
const MAX_PAGES = 10

function apiUrl() {
  // GITHUB_API_URL lo define el runner — en GitHub Enterprise no es api.github.com.
  return process.env.GITHUB_API_URL || DEFAULT_API_URL
}

/**
 * Cliente autenticado. `fetchImpl` inyectable para tests: Node 18+ ya trae `fetch` global,
 * así que en producción nunca se pasa.
 */
export function createClient(token, fetchImpl = globalThis.fetch) {
  async function request(method, path, body) {
    const response = await fetchImpl(`${apiUrl()}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        accept: 'application/vnd.github+json',
        'x-github-api-version': '2022-11-28',
        'user-agent': 'healify-action',
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })

    if (!response.ok) {
      // El cuerpo del error de GitHub dice qué permiso falta ("Resource not accessible by
      // integration" cuando el workflow no declaró `pull-requests: write`), que es el 90% de
      // los casos. Sin él, el usuario solo ve un 403 pelado.
      const detail = await response.text().catch(() => '')
      throw new Error(`GitHub API ${method} ${path} respondió ${response.status}: ${detail.slice(0, 300)}`)
    }

    return response.status === 204 ? null : response.json()
  }

  return {
    /** Todos los comentarios de la PR, paginados. El original leía solo la primera página:
     * en una PR con más de 100 comentarios no encontraba el suyo y publicaba uno nuevo cada vez. */
    async listComments(owner, repo, issueNumber) {
      const all = []
      for (let page = 1; page <= MAX_PAGES; page++) {
        const batch = await request('GET', `/repos/${owner}/${repo}/issues/${issueNumber}/comments?per_page=100&page=${page}`)
        if (!Array.isArray(batch) || batch.length === 0) break
        all.push(...batch)
        if (batch.length < 100) break
      }
      return all
    },

    createComment(owner, repo, issueNumber, body) {
      return request('POST', `/repos/${owner}/${repo}/issues/${issueNumber}/comments`, { body })
    },

    updateComment(owner, repo, commentId, body) {
      return request('PATCH', `/repos/${owner}/${repo}/issues/comments/${commentId}`, { body })
    },
  }
}
