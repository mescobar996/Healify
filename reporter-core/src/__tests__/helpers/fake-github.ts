import { createServer, type Server } from 'node:http'
import { AddressInfo } from 'node:net'

/**
 * Servidor que se comporta como la API de GitHub Issues, para ejercitar el cliente por HTTP.
 *
 * Mismo criterio que `fake-jira.ts`: estricto, porque un servidor complaciente no prueba nada.
 * Las validaciones replican lo que la API real rechaza:
 *
 * - Sin `Authorization: Bearer`, 401.
 * - Sin `User-Agent`, 403. GitHub lo exige y devuelve un error que no menciona el motivo, así
 *   que es de los que se descubren tarde y en producción.
 * - `POST /repos/:owner/:repo/issues` contra un repo que no existe, 404.
 */

export interface FakeGithubIssue {
  number: number
  title: string
  body: string
  labels: string[]
  comments: string[]
  state: 'open' | 'closed'
}

export interface FakeGithub {
  url: string
  issues: FakeGithubIssue[]
  requests: { method: string; path: string }[]
  close(): Promise<void>
}

export async function startFakeGithub(
  options: { repository?: string; existingIssues?: FakeGithubIssue[] } = {}
): Promise<FakeGithub> {
  const repository = options.repository ?? 'mescobar996/Healify'
  const issues: FakeGithubIssue[] = options.existingIssues ? [...options.existingIssues] : []
  const requests: { method: string; path: string }[] = []
  let nextNumber = issues.length + 1

  const server: Server = createServer((req, res) => {
    const method = req.method ?? 'GET'
    const path = req.url ?? '/'
    requests.push({ method, path })

    const send = (status: number, body: unknown): void => {
      res.writeHead(status, { 'content-type': 'application/json' })
      res.end(JSON.stringify(body))
    }

    if (!/^Bearer .+/.test(req.headers.authorization ?? '')) {
      send(401, { message: 'Requires authentication' })
      return
    }

    if (!req.headers['user-agent']) {
      send(403, { message: 'Request forbidden by administrative rules. Please make sure your request has a User-Agent header.' })
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
          send(400, { message: 'Problems parsing JSON' })
          return
        }
      }

      if (method === 'GET' && path.startsWith('/search/issues')) {
        const q = decodeURIComponent(new URL(path, 'http://x').searchParams.get('q') ?? '')
        // El query real es `repo:owner/name in:title HLF-XXXX`; acá alcanza con el término.
        const term = q.split(/\s+/).find((part) => part.startsWith('HLF-'))
        const scoped = q.includes(`repo:${repository}`)
        const found = scoped && term ? issues.filter((i) => i.title.includes(term)) : []
        send(200, { total_count: found.length, items: found.map((i) => ({ number: i.number })) })
        return
      }

      const issuesMatch = path.match(/^\/repos\/([^/]+)\/([^/]+)\/issues$/)
      if (method === 'POST' && issuesMatch) {
        if (`${issuesMatch[1]}/${issuesMatch[2]}` !== repository) {
          send(404, { message: 'Not Found' })
          return
        }
        const issue: FakeGithubIssue = {
          number: nextNumber++,
          title: String(body.title ?? ''),
          body: String(body.body ?? ''),
          labels: Array.isArray(body.labels) ? (body.labels as string[]) : [],
          comments: [],
          state: 'open',
        }
        issues.push(issue)
        send(201, { number: issue.number, html_url: `https://github.com/${repository}/issues/${issue.number}` })
        return
      }

      const commentMatch = path.match(/^\/repos\/([^/]+)\/([^/]+)\/issues\/(\d+)\/comments$/)
      if (method === 'POST' && commentMatch) {
        const issue = issues.find((i) => i.number === Number(commentMatch[3]))
        if (!issue) {
          send(404, { message: 'Not Found' })
          return
        }
        issue.comments.push(String(body.body ?? ''))
        send(201, { id: 1 })
        return
      }

      send(404, { message: `No endpoint ${method} ${path}` })
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
