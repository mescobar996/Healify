import { createServer, type Server } from 'node:http'
import { AddressInfo } from 'node:net'

/**
 * Servidor que se comporta como Jira Cloud v3, para ejercitar el cliente por HTTP de verdad.
 *
 * No es un mock del `fetch`. La diferencia importa: un `fetch` mockeado devuelve lo que el
 * test le dice que devuelva, así que valida que el código llame a lo que el test cree que
 * debería llamar — nunca que el otro lado lo acepte. Con eso, el reporte a Jira tuvo 19 tests
 * en verde mientras mandaba un cuerpo que Jira rechaza con 400.
 *
 * Por eso este servidor es **estricto**, y cada validación replica una regla documentada de la
 * API real:
 *
 * - `description` y el cuerpo de los comentarios tienen que venir en **ADF** (un documento
 *   `{ type: 'doc', version: 1, content: [...] }`), no un string. Es lo que separa la v3 de la
 *   v2, y mandar texto plano da 400.
 *   https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issues/
 *
 * - `GET /rest/api/3/search` **ya no existe**: Atlassian lo removió y responde pidiendo migrar
 *   a `/rest/api/3/search/jql`. Un servidor complaciente que igual contestara acá escondería
 *   que el dedupe está roto contra el Jira de hoy.
 *   https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-search/
 *
 * - Sin `Authorization: Basic` válido, 401.
 */

export interface FakeJiraIssue {
  key: string
  summary: string
  description: unknown
  labels: string[]
  comments: unknown[]
  attachments: string[]
  status: string
}

/** Transiciones que ofrece el workflow del proyecto simulado. */
const TRANSITIONS = [
  { id: '11', name: 'En curso', to: { name: 'In Progress' } },
  { id: '31', name: 'Listo', to: { name: 'Done' } },
]

export interface FakeJira {
  url: string
  issues: FakeJiraIssue[]
  /** Todas las requests que llegaron, para poder afirmar sobre el orden de las llamadas. */
  requests: { method: string; path: string }[]
  close(): Promise<void>
}

/** Un documento ADF mínimo válido: `{ type: 'doc', version: 1, content: [...] }`. */
function isAdf(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false
  const doc = value as { type?: unknown; version?: unknown; content?: unknown }
  return doc.type === 'doc' && typeof doc.version === 'number' && Array.isArray(doc.content)
}

