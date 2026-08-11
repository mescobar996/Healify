import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

// jsdom no tiene canvas: react-chartjs-2 intentaría usar el context 2D en el mount.
// Los tests verifican el render del dashboard, no el pixelado del gráfico.
vi.mock('react-chartjs-2', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Stub = ({ data }: { data?: any }) => <div data-testid="trend-chart">{JSON.stringify(data ?? {})}</div>
  return {
    Chart: {
      register: vi.fn(),
    },
    CategoryScale: class {},
    LinearScale: class {},
    BarElement: class {},
    Tooltip: class {},
    Bar: Stub,
  }
})