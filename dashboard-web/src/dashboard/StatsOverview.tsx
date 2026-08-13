import { useEffect, useState } from 'react'
import { api } from '../api'
import type { StatsOverview } from '../types'
import { TrendChart } from './TrendChart'

function pct(value: number): string {
  return `${Math.round(value * 1000) / 10}%`
}

function formatDate(value: string | null): string {
  if (!value) return '—'
  return value.slice(0, 10)
}

/** Vista de resumen: tarjetas de stats.json + tendencia y recientes del histórico. */
export function StatsOverview() {
  const [overview, setOverview] = useState<StatsOverview | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .stats()
      .then(setOverview)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
  }, [])

  if (error) return <p className="empty">No se pudieron cargar las estadísticas: {error}</p>
  if (!overview) return <p className="empty">Cargando…</p>

  const { history, efficacy } = overview
  const cards: Array<{ label: string; value: string; hint?: string }> = [
    { label: 'Analizados', value: String(overview.totalAnalyzed) },
    { label: 'Sanados (stats.json)', value: String(overview.healed) },
    { label: 'Fallas', value: String(overview.failed) },
    { label: 'Éxito acumulado', value: pct(overview.healRate) },
    { label: 'Tiempo medio', value: `${overview.avgHealingMs}ms` },
    {
      label: 'Eficacia de fixes',
      value: efficacy.rate === null ? '—' : pct(efficacy.rate),
      hint: `${efficacy.accepted} aceptados · ${efficacy.rejected} rechazados · ${efficacy.unconfirmed} sin confirmar (healify confirm)`,
    },
  ]

  return (
    <div className="page">
      <header className="page-head">
        <h1>Resumen</h1>
        <p className="sub">
          {history.total} entradas en el histórico · de {formatDate(history.firstSeen)} a {formatDate(history.lastSeen)}
        </p>
      </header>

      <div className="meta-strip">
        {cards.map((c) => (
          <div className="meta-cell" key={c.label}>
            <div className="label">{c.label}</div>
            <div className="value">{c.value}</div>
            {c.hint ? <div style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 4 }}>{c.hint}</div> : null}
          </div>
        ))}
      </div>

      <section className="card">
        <h2>Curaciones por día</h2>
        {history.timeline.length === 0 ? (
          <p className="empty">Todavía no hay curaciones que graficar — corré healify fix (sin --dry-run) al menos una vez.</p>
        ) : (
          <TrendChart timeline={history.timeline} />
        )}
      </section>
    </div>
  )
}