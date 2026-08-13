import { useEffect, useState } from 'react'
import { Bar, Doughnut, Line } from 'react-chartjs-2'
import { Chart as ChartJS, ArcElement, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend } from 'chart.js'
import { api } from '../api'
import type { EfficacyReport } from '../types'

ChartJS.register(ArcElement, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend)

const COLORS = {
  accepted: '#34D399',
  rejected: '#E85C4A',
  pending: '#8A8A8A',
}

function pct(value: number | null): string {
  if (value === null) return '—'
  return `${Math.round(value * 1000) / 10}%`
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function totalOf(group: { accepted: number; rejected: number; pending: number }): number {
  return group.accepted + group.rejected + group.pending
}

const CHART_TICKS = { color: '#8A8A8A' }
const CHART_GRID = { color: 'rgba(255,255,255,0.06)' }
const LEGEND_LABELS = { color: '#EDEDED' }

/** Sección "Eficacia": aceptación vs rechazo de fixes, por framework, tendencia 7/30 días y
 * por causa de fallo. Datos agregados server-side (efficacyReport de /api/stats). */
export function EfficacyDashboard() {
  const [report, setReport] = useState<EfficacyReport | null>(null)
  const [windowDays, setWindowDays] = useState<7 | 30>(30)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .stats(windowDays)
      .then((overview) => setReport(overview.efficacyReport))
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
  }, [windowDays])

  if (error) return <p className="empty">No se pudieron cargar los datos de eficacia: {error}</p>
  if (!report) return <p className="empty">Cargando…</p>

  const { totals, byFramework, trend, byCause } = report
  const frameworks = Object.entries(byFramework).sort((a, b) => totalOf(b[1]) - totalOf(a[1]))
  const causes = Object.entries(byCause).sort((a, b) => b[1].total - a[1].total)
  const confirmed = totals.accepted + totals.rejected

  return (
    <div className="page">
      <header className="page-head">
        <h1>Eficacia</h1>
        <p className="sub">
          ¿Cuántos fixes se aceptan sin revertir? {confirmed} confirmados vía healify confirm · {totals.pending} sin confirmar
        </p>
      </header>

      <div className="efficacy-grid">
        <section className="card">
          <h2>Aceptación vs rechazo</h2>
          {confirmed + totals.pending === 0 ? (
            <p className="empty">Sin entradas todavía — corré healify fix y confirmá con healify confirm.</p>
          ) : (
            <div className="efficacy-donut" data-testid="efficacy-donut">
              <Doughnut
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  cutout: '62%',
                  plugins: {
                    legend: { position: 'bottom', labels: LEGEND_LABELS },
                    tooltip: {
                      callbacks: {
                        label: (ctx) => {
                          const value = ctx.parsed as number
                          const pctOfTotal = confirmed + totals.pending > 0 ? Math.round((value / (confirmed + totals.pending)) * 1000) / 10 : 0
                          return ` ${ctx.label}: ${value} (${pctOfTotal}%)`
                        },
                      },
                    },
                  },
                }}
                data={{
                  labels: ['Aceptados', 'Rechazados', 'Sin confirmar'],
                  datasets: [
                    {
                      data: [totals.accepted, totals.rejected, totals.pending],
                      backgroundColor: [COLORS.accepted, COLORS.rejected, COLORS.pending],
                      borderColor: '#0A0A0A',
                      borderWidth: 2,
                    },
                  ],
                }}
              />
            </div>
          )}
          <div className="efficacy-rate">
            <span className="efficacy-rate-n">{pct(totals.rate)}</span>
            <span className="efficacy-rate-l">tasa de eficacia (aceptados / confirmados)</span>
          </div>
        </section>

        <section className="card">
          <h2>Tasa por framework</h2>
          {frameworks.length === 0 ? (
            <p className="empty">Sin datos por framework.</p>
          ) : (
            <div className="efficacy-chart" data-testid="efficacy-frameworks">
              <Bar
                options={{
                  indexAxis: 'y' as const,
                  responsive: true,
                  maintainAspectRatio: false,
                  scales: {
                    x: {
                      min: 0,
                      max: 1,
                      ticks: { ...CHART_TICKS, callback: (value) => pct(value as number) },
                      grid: CHART_GRID,
                    },
                    y: { ticks: CHART_TICKS, grid: { display: false } },
                  },
                  plugins: {
                    legend: { display: false },
                    tooltip: {
                      callbacks: {
                        afterLabel: (ctx) => {
                          const key = frameworks[ctx.dataIndex]?.[0] ?? 'unknown'
                          const f = byFramework[key]
                          return f ? ` ${f.accepted} aceptados · ${f.rejected} rechazados` : ''
                        },
                      },
                    },
                  },
                }}
                data={{
                  labels: frameworks.map(([key]) => capitalize(key)),
                  datasets: [
                    {
                      label: 'Tasa de eficacia',
                      data: frameworks.map(([, f]) => f.rate),
                      backgroundColor: frameworks.map(([, f]) => (f.rate !== null && f.rate >= 0.75 ? COLORS.accepted : COLORS.rejected)),
                      borderRadius: 4,
                    },
                  ],
                }}
              />
            </div>
          )}
          {frameworks.some(([key]) => key === 'unknown') ? (
            <p className="muted" style={{ marginTop: 8 }}>
              Entradas históricas sin framework se agrupan en "Unknown".
            </p>
          ) : null}
        </section>

        <section className="card efficacy-trend-card">
          <div className="efficacy-card-head">
            <h2>Tendencia</h2>
            <div className="efficacy-toggle" role="group" aria-label="Ventana de tendencia">
              <button
                type="button"
                className={windowDays === 7 ? 'active' : ''}
                onClick={() => setWindowDays(7)}
              >
                7 días
              </button>
              <button
                type="button"
                className={windowDays === 30 ? 'active' : ''}
                onClick={() => setWindowDays(30)}
              >
                30 días
              </button>
            </div>
          </div>
          <div className="efficacy-chart" data-testid="efficacy-trend">
            <Line
              options={{
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                  x: { ticks: { ...CHART_TICKS, maxRotation: 0, maxTicksLimit: 8 }, grid: { display: false } },
                  y: { ticks: CHART_TICKS, grid: CHART_GRID },
                },
                plugins: {
                  legend: { labels: LEGEND_LABELS },
                  tooltip: { callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y}` } },
                },
              }}
              data={{
                labels: trend.map((p) => p.date.slice(5)),
                datasets: [
                  {
                    label: 'Aceptados',
                    data: trend.map((p) => p.accepted),
                    borderColor: COLORS.accepted,
                    backgroundColor: COLORS.accepted,
                    tension: 0.25,
                    pointRadius: 2,
                  },
                  {
                    label: 'Rechazados',
                    data: trend.map((p) => p.rejected),
                    borderColor: COLORS.rejected,
                    backgroundColor: COLORS.rejected,
                    tension: 0.25,
                    pointRadius: 2,
                  },
                ],
              }}
            />
          </div>
        </section>

        <section className="card">
          <h2>Por causa de fallo</h2>
          {causes.length === 0 ? (
            <p className="empty">Sin causas registradas.</p>
          ) : (
            <div className="efficacy-chart" data-testid="efficacy-causes">
              <Bar
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  scales: {
                    x: { stacked: true, ticks: CHART_TICKS, grid: { display: false } },
                    y: { stacked: true, ticks: CHART_TICKS, grid: CHART_GRID },
                  },
                  plugins: {
                    legend: { labels: LEGEND_LABELS },
                    tooltip: {
                      callbacks: {
                        label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y}`,
                      },
                    },
                  },
                }}
                data={{
                  labels: causes.map(([label]) => label),
                  datasets: [
                    { label: 'Aceptados', data: causes.map(([, c]) => c.accepted), backgroundColor: COLORS.accepted },
                    { label: 'Rechazados', data: causes.map(([, c]) => c.rejected), backgroundColor: COLORS.rejected },
                  ],
                }}
              />
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
