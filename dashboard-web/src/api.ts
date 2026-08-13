import type { SelectorDetail, SelectorSummary, StatsOverview } from './types'

const BASE = ''

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`)
  return res.json()
}

/** Cliente mínimo de la API que sirve `healify dashboard --serve`. */
export const api = {
  stats: (): Promise<StatsOverview> => getJson('/api/stats'),
  selectors: (): Promise<SelectorSummary[]> => getJson('/api/selectors'),
  selector: (id: string): Promise<SelectorDetail> => getJson(`/api/selectors/${encodeURIComponent(id)}`),
}