export async function startFakeJira(options: { existingIssues?: FakeJiraIssue[] } = {}): Promise<FakeJira> {
  const issues: FakeJiraIssue[] = options.existingIssues ? [...options.existingIssues] : []
  const requests: { method: string; path: string }[] = []
  let nextId = issues.length + 1

  const server: Server = createServer((req, res) => {
    const method = req.method ?? 'GET'
    const path = req.url ?? '/'
    requests.push({ method, path })

    const send = (status: number, body: unknown): void => {
      res.writeHead(status, { 'content-type': 'application/json' })
      res.end(JSON.stringify(body))
    }

    if (!/^Basic .+/.test(req.headers.authorization ?? '')) {
      send(401, { errorMessages: ['Client must be authenticated to access this resource.'] })
      return
    }

    // Los adjuntos van en multipart, no en JSON: se procesan antes de intentar parsear el
    // cuerpo. La validación clave es el header XSRF, que la API real exige y sin el cual
    // devuelve 403 aunque las credenciales estén bien.
    const attachMatch = path.match(/^\/rest\/api\/3\/issue\/([^/]+)\/attachments$/)
    if (method === 'POST' && attachMatch) {
      if (req.headers['x-atlassian-token'] !== 'no-check') {
        send(403, { errorMessages: ['XSRF check failed'] })
        return
      }
      const issue = issues.find((i) => i.key === decodeURIComponent(attachMatch[1]))
      if (!issue) {
        send(404, { errorMessages: ['Issue does not exist'] })
        return
      }
      const chunks: Buffer[] = []
      req.on('data', (chunk) => chunks.push(chunk as Buffer))
      req.on('end', () => {
        // El nombre viaja en el Content-Disposition de la parte multipart.
        const nombre = Buffer.concat(chunks).toString('latin1').match(/filename="([^"]+)"/)?.[1] ?? 'sin-nombre'
        issue.attachments.push(nombre)
        send(200, [{ id: '10001', filename: nombre }])
      })
      return
    }

    let raw = ''
    req.on('data', (chunk) => (raw += chunk))
    req.on('end', () => {
      let body: Record<string, unknown> = {}
      if (raw) {
        try {
          body = JSON.parse(raw)
        } catch {
          send(400, { errorMessages: ['Unexpected character'] })
          return
        }
      }

      const transitionsMatch = path.match(/^\/rest\/api\/3\/issue\/([^/]+)\/transitions$/)
      if (transitionsMatch) {
        const issue = issues.find((i) => i.key === decodeURIComponent(transitionsMatch[1]))
        if (!issue) {
          send(404, { errorMessages: ['Issue does not exist'] })
          return
        }
        if (method === 'GET') {
          send(200, { transitions: TRANSITIONS })
          return
        }
        // Jira NO acepta el nombre del estado acá: solo el id de la transición.
        const id = ((body.transition ?? {}) as { id?: string }).id
        const found = TRANSITIONS.find((t) => t.id === id)
        if (!found) {
          send(400, { errorMessages: ['Transition id is not valid'] })
          return
        }
        issue.status = found.to.name
        send(204, null)
        return
      }

      // El endpoint viejo de búsqueda, removido por Atlassian.
      if (method === 'GET' && path.startsWith('/rest/api/3/search?')) {
        send(410, {
          errorMessages: [
            'The requested API has been removed. Please migrate to the /rest/api/3/search/jql API.',
          ],
        })
        return
      }

      if (method === 'GET' && path.startsWith('/rest/api/3/search/jql')) {
        const jql = decodeURIComponent(new URL(path, 'http://x').searchParams.get('jql') ?? '')
        // El JQL real es `text ~ "HLF-XXXX" AND project = QA`; acá alcanza con buscar el
        // defectId dentro del summary, que es donde el cliente lo pone.
        const term = jql.match(/text ~ "([^"]+)"/)?.[1]
        const found = term ? issues.filter((i) => i.summary.includes(term)) : []
        send(200, { issues: found.map((i) => ({ key: i.key })), total: found.length })
        return
      }

      if (method === 'POST' && path === '/rest/api/3/issue') {
        const fields = (body.fields ?? {}) as Record<string, unknown>

        if (!isAdf(fields.description)) {
          send(400, {
            errors: {
              description: 'Operation value must be an Atlassian Document (see the Atlassian Document Format)',
            },
          })
          return
        }

        const issue: FakeJiraIssue = {
          key: `QA-${nextId++}`,
          summary: String(fields.summary ?? ''),
          description: fields.description,
          labels: Array.isArray(fields.labels) ? (fields.labels as string[]) : [],
          comments: [],
          attachments: [],
          status: 'To Do',
        }
        issues.push(issue)
        send(201, { id: String(nextId), key: issue.key })
        return
      }

      const commentMatch = path.match(/^\/rest\/api\/3\/issue\/([^/]+)\/comment$/)
      if (method === 'POST' && commentMatch) {
        const issue = issues.find((i) => i.key === decodeURIComponent(commentMatch[1]))
        if (!issue) {
          send(404, { errorMessages: ['Issue does not exist or you do not have permission to see it.'] })
          return
        }
        if (!isAdf(body.body)) {
          send(400, {
            errors: { body: 'Operation value must be an Atlassian Document (see the Atlassian Document Format)' },
          })
          return
        }
        issue.comments.push(body.body)
        send(201, { id: '10000' })
        return
      }

      send(404, { errorMessages: [`No endpoint ${method} ${path}`] })
    })
  })

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as AddressInfo

  return {
    url: `http://127.0.0.1:${port}`,
    issues,
    requests,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  }
}
