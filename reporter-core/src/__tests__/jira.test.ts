import { describe, it, expect, vi } from 'vitest'
import { createJiraClient } from '../jira'
import type { ResolvedAgileConfig } from '../config'

function config(overrides: Partial<ResolvedAgileConfig> = {}): ResolvedAgileConfig {
  return {
    enabled: true,
    provider: 'jira',
    baseUrl: 'https://acme.atlassian.net',
    email: 'qa@acme.com',
    apiToken: 'un-secreto',
    issueType: 'Bug',
    priorityBySeverity: { blocker: 'Highest', major: 'High', minor: 'Medium' },
    labels: [],
    ...overrides,
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  } as unknown as Response
}

describe('createJiraClient', () => {
  it('manda Basic auth con base64(email:token)', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ issues: [] }))
    const client = createJiraClient(config(), fetchImpl)

    await client.searchByDefectId('QA', 'HLF-AABB11')

    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit]
    const expected = `Basic ${Buffer.from('qa@acme.com:un-secreto').toString('base64')}`
    expect((init.headers as Record<string, string>).authorization).toBe(expected)
  })

  it('la base URL queda sin barra final', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ issues: [] }))
    const client = createJiraClient(config({ baseUrl: 'https://acme.atlassian.net/' }), fetchImpl)

    await client.searchByDefectId('QA', 'HLF-AABB11')

    const [url] = fetchImpl.mock.calls[0] as [string]
    expect(url.startsWith('https://acme.atlassian.net/rest/')).toBe(true)
  })

  it('searchByDefectId escapa el defectId en el JQL y pide maxResults=1', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ issues: [] }))
    const client = createJiraClient(config(), fetchImpl)

    await client.searchByDefectId('QA', 'HLF-AABB11')

    const [url] = fetchImpl.mock.calls[0] as [string]
    expect(url).toContain('/rest/api/3/search?')
    expect(url).toContain(encodeURIComponent('text ~ "HLF-AABB11" AND project = QA'))
    expect(url).toContain('maxResults=1')
  })

  it('searchByDefectId devuelve la key del primer issue o null', async () => {
    const found = createJiraClient(config(), vi.fn().mockResolvedValue(jsonResponse({ issues: [{ key: 'QA-7' }] })))
    expect(await found.searchByDefectId('QA', 'HLF-AABB11')).toBe('QA-7')

    const empty = createJiraClient(config(), vi.fn().mockResolvedValue(jsonResponse({ issues: [] })))
    expect(await empty.searchByDefectId('QA', 'HLF-AABB11')).toBeNull()
  })

  it('createIssue manda el body correcto y devuelve la key', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ key: 'QA-11', id: '11011' }, 201))
    const client = createJiraClient(config(), fetchImpl)

    const key = await client.createIssue({
      project: 'QA',
      issueType: 'Bug',
      summary: '[HLF-AABB11] compra exprés',
      description: 'desc',
      priority: 'Highest',
      labels: ['healify'],
    })

    expect(key).toBe('QA-11')
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://acme.atlassian.net/rest/api/3/issue')
    const body = JSON.parse(init.body as string)
    expect(body.fields.project.key).toBe('QA')
    expect(body.fields.issuetype.name).toBe('Bug')
    expect(body.fields.priority.name).toBe('Highest')
    expect(body.fields.labels).toEqual(['healify'])
  })

  it('addComment postea al endpoint de comentarios', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ id: '9001' }, 201))
    const client = createJiraClient(config(), fetchImpl)

    await client.addComment('QA-11', '**Sugerencia de Healify**')

    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://acme.atlassian.net/rest/api/3/issue/QA-11/comment')
    expect(JSON.parse(init.body as string).body).toContain('Sugerencia')
  })

  it('un 403/401 tira error con el snippet del cuerpo (explica permisos)', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ errorMessages: ['no tiene permiso de crear'] }, 403))
    const client = createJiraClient(config(), fetchImpl)

    await expect(client.createIssue({ project: 'QA', issueType: 'Bug', summary: 'x', description: '', priority: 'High', labels: [] })).rejects.toThrow(
      /403.*no tiene permiso/
    )
  })
})
