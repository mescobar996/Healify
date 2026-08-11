import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { DashboardLayout } from './dashboard/DashboardLayout'
import { StatsOverview } from './dashboard/StatsOverview'
import { SelectorList } from './dashboard/SelectorList'
import { SelectorDetail } from './dashboard/SelectorDetail'
import { ChronicSelectors } from './dashboard/ChronicSelectors'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<DashboardLayout />}>
          <Route path="/" element={<StatsOverview />} />
          <Route path="/selectors" element={<SelectorList />} />
          <Route path="/selectors/:id" element={<SelectorDetail />} />
          <Route path="/chronic" element={<ChronicSelectors />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}