/**
 * POST genérico para el provider `webhook` (Zapier, n8n, automatización de Jira, etc.).
 *
 * El receptor es quien decide create-or-update (el patrón documentado de Atlassian: el webhook
 * dispara una regla que hace un lookupIssues por JQL y crea o comenta). Healify solo manda el
 * payload; la regla del receptor tiene la clave (`defectId`) en el cuerpo para deduplicar.
 */
export async function postJson(
  url: string,
  body: unknown,
  fetchImpl: typeof fetch = globalThis.fetch
): Promise<void> {
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'user-agent': 'healify',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`Webhook POST ${url} respondió ${response.status}: ${detail.slice(0, 300)}`)
  }
}
