import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AdminIncidentMapPanel } from '../../components/AdminIncidentMapPanel'
import { AdminSidebar } from '../../components/AdminSidebar'
import { AdminSimulationManager } from '../../components/AdminSimulationManager'
import {
  hazardIncidents,
  hazardMeta,
  type HazardIncident,
  type HazardType,
  type IncidentStatus,
} from '../../data/adminOperations'
import type { AdminNavKey } from '../../data/adminNavigation'
import { getCurrentUserProfile, logoutUser } from '../../services/auth'

type WorkspaceSection = 'overview' | 'reports' | 'map' | 'simulation'
type ReportFilter = 'all' | IncidentStatus
type MapFilter = 'all' | HazardType

function getWorkspaceSection(sectionParam: string | null): WorkspaceSection {
  if (sectionParam === 'reports' || sectionParam === 'map' || sectionParam === 'simulation') {
    return sectionParam
  }

  return 'overview'
}

function HeaderIcon({ name }: { name: 'search' | 'bell' | 'message' }) {
  if (name === 'search') {
    return (
      <svg aria-hidden className="h-4 w-4" fill="none" viewBox="0 0 24 24">
        <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
        <path d="m16 16 4 4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      </svg>
    )
  }

  if (name === 'bell') {
    return (
      <svg aria-hidden className="h-4 w-4" fill="none" viewBox="0 0 24 24">
        <path d="M8 17h8m-7-3V10a3 3 0 1 1 6 0v4l1.5 2h-9L9 14Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      </svg>
    )
  }

  if (name === 'message') {
    return (
      <svg aria-hidden className="h-4 w-4" fill="none" viewBox="0 0 24 24">
        <path d="M6 7.5h12A1.5 1.5 0 0 1 19.5 9v6A1.5 1.5 0 0 1 18 16.5H10l-4 3v-3H6A1.5 1.5 0 0 1 4.5 15V9A1.5 1.5 0 0 1 6 7.5Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
      </svg>
    )
  }

  if (name === 'grid') {
    return (
      <svg aria-hidden className="h-4 w-4" fill="none" viewBox="0 0 24 24">
        <path d="M6 6h4v4H6zm8 0h4v4h-4zM6 14h4v4H6zm8 0h4v4h-4z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
      </svg>
    )
  }

  return (
    <svg aria-hidden className="h-4 w-4" fill="none" viewBox="0 0 24 24">
      <path d="M6 7.5h12A1.5 1.5 0 0 1 19.5 9v6A1.5 1.5 0 0 1 18 16.5H10l-4 3v-3H6A1.5 1.5 0 0 1 4.5 15V9A1.5 1.5 0 0 1 6 7.5Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  )
}

export function AdminDashboardPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const topProfileMenuRef = useRef<HTMLDivElement | null>(null)
  const [currentDate, setCurrentDate] = useState('')
  const [currentTime, setCurrentTime] = useState('')
  const [activeSection, setActiveSection] = useState<WorkspaceSection>(() => getWorkspaceSection(searchParams.get('section')))
  const [reports, setReports] = useState(() => hazardIncidents)
  const [reportFilter, setReportFilter] = useState<ReportFilter>('all')
  const [mapFilter, setMapFilter] = useState<MapFilter>('all')
  const [isTopProfileMenuOpen, setIsTopProfileMenuOpen] = useState(false)

  const profile = getCurrentUserProfile()
  const displayName = profile?.fullName?.trim() || 'Administrator'

  const firstName = useMemo(() => displayName.split(/\s+/).filter(Boolean)[0] || 'Administrator', [displayName])
  const initials = useMemo(() => {
    const nameParts = displayName.split(/\s+/).filter(Boolean)
    if (nameParts.length === 0) {
      return 'AD'
    }
    if (nameParts.length === 1) {
      return nameParts[0].slice(0, 2).toUpperCase()
    }
    return `${nameParts[0][0]}${nameParts[1][0]}`.toUpperCase()
  }, [displayName])

  useEffect(() => {
    function syncDateTime(): void {
      const now = new Date()
      setCurrentDate(
        now.toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
      )
      setCurrentTime(
        now.toLocaleTimeString(undefined, {
          hour: 'numeric',
          minute: '2-digit',
        }),
      )
    }

    syncDateTime()
    const timer = window.setInterval(syncDateTime, 60000)

    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    function handleDocumentClick(event: MouseEvent): void {
      if (!topProfileMenuRef.current) {
        return
      }

      if (!topProfileMenuRef.current.contains(event.target as Node)) {
        setIsTopProfileMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleDocumentClick)

    return () => document.removeEventListener('mousedown', handleDocumentClick)
  }, [])

  useEffect(() => {
    const nextSection = getWorkspaceSection(searchParams.get('section'))
    setActiveSection((currentSection) => (currentSection === nextSection ? currentSection : nextSection))
  }, [searchParams])

  const filteredReports = useMemo(() => {
    if (reportFilter === 'all') {
      return reports
    }
    return reports.filter((report) => report.status === reportFilter)
  }, [reportFilter, reports])

  const currentYear = new Date().getFullYear()
  const previousYear = currentYear - 1
  const fireReports = useMemo(() => reports.filter((incident) => incident.code === 'FR'), [reports])
  const earthquakeReports = useMemo(() => reports.filter((incident) => incident.code === 'EQ'), [reports])
  const fireTotals = useMemo(
    () => ({ current: fireReports.length * 12 + 14, previous: fireReports.length * 9 + 10 }),
    [fireReports.length],
  )
  const earthquakeTotals = useMemo(
    () => ({ current: earthquakeReports.length * 8 + 9, previous: earthquakeReports.length * 6 + 8 }),
    [earthquakeReports.length],
  )
  const monitoredBarangays = 33
  const fireRiskScore = useMemo(
    () => Math.min(100, 52 + fireReports.length * 7 + fireReports.filter((item) => item.status === 'active').length * 6),
    [fireReports],
  )
  const earthquakeRiskScore = useMemo(
    () => Math.min(100, 44 + earthquakeReports.length * 10 + earthquakeReports.filter((item) => item.severity !== 'Low').length * 7),
    [earthquakeReports],
  )
  const overviewMetricCards = [
    {
      label: 'Total fire incidents',
      value: fireTotals.current,
      comparison: `${previousYear}: ${fireTotals.previous}`,
      delta: `+${fireTotals.current - fireTotals.previous} vs ${previousYear}`,
      accent: 'border-t-red-600',
      valueClass: 'text-red-700',
    },
    {
      label: 'Total earthquake occurrences',
      value: earthquakeTotals.current,
      comparison: `${previousYear}: ${earthquakeTotals.previous}`,
      delta: `+${earthquakeTotals.current - earthquakeTotals.previous} vs ${previousYear}`,
      accent: 'border-t-emerald-600',
      valueClass: 'text-emerald-700',
    },
    {
      label: 'Barangays monitored',
      value: monitoredBarangays,
      comparison: 'City-wide active watchlist',
      delta: 'Full Lucena City coverage',
      accent: 'border-t-blue-700',
      valueClass: 'text-blue-700',
    },
    {
      label: 'Current fire risk score',
      value: `${fireRiskScore}%`,
      comparison: 'Based on active fire alerts',
      delta: fireRiskScore >= 70 ? 'High vigilance required' : 'Within managed threshold',
      accent: 'border-t-orange-600',
      valueClass: 'text-orange-700',
    },
    {
      label: 'Current earthquake risk score',
      value: `${earthquakeRiskScore}%`,
      comparison: 'Based on seismic activity',
      delta: earthquakeRiskScore >= 70 ? 'Heightened seismic watch' : 'Routine monitoring level',
      accent: 'border-t-teal-600',
      valueClass: 'text-teal-700',
    },
  ]

  const glassPanelClass = 'rounded-[24px] border border-slate-200 bg-white shadow-[0_12px_32px_rgba(15,23,42,0.08)]'
  const glassPanelSoftClass = 'rounded-2xl border border-slate-200 bg-slate-50 shadow-[0_8px_20px_rgba(15,23,42,0.05)]'
  const dashboardHazardClasses: Record<HazardType, { accent: string; surface: string; solid: string }> = {
    EQ: {
      accent: 'text-emerald-800',
      surface: 'bg-emerald-100 border-emerald-300',
      solid: 'bg-emerald-600',
    },
    FR: {
      accent: 'text-orange-800',
      surface: 'bg-orange-100 border-orange-300',
      solid: 'bg-orange-600',
    },
    AC: {
      accent: 'text-amber-900',
      surface: 'bg-amber-100 border-amber-300',
      solid: 'bg-amber-500',
    },
  }
  const dashboardStatusClasses: Record<IncidentStatus, string> = {
    active: 'border-red-700 bg-red-700 text-white',
    pending: 'border-amber-500 bg-amber-500 text-white',
    resolved: 'border-emerald-700 bg-emerald-700 text-white',
  }
  const seasonalFireTrend = [
    { label: 'Jan', value: 4 },
    { label: 'Feb', value: 5 },
    { label: 'Mar', value: 7 },
    { label: 'Apr', value: 9 },
    { label: 'May', value: 11 },
    { label: 'Jun', value: 8 },
    { label: 'Jul', value: 6 },
    { label: 'Aug', value: 5 },
    { label: 'Sep', value: 6 },
    { label: 'Oct', value: 8 },
    { label: 'Nov', value: 10 },
    { label: 'Dec', value: 7 },
  ]
  const seasonalFireMax = Math.max(...seasonalFireTrend.map((item) => item.value), 1)
  const seasonalFirePoints = seasonalFireTrend
    .map((item, index) => {
      const x = (index / Math.max(seasonalFireTrend.length - 1, 1)) * 100
      const y = 92 - (item.value / seasonalFireMax) * 70
      return `${x},${y}`
    })
    .join(' ')
  const earthquakeMagnitudeData = [
    { range: '2.0-2.9', value: 5 },
    { range: '3.0-3.9', value: 7 },
    { range: '4.0-4.9', value: 4 },
    { range: '5.0-5.9', value: 2 },
    { range: '6.0+', value: 1 },
  ]
  const earthquakeMagnitudeMax = Math.max(...earthquakeMagnitudeData.map((item) => item.value), 1)
  const barangayHeatmap = [
    { name: 'Barangay 10', fireRisk: 51, earthquakeRisk: 41, totalRisk: 92 },
    { name: 'Ibabang Dupay', fireRisk: 48, earthquakeRisk: 37, totalRisk: 85 },
    { name: 'Gulang-Gulang', fireRisk: 43, earthquakeRisk: 35, totalRisk: 78 },
    { name: 'Cotta', fireRisk: 39, earthquakeRisk: 31, totalRisk: 70 },
    { name: 'Dalahican', fireRisk: 34, earthquakeRisk: 30, totalRisk: 64 },
    { name: 'Bocohan', fireRisk: 31, earthquakeRisk: 27, totalRisk: 58 },
  ]
  const incidentCauseData = [
    { label: 'Electrical', value: 42, color: '#ef4444' },
    { label: 'Accidental', value: 31, color: '#f59e0b' },
    { label: 'Natural', value: 18, color: '#10b981' },
    { label: 'Other', value: 9, color: '#3b82f6' },
  ]
  const incidentCauseTotal = Math.max(incidentCauseData.reduce((total, item) => total + item.value, 0), 1)
  const incidentCauseGradient = incidentCauseData
    .reduce(
      (segments, item) => {
        const start = segments.current
        const slice = (item.value / incidentCauseTotal) * 100
        segments.values.push(`${item.color} ${start}% ${start + slice}%`)
        segments.current += slice
        return segments
      },
      { current: 0, values: [] as string[] },
    )
    .values.join(', ')
  const populationExposureData = [
    { name: 'Gulang-Gulang', density: 62, exposure: 28 },
    { name: 'Ibabang Dupay', density: 55, exposure: 30 },
    { name: 'Barangay 10', density: 49, exposure: 36 },
    { name: 'Cotta', density: 46, exposure: 24 },
  ]
  const populationExposureMax = Math.max(...populationExposureData.map((item) => item.density + item.exposure), 1)
  const latestFireIncidents = fireReports.slice(0, 3)
  const latestSeismicEvents = [
    { title: 'Minor Earthquake - East Zone', magnitude: '4.2', time: '10:00 PM', note: 'Aftershock monitored with no structural collapse.' },
    { title: 'Offshore Seismic Disturbance', magnitude: '3.8', time: '6:40 PM', note: 'No tsunami advisory issued for Lucena coastline.' },
    { title: 'Northern Fault Microtremor', magnitude: '2.9', time: '4:15 AM', note: 'Barangay monitoring remained at advisory level.' },
  ]
  const hazardLevelUpdates = [
    { barangay: 'Barangay 10', status: 'Critical fire watch', note: 'Dense commercial load and recent structural fire activity.' },
    { barangay: 'Ibabang Dupay', status: 'Elevated combined risk', note: 'High exposure from dense housing and road incident corridor.' },
    { barangay: 'Gulang-Gulang', status: 'Seismic watch', note: 'Priority inspections scheduled for vulnerable structures.' },
  ]

  function handleSelectSection(section: WorkspaceSection): void {
    setActiveSection(section)

    const nextSearchParams = new URLSearchParams(searchParams)

    if (section === 'overview') {
      nextSearchParams.delete('section')
    } else {
      nextSearchParams.set('section', section)
    }

    setSearchParams(nextSearchParams, { replace: true })
  }

  function handleSelectMapFilter(filter: MapFilter): void {
    setActiveSection('map')
    setMapFilter(filter)
  }

  function handleUpdateReportStatus(reportId: string, status: IncidentStatus): void {
    setReports((currentReports) =>
      currentReports.map((report) => (report.id === reportId ? { ...report, status } : report)),
    )
  }

  function handleCreateMapIncident(incident: {
    code: Extract<HazardType, 'FR' | 'AC'>
    title: string
    location: string
    responseTeam: string
    severity: HazardIncident['severity']
    description: string
    coordinates: [number, number]
  }): void {
    const newIncident: HazardIncident = {
      id: `${incident.code.toLowerCase()}-${Date.now()}`,
      title: incident.title,
      code: incident.code,
      status: 'pending',
      severity: incident.severity,
      location: incident.location,
      time: new Date().toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
      }),
      responseTeam: incident.responseTeam,
      description: incident.description,
      coordinates: incident.coordinates,
    }

    setReports((currentReports) => [newIncident, ...currentReports])
    setActiveSection('map')
    setMapFilter('all')
  }

  function handleLogout(): void {
    logoutUser()
    navigate('/admin-page', {
      replace: true,
      state: {
        logoutSuccessMessage: 'You have been logged out successfully.',
      },
    })
  }

  function handleOpenAdminProfile(): void {
    setIsTopProfileMenuOpen(false)
    navigate('/admin-profile-settings')
  }

  function renderOverviewSection() {
    return (
      <>
        <section className="grid grid-cols-1 gap-6 px-6 pt-6 pb-8 md:grid-cols-2 xl:grid-cols-5">
          {overviewMetricCards.map((card) => (
            <div key={card.label} className={`${glassPanelClass} flex flex-col gap-3 border-t-4 p-6 ${card.accent}`}>
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{card.label}</span>
              <span className={`text-3xl font-bold ${card.valueClass}`}>{card.value}</span>
              <p className="text-sm font-medium text-slate-600">{currentYear} total</p>
              <p className="text-xs text-slate-500">{card.comparison}</p>
              <p className="text-xs font-semibold text-slate-700">{card.delta}</p>
            </div>
          ))}
        </section>

        <section className="grid grid-cols-1 gap-6 px-6 pb-8 xl:grid-cols-2">
          <div className={`${glassPanelClass} p-6`}>
            <div className="mb-5 flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Data Analytics</p>
                <div className="mt-1 text-xl font-semibold text-slate-900">Trend Line Chart</div>
              </div>
              <p className="text-xs text-slate-500">Seasonal fire spikes by month</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-[linear-gradient(180deg,#ffffff,#f8fafc)] p-4">
              <svg className="h-60 w-full" preserveAspectRatio="none" viewBox="0 0 100 100">
                {[20, 40, 60, 80].map((y) => (
                  <line key={y} stroke="#e2e8f0" strokeDasharray="2 3" strokeWidth="0.6" x1="0" x2="100" y1={y} y2={y} />
                ))}
                <polyline fill="none" points={seasonalFirePoints} stroke="#dc2626" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.6" />
                {seasonalFireTrend.map((item, index) => {
                  const x = (index / Math.max(seasonalFireTrend.length - 1, 1)) * 100
                  const y = 92 - (item.value / seasonalFireMax) * 70
                  return <circle key={item.label} cx={x} cy={y} fill="#dc2626" r="1.8" />
                })}
              </svg>

              <div className="mt-3 grid grid-cols-6 gap-2 text-center text-[11px] font-semibold text-slate-500">
                {seasonalFireTrend.map((item) => (
                  <div key={item.label}>
                    <p>{item.label}</p>
                    <p className="mt-1 text-slate-700">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className={`${glassPanelClass} p-6`}>
            <div className="mb-5 flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Data Analytics</p>
                <div className="mt-1 text-xl font-semibold text-slate-900">Bar Chart</div>
              </div>
              <p className="text-xs text-slate-500">Earthquake frequency by magnitude range</p>
            </div>

            <div className="flex min-h-[285px] items-end gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-5">
              {earthquakeMagnitudeData.map((item) => (
                <div className="flex flex-1 flex-col items-center gap-3" key={item.range}>
                  <span className="text-xs font-semibold text-slate-600">{item.value}</span>
                  <div className="flex h-52 w-full items-end rounded-[18px] bg-white p-2 shadow-[inset_0_0_0_1px_rgba(226,232,240,0.9)]">
                    <div
                      className="w-full rounded-[12px] bg-[linear-gradient(180deg,#0f766e,#2dd4bf)]"
                      style={{ height: `${Math.max((item.value / earthquakeMagnitudeMax) * 100, 14)}%` }}
                    />
                  </div>
                  <span className="text-center text-[11px] font-semibold text-slate-500">{item.range}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 px-6 pb-8 xl:grid-cols-[1.2fr_0.9fr_1.1fr]">
          <div className={`${glassPanelClass} p-6`}>
            <div className="mb-5 flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Data Analytics</p>
                <div className="mt-1 text-xl font-semibold text-slate-900">Heatmap Snapshot</div>
              </div>
              <p className="text-xs text-slate-500">Barangays with highest combined risk</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {barangayHeatmap.map((item) => (
                <div
                  className="rounded-2xl border p-4"
                  key={item.name}
                  style={{
                    borderColor: `rgba(220, 38, 38, ${Math.max(item.totalRisk / 120, 0.22)})`,
                    backgroundColor: `rgba(248, 113, 113, ${Math.max(item.totalRisk / 220, 0.12)})`,
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                    <span className="rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-bold text-slate-900">{item.totalRisk}</span>
                  </div>
                  <div className="mt-4 space-y-2 text-xs text-slate-700">
                    <div className="flex items-center justify-between gap-3">
                      <span>Fire risk</span>
                      <span className="font-semibold">{item.fireRisk}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/80">
                      <div className="h-full rounded-full bg-red-500" style={{ width: `${item.fireRisk}%` }} />
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Earthquake risk</span>
                      <span className="font-semibold">{item.earthquakeRisk}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/80">
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${item.earthquakeRisk}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={`${glassPanelClass} p-6`}>
            <div className="mb-5 flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Data Analytics</p>
                <div className="mt-1 text-xl font-semibold text-slate-900">Pie Chart</div>
              </div>
              <p className="text-xs text-slate-500">Fire incident causes</p>
            </div>

            <div className="flex flex-col items-center gap-6">
              <div className="relative flex h-48 w-48 items-center justify-center rounded-full" style={{ background: `conic-gradient(${incidentCauseGradient})` }}>
                <div className="flex h-28 w-28 items-center justify-center rounded-full border border-slate-200 bg-white text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Total</p>
                    <p className="mt-1 text-2xl font-bold text-slate-900">{incidentCauseTotal}</p>
                  </div>
                </div>
              </div>

              <div className="grid w-full gap-3">
                {incidentCauseData.map((item) => (
                  <div className="flex items-center justify-between gap-3 text-sm" key={item.label}>
                    <div className="flex items-center gap-3">
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-slate-700">{item.label}</span>
                    </div>
                    <span className="font-semibold text-slate-900">{item.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className={`${glassPanelClass} p-6`}>
            <div className="mb-5 flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Data Analytics</p>
                <div className="mt-1 text-xl font-semibold text-slate-900">Stacked Chart</div>
              </div>
              <p className="text-xs text-slate-500">Population density vs hazard exposure</p>
            </div>

            <div className="flex min-h-[285px] items-end gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-5">
              {populationExposureData.map((item) => {
                const densityHeight = ((item.density / populationExposureMax) * 100)
                const exposureHeight = ((item.exposure / populationExposureMax) * 100)

                return (
                  <div className="flex flex-1 flex-col items-center gap-3" key={item.name}>
                    <div className="flex h-56 w-full items-end rounded-[18px] bg-white p-2 shadow-[inset_0_0_0_1px_rgba(226,232,240,0.9)]">
                      <div className="flex w-full flex-col justify-end overflow-hidden rounded-[12px]">
                        <div className="bg-[linear-gradient(180deg,#38bdf8,#2563eb)]" style={{ height: `${Math.max(exposureHeight, 10)}%` }} />
                        <div className="bg-[linear-gradient(180deg,#f59e0b,#f97316)]" style={{ height: `${Math.max(densityHeight, 12)}%` }} />
                      </div>
                    </div>
                    <div className="text-center text-[11px] text-slate-500">
                      <p className="font-semibold text-slate-700">{item.name}</p>
                      <p>Density {item.density}</p>
                      <p>Exposure {item.exposure}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 px-6 pb-10 xl:grid-cols-3">
          <div className={`${glassPanelClass} p-6`}>
            <div className="mb-5 flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Recent Activity Feed</p>
                <div className="mt-1 text-xl font-semibold text-slate-900">Latest recorded fire incidents</div>
              </div>
            </div>

            <div className="space-y-3">
              {latestFireIncidents.map((incident) => (
                <article className={`${glassPanelSoftClass} p-4`} key={incident.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{incident.title}</p>
                      <p className="mt-1 text-xs text-slate-500">{incident.location} | {incident.time}</p>
                    </div>
                    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase ${dashboardStatusClasses[incident.status]}`}>
                      {incident.status}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600">{incident.description}</p>
                </article>
              ))}
            </div>
          </div>

          <div className={`${glassPanelClass} p-6`}>
            <div className="mb-5 flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Recent Activity Feed</p>
                <div className="mt-1 text-xl font-semibold text-slate-900">Latest seismic events</div>
              </div>
            </div>

            <div className="space-y-3">
              {latestSeismicEvents.map((event) => (
                <article className={`${glassPanelSoftClass} p-4`} key={`${event.title}-${event.time}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{event.title}</p>
                      <p className="mt-1 text-xs text-slate-500">Magnitude {event.magnitude} | {event.time}</p>
                    </div>
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase text-emerald-700">
                      Seismic
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600">{event.note}</p>
                </article>
              ))}
            </div>
          </div>

          <div className={`${glassPanelClass} p-6`}>
            <div className="mb-5 flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Recent Activity Feed</p>
                <div className="mt-1 text-xl font-semibold text-slate-900">Barangay hazard level updates</div>
              </div>
            </div>

            <div className="space-y-3">
              {hazardLevelUpdates.map((update) => (
                <article className={`${glassPanelSoftClass} p-4`} key={update.barangay}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{update.barangay}</p>
                      <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{update.status}</p>
                    </div>
                    <span className="rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-[10px] font-bold uppercase text-orange-700">
                      Update
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600">{update.note}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </>
    )
  }

  function renderReportsSection() {
    return (
      <section className="px-6 py-8">
        <div className={`${glassPanelClass} p-6`}>
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Reports Desk</p>
              <h2 className="mt-1 text-2xl font-bold text-slate-900">Hazard Reports</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {(['all', 'active', 'pending', 'resolved'] as ReportFilter[]).map((filter) => (
                <button
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] transition ${
                    reportFilter === filter
                      ? 'border-blue-700 bg-blue-700 text-white'
                      : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                  key={filter}
                  onClick={() => setReportFilter(filter)}
                  type="button"
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 grid gap-4">
            {filteredReports.map((report) => (
              <article className={`${glassPanelSoftClass} p-5`} key={report.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-md border px-2 py-1 text-[11px] font-bold ${dashboardHazardClasses[report.code].surface} ${dashboardHazardClasses[report.code].accent}`}>
                        {hazardMeta[report.code].label}
                      </span>
                      <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] ${dashboardStatusClasses[report.status]}`}>
                        {report.status}
                      </span>
                    </div>
                    <h3 className="mt-3 text-lg font-bold text-slate-900">{report.title}</h3>
                    <p className="mt-1 text-sm text-slate-500">{report.location} • {report.time}</p>
                  </div>
                  <div className="text-right text-sm text-slate-600">
                    <p>Severity: {report.severity}</p>
                    <p className="mt-1">Team: {report.responseTeam}</p>
                  </div>
                </div>

                <p className="mt-4 text-sm leading-relaxed text-slate-700">{report.description}</p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button className="rounded-xl border border-amber-500 bg-amber-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-600" onClick={() => handleUpdateReportStatus(report.id, 'pending')} type="button">
                    Mark Pending
                  </button>
                  <button className="rounded-xl border border-red-700 bg-red-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-800" onClick={() => handleUpdateReportStatus(report.id, 'active')} type="button">
                    Mark Active
                  </button>
                  <button className="rounded-xl border border-emerald-700 bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800" onClick={() => handleUpdateReportStatus(report.id, 'resolved')} type="button">
                    Mark Resolved
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    )
  }

  function renderMapSection() {
    return (
      <AdminIncidentMapPanel incidents={reports} onCreateIncident={handleCreateMapIncident} onSelectType={handleSelectMapFilter} selectedType={mapFilter} />
    )
  }

  function renderSimulationSection() {
    return (
      <section className="px-6 py-8">
        <AdminSimulationManager embedded />
      </section>
    )
  }

  const activeSidebarKey: AdminNavKey =
    activeSection === 'reports'
      ? 'hazardDatabase'
      : activeSection === 'map'
        ? 'gisMapping'
        : activeSection === 'simulation'
          ? 'simulationTool'
          : 'dashboardOverview'

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f4f7fb] text-slate-900">
      <div className="relative z-10 flex min-h-screen">
        <AdminSidebar
          activeKey={activeSidebarKey}
          actionOverrides={{
            dashboardOverview: () => handleSelectSection('overview'),
            hazardDatabase: () => handleSelectSection('reports'),
            gisMapping: () => handleSelectSection('map'),
            simulationTool: () => handleSelectSection('simulation'),
          }}
        />

        <main className="flex min-h-screen flex-1 flex-col">
          <header className="mx-4 mt-4 flex flex-col gap-4 sm:mx-6">
            <div className="flex flex-wrap items-center gap-3 rounded-[24px] border border-slate-200 bg-white px-4 py-4 shadow-[0_12px_32px_rgba(15,23,42,0.08)] md:flex-nowrap md:px-5">
              <div className="inline-flex min-w-fit items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-medium text-slate-700">
                {currentDate} | {currentTime}
              </div>

              <label className="flex min-w-[220px] flex-1 items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-500">
                <HeaderIcon name="search" />
                <input className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400" placeholder="Search..." type="text" />
              </label>

              <div className="ml-auto flex items-center gap-2">
                <button className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-700 transition hover:bg-slate-100" type="button">
                  <HeaderIcon name="bell" />
                </button>
                <button className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-700 transition hover:bg-slate-100" type="button">
                  <HeaderIcon name="message" />
                </button>
                <div className="relative" ref={topProfileMenuRef}>
                  <button
                    className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-900 transition hover:bg-slate-100"
                    onClick={() => setIsTopProfileMenuOpen((current) => !current)}
                    type="button"
                  >
                    <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-blue-700 text-sm font-bold text-white shadow-[0_0_14px_rgba(29,78,216,0.16)]">
                      {profile?.photoUrl ? <img alt="Profile" className="h-full w-full object-cover" src={profile.photoUrl} /> : initials}
                    </div>
                    <div className="hidden min-w-0 sm:block">
                      <p className="truncate text-sm font-semibold text-slate-900">{displayName}</p>
                      <p className="text-[11px] text-slate-500">Administrator</p>
                    </div>
                    <svg aria-hidden className={`h-4 w-4 text-slate-500 transition ${isTopProfileMenuOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24">
                      <path d="m7 10 5 5 5-5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                    </svg>
                  </button>

                  {isTopProfileMenuOpen ? (
                    <div className="absolute right-0 top-[calc(100%+0.75rem)] z-30 min-w-[220px] rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_18px_38px_rgba(15,23,42,0.12)]">
                      <div className="border-b border-slate-200 px-3 pb-3 pt-2">
                        <p className="truncate text-sm font-semibold text-slate-900">{displayName}</p>
                        <p className="mt-1 text-xs text-slate-500">{profile?.email || 'Administrator account'}</p>
                      </div>
                      <div className="pt-2">
                        <button
                          className="flex w-full items-center rounded-xl px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100 hover:text-slate-900"
                          onClick={handleOpenAdminProfile}
                          type="button"
                        >
                          Profile settings
                        </button>
                        <button
                          className="mt-1 flex w-full items-center rounded-xl px-3 py-2 text-left text-sm text-red-700 transition hover:bg-red-50"
                          onClick={handleLogout}
                          type="button"
                        >
                          Logout
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-end justify-between gap-4 px-1">
              <div>
                <p className="text-sm font-medium text-slate-500">Hazard operations workspace</p>
                <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
                  Welcome back, <span className="text-blue-800">{firstName}</span>
                </h1>
              </div>
            </div>
          </header>

          {activeSection === 'overview' ? renderOverviewSection() : null}
          {activeSection === 'reports' ? renderReportsSection() : null}
          {activeSection === 'map' ? renderMapSection() : null}
          {activeSection === 'simulation' ? renderSimulationSection() : null}
        </main>
      </div>
    </div>
  )
}
