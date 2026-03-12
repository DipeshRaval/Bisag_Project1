import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiFetchJson, API_BASE_URL, API_DEBUG } from '../utils/api'

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

const ForgotPasswordPage = () => {
  const navigate = useNavigate()

  const [step, setStep] = useState(1)
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleSendOtp = async (e) => {
    e.preventDefault()
    const emailError = validateEmail(email)
    if (emailError) {
      setError(emailError)
      setSuccess('')
      return
    }

    setSubmitting(true)
    setError('')
    setSuccess('')

    try {
      const { res, data } = await apiFetchJson('/api/password/forgot', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      })
      if (API_DEBUG) {
        console.log('[FORGOT DEBUG] Send OTP called', {
          apiBaseUrl: API_BASE_URL,
          enteredEmail: email.trim().toLowerCase(),
          status: res.status,
          payload: data,
        })
      }
      if (!res.ok) {
        throw new Error(data?.message || 'Unable to send OTP')
      }
      setSuccess(data?.message || 'OTP sent successfully')
      setStep(2)
    } catch (err) {
      setError(err.message || 'Unable to send OTP')
    } finally {
      setSubmitting(false)
    }
  }

  const handleVerifyOtp = async (e) => {
    e.preventDefault()
    if (!/^\d{6}$/.test(otp.trim())) {
      setError('Enter a valid 6-digit OTP')
      setSuccess('')
      return
    }

    setSubmitting(true)
    setError('')
    setSuccess('')

    try {
      const { res, data } = await apiFetchJson('/api/password/verify-otp', {
        method: 'POST',
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          otp: otp.trim(),
        }),
      })
      if (API_DEBUG) {
        console.log('[FORGOT DEBUG] Verify OTP called', {
          apiBaseUrl: API_BASE_URL,
          status: res.status,
          payload: data,
        })
      }
      if (!res.ok) {
        throw new Error(data?.message || 'OTP verification failed')
      }
      setSuccess(data?.message || 'OTP verified')
      setStep(3)
    } catch (err) {
      setError(err.message || 'OTP verification failed')
    } finally {
      setSubmitting(false)
    }
  }

  const handleResetPassword = async (e) => {
    e.preventDefault()

    const passwordError = validatePassword(password)
    if (passwordError) {
      setError(passwordError)
      setSuccess('')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      setSuccess('')
      return
    }

    setSubmitting(true)
    setError('')
    setSuccess('')

    try {
      const { res, data } = await apiFetchJson('/api/password/reset', {
        method: 'POST',
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
          confirmPassword,
        }),
      })
      if (API_DEBUG) {
        console.log('[FORGOT DEBUG] Reset password called', {
          apiBaseUrl: API_BASE_URL,
          status: res.status,
          payload: data,
        })
      }
      if (!res.ok) {
        throw new Error(data?.message || 'Unable to reset password')
      }
      setSuccess(data?.message || 'Password reset successful')
      setTimeout(() => navigate('/signin', { replace: true }), 1000)
    } catch (err) {
      setError(err.message || 'Unable to reset password')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#dbeafe] via-white to-[#e0e7ff] px-4 py-10 font-['Manrope',system-ui,sans-serif] text-slate-900">
      <div className="mx-auto w-full max-w-md rounded-3xl border border-white/70 bg-white/80 px-8 py-10 shadow-2xl shadow-indigo-100 backdrop-blur">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-indigo-700">Forgot Password</h1>
          <p className="mt-2 text-sm text-slate-600">
            Step {step} of 3
          </p>
        </div>

        <div className="mt-6 flex items-center gap-2">
          <div className={`h-2 flex-1 rounded-full ${step >= 1 ? 'bg-indigo-500' : 'bg-slate-200'}`} />
          <div className={`h-2 flex-1 rounded-full ${step >= 2 ? 'bg-indigo-500' : 'bg-slate-200'}`} />
          <div className={`h-2 flex-1 rounded-full ${step >= 3 ? 'bg-indigo-500' : 'bg-slate-200'}`} />
        </div>

        {step === 1 ? (
          <form className="mt-8 space-y-4" onSubmit={handleSendOtp}>
            <label className="block text-sm font-medium text-slate-700">
              <span className="mb-2 block">Registered Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-indigo-300 focus:shadow-lg focus:shadow-indigo-100"
              />
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-2xl bg-gradient-to-r from-indigo-500 to-pink-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-200 transition hover:shadow-xl hover:shadow-indigo-200 focus:outline-none focus:ring-2 focus:ring-pink-200 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {submitting ? 'Sending OTP...' : 'Send OTP'}
            </button>
          </form>
        ) : null}

        {step === 2 ? (
          <form className="mt-8 space-y-4" onSubmit={handleVerifyOtp}>
            <p className="text-xs text-slate-600">OTP has been sent to {email}</p>
            <label className="block text-sm font-medium text-slate-700">
              <span className="mb-2 block">Enter 6-digit OTP</span>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-indigo-300 focus:shadow-lg focus:shadow-indigo-100"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
                onClick={() => {
                  setStep(1)
                  setOtp('')
                  setError('')
                  setSuccess('')
                }}
              >
                Change Email
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-2xl bg-gradient-to-r from-indigo-500 to-pink-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-200 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {submitting ? 'Verifying...' : 'Verify OTP'}
              </button>
            </div>
          </form>
        ) : null}

        {step === 3 ? (
          <form className="mt-8 space-y-4" onSubmit={handleResetPassword}>
            <label className="block text-sm font-medium text-slate-700">
              <span className="mb-2 block">New Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter new password"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-indigo-300 focus:shadow-lg focus:shadow-indigo-100"
              />
            </label>

            <label className="block text-sm font-medium text-slate-700">
              <span className="mb-2 block">Confirm New Password</span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-indigo-300 focus:shadow-lg focus:shadow-indigo-100"
              />
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-2xl bg-gradient-to-r from-indigo-500 to-pink-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-200 transition hover:shadow-xl hover:shadow-indigo-200 focus:outline-none focus:ring-2 focus:ring-pink-200 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {submitting ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        ) : null}

        {error ? <p className="mt-4 text-center text-xs text-red-500">{error}</p> : null}
        {success ? <p className="mt-4 text-center text-xs text-emerald-600">{success}</p> : null}

        <div className="mt-6 text-center text-sm text-slate-600">
          Remember your password?{' '}
          <Link to="/signin" className="font-semibold text-indigo-600 hover:text-indigo-700">
            Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  )
}

export default ForgotPasswordPage
