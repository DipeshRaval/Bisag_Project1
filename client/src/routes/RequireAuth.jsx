import { useEffect, useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { apiFetch } from '../utils/api'
import { clearAuthentication, markAuthenticated } from '../utils/auth'

const RequireAuth = () => {
  const [state, setState] = useState({ checking: true, allowed: false })

  useEffect(() => {
    let active = true
    const verify = async () => {
      try {
        const res = await apiFetch('/api/session', { method: 'GET' })
        if (!res.ok) {
          throw new Error('Not authenticated')
        }
        if (!active) return
        markAuthenticated()
        setState({ checking: false, allowed: true })
      } catch (err) {
        clearAuthentication()
        if (!active) return
        setState({ checking: false, allowed: false })
      }
    }
    verify()
    return () => {
      active = false
    }
  }, [])

  if (state.checking) {
    return null
  }

  return state.allowed ? <Outlet /> : <Navigate to="/signin" replace />
}

export default RequireAuth
