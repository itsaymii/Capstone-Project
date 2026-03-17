import axios from 'axios'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AdminIncidentMapPanel } from '../../components/AdminIncidentMapPanel'
import { AdminSidebar } from '../../components/AdminSidebar'
import { AdminSimulationManager } from '../../components/AdminSimulationManager'
import {
  hazardIncidents,
  type HazardIncident,
  type HazardType,
  type IncidentStatus,
} from '../../data/adminOperations'
import type { AdminNavKey } from '../../data/adminNavigation'
import type { AuthUser } from '../../types/api'
import { getCurrentUserProfile, logoutUser } from '../../services/auth'
import { createDashboardAccount, deleteDashboardAccount, getDashboardAccounts, updateDashboardAccount } from '../../services/api'

type WorkspaceSection = 'overview' | 'reports' | 'map' | 'simulation' | 'scoring' | 'trends' | 'resources' | 'users' | 'settings'
type MapFilter = 'all' | HazardType
type ReportHazardFilter = 'all' | 'FR' | 'EQ' | 'AC'
type DashboardUserFormState = {
  fullName: string
  email: string
  username: string
  password: string
  isAdmin: boolean
  isActive: boolean
}

const defaultDashboardUserFormState: DashboardUserFormState = {
  fullName: '',
  email: '',
  username: '',
  password: '',
  isAdmin: false,
  isActive: true,
}

type ReportTableColumn<T> = {
  key: keyof T
  label: string
  align?: 'left' | 'center' | 'right'
}

type UnifiedHazardReportRow = {
  reportId: string
  reportType: string
  location: string
  dateTime: string
  responseTeam: string
  magnitude: string
  cause: string
  impactLevel: string
  riskLevel: string
  alertLevel: string
  sentVia: string
  status: string
  hazardCode: 'FR' | 'EQ' | 'AC'
  locationKey: string
  dateValue: string
}

type MaintenanceChecklistStatus = 'pending' | 'complete' | 'incomplete'

type MaintenanceChecklistItem = {
  label: string
  status: MaintenanceChecklistStatus
  details?: string
}

type MaintenanceCategory = {
  title: string
  items: MaintenanceChecklistItem[]
}

type MaintenanceVehicleRecord = {
  team: string
  date: string
  time: string
  vehicle: string
  fuelType: string
  plateNumber: string
  assignedTo: string
  fuelGauge: string
  note: string
}

const defaultMaintenanceVehicleRecord: MaintenanceVehicleRecord = {
  team: 'BRAVO',
  date: 'March 01-02, 2026',
  time: '0800H - 0800H',
  vehicle: 'PCSO Commuter',
  fuelType: 'Diesel (70L)',
  plateNumber: 'IP 047A',
  assignedTo: 'Janet V. Gendrano',
  fuelGauge: '20%',
  note: 'Respectfully submitted with end-of-day maintenance notes from the 24-hour duty.',
}

const defaultMaintenanceTodoItems: MaintenanceChecklistItem[] = [
  { label: 'Disinfect and clean the ambulance', status: 'pending' },
  { label: 'Refill oxygen', status: 'pending', details: '100 PSI level' },
  { label: 'Inventory of supplies', status: 'complete' },
]

const defaultMaintenanceInventoryItems = [
  '1 stretcher',
  '1 folding stretcher (orange)',
  '1 scoop basket',
  '1 spine board',
  '1 oxygen tank',
  '1 set body splint (green)',
  '1 set padded board splint (blue)',
]

const defaultMaintenanceCategories: MaintenanceCategory[] = [
  {
    title: 'Check-up / Replacement of vehicle used',
    items: [
      { label: 'PMS', status: 'pending' },
      { label: 'Change oil / brake cleaning', status: 'pending' },
      { label: 'Brake pads', status: 'pending' },
      { label: 'Brake shoe', status: 'pending' },
      { label: 'Brake fluid / coolant / power steering / washer fluid', status: 'pending' },
      { label: 'Tire replacement / alignment', status: 'pending' },
      { label: 'Module siren replacement', status: 'pending' },
      { label: 'Wiper replacement', status: 'pending' },
      { label: 'Aircon cleaning', status: 'pending' },
      { label: 'Other services', status: 'pending', details: 'Pending workshop scheduling' },
    ],
  },
  {
    title: 'Communication equipment',
    items: [
      { label: 'Non-functional radio check', status: 'pending', details: 'Needs detailed equipment review' },
      { label: 'Functional communication line', status: 'complete' },
    ],
  },
]

function parseClockTimeLabel(label: string): { hours: number; minutes: number } {
  const match = label.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (!match) {
    return { hours: 8, minutes: 0 }
  }

  let hours = Number(match[1])
  const minutes = Number(match[2])
  const meridiem = match[3].toUpperCase()

  if (meridiem === 'PM' && hours !== 12) {
    hours += 12
  }

  if (meridiem === 'AM' && hours === 12) {
    hours = 0
  }

  return { hours, minutes }
}

function buildIncidentDateValue(timeLabel: string, dayOffset: number): string {
  const { hours, minutes } = parseClockTimeLabel(timeLabel)
  const year = new Date().getFullYear()
  const date = new Date(year, 2, 17 - dayOffset, hours, minutes, 0, 0)
  return date.toISOString()
}

