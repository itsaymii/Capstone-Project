import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AdminSidebar } from '../../components/AdminSidebar'
import {
  hazardIncidents,
  type HazardIncident,
  type HazardType,
} from '../../data/adminOperations'
import type { AdminNavKey } from '../../data/adminNavigation'
import { getCurrentUserProfile, logoutUser } from '../../services/auth'
import {
  NOTIFICATIONS_CHANGED_EVENT,
  getNotifications,
  markAllNotificationsRead,
  type NotificationItem,
} from '../../services/notifications'
import notificationIcon from '../../images/notification.png'
import { InlineModuleSection } from './sections/InlineModuleSection'
import { MapSection } from './sections/MapSection'
import { OverviewSection } from './sections/OverviewSection'
import { ReportsSection } from './sections/ReportsSection'
import { ResourcesSection } from './sections/ResourcesSection'
import { SimulationSection } from './sections/SimulationSection'
import { UsersSection } from './sections/UsersSection'

type WorkspaceSection =
  | 'overview'
  | 'reports'
  | 'map'
  | 'simulation'
  | 'scoring'
  | 'trends'
  | 'resources'
  | 'users'
  | 'settings'

type MapFilter = 'all' | HazardType

type MetricCard = {
  label: string
  value: number | string
  comparison: string
  delta: string
  accent: string
  valueClass: string
}

function getWorkspaceSection(sectionParam: string | null): WorkspaceSection {
  switch (sectionParam) {
    case 'reports':
    case 'map':
    case 'simulation':
    case 'scoring':
    case 'trends':
    case 'resources':
    case 'users':
    case 'settings':
      return sectionParam
    default:
      return 'overview'
  }
}

