import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import type { SelectorSummary } from '../types'

/** Selectores crónicos = 3+ roturas en el historial. Filtra la lista de /api/selectors. */
export function ChronicSelectors() {
  const [chronic, setChronic] = useState<SelectorSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .selectors()
      .then((list) => setChronic(list.filter((s) => s.chronic)))
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
  }, [])

  if (error) return <p className="empty">No se pudieron cargar los selectores: {error}</p>
  if (!chronic) return <p className="empty">Cargando…</p>

  return (
    <div className="page">
      <header className="page-head">
        <h1>Selectores crónicos</h1>
        <p className="sub">3+ roturas en el histórico — acá conviene dejar de parchear.</p>
      </header>

      {chronic.length === 0 ? (
        <p className="empty">No hay selectores crónicos todavía.</p>
      ) : (
        <ul className="chronic-list">
          {chronic.map((s) => (
            <li key={s.id} className="chronic-item">
              <Link to={`/selectors/${s.id}`}>
                <div className="chronic-head">
                  <span className="pill pill-chronic">{s.failCount} roturas</span>
                  <code>{s.selector}</code>
                </div>
                {s.testFile ? <div className="muted">{s.testFile}</div> : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}