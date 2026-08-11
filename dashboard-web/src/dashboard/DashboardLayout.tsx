import { NavLink, Outlet } from 'react-router-dom'

/** Layout del dashboard: sidebar con la paleta de healify-report.html + área de contenido. */
export function DashboardLayout() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="glyph">H</div>
          <div className="brand-text">
            <div className="brand-name">Healify</div>
            <div className="brand-sub">Dashboard de curaciones</div>
          </div>
        </div>
        <nav className="nav">
          <NavLink to="/" end className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
            Resumen
          </NavLink>
          <NavLink to="/selectors" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
            Selectores
          </NavLink>
          <NavLink to="/chronic" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
            🔥 Crónicos
          </NavLink>
        </nav>
        <div className="sidebar-foot">
          <span className="local-badge">100% local</span>
        </div>
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  )
}