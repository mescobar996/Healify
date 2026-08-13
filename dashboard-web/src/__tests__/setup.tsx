import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

// jsdom no tiene canvas: react-chartjs-2 intentaría usar el context 2D en el mount.
// Los tests verifican el render del dashboard, no el pixelado del gráfico.
vi.mock('react-chartjs-2', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Stub = ({ data, 'data-testid': testId, ...rest }: { data?: any; 'data-testid'?: string }) => (
    <div data-testid={testId ?? 'trend-chart'} {...rest}>
      {JSON.stringify(data ?? {})}
    </div>
  )
  return {
    Chart: {
      register: vi.fn(),
    },
    CategoryScale: class {},
    LinearScale: class {},
    BarElement: class {},
    ArcElement: class {},
    LineElement: class {},
    PointElement: class {},
    Tooltip: class {},
    Legend: class {},
    Bar: Stub,
    Line: Stub,
    Doughnut: Stub,
  }
})