function escapeHtmlCell(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function getWorkspaceSection(sectionParam: string | null): WorkspaceSection {
  if (
    sectionParam === 'reports' ||
    sectionParam === 'map' ||
    sectionParam === 'simulation' ||
    sectionParam === 'scoring' ||
    sectionParam === 'trends' ||
    sectionParam === 'resources' ||
    sectionParam === 'users' ||
    sectionParam === 'settings'
  ) {
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
  const [reportStartDate, setReportStartDate] = useState('')
  const [reportEndDate, setReportEndDate] = useState('')
  const [reportHazardFilter, setReportHazardFilter] = useState<ReportHazardFilter>('all')
  const [reportLocationFilter, setReportLocationFilter] = useState('')
  const [mapFilter, setMapFilter] = useState<MapFilter>('all')
  const [isTopProfileMenuOpen, setIsTopProfileMenuOpen] = useState(false)
  const [dashboardUsers, setDashboardUsers] = useState<AuthUser[]>([])
  const [isUsersLoading, setIsUsersLoading] = useState(false)
  const [usersMessage, setUsersMessage] = useState('')
  const [usersError, setUsersError] = useState('')
  const [editingUserId, setEditingUserId] = useState<number | null>(null)
  const [userFormState, setUserFormState] = useState<DashboardUserFormState>(defaultDashboardUserFormState)
  const [isSavingUser, setIsSavingUser] = useState(false)
  const [deletingUserId, setDeletingUserId] = useState<number | null>(null)
  const [isUserModalOpen, setIsUserModalOpen] = useState(false)
  const [maintenanceVehicleForm, setMaintenanceVehicleForm] = useState<MaintenanceVehicleRecord>(defaultMaintenanceVehicleRecord)
  const [maintenanceTodoState, setMaintenanceTodoState] = useState<MaintenanceChecklistItem[]>(defaultMaintenanceTodoItems)
  const [maintenanceCategoryState, setMaintenanceCategoryState] = useState<MaintenanceCategory[]>(defaultMaintenanceCategories)
  const [maintenanceMessage, setMaintenanceMessage] = useState('')

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

  useEffect(() => {
    if (activeSection === 'users') {
      void loadDashboardUsers()
    }
  }, [activeSection])

  const normalizedReportLocationFilter = reportLocationFilter.trim().toLowerCase()
  const userAccountStats = useMemo(
    () => ({
      total: dashboardUsers.length,
      admin: dashboardUsers.filter((user) => Boolean(user.isAdmin)).length,
      citizen: dashboardUsers.filter((user) => !user.isAdmin).length,
    }),
    [dashboardUsers],
  )

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
  function handleMaintenanceFieldChange(field: keyof MaintenanceVehicleRecord, value: string): void {
    setMaintenanceVehicleForm((current) => ({
      ...current,
      [field]: value,
    }))
    if (maintenanceMessage) {
      setMaintenanceMessage('')
    }
  }

  function handleMaintenanceTodoChange(index: number, field: 'status' | 'details', value: string): void {
    setMaintenanceTodoState((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              [field]: value,
            }
          : item,
      ),
    )
    if (maintenanceMessage) {
      setMaintenanceMessage('')
    }
  }

  function handleMaintenanceCategoryChange(categoryIndex: number, itemIndex: number, field: 'status' | 'details', value: string): void {
    setMaintenanceCategoryState((current) =>
      current.map((category, currentCategoryIndex) =>
        currentCategoryIndex === categoryIndex
          ? {
              ...category,
              items: category.items.map((item, currentItemIndex) =>
                currentItemIndex === itemIndex
                  ? {
                      ...item,
                      [field]: value,
                    }
                  : item,
              ),
            }
          : category,
      ),
    )
    if (maintenanceMessage) {
      setMaintenanceMessage('')
    }
  }

  function handleSaveMaintenanceRecord(): void {
    setMaintenanceMessage(`Maintenance record updated locally at ${new Date().toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}.`)
  }

  function handleResetMaintenanceRecord(): void {
    setMaintenanceVehicleForm(defaultMaintenanceVehicleRecord)
    setMaintenanceTodoState(defaultMaintenanceTodoItems)
    setMaintenanceCategoryState(defaultMaintenanceCategories)
    setMaintenanceMessage('Maintenance form reset to the default checklist.')
  }

  function printMaintenanceVehicleForm(): void {
    const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=1100,height=900')
    if (!printWindow) {
      return
    }

    const todoRows = maintenanceTodoState
      .map(
        (item) => `
          <tr>
            <td>${escapeHtmlCell(item.label)}</td>
            <td>${escapeHtmlCell(item.status)}</td>
            <td>${escapeHtmlCell(item.details || '-')}</td>
          </tr>
        `,
      )
      .join('')

    const inventoryRows = defaultMaintenanceInventoryItems
      .map((item) => `<li>${escapeHtmlCell(item)}</li>`)
      .join('')

    const categorySections = maintenanceCategoryState
      .map(
        (category) => `
          <section class="category-block">
            <h3>${escapeHtmlCell(category.title)}</h3>
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Status</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                ${category.items
                  .map(
                    (item) => `
                      <tr>
                        <td>${escapeHtmlCell(item.label)}</td>
                        <td>${escapeHtmlCell(item.status)}</td>
                        <td>${escapeHtmlCell(item.details || '-')}</td>
                      </tr>
                    `,
                  )
                  .join('')}
              </tbody>
            </table>
          </section>
        `,
      )
      .join('')

    printWindow.document.write(`
      <html>
        <head>
          <title>Maintenance Vehicle Form</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 24px; color: #0f172a; }
            h1 { font-size: 24px; margin-bottom: 4px; text-transform: uppercase; }
            h2 { font-size: 16px; margin: 0 0 8px; }
            h3 { font-size: 14px; margin: 0 0 10px; text-transform: uppercase; }
            p { margin: 0; }
            .subtle { color: #475569; margin-bottom: 16px; }
            .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px; }
            .info-card { border: 1px solid #cbd5e1; border-radius: 12px; padding: 12px; }
            .info-card span { display: block; font-size: 11px; text-transform: uppercase; color: #64748b; margin-bottom: 6px; }
            .meta-table, table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #cbd5e1; padding: 10px 12px; text-align: left; vertical-align: top; font-size: 12px; }
            th { background: #e2e8f0; text-transform: uppercase; font-size: 11px; letter-spacing: 0.08em; }
            .section { margin-top: 18px; }
            .inventory-list { margin: 10px 0 0; padding-left: 18px; }
            .inventory-list li { margin-bottom: 6px; }
            .category-block { margin-top: 18px; }
            .note-box { margin-top: 12px; padding: 12px; border: 1px solid #cbd5e1; border-radius: 12px; background: #f8fafc; }
          </style>
        </head>
        <body>
          <h1>Maintenance of Vehicle</h1>
          <p class="subtle">Printable vehicle readiness and maintenance checklist for the current response unit.</p>

          <div class="summary-grid">
            <div class="info-card"><span>Team</span><strong>${escapeHtmlCell(maintenanceVehicleForm.team)}</strong></div>
            <div class="info-card"><span>Date</span><strong>${escapeHtmlCell(maintenanceVehicleForm.date)}</strong></div>
            <div class="info-card"><span>Time</span><strong>${escapeHtmlCell(maintenanceVehicleForm.time)}</strong></div>
            <div class="info-card"><span>Assigned For</span><strong>${escapeHtmlCell(maintenanceVehicleForm.assignedTo)}</strong></div>
          </div>

          <table class="meta-table">
            <thead>
              <tr>
                <th>Vehicle</th>
                <th>Fuel Type</th>
                <th>Temporary Plate No.</th>
                <th>Fuel Gauge</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>${escapeHtmlCell(maintenanceVehicleForm.vehicle)}</td>
                <td>${escapeHtmlCell(maintenanceVehicleForm.fuelType)}</td>
                <td>${escapeHtmlCell(maintenanceVehicleForm.plateNumber)}</td>
                <td>${escapeHtmlCell(maintenanceVehicleForm.fuelGauge)}</td>
              </tr>
            </tbody>
          </table>

          <div class="note-box">${escapeHtmlCell(maintenanceVehicleForm.note)}</div>

          <section class="section">
            <h2>Daily Maintenance Checklist</h2>
            <table>
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Status</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>${todoRows}</tbody>
            </table>
          </section>

          <section class="section">
            <h2>Inventory of Supplies</h2>
            <ul class="inventory-list">${inventoryRows}</ul>
          </section>

          ${categorySections}
        </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.focus()
    printWindow.print()
  }

  function matchesReportDateRange(dateValue?: string): boolean {
    if (!dateValue) {
      return true
    }

    const parsedDate = new Date(dateValue)
    if (Number.isNaN(parsedDate.getTime())) {
      return true
    }

    if (reportStartDate) {
      const startDate = new Date(`${reportStartDate}T00:00:00`)
      if (parsedDate < startDate) {
        return false
      }
    }

    if (reportEndDate) {
      const endDate = new Date(`${reportEndDate}T23:59:59.999`)
      if (parsedDate > endDate) {
        return false
      }
    }

    return true
  }

  function matchesReportHazard(hazardCode?: 'FR' | 'EQ' | 'AC'): boolean {
    if (!hazardCode || reportHazardFilter === 'all') {
      return true
    }

    return reportHazardFilter === hazardCode
  }

  function matchesReportLocation(locationValue?: string): boolean {
    if (!normalizedReportLocationFilter) {
      return true
    }

    return (locationValue || '').toLowerCase().includes(normalizedReportLocationFilter)
  }

  function formatReportDateTime(value: string): string {
    const parsedDate = new Date(value)
    if (Number.isNaN(parsedDate.getTime())) {
      return value
    }

    return parsedDate.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  function downloadReportTableAsCsv<T extends Record<string, string | number>>(fileName: string, columns: ReportTableColumn<T>[], rows: T[]): void {
    const escapeCsvValue = (value: string) => {
      if (/[",\n]/.test(value)) {
        return `"${value.replace(/"/g, '""')}"`
      }
      return value
    }

    const headerRow = columns.map((column) => escapeCsvValue(String(column.label))).join(',')
    const bodyRows = rows.map((row) =>
      columns
        .map((column) => escapeCsvValue(String(row[column.key] ?? '')))
        .join(','),
    )

    const csvContent = [headerRow, ...bodyRows].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const downloadUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = downloadUrl
    link.download = `${fileName}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(downloadUrl)
  }

  function printReportTable<T extends Record<string, string | number>>(title: string, subtitle: string, columns: ReportTableColumn<T>[], rows: T[]): void {
    const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=1200,height=900')
    if (!printWindow) {
      return
    }

    const headerCells = columns
      .map((column) => `<th>${escapeHtmlCell(String(column.label))}</th>`)
      .join('')
    const bodyRows = rows
      .map((row) =>
        `<tr>${columns
          .map((column) => `<td>${escapeHtmlCell(String(row[column.key] ?? ''))}</td>`)
          .join('')}</tr>`,
      )
      .join('')

    printWindow.document.write(`
      <html>
        <head>
          <title>${escapeHtmlCell(title)}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 24px; color: #0f172a; }
            h1 { font-size: 22px; margin-bottom: 4px; }
            p { margin: 0 0 16px; color: #475569; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { border: 1px solid #cbd5e1; padding: 10px 12px; text-align: left; vertical-align: top; }
            th { background: #e2e8f0; text-transform: uppercase; font-size: 11px; letter-spacing: 0.08em; }
            tr:nth-child(even) td { background: #f8fafc; }
          </style>
        </head>
        <body>
          <h1>${escapeHtmlCell(title)}</h1>
          <p>${escapeHtmlCell(subtitle)}</p>
          <table>
            <thead><tr>${headerCells}</tr></thead>
            <tbody>${bodyRows || '<tr><td colspan="99">No rows available for the selected filters.</td></tr>'}</tbody>
          </table>
        </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.focus()
    printWindow.print()
  }

  function resetReportFilters(): void {
    setReportStartDate('')
    setReportEndDate('')
    setReportHazardFilter('all')
    setReportLocationFilter('')
  }

  const unifiedHazardReportRows = useMemo<UnifiedHazardReportRow[]>(() => {
    const fireCauseLookup: Record<string, string> = {
      'fire-commercial': 'Electrical overload',
      'fire-barangay-10': 'Unattended cooking flame',
      'fire-industrial': 'Chemical ignition in storage area',
    }
    const earthquakeMagnitudeLookup: Record<string, string> = {
      'eq-east-zone': '4.2',
    }
    const accidentCauseLookup: Record<string, string> = {
      'acc-highway': 'Multi-vehicle collision',
      'acc-diversion': 'Road collision during peak traffic',
    }

    return reports
      .map((incident, index) => {
        const hazardCode: 'FR' | 'EQ' | 'AC' = incident.code
        const dateValue = buildIncidentDateValue(incident.time, index)
        const riskLevel =
          incident.severity === 'Low'
            ? 'Low'
            : incident.severity === 'Moderate'
              ? 'Medium'
              : incident.severity === 'High'
                ? 'High'
                : 'Critical'
        const impactLevel =
          incident.severity === 'Low'
            ? 'Minimal'
            : incident.severity === 'Moderate'
              ? 'Localized'
              : incident.severity === 'High'
                ? 'Significant'
                : 'Severe'
        const alertLevel =
          incident.severity === 'Low'
            ? 'Advisory'
            : incident.severity === 'Moderate'
              ? 'Watch'
              : incident.severity === 'High'
                ? 'Warning'
                : 'Emergency'

        return {
          reportId: `RPT-${String(index + 1).padStart(3, '0')}`,
          reportType: incident.code === 'FR' ? 'Fire' : incident.code === 'EQ' ? 'Earthquake' : 'Accident',
          location: incident.location,
          dateTime: formatReportDateTime(dateValue),
          responseTeam: incident.responseTeam,
          magnitude: incident.code === 'EQ' ? earthquakeMagnitudeLookup[incident.id] ?? '3.8' : '-',
          cause:
            incident.code === 'FR'
              ? fireCauseLookup[incident.id] ?? 'Under investigation'
              : incident.code === 'AC'
                ? accidentCauseLookup[incident.id] ?? 'Traffic investigation ongoing'
                : '-',
          impactLevel,
          riskLevel,
          alertLevel,
          sentVia: index % 2 === 0 ? 'SMS' : 'Email',
          status: incident.status,
          hazardCode,
          locationKey: incident.location,
          dateValue,
        }
      })
  }, [reports])

  const filteredUnifiedHazardReportRows = useMemo(
    () =>
      unifiedHazardReportRows.filter(
        (row) =>
          matchesReportHazard(row.hazardCode) &&
          matchesReportLocation(row.locationKey) &&
          matchesReportDateRange(row.dateValue),
      ),
    [unifiedHazardReportRows, reportHazardFilter, normalizedReportLocationFilter, reportStartDate, reportEndDate],
  )
  const unifiedHazardReportColumns: ReportTableColumn<UnifiedHazardReportRow>[] = [
    { key: 'reportId', label: 'Report ID' },
    { key: 'reportType', label: 'Type' },
    { key: 'location', label: 'Location / Barangay' },
    { key: 'dateTime', label: 'Date and Time' },
    { key: 'responseTeam', label: 'Response Team' },
    { key: 'magnitude', label: 'Magnitude' },
    { key: 'cause', label: 'Cause' },
    { key: 'impactLevel', label: 'Impact Level' },
    { key: 'riskLevel', label: 'Risk Level' },
    { key: 'alertLevel', label: 'Alert Level' },
    { key: 'sentVia', label: 'Sent Via' },
    { key: 'status', label: 'Status' },
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

  function getUsersApiErrorMessage(error: unknown, fallbackMessage: string): string {
    if (!axios.isAxiosError(error)) {
      return fallbackMessage
    }

    const statusCode = error.response?.status
    const apiError = (error.response?.data as { error?: string } | undefined)?.error

    if (statusCode === 401 || statusCode === 403) {
      return 'Unable to load website accounts because the admin session is missing or expired. Log out, log in again, then refresh Users.'
    }

    if (!error.response) {
      return 'Unable to connect to the backend server. Make sure Django is running, then refresh Users.'
    }

    return apiError ?? fallbackMessage
  }

  async function loadDashboardUsers(): Promise<void> {
    setIsUsersLoading(true)
    setUsersError('')

    try {
      const response = await getDashboardAccounts()
      setDashboardUsers(response.users)
    } catch (error) {
      setDashboardUsers([])
      setUsersError(getUsersApiErrorMessage(error, 'Unable to load website accounts right now.'))
    } finally {
      setIsUsersLoading(false)
    }
  }

  function resetUserForm(): void {
    setEditingUserId(null)
    setUserFormState(defaultDashboardUserFormState)
  }

  function handleOpenCreateUserModal(): void {
    resetUserForm()
    setUsersMessage('')
    setUsersError('')
    setIsUserModalOpen(true)
  }

  function handleCloseUserModal(): void {
    setIsUserModalOpen(false)
    resetUserForm()
  }

  function handleUserFieldChange(field: keyof DashboardUserFormState, value: string | boolean): void {
    setUserFormState((current) => ({
      ...current,
      [field]: value,
    }))
    if (usersMessage) {
      setUsersMessage('')
    }
    if (usersError) {
      setUsersError('')
    }
  }

  function handleEditUser(user: AuthUser): void {
    setEditingUserId(user.id ?? null)
    setUserFormState({
      fullName: user.fullName,
      email: user.email,
      username: user.username ?? '',
      password: '',
      isAdmin: Boolean(user.isAdmin),
      isActive: user.isActive ?? true,
    })
    setUsersMessage('')
    setUsersError('')
    setIsUserModalOpen(true)
  }

  function formatUserDateTime(value?: string | null): string {
    if (!value) {
      return 'Not available'
    }

    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) {
      return 'Not available'
    }

    return parsed.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  async function handleSubmitUserForm(): Promise<void> {
    setIsSavingUser(true)
    setUsersMessage('')
    setUsersError('')

    if (!userFormState.fullName.trim() || !userFormState.email.trim() || (!editingUserId && !userFormState.password)) {
      setUsersError('Full name, email, and password for new accounts are required.')
      setIsSavingUser(false)
      return
    }

    if (userFormState.password && userFormState.password.length < 6) {
      setUsersError('Password must be at least 6 characters.')
      setIsSavingUser(false)
      return
    }

    try {
      if (editingUserId) {
        const response = await updateDashboardAccount(editingUserId, {
          fullName: userFormState.fullName,
          email: userFormState.email,
          username: userFormState.username,
          password: userFormState.password || undefined,
          isAdmin: userFormState.isAdmin,
          isActive: userFormState.isActive,
        })

        setDashboardUsers((currentUsers) =>
          currentUsers.map((user) => (user.id === editingUserId ? response.user : user)),
        )
        setUsersMessage(response.message)
      } else {
        const response = await createDashboardAccount({
          fullName: userFormState.fullName,
          email: userFormState.email,
          username: userFormState.username || undefined,
          password: userFormState.password,
          isAdmin: userFormState.isAdmin,
        })

        setDashboardUsers((currentUsers) => [response.user, ...currentUsers])
        setUsersMessage(response.message)
      }

      handleCloseUserModal()
    } catch (error) {
      setUsersError(getUsersApiErrorMessage(error, 'Unable to save account changes right now.'))
    } finally {
      setIsSavingUser(false)
    }
  }

  async function handleDeleteUser(user: AuthUser): Promise<void> {
    if (!user.id) {
      return
    }

    setDeletingUserId(user.id)
    setUsersMessage('')
    setUsersError('')

    try {
      const response = await deleteDashboardAccount(user.id)
      setDashboardUsers((currentUsers) => currentUsers.filter((currentUser) => currentUser.id !== user.id))
      setUsersMessage(response.message)
      if (editingUserId === user.id) {
        resetUserForm()
      }
    } catch (error) {
      setUsersError(getUsersApiErrorMessage(error, 'Unable to delete this account right now.'))
    } finally {
      setDeletingUserId(null)
    }
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

  function renderReportTable<T extends Record<string, string | number>>(options: {
    title: string
    description: string
    columns: ReportTableColumn<T>[]
    rows: T[]
    emptyMessage: string
    exportFileName: string
    rowKey: (row: T, index: number) => string
  }) {
    const { title, description, columns, rows, emptyMessage, exportFileName, rowKey } = options

    return (
      <article className={`${glassPanelSoftClass} overflow-hidden p-0`}>
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 bg-[linear-gradient(180deg,#f8fafc_0%,#ffffff_100%)] px-5 py-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
            <p className="mt-1 text-sm text-slate-600">{description}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-700 transition hover:bg-slate-50"
              onClick={() => printReportTable(title, description, columns, rows)}
              type="button"
            >
              Print / Save PDF
            </button>
            <button
              className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700 transition hover:bg-emerald-100"
              onClick={() => downloadReportTableAsCsv(exportFileName, columns, rows)}
              type="button"
            >
              Export Excel CSV
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50/90">
              <tr>
                {columns.map((column) => (
                  <th
                    className={`px-4 py-3.5 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 ${
                      column.align === 'right' ? 'text-right' : column.align === 'center' ? 'text-center' : 'text-left'
                    }`}
                    key={String(column.key)}
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {rows.length > 0 ? (
                rows.map((row, index) => (
                  <tr className="transition hover:bg-slate-50/80" key={rowKey(row, index)}>
                    {columns.map((column) => (
                      <td
                        className={`px-4 py-4 align-top text-slate-700 ${
                          column.align === 'right' ? 'text-right' : column.align === 'center' ? 'text-center' : 'text-left'
                        }`}
                        key={String(column.key)}
                      >
                        {String(row[column.key] ?? '-')}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-4 py-6 text-center text-sm text-slate-500" colSpan={columns.length}>
                    {emptyMessage}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>
    )
  }

  function renderReportsSection() {
    return (
      <section className="px-6 py-8">
        <div className="grid gap-6">
          <div className={`${glassPanelClass} p-6`}>
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Reports Desk</p>
                <h2 className="mt-1 text-2xl font-bold text-slate-900">Unified Hazard Report Table</h2>
                <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
                  All incident reports now appear in one clean table. Use the Type column to distinguish Earthquake, Fire, and Accident records, then print or export the filtered results.
                </p>
              </div>
              <button
                className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                onClick={resetReportFilters}
                type="button"
              >
                Clear filters
              </button>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Start date
                <input
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-700"
                  onChange={(event) => setReportStartDate(event.target.value)}
                  type="date"
                  value={reportStartDate}
                />
              </label>
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                End date
                <input
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-700"
                  onChange={(event) => setReportEndDate(event.target.value)}
                  type="date"
                  value={reportEndDate}
                />
              </label>
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Type
                <select
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-700"
                  onChange={(event) => setReportHazardFilter(event.target.value as ReportHazardFilter)}
                  value={reportHazardFilter}
                >
                  <option value="all">All types</option>
                  <option value="FR">Fire</option>
                  <option value="EQ">Earthquake</option>
                  <option value="AC">Accident</option>
                </select>
              </label>
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Location / Barangay
                <input
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-700"
                  onChange={(event) => setReportLocationFilter(event.target.value)}
                  placeholder="Filter by location"
                  type="text"
                  value={reportLocationFilter}
                />
              </label>
            </div>
          </div>

          {renderReportTable({
            title: 'Hazard Incident Master Table',
            description: 'Combined admin report table for earthquake, fire, and accident records with print and export support.',
            columns: unifiedHazardReportColumns,
            rows: filteredUnifiedHazardReportRows,
            emptyMessage: 'No hazard report rows match the current filters.',
            exportFileName: 'hazard-incident-master-report',
            rowKey: (row) => row.reportId,
          })}
        </div>
      </section>
    )
  }

  function renderInlineModuleSection(title: string, eyebrow: string, description: string) {
    return (
      <section className="px-6 py-8">
        <div className={`${glassPanelClass} p-6`}>
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{eyebrow}</p>
            <h2 className="mt-1 text-2xl font-bold text-slate-900">{title}</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">{description}</p>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <article className={`${glassPanelSoftClass} p-5`}>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Status</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">Embedded in dashboard</p>
              <p className="mt-2 text-sm text-slate-600">This module now stays inside the same admin workspace instead of opening a separate dark page.</p>
            </article>
            <article className={`${glassPanelSoftClass} p-5`}>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Theme</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">Light dashboard layout</p>
              <p className="mt-2 text-sm text-slate-600">The section uses the same light cards and spacing pattern as the overview screen.</p>
            </article>
            <article className={`${glassPanelSoftClass} p-5`}>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Next step</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">Ready for module content</p>
              <p className="mt-2 text-sm text-slate-600">You can keep this inline panel or replace it later with full charts, tables, and forms for this section.</p>
            </article>
          </div>
        </div>
      </section>
    )
  }

  function renderUsersLoadingSkeleton() {
    return (
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div className={`${glassPanelSoftClass} animate-pulse p-4`} key={`users-stats-skeleton-${index}`}>
              <div className="h-3 w-24 rounded-full bg-slate-200" />
              <div className="mt-3 h-8 w-16 rounded-full bg-slate-200" />
            </div>
          ))}
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="hidden grid-cols-[1.2fr_1.3fr_1fr_0.8fr_0.8fr_1fr_0.9fr] gap-4 border-b border-slate-200 bg-slate-50 px-4 py-3 md:grid">
            {Array.from({ length: 7 }).map((_, index) => (
              <div className="h-4 rounded-full bg-slate-200" key={`users-header-skeleton-${index}`} />
            ))}
          </div>
          <div className="space-y-3 p-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <div className="grid gap-3 rounded-xl border border-slate-100 p-3 md:grid-cols-[1.2fr_1.3fr_1fr_0.8fr_0.8fr_1fr_0.9fr] md:items-center" key={`users-row-skeleton-${index}`}>
                <div className="h-4 w-3/4 rounded-full bg-slate-200" />
                <div className="h-4 w-5/6 rounded-full bg-slate-200" />
                <div className="h-4 w-2/3 rounded-full bg-slate-200" />
                <div className="h-7 w-20 rounded-full bg-slate-200" />
                <div className="h-7 w-20 rounded-full bg-slate-200" />
                <div className="h-4 w-4/5 rounded-full bg-slate-200" />
                <div className="flex gap-2 md:justify-end">
                  <div className="h-8 w-16 rounded-lg bg-slate-200" />
                  <div className="h-8 w-16 rounded-lg bg-slate-200" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  function renderUsersSection() {
    return (
      <section className="px-6 py-8">
        <div className={`${glassPanelClass} p-6`}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Registered Users</p>
                <h2 className="mt-1 text-2xl font-bold text-slate-900">All website accounts</h2>
                <p className="mt-2 text-sm text-slate-600">Citizen-side registrations and admin accounts are both listed here.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_20px_rgba(29,78,216,0.18)] transition hover:bg-blue-800" onClick={handleOpenCreateUserModal} type="button">
                  Add
                </button>
                <button className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400" disabled={isUsersLoading} onClick={() => void loadDashboardUsers()} type="button">
                  {isUsersLoading ? 'Refreshing...' : 'Refresh'}
                </button>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              {usersMessage ? <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{usersMessage}</p> : null}
              {usersError && !isUserModalOpen ? <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{usersError}</p> : null}
              {isUsersLoading ? (
                renderUsersLoadingSkeleton()
              ) : (
                <>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className={`${glassPanelSoftClass} p-4`}>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Total accounts</p>
                      <p className="mt-2 text-2xl font-bold text-slate-900">{userAccountStats.total}</p>
                    </div>
                    <div className={`${glassPanelSoftClass} p-4`}>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Citizen accounts</p>
                      <p className="mt-2 text-2xl font-bold text-slate-900">{userAccountStats.citizen}</p>
                    </div>
                    <div className={`${glassPanelSoftClass} p-4`}>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Admin accounts</p>
                      <p className="mt-2 text-2xl font-bold text-slate-900">{userAccountStats.admin}</p>
                    </div>
                  </div>

                  {!usersError && dashboardUsers.length === 0 ? <p className="text-sm text-slate-500">No citizen or admin accounts found.</p> : null}

                  {dashboardUsers.length > 0 ? (
                    <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
                      <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-[linear-gradient(180deg,#f8fafc_0%,#ffffff_100%)] px-4 py-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">Accounts directory</p>
                          <p className="text-xs text-slate-500">Manage citizen and admin records from one table.</p>
                        </div>
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                          {dashboardUsers.length} total
                        </span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200 text-sm">
                          <thead className="bg-slate-50/80">
                            <tr>
                              <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Name</th>
                              <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Email</th>
                              <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Username</th>
                              <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Role</th>
                              <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Status</th>
                              <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Joined</th>
                              <th className="px-4 py-3.5 text-right text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 bg-white">
                            {dashboardUsers.map((user) => (
                              <tr className="transition hover:bg-slate-50/80" key={user.id ?? user.email}>
                                <td className="px-4 py-4 align-top">
                                  <div>
                                    <p className="font-semibold text-slate-900">{user.fullName}</p>
                                    <p className="mt-1 text-xs text-slate-500">User ID: {user.id ?? 'Not set'}</p>
                                  </div>
                                </td>
                                <td className="px-4 py-4 align-top text-slate-600">{user.email}</td>
                                <td className="px-4 py-4 align-top text-slate-600">{user.username || 'Not set'}</td>
                                <td className="px-4 py-4 align-top">
                                  <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] ${user.isAdmin ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 bg-slate-50 text-slate-700'}`}>
                                    {user.isAdmin ? 'Admin' : 'Citizen'}
                                  </span>
                                </td>
                                <td className="px-4 py-4 align-top">
                                  <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] ${user.isActive === false ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
                                    {user.isActive === false ? 'Inactive' : 'Active'}
                                  </span>
                                </td>
                                <td className="px-4 py-4 align-top text-slate-600">{formatUserDateTime(user.dateJoined)}</td>
                                <td className="px-4 py-4 align-top">
                                  <div className="flex justify-end gap-2">
                                    <button className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 font-semibold text-blue-700 transition hover:bg-blue-100" onClick={() => handleEditUser(user)} type="button">
                                      Edit
                                    </button>
                                    <button className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400" disabled={deletingUserId === user.id} onClick={() => void handleDeleteUser(user)} type="button">
                                      {deletingUserId === user.id ? 'Deleting...' : 'Delete'}
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : null}
                </>
              )}
            </div>

            {isUserModalOpen ? (
              <div className="fixed inset-0 z-[1400] flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-[1px]" onClick={handleCloseUserModal}>
                <div className="w-full max-w-2xl rounded-[28px] border border-slate-200 bg-white shadow-[0_24px_50px_rgba(15,23,42,0.22)]" onClick={(event) => event.stopPropagation()}>
                  <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Account Form</p>
                      <h3 className="mt-1 text-xl font-bold text-slate-900">{editingUserId ? 'Edit account' : 'Add account'}</h3>
                      <p className="mt-2 text-sm text-slate-600">Update account details, access level, and active status from this popup.</p>
                    </div>
                    <button className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50" onClick={handleCloseUserModal} type="button">
                      Close panel
                    </button>
                  </div>

                  <div className="grid gap-5 px-6 py-6">
                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="grid gap-2 text-sm font-medium text-slate-700">
                        Full name
                        <input className="rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-700 focus:ring-2 focus:ring-blue-100" onChange={(event) => handleUserFieldChange('fullName', event.target.value)} placeholder="Enter full name" type="text" value={userFormState.fullName} />
                      </label>
                      <label className="grid gap-2 text-sm font-medium text-slate-700">
                        Email
                        <input className="rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-700 focus:ring-2 focus:ring-blue-100" onChange={(event) => handleUserFieldChange('email', event.target.value)} placeholder="Enter email address" type="email" value={userFormState.email} />
                      </label>
                      <label className="grid gap-2 text-sm font-medium text-slate-700">
                        Username
                        <input className="rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-700 focus:ring-2 focus:ring-blue-100" onChange={(event) => handleUserFieldChange('username', event.target.value)} placeholder="Enter username" type="text" value={userFormState.username} />
                      </label>
                      <label className="grid gap-2 text-sm font-medium text-slate-700">
                        {editingUserId ? 'New password (optional)' : 'Password'}
                        <input className="rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-700 focus:ring-2 focus:ring-blue-100" onChange={(event) => handleUserFieldChange('password', event.target.value)} placeholder={editingUserId ? 'Leave blank to keep current password' : 'Enter password'} type="password" value={userFormState.password} />
                      </label>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
                        <div>
                          <p className="font-semibold text-slate-900">Admin access</p>
                          <p className="mt-1 text-xs text-slate-500">Allow this account to access the admin dashboard.</p>
                        </div>
                        <input checked={userFormState.isAdmin} onChange={(event) => handleUserFieldChange('isAdmin', event.target.checked)} type="checkbox" />
                      </label>
                      <label className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
                        <div>
                          <p className="font-semibold text-slate-900">Active status</p>
                          <p className="mt-1 text-xs text-slate-500">Inactive accounts can stay in the list without being able to sign in.</p>
                        </div>
                        <input checked={userFormState.isActive} onChange={(event) => handleUserFieldChange('isActive', event.target.checked)} type="checkbox" />
                      </label>
                    </div>

                    {usersError ? <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{usersError}</p> : null}

                    <div className="flex flex-wrap justify-end gap-3 border-t border-slate-200 pt-5">
                      <button className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50" onClick={handleCloseUserModal} type="button">
                        Cancel
                      </button>
                      <button className="rounded-xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_20px_rgba(29,78,216,0.18)] transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-400" disabled={isSavingUser} onClick={() => void handleSubmitUserForm()} type="button">
                        {isSavingUser ? 'Saving...' : editingUserId ? 'Update account' : 'Add account'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
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

  function renderResourcesSection() {
    return (
      <section className="px-6 py-8">
        <div className="grid gap-6">
          <div className={`${glassPanelClass} overflow-hidden`}>
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 bg-[linear-gradient(180deg,#eff6ff_0%,#ffffff_100%)] px-6 py-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Resources</p>
                <h2 className="mt-1 text-2xl font-bold text-slate-900">Maintenance Vehicle</h2>
                <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
                  Vehicle readiness and equipment maintenance summary for the active response unit, based on the ambulance maintenance checklist format.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  onClick={handleResetMaintenanceRecord}
                  type="button"
                >
                  Reset Form
                </button>
                <button
                  className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800"
                  onClick={handleSaveMaintenanceRecord}
                  type="button"
                >
                  Save Changes
                </button>
                <button
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  onClick={printMaintenanceVehicleForm}
                  type="button"
                >
                  Print Maintenance Form
                </button>
              </div>
            </div>

            {maintenanceMessage ? <div className="border-b border-slate-200 bg-emerald-50 px-6 py-3 text-sm font-medium text-emerald-700">{maintenanceMessage}</div> : null}

            <div className="grid gap-4 px-6 py-6 md:grid-cols-3 xl:grid-cols-4">
              <div className={`${glassPanelSoftClass} p-4`}>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Team</p>
                <input className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-700 focus:ring-2 focus:ring-blue-100" onChange={(event) => handleMaintenanceFieldChange('team', event.target.value)} type="text" value={maintenanceVehicleForm.team} />
              </div>
              <div className={`${glassPanelSoftClass} p-4`}>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Date</p>
                <input className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-700 focus:ring-2 focus:ring-blue-100" onChange={(event) => handleMaintenanceFieldChange('date', event.target.value)} type="text" value={maintenanceVehicleForm.date} />
              </div>
              <div className={`${glassPanelSoftClass} p-4`}>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Time</p>
                <input className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-700 focus:ring-2 focus:ring-blue-100" onChange={(event) => handleMaintenanceFieldChange('time', event.target.value)} type="text" value={maintenanceVehicleForm.time} />
              </div>
              <div className={`${glassPanelSoftClass} p-4`}>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Assigned For</p>
                <input className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-700 focus:ring-2 focus:ring-blue-100" onChange={(event) => handleMaintenanceFieldChange('assignedTo', event.target.value)} type="text" value={maintenanceVehicleForm.assignedTo} />
              </div>
            </div>

            <div className="grid gap-6 border-t border-slate-200 px-6 py-6 xl:grid-cols-[1.1fr_0.9fr]">
              <div className="grid gap-6">
                <div className={`${glassPanelSoftClass} p-5`}>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Vehicle</p>
                      <input className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-700 focus:ring-2 focus:ring-blue-100" onChange={(event) => handleMaintenanceFieldChange('vehicle', event.target.value)} type="text" value={maintenanceVehicleForm.vehicle} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Fuel Type</p>
                      <input className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-700 focus:ring-2 focus:ring-blue-100" onChange={(event) => handleMaintenanceFieldChange('fuelType', event.target.value)} type="text" value={maintenanceVehicleForm.fuelType} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Temporary Plate No.</p>
                      <input className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-700 focus:ring-2 focus:ring-blue-100" onChange={(event) => handleMaintenanceFieldChange('plateNumber', event.target.value)} type="text" value={maintenanceVehicleForm.plateNumber} />
                    </div>
                  </div>

                  <div className="mt-5 rounded-2xl border border-slate-200 bg-white px-4 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Fuel Gauge</p>
                        <input className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-700 focus:ring-2 focus:ring-blue-100" onChange={(event) => handleMaintenanceFieldChange('fuelGauge', event.target.value)} type="text" value={maintenanceVehicleForm.fuelGauge} />
                      </div>
                      <div className="h-3 w-full max-w-[220px] overflow-hidden rounded-full bg-slate-200">
                        <div className="h-full rounded-full bg-amber-500" style={{ width: maintenanceVehicleForm.fuelGauge }} />
                      </div>
                    </div>
                    <textarea className="mt-4 min-h-24 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-700 focus:ring-2 focus:ring-blue-100" onChange={(event) => handleMaintenanceFieldChange('note', event.target.value)} value={maintenanceVehicleForm.note} />
                  </div>
                </div>

                <div className={`${glassPanelSoftClass} p-5`}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">To Do</p>
                      <h3 className="mt-1 text-lg font-semibold text-slate-900">Daily maintenance checklist</h3>
                    </div>
                  </div>

                  <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Task</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Status</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Details</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 bg-white">
                        {maintenanceTodoState.map((item, index) => (
                          <tr key={item.label}>
                            <td className="px-4 py-4 font-medium text-slate-900">{item.label}</td>
                            <td className="px-4 py-4">
                              <select className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-700" onChange={(event) => handleMaintenanceTodoChange(index, 'status', event.target.value)} value={item.status}>
                                <option value="pending">Pending</option>
                                <option value="complete">Complete</option>
                                <option value="incomplete">Incomplete</option>
                              </select>
                            </td>
                            <td className="px-4 py-4 text-slate-600">
                              <input className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-700" onChange={(event) => handleMaintenanceTodoChange(index, 'details', event.target.value)} placeholder="Add details" type="text" value={item.details || ''} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="grid gap-6">
                <div className={`${glassPanelSoftClass} p-5`}>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Inventory of Supplies</p>
                  <h3 className="mt-1 text-lg font-semibold text-slate-900">Toyota commuter ambulance equipment</h3>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {defaultMaintenanceInventoryItems.map((item) => (
                      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700" key={item}>
                        {item}
                      </div>
                    ))}
                  </div>
                </div>

                {maintenanceCategoryState.map((category, categoryIndex) => (
                  <div className={`${glassPanelSoftClass} p-5`} key={category.title}>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Maintenance Category</p>
                    <h3 className="mt-1 text-lg font-semibold text-slate-900">{category.title}</h3>
                    <div className="mt-4 grid gap-3">
                      {category.items.map((item, itemIndex) => (
                        <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3" key={`${category.title}-${item.label}`}>
                          <div>
                            <p className="text-sm font-medium text-slate-900">{item.label}</p>
                            <input className="mt-2 w-full min-w-[220px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-700" onChange={(event) => handleMaintenanceCategoryChange(categoryIndex, itemIndex, 'details', event.target.value)} placeholder="Add details" type="text" value={item.details || ''} />
                          </div>
                          <select className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-700" onChange={(event) => handleMaintenanceCategoryChange(categoryIndex, itemIndex, 'status', event.target.value)} value={item.status}>
                            <option value="pending">Pending</option>
                            <option value="complete">Complete</option>
                            <option value="incomplete">Incomplete</option>
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    )
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
    <div className="relative min-h-screen overflow-hidden bg-[#f4f7fb] text-slate-900">
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
          {activeSection === 'scoring' ? renderInlineModuleSection('Risk Scoring', 'Admin Operations', 'Risk scoring now opens inside the main dashboard so the workflow stays on the same page as Overview.') : null}
          {activeSection === 'trends' ? renderInlineModuleSection('Predictive Trends', 'Admin Operations', 'Trend monitoring stays inside the same light admin dashboard instead of routing to a separate page.') : null}
          {activeSection === 'resources' ? renderResourcesSection() : null}
          {activeSection === 'users' ? renderUsersSection() : null}
          {activeSection === 'simulation' ? renderSimulationSection() : null}
          {activeSection === 'settings' ? renderInlineModuleSection('Settings', 'Admin Controls', 'Settings now stay in the same dashboard page so the admin workspace remains consistent and light-themed.') : null}
        </main>
      </div>
    </div>
  )
}
