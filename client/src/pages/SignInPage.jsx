import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiFetch } from '../utils/api'
import { clearAuthentication, markAuthenticated } from '../utils/auth'

const Field = ({ label, type, name, placeholder, note, onChange, value }) => (
  <label className="block text-sm font-medium text-slate-700">
    <span className="mb-2 block">{label}</span>
    <div className="relative">
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:-translate-y-0.5 focus:border-indigo-300 focus:shadow-lg focus:shadow-indigo-100"
      />
      {type === 'password' ? (
        <span className="absolute inset-y-0 right-0 grid place-items-center px-4 text-slate-400">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
            <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z" />
            <circle cx="12" cy="12" r="2.5" />
          </svg>
        </span>
      ) : (
        <span className="absolute inset-y-0 right-0 grid place-items-center px-4 text-slate-400">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4z" />
            <path d="M4 20c0-2.21 3.58-4 8-4s8 1.79 8 4" />
          </svg>
        </span>
      )}
    </div>
    {note ? <p className="mt-2 text-xs text-slate-500">{note}</p> : null}
  </label>
)

const SignInPage = () => {
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState({})
  const [status, setStatus] = useState({ message: '', error: false })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const syncSession = async () => {
      try {
        const res = await apiFetch('/api/session', { method: 'GET' })
        if (res.ok) {
          markAuthenticated()
          navigate('/', { replace: true })
        } else {
          clearAuthentication()
        }
      } catch (err) {
        clearAuthentication()
      }
    }
    syncSession()
  }, [navigate])

  const validateEmail = (value) => {
    if (!value) return 'Email is required'
    const parts = value.split('@')
    if (parts.length !== 2) return 'Enter a valid email'
    const allowed = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'zoho.com', 'icloud.com', 'proton.me', 'aol.com']
    if (!allowed.includes(parts[1].toLowerCase())) return 'Use a popular email domain'
    return ''
  }

  const validatePassword = (value) => {
    if (!value) return 'Password is required'
    if (value.length < 8) return 'At least 8 characters'
    if (!/[A-Z]/.test(value)) return 'Include at least 1 uppercase letter'
    if (!/[a-z]/.test(value)) return 'Include at least 1 lowercase letter'
    if (!/\d/.test(value)) return 'Include at least 1 number'
    if (!/[^A-Za-z0-9]/.test(value)) return 'Include at least 1 special character'
    if (/(123|abc|password|qwerty)/i.test(value)) return 'Avoid common patterns'
    return ''
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const emailError = validateEmail(form.email)
    const passwordError = validatePassword(form.password)
    if (emailError || passwordError) {
      setErrors({ email: emailError, password: passwordError })
      return
    }
    setErrors({})
    setStatus({ message: '', error: false })
    setSubmitting(true)
    try {
      const res = await apiFetch('/api/signin', {
        method: 'POST',
        body: JSON.stringify({ email: form.email, password: form.password }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.message || 'Unable to sign in')
      }
      markAuthenticated()
      setStatus({ message: 'Signed in successfully.', error: false })
      navigate('/', { replace: true })
    } catch (err) {
      setStatus({ message: err.message || 'Unable to sign in', error: true })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#dbeafe] via-white to-[#e0e7ff] px-4 py-10 font-['Manrope',system-ui,sans-serif] text-slate-900">
      <div className="relative mx-auto flex max-w-4xl flex-col items-center">
        <div className="absolute -left-8 -top-8 h-28 w-28 rounded-full bg-gradient-to-br from-indigo-200 to-purple-200 blur-3xl" aria-hidden="true" />
        <div className="absolute bottom-16 right-4 h-24 w-24 rounded-full bg-gradient-to-tr from-pink-100 to-indigo-100 blur-3xl" aria-hidden="true" />

        <div className="relative w-full max-w-md rounded-3xl border border-white/70 bg-white/80 px-8 py-10 shadow-2xl shadow-indigo-100 backdrop-blur">
          <div className="absolute -right-6 -top-6 h-16 w-16 rounded-3xl bg-gradient-to-br from-indigo-100 to-purple-50" aria-hidden="true" />
          <div className="flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 shadow-lg shadow-indigo-200">
              <span className="text-xl font-semibold text-white">L</span>
            </div>
          </div>

          <div className="mt-6 text-center">
            <h1 className="text-2xl font-semibold text-indigo-700">Heartily Welcome</h1>
            <p className="mt-2 text-sm text-slate-600">Sign in to your account</p>
          </div>

          <div className="mt-8 space-y-6">
            <div className="space-y-2">
              <Field
                label="Email Address *"
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="you@example.com"
                note="Allowed characters: letters, numbers, and $._- (only one @)"
              />
              {errors.email ? <p className="text-xs text-red-500">{errors.email}</p> : null}
            </div>

            <div className="space-y-1">
              <Field
                label="Password *"
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                placeholder="Enter your password"
              />
              {errors.password ? <p className="text-xs text-red-500">{errors.password}</p> : null}
            </div>

            <div className="flex items-center justify-between text-xs font-medium text-indigo-600">
              <button className="transition hover:text-indigo-700" type="button">Forgot Email?</button>
              <button className="transition hover:text-indigo-700" type="button">Forgot Password?</button>
            </div>

            <button
              type="button"
              className="w-full rounded-2xl bg-gradient-to-r from-indigo-500 to-pink-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-200 transition hover:shadow-xl hover:shadow-indigo-200 focus:outline-none focus:ring-2 focus:ring-pink-200 disabled:cursor-not-allowed disabled:opacity-70"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? 'Signing In...' : 'Sign In'}
            </button>
            {status.message ? (
              <p className={`text-center text-xs ${status.error ? 'text-red-500' : 'text-emerald-600'}`}>{status.message}</p>
            ) : null}

            <div className="relative my-2 h-px bg-slate-200">
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-white px-4 text-xs text-slate-500">OR</span>
            </div>

            <div className="text-center">
              <p className="text-sm text-slate-600">Don&apos;t have an account?</p>
              <Link
                to="/signup"
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4z" />
                  <path d="M4 20c0-2.21 3.58-4 8-4s8 1.79 8 4" />
                  <path d="M15 12h2m-1-1v2" />
                </svg>
                Create New Account
              </Link>
            </div>

            <p className="mt-4 text-center text-[11px] text-slate-500">
              By signing in, you agree to our Terms and Privacy Policy
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SignInPage
