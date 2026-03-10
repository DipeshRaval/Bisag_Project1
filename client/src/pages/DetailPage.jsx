import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../utils/api'
import { clearAuthentication } from '../utils/auth'

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

  const handleSwitchAccount = async () => {
    try {
      await apiFetch('/api/signout', { method: 'POST' })
    } catch (err) {
      // ignore sign-out API failures, local logout still proceeds
    } finally {
      clearAuthentication()
      navigate('/signup')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#dbeafe] via-white to-[#e0e7ff] px-4 py-10 font-['Manrope',system-ui,sans-serif] text-slate-900">
      <div className="mx-auto max-w-4xl rounded-3xl border border-white/60 bg-white/80 px-10 py-12 shadow-2xl shadow-indigo-100 backdrop-blur">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">Signed in</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-900">Welcome back{sessionUser?.fullName ? `, ${sessionUser.fullName.split(' ')[0]}` : ''}</h1>
            <p className="mt-2 text-base text-slate-600">
              Manage your dashboard once you sign in. Session data updates every time you authenticate so you can track activity easily.
            </p>
          </div>
          <div className="h-24 w-24 rounded-3xl bg-gradient-to-br from-indigo-500 to-pink-500 shadow-lg shadow-indigo-200" />
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-100 bg-white px-5 py-4 shadow-sm">
            <p className="text-sm font-semibold text-slate-800">Session</p>
            <p className="mt-1 text-sm text-slate-600">Email: {sessionUser?.email || 'Loading...'}</p>
            <p className="text-xs text-slate-500">Status: <span className={sessionUser?.isActive === false ? 'text-rose-500' : 'text-emerald-600'}>{sessionUser?.isActive === false ? 'Inactive' : 'Active'}</span></p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-white px-5 py-4 shadow-sm">
            <p className="text-sm font-semibold text-slate-800">Next steps</p>
            <p className="mt-1 text-sm text-slate-600">Last login: {lastLoginDisplay}</p>
          </div>
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          <button
            type="button"
            className="inline-flex items-center rounded-2xl bg-gradient-to-r from-indigo-500 to-pink-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-200 transition hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-pink-200"
            onClick={handleSignOut}
          >
            Sign Out
          </button>
          <button
            type="button"
            className="inline-flex items-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            onClick={handleSwitchAccount}
          >
            Go to Sign Up
          </button>
        </div>
      </div>
    </div>
  )
}

export default DetailPage
