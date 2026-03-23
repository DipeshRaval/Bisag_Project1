import { useEffect, useMemo, useRef, useState } from 'react'
import { PhoneNumberUtil } from 'google-libphonenumber'
import { Link, useNavigate, useParams } from 'react-router-dom'
import DashboardLayout from '../components/DashboardLayout'
import { API_BASE_URL, apiFetch, apiFetchJson } from '../utils/api'
import { clearAuthentication } from '../utils/auth'

const EditUserPage = () => {
  const navigate = useNavigate()
  const { id } = useParams()
  const dateInputRef = useRef(null)

  const [sessionUser, setSessionUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [status, setStatus] = useState({ message: '', error: false })

  const [formData, setFormData] = useState({
    fullName: '',
    gender: '',
    dob: '',
    email: '',
    countryCode: '+91',
    mobileNumber: '',
  })
  const [files, setFiles] = useState({ profileImage: null, document: null })
  const [existingUploads, setExistingUploads] = useState({ profileImagePath: '', documentPath: '' })
  const [errors, setErrors] = useState({})
  const [dobFocused, setDobFocused] = useState(false)

  const allowedEmailDomains = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'zoho.com', 'icloud.com', 'proton.me', 'aol.com']
  const countryCodes = ['+91', '+1', '+44', '+61', '+81', '+49', '+33', '+34', '+39', '+971', '+65']
  const phoneUtil = useMemo(() => PhoneNumberUtil.getInstance(), [])

  const profileImageUrl = (path) => (path ? `${API_BASE_URL}/uploads/${path}` : '')
  const documentUrl = (path) => (path ? `${API_BASE_URL}/uploads/${path}` : '')

  useEffect(() => {
    let mounted = true

    const loadData = async () => {
      try {
        setLoading(true)
        const [sessionRes, usersRes] = await Promise.all([
          apiFetch('/api/session', { method: 'GET' }),
          apiFetch('/api/users', { method: 'GET' }),
        ])

        if (!sessionRes.ok || !usersRes.ok) {
          throw new Error('Session expired')
        }

        const sessionData = await sessionRes.json()
        const usersData = await usersRes.json()
        const user = (usersData.users || []).find((u) => u.id === id)

        if (!user) {
          throw new Error('User not found')
        }

        if (!mounted) return

        setSessionUser(sessionData.user)
        setFormData({
          fullName: user.fullName || '',
          gender: user.gender || '',
          dob: user?.dob ? new Date(user.dob).toISOString().slice(0, 10) : '',
          email: user.email || '',
          countryCode: user.countryCode || '+91',
          mobileNumber: user.mobileNumber || '',
        })
        setExistingUploads({
          profileImagePath: user.profileImagePath || '',
          documentPath: user.documentPath || '',
        })
      } catch (err) {
        clearAuthentication()
        if (!mounted) return
        navigate('/signin', { replace: true })
      } finally {
        if (mounted) setLoading(false)
      }
    }

    loadData()

    return () => {
      mounted = false
    }
  }, [id, navigate])

  const handleLogout = async () => {
    try {
      await apiFetch('/api/signout', { method: 'POST' })
    } finally {
      clearAuthentication()
      navigate('/signin', { replace: true })
    }
  }

  const phoneHint = (code) => (code === '+91' ? 'India: 10 digits; must start with 6, 7, 8, or 9.' : `Use a valid number for ${code}`)

  const formatDateDisplay = (value) => {
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return null
    return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(parsed)
  }

  const normalizeDobInput = (value) => {
    if (!value) return ''
    const slashMatch = value.trim().match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/)
    if (slashMatch) {
      const [, d, m, y] = slashMatch
      const year = y.length === 2 ? Number(`20${y}`) : Number(y)
      const dateObj = new Date(year, Number(m) - 1, Number(d))
      if (!Number.isNaN(dateObj.getTime())) return dateObj.toISOString().slice(0, 10)
    }
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return ''
    return parsed.toISOString().slice(0, 10)
  }

  const validators = {
    fullName: (value) => {
      if (!value.trim()) return 'Full name is required'
      if (!/^[A-Za-z ]+$/.test(value)) return 'Only letters and spaces allowed'
      return ''
    },
    gender: (value) => (!value ? 'Gender is required' : ''),
    dob: (value) => {
      if (!value) return 'Date of birth is required'
      const parsed = new Date(value)
      if (Number.isNaN(parsed.getTime())) return 'Use format like 01 Mar 2026'
      return ''
    },
    email: (value) => {
      if (!value) return 'Email is required'
      const parts = value.split('@')
      if (parts.length !== 2) return 'Enter a valid email'
      const domain = parts[1].toLowerCase()
      if (!allowedEmailDomains.includes(domain)) return 'Use a popular email domain (gmail, yahoo, outlook, hotmail, zoho, icloud, proton, aol)'
      return ''
    },
    mobileNumber: (value, data) => {
      if (!value) return 'Mobile number is required'
      try {
        const number = phoneUtil.parse(`${data.countryCode}${value}`)
        if (!phoneUtil.isValidNumber(number)) return 'Enter a valid phone number'
        return ''
      } catch (e) {
        return 'Enter a valid phone number'
      }
    },
    profileImage: (file, _data, existing) => {
      if (!file && !existing?.profileImagePath) return 'Profile image is required'
      if (!file) return ''
      const isJpeg = /image\/(jpeg|jpg)/.test(file.type)
      if (!isJpeg) return 'Profile image must be JPEG'
      if (file.size > 1 * 1024 * 1024) return 'Profile image must be under 1MB'
      return ''
    },
    document: (file, _data, existing) => {
      if (!file && !existing?.documentPath) return 'Document is required'
      if (!file) return ''
      const ok = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
      if (!ok.includes(file.type)) return 'Document must be PDF or DOC/DOCX'
      if (file.size > 5 * 1024 * 1024) return 'Document must be under 5MB'
      return ''
    },
  }

  const setFieldError = (field, message) => {
    setErrors((prev) => ({ ...prev, [field]: message }))
  }

  const handleFocus = (e) => {
    const { name } = e.target
    if (name === 'dob') setDobFocused(true)
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    const nextValue = name === 'fullName' ? value.replace(/\s+/g, ' ') : value
    const nextForm = { ...formData, [name]: nextValue }
    setFormData(nextForm)
    const validationMessage = validators[name]?.(nextValue, nextForm, existingUploads) || ''
    setFieldError(name, validationMessage)
    if (name === 'countryCode' && formData.mobileNumber) {
      const mobileMsg = validators.mobileNumber(formData.mobileNumber, nextForm) || ''
      setFieldError('mobileNumber', mobileMsg)
    }
  }

  const handleBlur = (e) => {
    const { name, value } = e.target
    if (name === 'dob') {
      setDobFocused(false)
      const normalized = normalizeDobInput(value)
      if (normalized) {
        setFormData((prev) => ({ ...prev, dob: normalized }))
        setFieldError('dob', validators.dob(normalized, { ...formData, dob: normalized }, existingUploads) || '')
        return
      }
    }
    if (name === 'fullName' && value) {
      const capped = value
        .trim()
        .split(' ')
        .filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ')
      setFormData((prev) => ({ ...prev, [name]: capped }))
      setFieldError(name, validators[name]?.(capped, { ...formData, [name]: capped }, existingUploads) || '')
      return
    }
    setFieldError(name, validators[name]?.(value, formData, existingUploads) || '')
  }

  const handleDatePickerChange = (e) => {
    const { value } = e.target
    if (!value) return
    const normalized = normalizeDobInput(value)
    if (normalized) {
      setFormData((prev) => ({ ...prev, dob: normalized }))
      setFieldError('dob', validators.dob(normalized, { ...formData, dob: normalized }, existingUploads) || '')
    }
  }

  const handleFileChange = (e) => {
    const { name, files: selected } = e.target
    const file = selected?.[0] ?? null
    setFiles((prev) => ({ ...prev, [name]: file }))
    const validationMessage = validators[name]?.(file, formData, existingUploads) || ''
    setFieldError(name, validationMessage)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setStatus({ message: '', error: false })
    setSubmitting(true)

    try {
      const nextErrors = {}
      Object.entries(formData).forEach(([key, value]) => {
        const msg = validators[key]?.(value, formData, existingUploads) || ''
        if (msg) nextErrors[key] = msg
      })
      const profileMsg = validators.profileImage(files.profileImage, formData, existingUploads)
      const docMsg = validators.document(files.document, formData, existingUploads)
      if (profileMsg) nextErrors.profileImage = profileMsg
      if (docMsg) nextErrors.document = docMsg

      setErrors(nextErrors)
      if (Object.keys(nextErrors).length) {
        setSubmitting(false)
        return
      }

      const fd = new FormData()
      Object.entries(formData).forEach(([key, value]) => fd.append(key, value))
      if (files.profileImage) fd.append('profileImage', files.profileImage)
      if (files.document) fd.append('document', files.document)

      const { res, data } = await apiFetchJson(`/api/users/${id}`, {
        method: 'PATCH',
        body: fd,
      })

      if (!res.ok) {
        throw new Error(data?.message || 'Failed to update user')
      }

      setStatus({ message: data?.message || 'User updated successfully.', error: false })
      navigate('/users', { replace: true })
    } catch (err) {
      setStatus({ message: err.message || 'Unable to update user', error: true })
    } finally {
      setSubmitting(false)
    }
  }

  const fieldBorder = (name, value) => {
    if (errors[name]) return 'border-red-400'
    if (value) return 'border-emerald-300'
    return 'border-slate-200'
  }

  return (
    <DashboardLayout
      heading="Edit User"
      subheading="Update user profile details with full validation"
      sessionUser={sessionUser}
      onLogout={handleLogout}
      showWelcome={false}
    >
      <section className="dashboard-card">
        {loading ? (
          <p className="empty-note">Loading user details...</p>
        ) : (
          <div className="bg-gradient-to-br from-[#dbeafe] via-white to-[#e0e7ff] px-4 py-6 font-['Manrope',system-ui,sans-serif] text-slate-900">
            <div className="mx-auto max-w-5xl rounded-3xl border border-white/70 bg-white/85 px-8 py-10 shadow-2xl shadow-indigo-100 backdrop-blur">
              <header className="text-center">
                <h2 className="text-3xl font-semibold text-indigo-700">Edit User Account</h2>
                <p className="mt-2 text-sm text-slate-600">Same validations as signup are applied to this update form</p>
              </header>

              <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-sm font-semibold text-slate-800">Full Name *</label>
                    <input
                      required
                      name="fullName"
                      value={formData.fullName}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      placeholder="Your name"
                      className={`mt-2 w-full rounded-2xl border bg-white px-4 py-3 shadow-sm outline-none transition focus:border-indigo-300 focus:shadow-lg focus:shadow-indigo-100 ${fieldBorder('fullName', formData.fullName)}`}
                    />
                    <p className={`mt-1 text-xs ${errors.fullName ? 'text-red-500' : 'text-slate-500'}`}>
                      {errors.fullName || 'Letters and spaces only. Auto-capitalizes each name.'}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-slate-800">Gender *</label>
                    <select
                      required
                      name="gender"
                      value={formData.gender}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      className={`mt-2 w-full rounded-2xl border bg-white px-4 py-3 shadow-sm outline-none transition focus:border-indigo-300 focus:shadow-lg focus:shadow-indigo-100 ${fieldBorder('gender', formData.gender)}`}
                    >
                      <option value="">Select Gender</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                    {errors.gender ? <p className="mt-1 text-xs text-red-500">{errors.gender}</p> : null}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-sm font-semibold text-slate-800">Date of Birth *</label>
                    <div className="mt-2 flex gap-3">
                      <input
                        required
                        type="text"
                        name="dob"
                        value={dobFocused ? formData.dob : formData.dob ? formatDateDisplay(formData.dob) || formData.dob : ''}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        onFocus={handleFocus}
                        className={`flex-1 rounded-2xl border bg-white px-4 py-3 shadow-sm outline-none transition focus:border-indigo-300 focus:shadow-lg focus:shadow-indigo-100 ${fieldBorder('dob', formData.dob)}`}
                        placeholder="01 Mar 2026 or 01/03/26"
                      />
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => dateInputRef.current?.showPicker?.() || dateInputRef.current?.click()}
                          className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-3 py-3 text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                          aria-label="Open calendar"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
                            <rect x="3.5" y="5" width="17" height="15" rx="2" ry="2" />
                            <path d="M8 3v4m8-4v4M4 10.5h16" />
                          </svg>
                        </button>
                        <input
                          ref={dateInputRef}
                          type="date"
                          className="absolute left-0 top-full h-10 w-10 opacity-0"
                          onChange={handleDatePickerChange}
                        />
                      </div>
                    </div>
                    <p className={`mt-1 text-xs ${errors.dob ? 'text-red-500' : 'text-slate-500'}`}>
                      {errors.dob || (formData.dob ? `Selected: ${formatDateDisplay(formData.dob) || formData.dob}` : 'Type a date or use the picker (e.g., 01 Mar 2026)')}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-slate-800">Email Address *</label>
                    <input
                      required
                      type="email"
                      name="email"
                      value={formData.email}
                      readOnly
                      placeholder="you@example.com"
                      className={`mt-2 w-full rounded-2xl border bg-white px-4 py-3 shadow-sm outline-none transition focus:border-indigo-300 focus:shadow-lg focus:shadow-indigo-100 ${fieldBorder('email', formData.email)}`}
                    />
                    <p className={`mt-1 text-xs ${errors.email ? 'text-red-500' : 'text-slate-500'}`}>
                      {errors.email || 'Email is read-only on edit page.'}
                    </p>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-800">Mobile Number * (India)</label>
                  <div className="mt-2 flex gap-3">
                    <select
                      name="countryCode"
                      value={formData.countryCode}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      className="w-32 rounded-2xl border border-slate-200 bg-white px-3 py-3 shadow-sm outline-none transition focus:border-indigo-300 focus:shadow-lg focus:shadow-indigo-100"
                    >
                      {countryCodes.map((code) => (
                        <option key={code} value={code}>{code}</option>
                      ))}
                    </select>
                    <input
                      required
                      name="mobileNumber"
                      value={formData.mobileNumber}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      placeholder="98765-43210"
                      className={`flex-1 rounded-2xl border bg-white px-4 py-3 shadow-sm outline-none transition focus:border-indigo-300 focus:shadow-lg focus:shadow-indigo-100 ${fieldBorder('mobileNumber', formData.mobileNumber)}`}
                    />
                  </div>
                  <p className={`mt-1 text-xs ${errors.mobileNumber ? 'text-red-500' : 'text-slate-500'}`}>
                    {errors.mobileNumber || phoneHint(formData.countryCode)}
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-6 text-center shadow-inner">
                    <label className="flex h-full cursor-pointer flex-col items-center justify-center gap-2 text-sm text-slate-600">
                      <span className="font-semibold text-slate-700">Profile Image *</span>
                      <span className="text-xs text-slate-500">Click to upload profile image (JPG/JPEG, max 1MB)</span>
                      <input
                        type="file"
                        name="profileImage"
                        accept="image/jpeg,image/jpg"
                        className="hidden"
                        onChange={handleFileChange}
                      />
                      {files.profileImage ? <span className="text-xs text-indigo-600">{files.profileImage.name}</span> : null}
                      {errors.profileImage ? <span className="text-xs text-red-500">{errors.profileImage}</span> : null}
                      {!files.profileImage && existingUploads.profileImagePath ? (
                        <img
                          src={profileImageUrl(existingUploads.profileImagePath)}
                          alt="Current profile"
                          className="mt-2 h-16 w-16 rounded-full object-cover"
                        />
                      ) : null}
                    </label>
                  </div>
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-6 text-center shadow-inner">
                    <label className="flex h-full cursor-pointer flex-col items-center justify-center gap-2 text-sm text-slate-600">
                      <span className="font-semibold text-slate-700">Document *</span>
                      <span className="text-xs text-slate-500">Click to upload PDF/DOC/DOCX (max 5MB)</span>
                      <input
                        type="file"
                        name="document"
                        accept="application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        className="hidden"
                        onChange={handleFileChange}
                      />
                      {files.document ? <span className="text-xs text-indigo-600">{files.document.name}</span> : null}
                      {errors.document ? <span className="text-xs text-red-500">{errors.document}</span> : null}
                      {!files.document && existingUploads.documentPath ? (
                        <a className="doc-link" href={documentUrl(existingUploads.documentPath)} target="_blank" rel="noreferrer">Current document</a>
                      ) : null}
                    </label>
                  </div>
                </div>

                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="flex flex-1 flex-col gap-2 md:flex-row md:items-center md:gap-3">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full rounded-2xl bg-gradient-to-r from-indigo-500 to-pink-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-200 transition hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-pink-200 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {submitting ? 'Updating...' : 'Save Changes'}
                    </button>
                    <Link
                      to="/users"
                      className="w-full rounded-2xl border border-slate-200 bg-white px-6 py-3 text-center text-sm font-semibold text-slate-800 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                    >
                      Back to Users
                    </Link>
                  </div>
                </div>

                {status.message ? (
                  <p className={`text-xs text-center ${status.error ? 'text-red-500' : 'text-emerald-600'}`}>{status.message}</p>
                ) : null}
              </form>
            </div>
          </div>
        )}
      </section>
    </DashboardLayout>
  )
}

export default EditUserPage
