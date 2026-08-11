import { Bar } from 'react-chartjs-2'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip } from 'chart.js'
import type { TrendPoint } from '../types'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip)

const COLORS = {
  healed: '#34D399',
  review: '#E8B94D',
  unresolved: '#E85C4A',
}

interface TrendChartProps {
  timeline: TrendPoint[]
  height?: number
}

/** Gráfico de curaciones por día (apilado), misma paleta que healify-report.html. */
export function TrendChart({ timeline, height = 180 }: TrendChartProps) {
  const labels = timeline.map((p) => p.date)
  return (
    <div style={{ height }}>
      <Bar
        options={{
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: { stacked: true, ticks: { color: '#8A8A8A', maxRotation: 0 }, grid: { display: false } },
            y: { stacked: true, ticks: { color: '#8A8A8A' }, grid: { color: 'rgba(255,255,255,0.06)' } },
          },
          plugins: { legend: { labels: { color: '#EDEDED' } } },
        }}
        data={{
          labels,
          datasets: [
            { label: 'Curadas', data: timeline.map((p) => p.healed), backgroundColor: COLORS.healed },
            { label: 'En revisión', data: timeline.map((p) => p.review), backgroundColor: COLORS.review },
            { label: 'Sin resolver', data: timeline.map((p) => p.unresolved), backgroundColor: COLORS.unresolved },
          ],
        }}
      />
    </div>
  )
}