function formatNotificationTime(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return parsed.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function HeaderIcon({ name }: { name: 'search' | 'bell' }) {
  if (name === 'search') {
    return (
      <svg aria-hidden className="h-4 w-4" fill="none" viewBox="0 0 24 24">
        <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
        <path d="m20 20-3.5-3.5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      </svg>
    )
  }

  return (
    <svg aria-hidden className="h-4 w-4" fill="none" viewBox="0 0 24 24">
      <path
        d="M14.857 17H5.143A1.143 1.143 0 0 1 4 15.857V10.5A5.5 5.5 0 0 1 9.5 5h1A5.5 5.5 0 0 1 16 10.5v5.357A1.143 1.143 0 0 1 14.857 17Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path d="M9 20h2" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  )
}

export function AdminDashboardPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const notificationsMenuRef = useRef<HTMLDivElement | null>(null)
  const topProfileMenuRef = useRef<HTMLDivElement | null>(null)
  const [currentDate, setCurrentDate] = useState('')
  const [currentTime, setCurrentTime] = useState('')
  const [activeSection, setActiveSection] = useState<WorkspaceSection>(() =>
    getWorkspaceSection(searchParams.get('section')),
  )
  const [reports, setReports] = useState(() => hazardIncidents)
  const [mapFilter, setMapFilter] = useState<MapFilter>('all')
  const [notifications, setNotifications] = useState<NotificationItem[]>(() => getNotifications())
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)
  const [isTopProfileMenuOpen, setIsTopProfileMenuOpen] = useState(false)

  const profile = getCurrentUserProfile()
  const displayName = profile?.fullName?.trim() || 'Administrator'
  const firstName = useMemo(() => displayName.split(/\s+/).filter(Boolean)[0] || 'Administrator', [displayName])
  const initials = useMemo(() => {
    const nameParts = displayName.split(/\s+/).filter(Boolean)
    if (nameParts.length === 0) return 'AD'
    if (nameParts.length === 1) return nameParts[0].slice(0, 2).toUpperCase()
    return `${nameParts[0][0]}${nameParts[1][0]}`.toUpperCase()
  }, [displayName])
  const unreadNotificationsCount = useMemo(
    () => notifications.filter((item) => !item.read).length,
    [notifications],
  )

  const currentYear = new Date().getFullYear()
  const previousYear = currentYear - 1
  const fireReports = useMemo(() => reports.filter((incident) => incident.code === 'FR'), [reports])
  const earthquakeReports = useMemo(
    () => reports.filter((incident) => incident.code === 'EQ'),
    [reports],
  )
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
    () =>
      Math.min(
        100,
        52 +
          fireReports.length * 7 +
          fireReports.filter((item) => item.status === 'active').length * 6,
      ),
    [fireReports],
  )
  const earthquakeRiskScore = useMemo(
    () =>
      Math.min(
        100,
        44 +
          earthquakeReports.length * 10 +
          earthquakeReports.filter((item) => item.severity !== 'Low').length * 7,
      ),
    [earthquakeReports],
  )

  const overviewMetricCards: MetricCard[] = [
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
      delta:
        earthquakeRiskScore >= 70 ? 'Heightened seismic watch' : 'Routine monitoring level',
      accent: 'border-t-teal-600',
      valueClass: 'text-teal-700',
    },
  ]

  const latestFireIncidents = fireReports.slice(0, 3)

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
      if (topProfileMenuRef.current && !topProfileMenuRef.current.contains(event.target as Node)) {
        setIsTopProfileMenuOpen(false)
      }

      if (
        notificationsMenuRef.current &&
        !notificationsMenuRef.current.contains(event.target as Node)
      ) {
        setIsNotificationsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleDocumentClick)
    return () => document.removeEventListener('mousedown', handleDocumentClick)
  }, [])

  useEffect(() => {
    function syncNotifications(): void {
      setNotifications(getNotifications())
    }

    syncNotifications()
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, syncNotifications)
    return () => window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, syncNotifications)
  }, [])

  useEffect(() => {
    const nextSection = getWorkspaceSection(searchParams.get('section'))
    setActiveSection((currentSection) =>
      currentSection === nextSection ? currentSection : nextSection,
    )
  }, [searchParams])

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

  function handleToggleNotifications(): void {
    setIsNotificationsOpen((current) => !current)
    setIsTopProfileMenuOpen(false)
  }

  function handleMarkAllNotificationsRead(): void {
    markAllNotificationsRead()
  }

  const activeSidebarKey: AdminNavKey =
    activeSection === 'reports'
      ? 'reportsAnalytics'
      : activeSection === 'map'
        ? 'gisMapping'
        : activeSection === 'scoring'
          ? 'riskScoring'
          : activeSection === 'trends'
            ? 'predictiveTrends'
            : activeSection === 'resources'
              ? 'evacuationResources'
              : activeSection === 'users'
                ? 'communityPortal'
                : activeSection === 'settings'
                  ? 'settingsAdminControls'
                  : activeSection === 'simulation'
                    ? 'simulationTool'
                    : 'dashboardOverview'

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#f4f7fb] text-slate-900">
      <div className="relative z-10 flex min-h-screen">
        <AdminSidebar
          activeKey={activeSidebarKey}
          actionOverrides={{
            dashboardOverview: () => handleSelectSection('overview'),
            gisMapping: () => handleSelectSection('map'),
            riskScoring: () => handleSelectSection('scoring'),
            predictiveTrends: () => handleSelectSection('trends'),
            evacuationResources: () => handleSelectSection('resources'),
            communityPortal: () => handleSelectSection('users'),
            simulationTool: () => handleSelectSection('simulation'),
            reportsAnalytics: () => handleSelectSection('reports'),
            settingsAdminControls: () => handleSelectSection('settings'),
          }}
        />

        <main className="flex min-h-screen flex-1 flex-col">
          <header className="sticky top-0 z-30 mx-4 mt-4 flex flex-col gap-4 pb-2 sm:mx-6">
            <div className="flex flex-wrap items-center gap-3 rounded-[24px] border border-slate-200 bg-white px-4 py-4 shadow-[0_12px_32px_rgba(15,23,42,0.08)] md:flex-nowrap md:px-5">
              <div className="inline-flex min-w-fit items-center px-1 py-1 text-sm font-semibold text-slate-800">
                {currentDate} | {currentTime}
              </div>

              <div className="ml-auto flex items-center gap-2">
                <label className="flex min-w-[220px] w-full max-w-[360px] items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-500 md:max-w-[420px]">
                  <HeaderIcon name="search" />
                  <input
                    className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                    placeholder="Search..."
                    type="text"
                  />
                </label>

                <div className="relative" ref={notificationsMenuRef}>
                  <button
                    aria-label="Notifications"
                    className="relative inline-flex h-9 w-9 items-center justify-center text-blue-800 transition hover:opacity-80"
                    onClick={handleToggleNotifications}
                    type="button"
                  >
                    <img alt="" aria-hidden className="h-6 w-6 object-contain" src={notificationIcon} />
                    {unreadNotificationsCount > 0 ? (
                      <span className="absolute -right-1 -top-1 flex min-h-[1.1rem] min-w-[1.1rem] items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">
                        {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                      </span>
                    ) : null}
                  </button>

                  {isNotificationsOpen ? (
                    <div className="absolute right-0 top-[calc(100%+0.75rem)] z-30 w-[320px] max-w-[84vw] rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_18px_38px_rgba(15,23,42,0.12)]">
                      <div className="flex items-center justify-between border-b border-slate-200 px-3 pb-3 pt-2">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">Notifications</p>
                          <p className="text-xs text-slate-500">{unreadNotificationsCount} unread</p>
                        </div>
                        <button
                          className="text-xs font-semibold text-blue-700 transition hover:text-blue-800 disabled:text-slate-300"
                          disabled={unreadNotificationsCount === 0}
                          onClick={handleMarkAllNotificationsRead}
                          type="button"
                        >
                          Mark all as read
                        </button>
                      </div>

                      <div className="max-h-[320px] overflow-y-auto py-2">
                        {notifications.length === 0 ? (
                          <p className="px-3 py-8 text-center text-sm text-slate-500">No notifications yet.</p>
                        ) : (
                          notifications.slice(0, 10).map((item) => (
                            <div
                              className={`rounded-xl px-3 py-2.5 ${
                                item.read ? 'text-slate-600' : 'bg-blue-50 text-slate-900'
                              }`}
                              key={item.id}
                            >
                              <p className="text-sm leading-relaxed">{item.message}</p>
                              <p className="mt-1 text-[11px] text-slate-500">
                                {formatNotificationTime(item.createdAt)}
                              </p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="relative" ref={topProfileMenuRef}>
                  <button
                    className="flex items-center gap-3 px-1 py-1 text-slate-900 transition hover:opacity-85"
                    onClick={() => setIsTopProfileMenuOpen((current) => !current)}
                    type="button"
                  >
                    <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-blue-700 text-sm font-bold text-white shadow-[0_0_14px_rgba(29,78,216,0.16)]">
                      {profile?.photoUrl ? (
                        <img alt="Profile" className="h-full w-full object-cover" src={profile.photoUrl} />
                      ) : (
                        initials
                      )}
                    </div>
                    <div className="hidden min-w-0 sm:block">
                      <p className="truncate text-sm font-semibold text-slate-900">{displayName}</p>
                      <p className="text-[11px] text-slate-500">Administrator</p>
                    </div>
                    <svg
                      aria-hidden
                      className={`h-4 w-4 text-slate-500 transition ${
                        isTopProfileMenuOpen ? 'rotate-180' : ''
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <path
                        d="m7 10 5 5 5-5"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.8"
                      />
                    </svg>
                  </button>

                  {isTopProfileMenuOpen ? (
                    <div className="absolute right-0 top-[calc(100%+0.75rem)] z-30 min-w-[220px] rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_18px_38px_rgba(15,23,42,0.12)]">
                      <div className="border-b border-slate-200 px-3 pb-3 pt-2">
                        <p className="truncate text-sm font-semibold text-slate-900">{displayName}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {profile?.email || 'Administrator account'}
                        </p>
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

            {activeSection === 'overview' ? (
              <div className="flex flex-wrap items-end justify-between gap-4 px-1">
                <div>
                  <p className="text-sm font-medium text-slate-500">Hazard operations workspace</p>
                  <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
                    Welcome back, <span className="text-blue-800">{firstName}</span>
                  </h1>
                </div>
              </div>
            ) : null}
          </header>

          {activeSection === 'overview' ? (
            <OverviewSection
              latestFireIncidents={latestFireIncidents}
              overviewMetricCards={overviewMetricCards}
            />
          ) : null}
          {activeSection === 'reports' ? <ReportsSection reports={reports} /> : null}
          {activeSection === 'map' ? (
            <MapSection
              incidents={reports}
              mapFilter={mapFilter}
              onCreateIncident={handleCreateMapIncident}
              onSelectType={handleSelectMapFilter}
            />
          ) : null}
          {activeSection === 'scoring' ? (
            <InlineModuleSection
              description="Risk scoring now opens inside the main dashboard so the workflow stays on the same page as Overview."
              eyebrow="Admin Operations"
              title="Risk Scoring"
            />
          ) : null}
          {activeSection === 'trends' ? (
            <InlineModuleSection
              description="Trend monitoring stays inside the same light admin dashboard instead of routing to a separate page."
              eyebrow="Admin Operations"
              title="Predictive Trends"
            />
          ) : null}
          {activeSection === 'resources' ? <ResourcesSection /> : null}
          {activeSection === 'users' ? <UsersSection /> : null}
          {activeSection === 'simulation' ? <SimulationSection /> : null}
          {activeSection === 'settings' ? (
            <InlineModuleSection
              description="Settings now stay in the same dashboard page so the admin workspace remains consistent and light-themed."
              eyebrow="Admin Controls"
              title="Settings"
            />
          ) : null}
        </main>
      </div>
    </div>
  )
}
