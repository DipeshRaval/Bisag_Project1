import { NavLink } from 'react-router-dom'

const DashboardLayout = ({ heading, subheading, sessionUser, onLogout, children, showWelcome = true }) => {
  const displayName = sessionUser?.fullName || 'Vatsala Solanki'

  return (
    <div className="dashboard-shell">
      <aside className="dashboard-sidebar">
        <div className="brand-block">
          <div className="brand-logo">BISAG-N</div>
          <div>
            <h2>Bisag-N</h2>
            <p>Lavya Workshop</p>
          </div>
        </div>

        <nav className="sidebar-nav" aria-label="Main navigation">
          <NavLink to="/" end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <span className="nav-icon">⌂</span>
            Dashboard
          </NavLink>
          <NavLink to="/users" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <span className="nav-icon">◌</span>
            User Management
          </NavLink>
          <NavLink to="/analytics" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <span className="nav-icon">◔</span>
            Analytics
          </NavLink>
        </nav>

        <div className="sidebar-bottom">
          <button type="button" className="logout-btn" onClick={onLogout}>
            Logout
          </button>
          <p className="signed-user">Signed in as {displayName}</p>
        </div>
      </aside>

      <main className="dashboard-main">
        <header className="main-header">
          <h1>
            {showWelcome ? (
              <>
                Welcome to <span>{heading}</span>
              </>
            ) : (
              <span>{heading}</span>
            )}
          </h1>
          <p>{subheading}</p>
        </header>

        {children}
      </main>
    </div>
  )
}

export default DashboardLayout
