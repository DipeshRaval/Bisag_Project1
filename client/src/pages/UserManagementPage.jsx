import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DashboardLayout from '../components/DashboardLayout'
import { API_BASE_URL, apiFetch } from '../utils/api'
import { clearAuthentication } from '../utils/auth'
import './DetailPage.css'

const initialEdit = {
  id: '',
  fullName: '',
  gender: '',
  dob: '',
  countryCode: '',
  mobileNumber: '',
  profileImageFile: null,
  profileImagePreview: '',
}

const UserManagementPage = () => {
  const navigate = useNavigate()
  const [sessionUser, setSessionUser] = useState(null)
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState({ message: '', error: false })
  const [editing, setEditing] = useState(initialEdit)
  const [saving, setSaving] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [genderFilter, setGenderFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortBy, setSortBy] = useState('latest')
  const [viewingUser, setViewingUser] = useState(null)
  const [lightbox, setLightbox] = useState({ src: '', title: '' })
  const [deletingUserId, setDeletingUserId] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

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

      setSessionUser(sessionData.user)
      setUsers(usersData.users || [])
      setStatus({ message: '', error: false })
    } catch (err) {
      clearAuthentication()
      navigate('/signin', { replace: true })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const filteredUsers = useMemo(() => {
    const lowerSearch = searchTerm.trim().toLowerCase()
    let data = [...users]

    if (lowerSearch) {
      data = data.filter((user) => {
        const name = user.fullName?.toLowerCase() || ''
        const email = user.email?.toLowerCase() || ''
        return name.includes(lowerSearch) || email.includes(lowerSearch)
      })
    }

    if (genderFilter !== 'all') {
      data = data.filter((user) => (user.gender || '').toLowerCase() === genderFilter)
    }

    if (statusFilter !== 'all') {
      data = data.filter((user) => (statusFilter === 'active' ? user.isActive : !user.isActive))
    }

    if (sortBy === 'latest') {
      data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    }
    if (sortBy === 'oldest') {
      data.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    }
    if (sortBy === 'name-az') {
      data.sort((a, b) => (a.fullName || '').localeCompare(b.fullName || ''))
    }
    if (sortBy === 'name-za') {
      data.sort((a, b) => (b.fullName || '').localeCompare(a.fullName || ''))
    }

    return data
  }, [users, searchTerm, genderFilter, statusFilter, sortBy])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, genderFilter, statusFilter, sortBy])

  const paginatedUsers = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    return filteredUsers.slice(startIndex, startIndex + itemsPerPage)
  }, [filteredUsers, currentPage])

  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage)

  const activeCount = useMemo(() => users.filter((u) => u.isActive).length, [users])
  const maleCount = useMemo(() => users.filter((u) => (u.gender || '').toLowerCase() === 'male').length, [users])
  const femaleCount = useMemo(() => users.filter((u) => (u.gender || '').toLowerCase() === 'female').length, [users])

  const handleLogout = async () => {
    try {
      await apiFetch('/api/signout', { method: 'POST' })
    } finally {
      clearAuthentication()
      navigate('/signin', { replace: true })
    }
  }

  const updateStatus = async (user, nextActive) => {
    try {
      const res = await apiFetch(`/api/users/${user.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: nextActive }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.message || 'Failed to update status')
      setUsers((prev) => prev.map((u) => (u.id === user.id ? data.user : u)))
      setStatus({ message: `${data.user.fullName} is now ${data.user.isActive ? 'Active' : 'Disabled'}.`, error: false })
    } catch (err) {
      setStatus({ message: err.message || 'Unable to update status', error: true })
    }
  }

  const openEdit = (user) => {
    const preview = user.profileImagePath ? profileImageUrl(user.profileImagePath) : ''
    setEditing({
      id: user.id,
      fullName: user.fullName || '',
      gender: user.gender || '',
      dob: user?.dob ? new Date(user.dob).toISOString().slice(0, 10) : '',
      countryCode: user.countryCode || '',
      mobileNumber: user.mobileNumber || '',
      profileImageFile: null,
      profileImagePreview: preview,
    })
  }

  const closeEdit = () => {
    if (editing.profileImagePreview?.startsWith('blob:')) {
      URL.revokeObjectURL(editing.profileImagePreview)
    }
    setEditing(initialEdit)
  }

  const handleEditChange = (e) => {
    const { name, value } = e.target
    setEditing((prev) => ({ ...prev, [name]: value }))
  }

  const handleProfileImageChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) {
      setEditing((prev) => ({ ...prev, profileImageFile: null }))
      return
    }

    const isJpeg = ['image/jpeg', 'image/jpg'].includes(file.type)
    if (!isJpeg) {
      setStatus({ message: 'Profile image must be JPG/JPEG.', error: true })
      return
    }

    setEditing((prev) => {
      if (prev.profileImagePreview?.startsWith('blob:')) {
        URL.revokeObjectURL(prev.profileImagePreview)
      }
      return {
        ...prev,
        profileImageFile: file,
        profileImagePreview: URL.createObjectURL(file),
      }
    })
  }

  const saveEdit = async (e) => {
    e.preventDefault()
    if (!editing.id) return

    try {
      setSaving(true)
      const payload = new FormData()
      payload.append('fullName', editing.fullName)
      payload.append('gender', editing.gender)
      payload.append('dob', editing.dob)
      payload.append('countryCode', editing.countryCode)
      payload.append('mobileNumber', editing.mobileNumber)

      if (editing.profileImageFile) {
        payload.append('profileImage', editing.profileImageFile)
      }

      const res = await apiFetch(`/api/users/${editing.id}`, {
        method: 'PATCH',
        body: payload,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.message || 'Failed to save user')

      setUsers((prev) => prev.map((u) => (u.id === editing.id ? data.user : u)))
      setStatus({ message: 'User updated successfully.', error: false })
      closeEdit()
    } catch (err) {
      setStatus({ message: err.message || 'Unable to save user', error: true })
    } finally {
      setSaving(false)
    }
  }

  const openView = (user) => setViewingUser(user)
  const closeView = () => setViewingUser(null)

  const openImage = (src, title) => setLightbox({ src, title })
  const closeImage = () => setLightbox({ src: '', title: '' })

  const deleteUser = async (user) => {
    const shouldDelete = window.confirm(`Delete ${user.fullName}? This action cannot be undone.`)
    if (!shouldDelete) return

    try {
      setDeletingUserId(user.id)
      const res = await apiFetch(`/api/users/${user.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.message || 'Failed to delete user')

      setUsers((prev) => prev.filter((u) => u.id !== user.id))
      if (viewingUser?.id === user.id) {
        closeView()
      }
      setStatus({ message: 'User deleted successfully.', error: false })
    } catch (err) {
      setStatus({ message: err.message || 'Unable to delete user', error: true })
    } finally {
      setDeletingUserId('')
    }
  }

  const clearFilters = () => {
    setSearchTerm('')
    setGenderFilter('all')
    setStatusFilter('all')
    setSortBy('latest')
  }
  const formatRegDate = (value) => {
    if (!value) return '--'
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value))
  }

  const formatDob = (value) => {
    if (!value) return '--'
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(value))
  }

  const profileImageUrl = (path) => (path ? `${API_BASE_URL}/uploads/${path}` : '')
  const documentUrl = (path) => (path ? `${API_BASE_URL}/uploads/${path}` : '')

  return (
    <DashboardLayout
      heading="User Management"
      subheading="Comprehensive user management system"
      sessionUser={sessionUser}
      onLogout={handleLogout}
      showWelcome={false}
    >
      <section className="dashboard-card users-card users-screen">
        <div className="summary-row" style={{ marginTop: 0, marginBottom: '20px' }}>
          <article className="summary-card blue">
            <p>Total Users</p>
            <h4>{users.length}</h4>
          </article>
          <article className="summary-card green">
            <p>Active Users</p>
            <h4>{activeCount}</h4>
          </article>
          <article className="summary-card purple">
            <p>Male Users</p>
            <h4>{maleCount}</h4>
          </article>
          <article className="summary-card pink">
            <p>Female Users</p>
            <h4>{femaleCount}</h4>
          </article>
        </div>

        <div className="table-controls">
          <input
            type="text"
            className="search-input"
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <div style={{ flex: 1 }} />
          <button type="button" className="light-btn" onClick={loadData}>Refresh</button>
          <button type="button" className="soft-blue-btn" onClick={() => navigate('/analytics')}>Analytics</button>
          <button type="button" className="soft-red-btn" onClick={handleLogout}>Logout</button>
        </div>

        <div className="filter-panel">
          <div className="users-toolbar">
            <p>Filters &amp; Sorting</p>
            <div className="toolbar-actions">
              <button type="button" className="light-btn" onClick={clearFilters}>Clear Filters</button>
            </div>
          </div>

          <div className="filter-grid">
            <label>
              Gender
              <select value={genderFilter} onChange={(e) => setGenderFilter(e.target.value)}>
                <option value="all">All Genders</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label>
              Activation Status
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
            <label>
              Sort By
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="latest">Latest First</option>
                <option value="oldest">Oldest First</option>
                <option value="name-az">Name A-Z</option>
                <option value="name-za">Name Z-A</option>
              </select>
            </label>
          </div>
        </div>

        {status.message ? (
          <p className={`users-status ${status.error ? 'error' : 'ok'}`}>{status.message}</p>
        ) : null}

        {loading ? (
          <p className="empty-note">Loading users...</p>
        ) : filteredUsers.length === 0 ? (
          <p className="empty-note">No users found.</p>
        ) : (
          <div className="users-table-wrap">
            <table className="users-table">
              <thead>
                <tr>
                  <th>Name &amp; Details</th>
                  <th>Registration Date</th>
                  <th>Date of Birth</th>
                  <th>Gender</th>
                  <th>Profile Image</th>
                  <th>Document</th>
                  <th>Actions</th>
                  <th>Active Status</th>
                </tr>
              </thead>
              <tbody>
                {paginatedUsers.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div className="name-cell">
                        <strong>{user.fullName}</strong>
                        <span>{user.email}</span>
                        <span>{user.countryCode} {user.mobileNumber}</span>
                      </div>
                    </td>
                    <td>{formatRegDate(user.createdAt)}</td>
                    <td>{formatDob(user.dob)}</td>
                    <td><span className="gender-pill">{user.gender || '-'}</span></td>
                    <td>
                      {user.profileImagePath ? (
                        <button
                          type="button"
                          className="image-view-btn"
                          onClick={() => openImage(profileImageUrl(user.profileImagePath), `${user.fullName} profile image`)}
                        >
                          <img src={profileImageUrl(user.profileImagePath)} alt={user.fullName} className="avatar-thumb" />
                        </button>
                      ) : (
                        <div className="avatar-fallback">N/A</div>
                      )}
                    </td>
                    <td>
                      {user.documentPath ? (
                        <a className="doc-link" href={documentUrl(user.documentPath)} target="_blank" rel="noreferrer">View</a>
                      ) : (
                        <span className="muted">No file</span>
                      )}
                    </td>
                    <td>
                      <div className="table-actions">
                        <button type="button" className="light-btn" onClick={() => openView(user)}>View</button>
                        <button type="button" className="warn-btn" onClick={() => openEdit(user)}>Edit</button>
                        <button
                          type="button"
                          className="delete-btn"
                          onClick={() => deleteUser(user)}
                          disabled={deletingUserId === user.id}
                        >
                          {deletingUserId === user.id ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    </td>
                    <td>
                      <div className="status-actions">
                        <button
                          type="button"
                          className={`status-pill ${user.isActive ? 'selected-on' : ''}`}
                          onClick={() => updateStatus(user, true)}
                          disabled={user.isActive}
                        >
                          Active
                        </button>
                        <button
                          type="button"
                          className={`status-pill ${!user.isActive ? 'selected-off' : ''}`}
                          onClick={() => updateStatus(user, false)}
                          disabled={!user.isActive}
                        >
                          Deactive
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="pagination-controls" style={{ display: 'flex', gap: '10px', marginTop: '14px', alignItems: 'center', justifyContent: 'center' }}>
            <button
              type="button"
              className="light-btn"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </button>
            <span style={{ fontSize: '12px', color: '#667085' }}>
              Page {currentPage} of {totalPages}
            </span>
            <button
              type="button"
              className="light-btn"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </button>
          </div>
        )}
      </section>

      {editing.id ? (
        <div className="modal-backdrop" role="presentation" onClick={closeEdit}>
          <section className="edit-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h3>Edit User</h3>
            <p>Edit any fields below without changing email.</p>
            <form onSubmit={saveEdit} className="edit-form">
              <label>
                Full Name
                <input name="fullName" value={editing.fullName} onChange={handleEditChange} required />
              </label>
              <label>
                Gender
                <select name="gender" value={editing.gender} onChange={handleEditChange}>
                  <option value="">Select</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label>
                DOB
                <input type="date" name="dob" value={editing.dob} onChange={handleEditChange} />
              </label>
              <label>
                Country Code
                <input name="countryCode" value={editing.countryCode} onChange={handleEditChange} />
              </label>
              <label>
                Mobile Number
                <input name="mobileNumber" value={editing.mobileNumber} onChange={handleEditChange} />
              </label>
              <label>
                Profile Picture (JPG/JPEG)
                <input type="file" accept=".jpg,.jpeg,image/jpeg" onChange={handleProfileImageChange} />
              </label>
              {editing.profileImagePreview ? (
                <button
                  type="button"
                  className="image-view-btn preview-wrap"
                  onClick={() => openImage(editing.profileImagePreview, 'Profile preview')}
                >
                  <img src={editing.profileImagePreview} alt="Profile preview" className="edit-image-preview" />
                </button>
              ) : null}
              <div className="modal-actions">
                <button type="button" className="light-btn" onClick={closeEdit}>Cancel</button>
                <button type="submit" className="ok-btn" disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      {viewingUser ? (
        <div className="modal-backdrop" role="presentation" onClick={closeView}>
          <section className="edit-modal view-modal view-modal-modern p-3" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <header className="vm-header">
              <div className="vm-profile">
                {viewingUser.profileImagePath ? (
                  <button
                    type="button"
                    className="image-view-btn"
                    onClick={() => openImage(profileImageUrl(viewingUser.profileImagePath), `${viewingUser.fullName} profile image`)}
                    aria-label="Open profile image"
                  >
                    <img src={profileImageUrl(viewingUser.profileImagePath)} alt={viewingUser.fullName} className="vm-avatar" />
                  </button>
                ) : (
                  <div className="vm-avatar-fallback">
                    {(viewingUser.fullName || '?').charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="vm-meta">
                  <h3>{viewingUser.fullName}</h3>
                  <p>{viewingUser.email}</p>
                  <div className="vm-badges">
                    <span className="vm-chip">{viewingUser.gender || '--'}</span>
                    <span className={`vm-chip ${viewingUser.isActive ? 'status-active' : 'status-inactive'}`}>
                      {viewingUser.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              </div>
            </header>

            <div className="vm-body">
              <div className="vm-grid">
                <article className="vm-card">
                  <span className="vm-label">Mobile Number</span>
                  <strong className="vm-value">{viewingUser.countryCode} {viewingUser.mobileNumber}</strong>
                </article>
                <article className="vm-card">
                  <span className="vm-label">Date of Birth</span>
                  <strong className="vm-value">{formatDob(viewingUser.dob)}</strong>
                </article>
                <article className="vm-card">
                  <span className="vm-label">Registration Date</span>
                  <strong className="vm-value">{formatRegDate(viewingUser.createdAt)}</strong>
                </article>
                <article className="vm-card">
                  <span className="vm-label">Last Login</span>
                  <strong className="vm-value">{formatRegDate(viewingUser.lastLogin)}</strong>
                </article>
                <article className="vm-card vm-card-wide">
                  <span className="vm-label">Document</span>
                  {viewingUser.documentPath ? (
                    <a className="vm-doc-link" href={documentUrl(viewingUser.documentPath)} target="_blank" rel="noreferrer">
                      Open Uploaded Document
                    </a>
                  ) : (
                    <span className="muted">No file uploaded</span>
                  )}
                </article>
              </div>
            </div>

            <div className="modal-actions p-3 pt-0">
              <button type="button" className="light-btn" onClick={closeView}>Close</button>
              <button type="button" className="warn-btn" onClick={() => { closeView(); openEdit(viewingUser) }}>Edit</button>
              <button
                type="button"
                className="delete-btn"
                onClick={() => deleteUser(viewingUser)}
                disabled={deletingUserId === viewingUser.id}
              >
                {deletingUserId === viewingUser.id ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {lightbox.src ? (
        <div className="modal-backdrop image-lightbox" role="presentation" onClick={closeImage}>
          <figure className="lightbox-figure" onClick={(e) => e.stopPropagation()}>
            <img src={lightbox.src} alt={lightbox.title || 'Image preview'} className="lightbox-image" />
            <figcaption>{lightbox.title}</figcaption>
            <button type="button" className="light-btn" onClick={closeImage}>Close</button>
          </figure>
        </div>
      ) : null}
    </DashboardLayout>
  )
}

export default UserManagementPage
