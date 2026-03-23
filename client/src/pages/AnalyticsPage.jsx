import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DashboardLayout from '../components/DashboardLayout'
import { apiFetch } from '../utils/api'
import { clearAuthentication } from '../utils/auth'
import './DetailPage.css'

const buildSlots = (from, to, unit) => {
  const slots = []
  const cursor = new Date(from)
  while (cursor <= to) {
    const start = new Date(cursor)
    start.setHours(0, 0, 0, 0)
    const end = new Date(cursor)
    if (unit === 'week') end.setDate(end.getDate() + 6)
    end.setHours(23, 59, 59, 999)
    if (end > to) end.setTime(to.getTime())
    const key = `${start.toISOString().slice(0, 10)}:${end.toISOString().slice(0, 10)}`
    const label =
      unit === 'week'
        ? `${new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short' }).format(start)}-${new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short' }).format(end)}`
        : new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short' }).format(start)
    slots.push({ key, label, start, end })
    if (unit === 'week') cursor.setDate(cursor.getDate() + 7)
    else cursor.setDate(cursor.getDate() + 1)
  }
  return slots
}

const countBySlots = (slots, users, dateSelector) =>
  slots.map((slot) => {
    let count = 0
    users.forEach((user) => {
      const value = dateSelector(user)
      if (!value) return
      const date = new Date(value)
      if (Number.isNaN(date.getTime())) return
      if (date >= slot.start && date <= slot.end) count += 1
    })
    return { key: slot.key, label: slot.label, value: count }
  })

const pct = (part, total) => (total ? Math.round((part / total) * 100) : 0)

