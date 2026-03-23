import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import DashboardLayout from '../components/DashboardLayout'
import { apiFetch } from '../utils/api'
import { clearAuthentication } from '../utils/auth'
import './DetailPage.css'

const DetailPage = () => {
  const navigate = useNavigate()
  const [sessionUser, setSessionUser] = useState(null)

  useEffect(() => {
    let active = true
    const loadSession = async () => {
      try {
        const res = await apiFetch('/api/session', { method: 'GET' })
        if (!res.ok) {
          throw new Error('Session expired')
        }
        const data = await res.json()
        if (!active) return
        setSessionUser(data.user)
      } catch (err) {
        clearAuthentication()
        if (!active) return
        navigate('/signin', { replace: true })
      }
    }
    loadSession()
    return () => {
      active = false
    }
  }, [navigate])

  const lastLoginDisplay = useMemo(() => {
    if (!sessionUser?.lastLogin) return 'Not recorded'
    return new Intl.DateTimeFormat('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(sessionUser.lastLogin))
  }, [sessionUser])

  const handleSignOut = async () => {
    try {
      await apiFetch('/api/signout', { method: 'POST' })
    } catch (err) {
      // ignore sign-out API failures, local logout still proceeds
    } finally {
      clearAuthentication()
      navigate('/signin', { replace: true })
    }
  }

  const firstName = useMemo(() => 'Bisag-N', [])

  return (
    <DashboardLayout
      heading={`${firstName} Dashboard`}
      subheading="Manage your users and view analytics from this centralized dashboard"
      sessionUser={sessionUser}
      onLogout={handleSignOut}
    >
      <section className="dashboard-card" aria-live="polite">
        <div className="center-logo">BISAG-N</div>
        <h2>{firstName} Dashboard</h2>
        <p className="byline">By Lavya Workshop</p>

        <p className="intro">Select an option from the sidebar to get started:</p>

        <div className="quick-grid">
          <Link to="/users" className="quick-item blue" aria-label="Go to User Management">
            <h3>User Management</h3>
            <p>Manage all users</p>
          </Link>
          <Link to="/analytics" className="quick-item pink" aria-label="Go to Analytics">
            <h3>Analytics</h3>
            <p>View insights &amp; reports</p>
          </Link>
          <Link to="/" className="quick-item plain" aria-label="Go to Dashboard Home">
            <h3>Dashboard</h3>
            <p>You are here</p>
          </Link>
        </div>

        <p className="support-note">Need help? Contact support or refer to the documentation.</p>
        <p className="session-note">
          Session: {sessionUser?.email || 'Loading...'} | Last login: {lastLoginDisplay}
        </p>
      </section>
    </DashboardLayout>
  )
}

export default DetailPage
