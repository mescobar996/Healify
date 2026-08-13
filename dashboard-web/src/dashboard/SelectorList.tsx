import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import type { SelectorSummary } from '../types'

/** Lista de selectores rotos, con filtro por selector/archivo y link al detalle. */
export function SelectorList() {
  const [selectors, setSelectors] = useState<SelectorSummary[] | null>(null)
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .selectors()
      .then(setSelectors)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
  }, [])

  const filtered = useMemo(() => {
    if (!selectors) return []
    const q = query.trim().toLowerCase()
    if (!q) return selectors
    return selectors.filter(
      (s) =>
        s.selector.toLowerCase().includes(q) ||
        (s.testFile ? s.testFile.toLowerCase().includes(q) : false)
    )
  }, [selectors, query])

  if (error) return <p className="empty">No se pudieron cargar los selectores: {error}</p>
  if (!selectors) return <p className="empty">Cargando…</p>

  return (
    <div className="page">
      <header className="page-head">
        <h1>Selectores</h1>
        <p className="sub">Cada selector roto del histórico, con su última sugerencia.</p>
      </header>

      <input
        className="search"
        type="search"
        placeholder="Filtrar por selector o archivo…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {filtered.length === 0 ? (
        <p className="empty">🤷 Sin resultados para «{query}».</p>
      ) : (
        <section className="card">
          <table className="table">
            <thead>
              <tr>
                <th>Selector</th>
                <th>Tipo</th>
                <th>Roturas</th>
                <th>Última cura</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id}>
                  <td>
                    <Link to={`/selectors/${s.id}`} className="selector-cell">
                      <span className="selector-row">
                        <code>{s.selector}</code>
                        {s.chronic ? <span className="pill pill-chronic">Crónico</span> : null}
                      </span>
                      {s.testFile ? <span className="muted">{s.testFile}</span> : null}
                    </Link>
                  </td>
                  <td>
                    <span className={s.chronic ? 'pill pill-chronic' : 'pill'}>{s.type}</span>
                  </td>
                  <td>{s.failCount}</td>
                  <td className="muted">{s.lastHealed ? s.lastHealed.slice(0, 10) : '—'}</td>
                  <td className="row-action">→</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  )
}