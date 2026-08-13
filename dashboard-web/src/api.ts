import type { SelectorDetail, SelectorSummary, StatsOverview } from './types'

const BASE = ''

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`)
  return res.json()
}

/** Cliente mínimo de la API que sirve `healify dashboard --serve`. */
export const api = {
  /** `window` (7|30) ajusta la tendencia de eficacia server-side. */
  stats: (window?: number): Promise<StatsOverview> => {
    const query = window ? `?efficacy-window=${window}` : ''
    return getJson(`/api/stats${query}`)
  },
  selectors: (): Promise<SelectorSummary[]> => getJson('/api/selectors'),
  selector: (id: string): Promise<SelectorDetail> => getJson(`/api/selectors/${encodeURIComponent(id)}`),
}