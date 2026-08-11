import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api'
import type { SelectorDetail as SelectorDetailType } from '../types'
import { TrendChart } from './TrendChart'

function statusLabel(status: string): string {
  if (status === 'healed') return 'Curado'
  if (status === 'review') return 'En revisión'
  return 'Sin resolver'
}

/** Detalle de un selector: resumen, historial de curaciones y tendencia propia. */
export function SelectorDetail() {
  const { id } = useParams<{ id: string }>()
  const [detail, setDetail] = useState<SelectorDetailType | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    setDetail(null)
    setError(null)
    api
      .selector(id)
      .then(setDetail)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
  }, [id])

  if (error)
    return (
      <p className="empty">
        No se pudo cargar el selector — <Link to="/selectors">volver a selectores</Link>.
      </p>
    )
  if (!detail) return <p className="empty">Cargando…</p>

  return (
    <div className="page">
      <header className="page-head">
        <Link to="/selectors" className="back">
          ← Selectores
        </Link>
        <h1>
          <code>{detail.selector}</code>
          {detail.chronic ? <span className="pill pill-chronic">crónico</span> : null}
        </h1>
        <p className="sub">{detail.testFile ?? 'Archivo desconocido'}</p>
      </header>

      <div className="meta-strip">
        <div className="meta-cell">
          <div className="label">Roturas</div>
          <div className="value">{detail.failCount}</div>
        </div>
        <div className="meta-cell">
          <div className="label">Tipo</div>
          <div className="value">{detail.type}</div>
        </div>
        <div className="meta-cell">
          <div className="label">Última cura</div>
          <div className="value">{detail.lastHealed ? detail.lastHealed.slice(0, 10) : '—'}</div>
        </div>
      </div>

      {detail.lastSuggestion ? (
        <section className="card">
          <h2>Última sugerencia</h2>
          <code>{detail.lastSuggestion}</code>
        </section>
      ) : null}

      <section className="card">
        <h2>Tendencia</h2>
        {detail.timeline.length === 0 ? (
          <p className="empty">Sin actividad registrada para este selector.</p>
        ) : (
          <TrendChart timeline={detail.timeline} />
        )}
      </section>

      <section className="card">
        <h2>Historial</h2>
        {detail.suggestions.length === 0 ? (
          <p className="empty">Sin apariciones registradas.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Estado</th>
                <th>Confianza</th>
                <th>Sugerencia</th>
              </tr>
            </thead>
            <tbody>
              {detail.suggestions.map((s, i) => (
                <tr key={i}>
                  <td className="muted">{s.timestamp}</td>
                  <td>
                    <span className={`status status-${s.status}`}>{statusLabel(s.status)}</span>
                  </td>
                  <td>{s.confidence !== null ? `${Math.round(s.confidence * 100)}%` : '—'}</td>
                  <td>{s.fixedSelector ? <code>{s.fixedSelector}</code> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}