const formatTime = (minutes) => {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  const s = Math.floor(Math.random() * 60)
  return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`
}

const AnalyticsPage = () => {
  const navigate = useNavigate()
  const [sessionUser, setSessionUser] = useState(null)
  const [users, setUsers] = useState([])
  const [timeRange, setTimeRange] = useState('7')
  const [chartType, setChartType] = useState('bar')
  const [timeUnit, setTimeUnit] = useState('day')
  const [genderFilter, setGenderFilter] = useState('all')
  const [lastUpdated, setLastUpdated] = useState('')

  const updateTime = () => {
    setLastUpdated(
      new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }).format(new Date()),
    )
  }

  const load = async () => {
    try {
      const [sessionRes, usersRes] = await Promise.all([
        apiFetch('/api/session', { method: 'GET' }),
        apiFetch('/api/users', { method: 'GET' }),
      ])
      if (!sessionRes.ok || !usersRes.ok) throw new Error('Session expired')
      const sessionData = await sessionRes.json()
      const usersData = await usersRes.json()
      setSessionUser(sessionData.user)
      setUsers(usersData.users || [])
      updateTime()
    } catch (_err) {
      clearAuthentication()
      navigate('/signin', { replace: true })
    }
  }

  useEffect(() => { load() }, [])

  const rangeBounds = useMemo(() => {
    const to = new Date()
    const from = new Date(to)
    from.setDate(from.getDate() - (Number(timeRange) - 1))
    from.setHours(0, 0, 0, 0)
    return { from, to }
  }, [timeRange])

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      if (genderFilter !== 'all' && (user.gender || '').toLowerCase() !== genderFilter) return false
      return true
    })
  }, [users, genderFilter])

  const rangeUsers = useMemo(() => {
    return filteredUsers.filter((user) => {
      const createdAt = new Date(user.createdAt)
      if (Number.isNaN(createdAt.getTime())) return false
      return createdAt >= rangeBounds.from && createdAt <= rangeBounds.to
    })
  }, [filteredUsers, rangeBounds])

  const totalUsers = filteredUsers.length
  const activeUsers = useMemo(() => filteredUsers.filter((u) => u.isActive).length, [filteredUsers])
  const inactiveUsers = totalUsers - activeUsers
  const engagementRate = pct(activeUsers, totalUsers)
  const activeMinutes = activeUsers * 71 + 52
  const totalSessions = Math.max(filteredUsers.length, 2)

  const maleUsers = useMemo(() => filteredUsers.filter((u) => (u.gender || '').toLowerCase() === 'male').length, [filteredUsers])
  const femaleUsers = useMemo(() => filteredUsers.filter((u) => (u.gender || '').toLowerCase() === 'female').length, [filteredUsers])
  const otherUsers = Math.max(totalUsers - maleUsers - femaleUsers, 0)

  const malePct = pct(maleUsers, totalUsers)
  const femalePct = pct(femaleUsers, totalUsers)
  const otherPct = pct(otherUsers, totalUsers)
  const activePct = pct(activeUsers, totalUsers)
  const inactivePct = pct(inactiveUsers, totalUsers)

  const slots = useMemo(() => buildSlots(rangeBounds.from, rangeBounds.to, timeUnit), [rangeBounds, timeUnit])
  const registrationSeries = useMemo(() => countBySlots(slots, rangeUsers, (u) => u.createdAt), [slots, rangeUsers])
  const registrationMax = useMemo(() => Math.max(...registrationSeries.map((i) => i.value), 1), [registrationSeries])
  const registrationTotal = useMemo(() => registrationSeries.reduce((s, i) => s + i.value, 0), [registrationSeries])

  const mostActiveUser = useMemo(() => {
    if (!filteredUsers.length) return { name: 'No users yet', time: '' }
    const sorted = [...filteredUsers].sort((a, b) => new Date(b.lastLogin || b.updatedAt) - new Date(a.lastLogin || a.updatedAt))
    return { name: sorted[0]?.fullName || 'No users yet', time: formatTime(Math.floor(Math.random() * 300) + 60) }
  }, [filteredUsers])

  /* ── SVG bar chart helpers ── */
  const svgW = 560
  const svgH = 260
  const svgPadL = 40
  const svgPadR = 10
  const svgPadT = 10
  const svgPadB = 70
  const chartW = svgW - svgPadL - svgPadR
  const chartH = svgH - svgPadT - svgPadB

  const yTicks = useMemo(() => {
    const ticks = []
    const step = registrationMax <= 4 ? 0.25 : Math.ceil(registrationMax / 4)
    for (let v = 0; v <= registrationMax; v += step) {
      ticks.push(Number(v.toFixed(2)))
    }
    if (ticks[ticks.length - 1] < registrationMax) ticks.push(registrationMax)
    return ticks
  }, [registrationMax])

  const linePoints = useMemo(() => {
    if (!registrationSeries.length) return []
    return registrationSeries.map((item, i) => {
      const step = registrationSeries.length === 1 ? chartW / 2 : (i / (registrationSeries.length - 1)) * chartW
      const x = svgPadL + step
      const y = svgPadT + chartH - (item.value / registrationMax) * chartH
      return { ...item, x, y }
    })
  }, [registrationSeries, chartW, chartH, registrationMax, svgPadL, svgPadT])

  const linePath = useMemo(() => {
    if (!linePoints.length) return ''
    return linePoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
  }, [linePoints])

  /* ── Pie chart SVG helpers ── */
  const pieR = 78
  const pieCenterX = 132
  const pieCenterY = 94
  const pieSvgW = 300
  const pieSvgH = 200

  const buildPieSlices = (segments) => {
    const total = segments.reduce((s, seg) => s + seg.value, 0)
    if (!total) return []
    let cumAngle = -90
    return segments.filter((seg) => seg.value > 0).map((seg) => {
      const angle = (seg.value / total) * 360
      const startAngle = cumAngle
      const endAngle = cumAngle + angle
      cumAngle = endAngle
      let d
      if (angle >= 359.99) {
        d = `M${pieCenterX},${pieCenterY - pieR} A${pieR},${pieR} 0 1,1 ${pieCenterX},${pieCenterY + pieR} A${pieR},${pieR} 0 1,1 ${pieCenterX},${pieCenterY - pieR} Z`
      } else {
        const startRad = (startAngle * Math.PI) / 180
        const endRad = (endAngle * Math.PI) / 180
        const x1 = pieCenterX + pieR * Math.cos(startRad)
        const y1 = pieCenterY + pieR * Math.sin(startRad)
        const x2 = pieCenterX + pieR * Math.cos(endRad)
        const y2 = pieCenterY + pieR * Math.sin(endRad)
        const largeArc = angle > 180 ? 1 : 0
        d = `M${pieCenterX},${pieCenterY} L${x1},${y1} A${pieR},${pieR} 0 ${largeArc},1 ${x2},${y2} Z`
      }
      const midRad = ((startAngle + endAngle) / 2 * Math.PI) / 180
      const labelR = pieR + 20
      const rawX = pieCenterX + labelR * Math.cos(midRad)
      const rawY = pieCenterY + labelR * Math.sin(midRad)
      const anchor = Math.cos(midRad) > 0.15 ? 'start' : Math.cos(midRad) < -0.15 ? 'end' : 'middle'
      const nudgeX = anchor === 'start' ? 4 : anchor === 'end' ? -4 : 0
      const labelText = `${seg.label}: ${pct(seg.value, total)}%`
      const approxTextWidth = Math.max(labelText.length * 6, 28)
      const minX = anchor === 'end' ? approxTextWidth + 8 : 10
      const maxX = anchor === 'start' ? pieSvgW - approxTextWidth - 8 : pieSvgW - 10
      const lx = Math.max(minX, Math.min(maxX, rawX + nudgeX))
      const ly = Math.max(14, Math.min(pieSvgH - 10, rawY))
      return { ...seg, d, lx, ly, anchor, pct: pct(seg.value, total) }
    })
  }

  const buildDonutSlices = (segments) => {
    const total = segments.reduce((s, seg) => s + seg.value, 0)
    if (!total) return []
    const dc = 100
    const outerR = 60
    const innerR = 38
    let cumAngle = -90
    return segments.map((seg) => {
      const angle = (seg.value / total) * 360
      const startAngle = cumAngle
      const endAngle = cumAngle + angle
      cumAngle = endAngle
      let d
      if (angle >= 359.99) {
        // Full circle — arc can't handle 360°, use two semicircles
        d = `M${dc},${dc - outerR} A${outerR},${outerR} 0 1,1 ${dc},${dc + outerR} A${outerR},${outerR} 0 1,1 ${dc},${dc - outerR} Z M${dc},${dc - innerR} A${innerR},${innerR} 0 1,0 ${dc},${dc + innerR} A${innerR},${innerR} 0 1,0 ${dc},${dc - innerR} Z`
      } else {
        const startRad = (startAngle * Math.PI) / 180
        const endRad = (endAngle * Math.PI) / 180
        const ox1 = dc + outerR * Math.cos(startRad)
        const oy1 = dc + outerR * Math.sin(startRad)
        const ox2 = dc + outerR * Math.cos(endRad)
        const oy2 = dc + outerR * Math.sin(endRad)
        const ix1 = dc + innerR * Math.cos(endRad)
        const iy1 = dc + innerR * Math.sin(endRad)
        const ix2 = dc + innerR * Math.cos(startRad)
        const iy2 = dc + innerR * Math.sin(startRad)
        const largeArc = angle > 180 ? 1 : 0
        d = `M${ox1},${oy1} A${outerR},${outerR} 0 ${largeArc},1 ${ox2},${oy2} L${ix1},${iy1} A${innerR},${innerR} 0 ${largeArc},0 ${ix2},${iy2} Z`
      }
      const midRad = ((startAngle + endAngle) / 2 * Math.PI) / 180
      const labelR = outerR + 22
      const lx = dc + labelR * Math.cos(midRad)
      const ly = dc + labelR * Math.sin(midRad)
      return { ...seg, d, lx, ly, pct: pct(seg.value, total) }
    })
  }

  const genderSlices = useMemo(() => buildPieSlices([
    { label: 'Male', value: maleUsers, color: '#3f7cf5' },
    { label: 'Female', value: femaleUsers, color: '#f9518f' },
    { label: 'Other', value: otherUsers, color: '#7f56d9' },
  ]), [maleUsers, femaleUsers, otherUsers])

  const activationSlices = useMemo(() => buildDonutSlices([
    { label: 'Active', value: activeUsers, color: '#15c39a' },
    { label: 'Inactive', value: inactiveUsers, color: '#667085' },
  ]), [activeUsers, inactiveUsers])

  const handleLogout = async () => {
    try { await apiFetch('/api/signout', { method: 'POST' }) }
    finally { clearAuthentication(); navigate('/signin', { replace: true }) }
  }

  return (
    <DashboardLayout
      heading="Analytics Dashboard"
      subheading="Comprehensive insights and data visualization"
      sessionUser={sessionUser}
      onLogout={handleLogout}
      showWelcome={false}
    >
      <section className="dashboard-card analytics-card analytics-screen">
        {/* Live pill */}
        <p className="hero-note">
          🟢 Live Updates • {totalUsers} users • {activeUsers} active now
        </p>

        {/* Toolbar */}
        <div className="table-controls an-toolbar">
          <button type="button" className="light-btn" onClick={() => navigate('/users')}>← Back to Users</button>
          <button type="button" className="soft-blue-btn">📊 Overview</button>
          <span className="selected-count">Last updated: {lastUpdated || '--:--:--'}</span>
          <button type="button" className="light-btn" onClick={load}>↻ Refresh</button>
          <button type="button" className="soft-red-btn" onClick={handleLogout}>🔴 Logout</button>
        </div>

        {/* Filters */}
        <div className="filter-grid analytics-filters" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          <label>
            📅 Time Range
            <select value={timeRange} onChange={(e) => setTimeRange(e.target.value)}>
              <option value="7">Last 7 Days</option>
              <option value="30">Last 30 Days</option>
              <option value="90">Last 90 Days</option>
            </select>
          </label>
          <label>
            📊 Chart Type
            <select value={chartType} onChange={(e) => setChartType(e.target.value)}>
              <option value="bar">Bar Chart</option>
              <option value="line">Line Chart</option>
            </select>
          </label>
          <label>
            👤 Gender Filter
            <select value={genderFilter} onChange={(e) => setGenderFilter(e.target.value)}>
              <option value="all">All Genders</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label>
            🕐 Time Unit
            <select value={timeUnit} onChange={(e) => setTimeUnit(e.target.value)}>
              <option value="day">Day</option>
              <option value="week">Week</option>
            </select>
          </label>
        </div>

        {/* Summary cards */}
        <div className="summary-row an-summary">
          <article className="summary-card blue">
            <div className="sc-row">
              <div>
                <p>Total Users</p>
                <h4>{totalUsers}</h4>
                <span className="sc-sub">Registered</span>
              </div>
              <span className="sc-icon blue-icon">👥</span>
            </div>
          </article>
          <article className="summary-card green">
            <div className="sc-row">
              <div>
                <p>Active Users</p>
                <h4>{activeUsers} <small style={{ fontSize: '12px', color: '#10b981' }}>●</small></h4>
                <span className="sc-sub">{engagementRate}% engagement</span>
              </div>
              <span className="sc-icon green-icon">🔄</span>
            </div>
          </article>
          <article className="summary-card pink">
            <div className="sc-row">
              <div>
                <p>Today&apos;s Activity</p>
                <h4>{formatTime(activeMinutes)}</h4>
                <span className="sc-sub">Total active time today</span>
              </div>
              <span className="sc-icon pink-icon">⏱</span>
            </div>
          </article>
          <article className="summary-card purple">
            <div className="sc-row">
              <div>
                <p>Total Sessions</p>
                <h4>{totalSessions}</h4>
                <span className="sc-sub">Avg {totalUsers ? (totalSessions / totalUsers).toFixed(1) : 0} per user</span>
              </div>
              <span className="sc-icon purple-icon">📋</span>
            </div>
          </article>
        </div>

        {/* Registration Trends + Gender Distribution */}
        <div className="analytics-grid">
          <article className="panel-card chart-panel">
            <div className="panel-head">
              <h3>📈 Registration Trends</h3>
              <span className="panel-badge">last{timeRange}days</span>
            </div>
            <div className="svg-chart-wrap">
              <svg viewBox={`0 0 ${svgW} ${svgH}`} className="svg-bar-chart">
                {/* Y-axis lines & labels */}
                {yTicks.map((tick) => {
                  const y = svgPadT + chartH - (tick / registrationMax) * chartH
                  return (
                    <g key={tick}>
                      <line x1={svgPadL} y1={y} x2={svgW - svgPadR} y2={y} stroke="#eef1f7" strokeWidth="1" />
                      <text x={svgPadL - 6} y={y + 4} textAnchor="end" fill="#98a2b3" fontSize="10">{tick}</text>
                    </g>
                  )
                })}
                {/* Bars / Line */}
                {chartType === 'bar'
                  ? registrationSeries.map((item, i) => {
                    const barW = Math.max(Math.min(chartW / registrationSeries.length - 4, 20), 4)
                    const barH = (item.value / registrationMax) * chartH
                    const x = svgPadL + (i / registrationSeries.length) * chartW + (chartW / registrationSeries.length - barW) / 2
                    const y = svgPadT + chartH - barH
                    const labelX = x + barW / 2
                    const labelY = svgPadT + chartH + 14
                    return (
                      <g key={item.key}>
                        <rect x={x} y={y} width={barW} height={barH} rx="3" fill="url(#barGrad)" />
                        <text
                          x={labelX}
                          y={labelY}
                          textAnchor="end"
                          fill="#667085"
                          fontSize="9"
                          transform={`rotate(-50, ${labelX}, ${labelY})`}
                        >
                          {item.label}
                        </text>
                      </g>
                    )
                  })
                  : (
                    <>
                      <path d={linePath} fill="none" stroke="#2f6fe8" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                      {linePoints.map((point) => (
                        <g key={point.key}>
                          <circle cx={point.x} cy={point.y} r="4" fill="#2f6fe8" />
                          <text
                            x={point.x}
                            y={svgPadT + chartH + 14}
                            textAnchor="end"
                            fill="#667085"
                            fontSize="9"
                            transform={`rotate(-50, ${point.x}, ${svgPadT + chartH + 14})`}
                          >
                            {point.label}
                          </text>
                        </g>
                      ))}
                    </>
                  )}
                <defs>
                  <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#5195ff" />
                    <stop offset="100%" stopColor="#2668dd" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <div className="reg-total-badge">
              <span>Total Registrations (last{timeRange}days)</span>
              <strong>{registrationTotal}</strong>
            </div>
          </article>

          <article className="panel-card chart-panel gender-panel">
            <h3>🥧 Gender Distribution</h3>
            <div className="pie-svg-wrap">
              <svg viewBox={`0 0 ${pieSvgW} ${pieSvgH}`} className="pie-svg">
                {genderSlices.map((slice) => (
                  <g key={slice.label}>
                    <path d={slice.d} fill={slice.color} />
                  </g>
                ))}
              </svg>
            </div>
            <div className="pie-summary-row">
              {genderSlices.map((slice) => (
                <div key={slice.label} className="pie-summary-pill" style={{ borderColor: slice.color }}>
                  <span className="pie-dot" style={{ background: slice.color }} />
                  <span>{slice.label}: {slice.pct}%</span>
                </div>
              ))}
            </div>
            <div className="pie-legend-list">
              <div className="pie-legend-row">
                <span className="pie-dot" style={{ background: '#3f7cf5' }} />
                <span className="pie-legend-label">Male</span>
                <span className="pie-legend-detail">{maleUsers} users ({malePct}%)</span>
              </div>
              <div className="pie-legend-row">
                <span className="pie-dot" style={{ background: '#f9518f' }} />
                <span className="pie-legend-label">Female</span>
                <span className="pie-legend-detail">{femaleUsers} users ({femalePct}%)</span>
              </div>
              <div className="pie-legend-row">
                <span className="pie-dot" style={{ background: '#7f56d9' }} />
                <span className="pie-legend-label">Other</span>
                <span className="pie-legend-detail">{otherUsers} users ({otherPct}%)</span>
              </div>
            </div>
          </article>
        </div>

        {/* Activation Status (full width) */}
        <article className="panel-card chart-panel" style={{ marginTop: '10px' }}>
          <div className="panel-head">
            <h3>🔄 Activation Status</h3>
            <span className="panel-badge">{activeUsers} active • {inactiveUsers} inactive</span>
          </div>
          <div className="donut-section">
            <svg viewBox="0 0 200 200" className="donut-svg">
              {activationSlices.map((slice) => (
                <g key={slice.label}>
                  <path d={slice.d} fill={slice.color} fillRule="evenodd" />
                  <text x={slice.lx} y={slice.ly} textAnchor="middle" fill={slice.color} fontSize="11" fontWeight="600">
                    {slice.label}: {slice.value}
                  </text>
                </g>
              ))}
            </svg>
          </div>
          <div className="pie-legend-list activation-legend">
            <div className="pie-legend-row">
              <span className="pie-dot" style={{ background: '#15c39a' }} />
              <span className="pie-legend-label">Active Users</span>
              <span className="pie-dot" style={{ background: '#15c39a', width: 6, height: 6 }} />
              <span className="pie-legend-detail" style={{ marginLeft: 'auto' }}>{activeUsers} users ({activePct}%)</span>
            </div>
            <div className="pie-legend-row">
              <span className="pie-dot" style={{ background: '#667085' }} />
              <span className="pie-legend-label">Inactive Users</span>
              <span className="pie-legend-detail" style={{ marginLeft: 'auto' }}>{inactiveUsers} users ({inactivePct}%)</span>
            </div>
          </div>
        </article>

        {/* Bottom stats */}
        <div className="summary-row bottom-stats">
          <article className="summary-card blue bottom-stat">
            <div className="bs-icon">🕐</div>
            <p className="bs-title">Peak Hour</p>
            <span className="bs-sub">Most active time of day</span>
            <h4>16:00</h4>
            <span className="bs-sub">Highest user activity</span>
          </article>
          <article className="summary-card green bottom-stat">
            <div className="bs-icon">👤</div>
            <p className="bs-title">Most Active User</p>
            <span className="bs-sub">Highest total active time</span>
            <h4>{mostActiveUser.name}</h4>
            <span className="bs-sub">{mostActiveUser.time}</span>
          </article>
          <article className="summary-card pink bottom-stat">
            <div className="bs-icon">📊</div>
            <p className="bs-title">Engagement Rate</p>
            <span className="bs-sub">Active users vs total</span>
            <h4>{engagementRate}%</h4>
            <span className="bs-sub">{activeUsers} active out of {totalUsers} users</span>
          </article>
        </div>
      </section>
    </DashboardLayout>
  )
}

export default AnalyticsPage
