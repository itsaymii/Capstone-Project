import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AdminSidebar } from '../../components/AdminSidebar'
import {
  hazardIncidents,
  mapBackendIncidentToHazardIncident,
  type HazardIncident,
  type HazardType,
} from '../../data/adminOperations'
import type { AdminNavKey } from '../../data/adminNavigation'
import { getCurrentUserProfile, logoutUser } from '../../services/auth'
import { fetchQuezonRegionEarthquakes, type EarthquakeEvent } from '../../services/earthquakes'
import { getIncidents, getIncidentReports } from '../../services/incidents'
import {
  NOTIFICATIONS_CHANGED_EVENT,
  getNotifications,
  markAllNotificationsRead,
  type NotificationItem,
} from '../../services/notifications'
import notificationIcon from '../../images/notification.png'
import { InlineModuleSection } from './sections/InlineModuleSection'
import { AnalyticsSection } from './sections/AnalyticsSection'
import { MapSection } from './sections/MapSection'
import { ReportsSection } from './sections/ReportsSection'
import { ResourcesSection } from './sections/ResourcesSection'
import { SimulationSection } from './sections/SimulationSection'
import { UsersSection } from './sections/UsersSection'
import { AccomplishmentReports } from './sections/AccomplishmentReports'
import { IncidentReports } from './sections/IncidentReports'

type WorkspaceSection =
  | 'overview'
  | 'reports'
  | 'incidents'
  | 'accomplishment'
  | 'map'
  | 'simulation'
  | 'scoring'
  | 'trends'
  | 'resources'
  | 'users'
  | 'settings'

type MapFilter = HazardType

type MetricCard = {
  label: string
  value: number | string
  comparison: string
  delta: string
  accent: string
  valueClass: string
}

function getDashboardSeverityScoreFromRecord(record: any): number {
  const severity = getRecordValue(record, 'severity', 'severity_level').toLowerCase()

  if (severity.includes('critical')) return 100
  if (severity.includes('high')) return 78
  if (severity.includes('moderate')) return 52
  if (severity.includes('low')) return 26

  const victims = Number(getRecordValue(record, 'victimCount', 'victim_count'))
  if (Number.isFinite(victims) && victims >= 4) return 100
  if (Number.isFinite(victims) && victims >= 3) return 78
  if (Number.isFinite(victims) && victims >= 1) return 52

  return 26
}

function calculateDashboardFireRiskScore(records: any[]): number {
  const fireRecords = records.filter((record) => getDashboardIncidentType(record) === 'Fire')
  if (fireRecords.length === 0) return 0

  const activeFireRecords = fireRecords.filter((record) => getDashboardIncidentStatus(record) === 'pending')
  const basis = activeFireRecords.length > 0 ? activeFireRecords : fireRecords

  return Math.min(
    100,
    Math.round(
      basis.reduce((total, record) => total + getDashboardSeverityScoreFromRecord(record), 0) / basis.length,
    ),
  )
}

function filterLucenaEvents(events: EarthquakeEvent[]): EarthquakeEvent[] {
  return events.filter(
    (event) =>
      event.lat >= 13.78 &&
      event.lat <= 14.09 &&
      event.lng >= 121.45 &&
      event.lng <= 121.77,
  )
}

function calculateEarthquakeRiskScore(events: EarthquakeEvent[]): number {
  if (events.length === 0) return 20

  const now = Date.now()
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000
  const sixMonthsAgo = now - 180 * 24 * 60 * 60 * 1000
  const oneYearAgo = now - 365 * 24 * 60 * 60 * 1000

  const recent30 = events.filter((event) => event.rawTimestamp >= thirtyDaysAgo)
  const significant30 = recent30.filter((event) => event.magnitude >= 4.0)
  const strong180 = events.filter(
    (event) => event.rawTimestamp >= sixMonthsAgo && event.magnitude >= 5.0,
  )
  const maxMagYear = events
    .filter((event) => event.rawTimestamp >= oneYearAgo)
    .reduce((maxMag, event) => Math.max(maxMag, event.magnitude), 0)

  const score =
    30 +
    Math.min(recent30.length * 2, 25) +
    Math.min(significant30.length * 8, 24) +
    Math.min(strong180.length * 15, 30) +
    Math.min(maxMagYear * 4, 16)

  return Math.min(100, Math.round(score))
}

function getWorkspaceSection(sectionParam: string | null): WorkspaceSection {
  switch (sectionParam) {
    case 'reports':
    case 'incidents':
    case 'accomplishment':
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
  if (Number.isNaN(parsed.getTime())) return value

  return parsed.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function normalizeSearchValue(value: string): string {
  return value.trim().toLowerCase()
}

function matchesDashboardSearch(fields: Array<number | string>, query: string): boolean {
  if (!query) return true
  return fields.some((field) => normalizeSearchValue(String(field)).includes(query))
}

function getIncidentRecordId(record: any): string {
  return getRecordValue(
    record,
    'id',
    'incidentId',
    'incident_id',
    'reportCode',
    'report_code',
    'incidentCode',
    'incident_code',
    'incident_reference_code_readonly',
    'reference_code',
    'referenceCode',
  )
}

function getDashboardLocation(record: any): string {
  return getRecordValue(
    record,
    'location',
    'address',
    'locationAddress',
    'location_address',
    'groundZero',
    'ground_zero',
    'incidentLocation',
    'incident_location',
    'place',
    'landmark',
  )
}

function getDashboardDescription(record: any): string {
  return getRecordValue(
    record,
    'description',
    'incidentDescription',
    'incident_description',
    'particulars',
    'actionTaken',
    'action_taken',
    'report_text',
    'reportText',
    'remarks',
  )
}

function isPlaceholderLocation(value: string): boolean {
  const normalized = normalizeSearchValue(value)
  return !normalized || normalized === '-' || normalized === 'n/a' || normalized === 'na' || normalized === 'none'
}

function getRecordDate(record: any): Date {
  const value = getRecordValue(
    record,
    'createdAt',
    'created_at',
    'date_reported',
    'report_time',
    'reportTime',
    'timeOccurred',
    'time_occurred',
    'updatedAt',
    'updated_at',
  )
  const parsed = value ? new Date(value) : new Date()
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed
}

function formatShortDate(date: Date): string {
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

function buildLastSevenDaysTrend(records: any[]): TrendDataItem[] {
  const grouped = new Map<string, number>()

  records.forEach((record) => {
    const key = formatShortDate(getRecordDate(record))
    grouped.set(key, (grouped.get(key) || 0) + 1)
  })

  const latestRecordTime = records.reduce((latest, record) => {
    return Math.max(latest, getRecordDate(record).getTime())
  }, Date.now())

  const endDate = new Date(latestRecordTime)
  endDate.setHours(0, 0, 0, 0)

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(endDate)
    date.setDate(endDate.getDate() - (6 - index))
    const key = formatShortDate(date)

    return {
      date: key,
      count: grouped.get(key) || 0,
    }
  })
}



function getRecordValue(record: any, ...keys: string[]): string {
  for (const key of keys) {
    const value = record?.[key]
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value)
    }
  }

  return ''
}

function getDashboardIncidentStatus(record: any): 'pending' | 'approved' | 'resolved' {
  const rawStatus = getRecordValue(record, 'status', 'status_update').toLowerCase().trim()

  if (
    rawStatus.includes('resolved') ||
    rawStatus.includes('completed') ||
    rawStatus.includes('complete') ||
    rawStatus.includes('closed')
  ) {
    return 'resolved'
  }

  if (
    rawStatus.includes('approved') ||
    rawStatus.includes('verified') ||
    rawStatus.includes('accepted')
  ) {
    return 'approved'
  }

  return 'pending'
}

function getDashboardIncidentType(record: any): string {
  const explicitType = getRecordValue(
    record,
    'incidentType',
    'incident_type',
    'hazard_type_name',
    'type',
    'category',
    'incident_category',
    'nature_of_incident',
  )
  const title = getRecordValue(record, 'title', 'name', 'incidentTitle', 'incident_title')
  const description = getRecordValue(record, 'description', 'actionTaken', 'action_taken', 'report_text', 'particulars')
  const code = getRecordValue(record, 'code', 'incidentCode', 'incident_code', 'hazard_code').toUpperCase()
  const combined = `${explicitType} ${title} ${description} ${code}`.toLowerCase()

  if (combined.includes('fire') || code === 'FR') return 'Fire'
  if (combined.includes('earthquake') || code === 'EQ') return 'Earthquake'
  if (
    combined.includes('medical') ||
    combined.includes('ambulance') ||
    combined.includes('stand-by') ||
    combined.includes('standby') ||
    combined.includes('health')
  ) {
    return 'Medical'
  }
  if (combined.includes('crime') || combined.includes('theft') || combined.includes('robbery')) return 'Crime'
  if (combined.includes('drowning')) return 'Drowning'
  if (
    combined.includes('rca') ||
    combined.includes('road crash') ||
    combined.includes('vehicular') ||
    combined.includes('vehicle') ||
    combined.includes('collision') ||
    combined.includes('traffic') ||
    combined.includes('accident') ||
    code === 'AC'
  ) {
    return 'Accident'
  }

  return explicitType ? toTitleCase(explicitType) : 'Other'
}

function toTitleCase(value: string): string {
  return value
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function getDashboardBarangay(record: any): string {
  const location = getDashboardLocation(record)

  if (isPlaceholderLocation(location)) return 'Unspecified location'

  const lower = location.toLowerCase()

  const barangayMatch = location.match(/(?:barangay|brgy\.?|bgy\.?)\s+([^,]+)/i)
  if (barangayMatch?.[1]) {
    return `Barangay ${toTitleCase(barangayMatch[1].replace(/\s*\(pob\.\)\s*/i, '').trim())}`
  }

  const knownAreas: Array<[string, string]> = [
    ['gulang-gulang', 'Barangay Gulang-Gulang'],
    ['gulang gulang', 'Barangay Gulang-Gulang'],
    ['dalahican', 'Barangay Dalahican'],
    ['ibabang dupay', 'Barangay Ibabang Dupay'],
    ['ilayang dupay', 'Barangay Ilayang Dupay'],
    ['ilayang iyam', 'Barangay Ilayang Iyam'],
    ['ibabang iyam', 'Barangay Ibabang Iyam'],
    ['mayao crossing', 'Barangay Mayao Crossing'],
    ['mayao kanluran', 'Barangay Mayao Kanluran'],
    ['mayao silangan', 'Barangay Mayao Silangan'],
    ['cotta', 'Barangay Cotta'],
    ['bocohan', 'Barangay Bocohan'],
    ['isabang', 'Barangay Isabang'],
    ['market view', 'Barangay Market View'],
    ['domoit', 'Barangay Domoit'],
    ['city proper', 'Lucena City Proper'],
    ['quezon avenue', 'Quezon Avenue Area'],
    ['pacific mall', 'Pacific Mall Area'],
    ['sm city lucena', 'SM City Lucena Area'],
    ['grand central terminal', 'Grand Terminal Area'],
    ['diversion road', 'Diversion Road Area'],
  ]

  const matchedArea = knownAreas.find(([keyword]) => lower.includes(keyword))
  if (matchedArea) return matchedArea[1]

  const cleanParts = location
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part && !/lucena city/i.test(part))

  return cleanParts.at(-1) || 'Lucena City'
}

function buildCountData<T extends string>(items: any[], getKey: (item: any) => T): Array<{ name: T; count: number }> {
  const counts = new Map<T, number>()

  items.forEach((item) => {
    const key = getKey(item)
    counts.set(key, (counts.get(key) || 0) + 1)
  })

  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((left, right) => right.count - left.count)
}

const chartPalette = ['#2563eb', '#f59e0b', '#059669', '#dc2626', '#7c3aed', '#0891b2']
const softChartPalette = ['#dbeafe', '#fef3c7', '#d1fae5', '#fee2e2', '#ede9fe', '#cffafe']

type CountDataItem = { name: string; count: number }
type TrendDataItem = { date: string; count: number }

function EmptyChartState({ message }: { message: string }) {
  return (
    <div className="flex h-full min-h-[220px] items-center justify-center rounded-[24px] border border-dashed border-slate-200 bg-gradient-to-br from-slate-50 to-white text-center text-sm font-semibold text-slate-500">
      {message}
    </div>
  )
}

function DashboardLineChart({ data }: { data: TrendDataItem[] }) {
  if (data.length === 0) {
    return <EmptyChartState message="No incident trend data available yet." />
  }

  const width = 900
  const height = 340
  const padding = { top: 72, right: 62, bottom: 62, left: 72 }
  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom
  const maxCount = Math.max(1, ...data.map((item) => item.count))
  const totalCount = data.reduce((sum, item) => sum + item.count, 0)
  const peakPoint = data.reduce((top, item) => (item.count > top.count ? item : top), data[0])
  const stepX = data.length > 1 ? chartWidth / (data.length - 1) : chartWidth

  const points = data.map((item, index) => {
    const x = padding.left + (data.length > 1 ? index * stepX : chartWidth / 2)
    const y = padding.top + chartHeight - (item.count / maxCount) * chartHeight
    return { ...item, x, y }
  })

  const linePath = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ')

  const areaPath = `${linePath} L ${points[points.length - 1]?.x ?? padding.left} ${height - padding.bottom} L ${points[0]?.x ?? padding.left} ${height - padding.bottom} Z`

  const yTickCount = Math.min(Math.max(maxCount, 1), 4)
  const yTicks = Array.from({ length: yTickCount + 1 }, (_, index) => {
    const value = Math.round((maxCount / yTickCount) * index)
    const y = padding.top + chartHeight - (value / maxCount) * chartHeight
    return { value, y }
  })

  const lastPoint = points[points.length - 1]
  const peakIndex = points.findIndex((point) => point.date === peakPoint.date && point.count === peakPoint.count)

  return (
    <div className="relative h-full w-full overflow-hidden rounded-[26px] border border-blue-100 bg-[radial-gradient(circle_at_top_left,#dbeafe_0%,#ffffff_42%,#f8fafc_100%)] p-3 shadow-inner">
      <div className="pointer-events-none absolute -left-20 top-10 h-44 w-44 rounded-full bg-blue-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 bottom-4 h-40 w-40 rounded-full bg-cyan-400/10 blur-3xl" />

      <div className="absolute left-4 top-4 z-10 flex flex-wrap items-center gap-2 sm:left-5 sm:top-5">
        <span className="rounded-full bg-blue-700 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white shadow-lg shadow-blue-700/20">
          Live trend
        </span>
        <span className="rounded-full border border-blue-100 bg-white/80 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-blue-700 shadow-sm">
          Last {data.length} days
        </span>
      </div>

      <div className="absolute right-4 top-4 z-10 hidden rounded-2xl border border-white/80 bg-white/90 px-4 py-2 text-right shadow-sm backdrop-blur sm:right-5 sm:top-5">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Trend total</p>
        <p className="text-lg font-black text-blue-800">{totalCount} reports</p>
      </div>

      <svg className="relative z-[1] h-full w-full" preserveAspectRatio="xMidYMid meet" viewBox={`0 0 ${width} ${height}`}>
        <defs>
          <linearGradient id="incidentTrendStroke" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#1d4ed8" />
            <stop offset="48%" stopColor="#2563eb" />
            <stop offset="100%" stopColor="#06b6d4" />
            <animate attributeName="x1" dur="3s" repeatCount="indefinite" values="0;0.2;0" />
            <animate attributeName="x2" dur="3s" repeatCount="indefinite" values="1;1.2;1" />
          </linearGradient>

          <linearGradient id="incidentTrendArea" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#2563eb" stopOpacity="0.30" />
            <stop offset="60%" stopColor="#38bdf8" stopOpacity="0.09" />
            <stop offset="100%" stopColor="#2563eb" stopOpacity="0.01" />
          </linearGradient>

          <filter id="incidentTrendGlow" height="220%" width="220%" x="-60%" y="-60%">
            <feGaussianBlur result="coloredBlur" stdDeviation="5" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {yTicks.map((tick) => (
          <g key={tick.value}>
            <line
              stroke="#dbeafe"
              strokeDasharray="7 7"
              strokeWidth="1.2"
              x1={padding.left}
              x2={width - padding.right}
              y1={tick.y}
              y2={tick.y}
            />
            <text fill="#64748b" fontSize="12" fontWeight="800" x={padding.left - 14} y={tick.y + 4} textAnchor="end">
              {tick.value}
            </text>
          </g>
        ))}

        <line
          stroke="#cbd5e1"
          strokeLinecap="round"
          strokeWidth="1.4"
          x1={padding.left}
          x2={padding.left}
          y1={padding.top}
          y2={height - padding.bottom}
        />
        <line
          stroke="#cbd5e1"
          strokeLinecap="round"
          strokeWidth="1.4"
          x1={padding.left}
          x2={width - padding.right}
          y1={height - padding.bottom}
          y2={height - padding.bottom}
        />

        <path d={areaPath} fill="url(#incidentTrendArea)">
          <animate attributeName="opacity" dur="1.2s" values="0;1" fill="freeze" />
        </path>

        <path
          d={linePath}
          fill="none"
          filter="url(#incidentTrendGlow)"
          stroke="url(#incidentTrendStroke)"
          strokeDasharray="1300"
          strokeDashoffset="1300"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="7"
        >
          <animate attributeName="stroke-dashoffset" begin="0s" dur="1.35s" fill="freeze" values="1300;0" />
        </path>

        <path
          d={linePath}
          fill="none"
          stroke="#ffffff"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeOpacity="0.65"
          strokeWidth="2"
        />

        {points.map((point, index) => {
          const isPeak = index === peakIndex
          const isLast = index === points.length - 1

          return (
            <g key={`${point.date}-${point.count}-${index}`}>
              {isPeak || isLast ? (
                <circle cx={point.x} cy={point.y} fill="#2563eb" opacity="0.18" r="14">
                  <animate attributeName="r" dur="1.5s" repeatCount="indefinite" values="10;22;10" />
                  <animate attributeName="opacity" dur="1.5s" repeatCount="indefinite" values="0.22;0;0.22" />
                </circle>
              ) : null}

              <circle cx={point.x} cy={point.y} fill="#ffffff" r="9" stroke="#bfdbfe" strokeWidth="7" />
              <circle cx={point.x} cy={point.y} fill={isPeak ? '#f59e0b' : '#2563eb'} r={isPeak ? '6' : '5'} />

              <text fill="#0f172a" fontSize="12" fontWeight="900" x={point.x} y={point.y - 16} textAnchor="middle">
                {point.count}
              </text>

              <text fill={isLast ? '#1d4ed8' : '#64748b'} fontSize="11" fontWeight="900" x={point.x} y={height - 22} textAnchor="middle">
                {point.date}
              </text>
            </g>
          )
        })}

        {lastPoint ? (
          <g>
            <circle cx={lastPoint.x} cy={lastPoint.y} fill="#06b6d4" r="4">
              <animate attributeName="opacity" dur="0.9s" repeatCount="indefinite" values="1;0.35;1" />
            </circle>
            <text fill="#0369a1" fontSize="11" fontWeight="900" x={lastPoint.x - 2} y={Math.min(lastPoint.y + 34, height - padding.bottom - 10)} textAnchor="end">
              Latest
            </text>
          </g>
        ) : null}
      </svg>
    </div>
  )
}

function DashboardDonutChart({ data }: { data: CountDataItem[] }) {
  if (data.length === 0) {
    return <EmptyChartState message="No distribution data available yet." />
  }

  const total = data.reduce((sum, item) => sum + item.count, 0)
  const radius = 78
  const circumference = 2 * Math.PI * radius
  let runningTotal = 0
  const leading = data[0]
  const leadingPercentage = total > 0 ? Math.round((leading.count / total) * 100) : 0

  return (
    <div className="relative flex h-full w-full flex-col gap-5 overflow-hidden rounded-[24px] border border-blue-100 bg-[radial-gradient(circle_at_top_left,#eff6ff_0%,#ffffff_44%,#f8fafc_100%)] p-5">
      <div className="pointer-events-none absolute -left-16 top-8 h-36 w-36 rounded-full bg-blue-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-12 bottom-8 h-36 w-36 rounded-full bg-emerald-400/10 blur-3xl" />

      <div className="relative flex w-full items-center justify-center pb-3">
        <div className="absolute inset-0 m-auto h-48 w-48 rounded-full bg-white/70 shadow-[0_18px_50px_rgba(37,99,235,0.12)]" />

        <svg className="relative h-[190px] w-[190px] drop-shadow-sm sm:h-[220px] sm:w-[220px] lg:h-[230px] lg:w-[230px]" viewBox="0 0 240 240">
          <defs>
            <filter id="donutGlow" height="180%" width="180%" x="-40%" y="-40%">
              <feGaussianBlur result="coloredBlur" stdDeviation="3" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <circle cx="120" cy="120" fill="#ffffff" r="108" />
          <circle cx="120" cy="120" fill="none" r={radius} stroke="#e2e8f0" strokeWidth="30" />

          {data.map((item, index) => {
            const percentage = total > 0 ? item.count / total : 0
            const dashLength = percentage * circumference
            const dashOffset = -runningTotal * circumference
            runningTotal += percentage

            return (
              <circle
                cx="120"
                cy="120"
                fill="none"
                filter="url(#donutGlow)"
                key={item.name}
                r={radius}
                stroke={chartPalette[index % chartPalette.length]}
                strokeDasharray={`${dashLength} ${circumference - dashLength}`}
                strokeDashoffset={dashOffset}
                strokeLinecap="round"
                strokeWidth="30"
                transform="rotate(-90 120 120)"
              >
                <animate
                  attributeName="stroke-dasharray"
                  begin={`${index * 0.12}s`}
                  dur="0.9s"
                  fill="freeze"
                  values={`0 ${circumference}; ${dashLength} ${circumference - dashLength}`}
                />
              </circle>
            )
          })}

          <circle cx="120" cy="120" fill="#ffffff" r="58" />
          <circle cx="120" cy="120" fill="none" r="59" stroke="#dbeafe" strokeDasharray="4 8" strokeWidth="2">
            <animateTransform
              attributeName="transform"
              dur="18s"
              from="0 120 120"
              repeatCount="indefinite"
              to="360 120 120"
              type="rotate"
            />
          </circle>

          <text fill="#0f172a" fontSize="34" fontWeight="900" textAnchor="middle" x="120" y="112">
            {total}
          </text>
          <text fill="#64748b" fontSize="12" fontWeight="800" textAnchor="middle" x="120" y="136">
            Total reports
          </text>
        </svg>
      </div>

      <div className="relative z-10 w-full min-w-0 space-y-3">
        <div className="rounded-2xl border border-blue-100 bg-white/85 p-4 shadow-sm backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-500">
                Main incident type
              </p>
              <p className="mt-1 truncate text-lg font-black text-slate-900">{leading.name}</p>
              <p className="mt-1 text-xs font-semibold leading-relaxed text-slate-500">
                This means most submitted reports belong to this incident category.
              </p>
            </div>

            <div className="rounded-2xl bg-blue-50 px-3 py-2 text-center">
              <p className="text-xl font-black text-blue-700">{leadingPercentage}%</p>
              <p className="text-[9px] font-bold uppercase tracking-wide text-blue-500">Share</p>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          {data.map((entry, index) => {
            const percentage = total > 0 ? Math.round((entry.count / total) * 100) : 0

            return (
              <div
                className="group rounded-2xl border border-white/80 bg-white/80 p-3 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-blue-100 hover:bg-white hover:shadow-md"
                key={entry.name}
              >
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className="h-3 w-3 shrink-0 rounded-full shadow-sm ring-4 ring-slate-50"
                      style={{ backgroundColor: chartPalette[index % chartPalette.length] }}
                    />
                    <span className="truncate text-xs font-black text-slate-700">{entry.name}</span>
                  </div>
                  <span className="shrink-0 text-xs font-black text-slate-900">
                    {entry.count} reports
                  </span>
                </div>

                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full transition-all duration-700 group-hover:brightness-110"
                    style={{
                      background: `linear-gradient(90deg, ${softChartPalette[index % softChartPalette.length]}, ${chartPalette[index % chartPalette.length]})`,
                      width: `${Math.max(5, percentage)}%`,
                    }}
                  />
                </div>

                <p className="mt-1 text-right text-[10px] font-bold text-slate-400">
                  {percentage}% of all reports
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function DashboardBarChart({ data }: { data: CountDataItem[] }) {
  if (data.length === 0) {
    return <EmptyChartState message="No barangay hotspot data available yet." />
  }

  const maxCount = Math.max(1, ...data.map((item) => item.count))

  return (
    <div className="flex h-full min-h-[300px] flex-col justify-center gap-3 rounded-[22px] bg-gradient-to-br from-amber-50 via-white to-slate-50 p-3 sm:p-4">
      {data.map((item, index) => {
        const width = `${Math.max(10, (item.count / maxCount) * 100)}%`
        const percentage = Math.round((item.count / maxCount) * 100)

        return (
          <div className="rounded-2xl border border-white/80 bg-white/80 p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md" key={item.name}>
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ backgroundColor: chartPalette[index % chartPalette.length] }}>
                  {index + 1}
                </span>
                <span className="truncate text-sm font-bold text-slate-800">{item.name}</span>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-900">{item.count}</span>
            </div>

            <div className="relative h-4 overflow-hidden rounded-full bg-slate-100">
              <div
                className="absolute inset-y-0 left-0 rounded-full shadow-[0_4px_14px_rgba(15,23,42,0.16)]"
                style={{ background: `linear-gradient(90deg, ${softChartPalette[index % softChartPalette.length]}, ${chartPalette[index % chartPalette.length]})`, width }}
              />
            </div>

            <p className="mt-1 text-right text-[10px] font-bold text-slate-400">{percentage}% of top count</p>
          </div>
        )
      })}
    </div>
  )
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
  const [reports, setReports] = useState<HazardIncident[]>(() => hazardIncidents)
  const [responderReports, setResponderReports] = useState<any[]>([])
  const [mapFilter, setMapFilter] = useState<MapFilter>('EQ')
  const [notifications, setNotifications] = useState<NotificationItem[]>(() => getNotifications())
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)
  const [isTopProfileMenuOpen, setIsTopProfileMenuOpen] = useState(false)
  const [liveEarthquakeEvents, setLiveEarthquakeEvents] = useState<EarthquakeEvent[]>([])
  const [eqLastUpdated, setEqLastUpdated] = useState<Date | null>(null)
  const [eqCardStatus, setEqCardStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [dashboardSearchQuery, setDashboardSearchQuery] = useState('')
  const isMountedRef = useRef(true)

  const loadBackendData = useCallback(async () => {
    try {
      const [backendIncidents, backendIncidentReports] = await Promise.all([
        getIncidents(),
        getIncidentReports(),
      ])

      const mappedIncidents = backendIncidents.map(mapBackendIncidentToHazardIncident)

      if (!isMountedRef.current) return

      setReports(mappedIncidents)
      setResponderReports(backendIncidentReports)
    } catch (error) {
      console.error('[AdminDashboard] Failed to load backend data:', error)

      if (!isMountedRef.current) return

      setReports(hazardIncidents)
      setResponderReports([])
    }
  }, [])

  useEffect(() => {
    isMountedRef.current = true
    void loadBackendData()

    return () => {
      isMountedRef.current = false
    }
  }, [loadBackendData])

  const profile = getCurrentUserProfile()
  const displayName = profile?.fullName?.trim() || 'Administrator'

  const firstName = useMemo(
    () => displayName.split(/\s+/).filter(Boolean)[0] || 'Administrator',
    [displayName],
  )

  const initials = useMemo(() => {
    const nameParts = displayName.split(/\s+/).filter(Boolean)
    if (nameParts.length === 0) return 'AD'
    if (nameParts.length === 1) return nameParts[0].slice(0, 2).toUpperCase()
    return `${nameParts[0][0]}${nameParts[1][0]}`.toUpperCase()
  }, [displayName])

  const normalizedDashboardSearchQuery = useMemo(
    () => normalizeSearchValue(dashboardSearchQuery),
    [dashboardSearchQuery],
  )

  const unreadNotificationsCount = useMemo(
    () => notifications.filter((item) => !item.read).length,
    [notifications],
  )

  // Merge responder reports as pseudo-incidents for display
  const responderReportIncidents = useMemo(() => {
    const refOrIdToHazardType = new Map<string, HazardType>()

    reports.forEach((incident) => {
      const refCode = (incident as any).reference_code || (incident as any).referenceCode || undefined

      if (refCode && incident.code) {
        refOrIdToHazardType.set(String(refCode), incident.code)
      }

      if (incident.id && incident.code) {
        refOrIdToHazardType.set(String(incident.id), incident.code)
      }
    })

    return responderReports.map((report) => {
      const explicitType = getRecordValue(
        report,
        'incidentType',
        'incident_type',
        'hazard_type_name',
        'type',
        'category',
        'nature_of_incident',
      )
      const combinedType = `${explicitType} ${getDashboardDescription(report)}`.toLowerCase()

      let code: HazardType = 'AC'

      if (report.incident_reference_code_readonly && refOrIdToHazardType.has(String(report.incident_reference_code_readonly))) {
        code = refOrIdToHazardType.get(String(report.incident_reference_code_readonly)) as HazardType
      } else if (report.incident_id && refOrIdToHazardType.has(String(report.incident_id))) {
        code = refOrIdToHazardType.get(String(report.incident_id)) as HazardType
      } else if (combinedType.includes('fire')) {
        code = 'FR'
      } else if (combinedType.includes('earthquake')) {
        code = 'EQ'
      } else if (
        combinedType.includes('rca') ||
        combinedType.includes('road crash') ||
        combinedType.includes('vehicular') ||
        combinedType.includes('vehicle') ||
        combinedType.includes('collision') ||
        combinedType.includes('traffic') ||
        combinedType.includes('accident')
      ) {
        code = 'AC'
      }

      let status: 'active' | 'pending' | 'approved' | 'resolved' = 'active'
      const statusStr = getRecordValue(report, 'status', 'status_update').toLowerCase()

      if (statusStr.includes('approved') || statusStr.includes('verified') || statusStr.includes('accepted')) {
        status = 'approved'
      } else if (statusStr.includes('pending')) {
        status = 'pending'
      } else if (statusStr.includes('resolved') || statusStr.includes('complete') || statusStr.includes('closed')) {
        status = 'resolved'
      }

      let severity: 'Low' | 'Moderate' | 'High' | 'Critical' = 'Moderate'

      if (Number(getRecordValue(report, 'victimCount', 'victim_count')) >= 3) {
        severity = 'High'
      }

      const reportId = getIncidentRecordId(report)
      const readableType = getDashboardIncidentType({ ...report, code })

      return {
        ...report,
        id: report.id || reportId,
        title: `${readableType} Report - ${report.reportCode || report.report_code || report.incidentCode || report.incident_code || report.incident_reference_code_readonly || reportId}`,
        code,
        status,
        severity,
        location: getDashboardLocation(report),
        time: getRecordDate(report).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }),
        responseTeam: report.responderTeam || report.responder_team || report.responder_username || report.responder || '-',
        description: getDashboardDescription(report) || '-',
        coordinates: [0, 0] as [number, number],
      }
    })
  }, [responderReports, reports])

  const filteredReports = useMemo(() => {
    const uniqueReports = new Map<string, HazardIncident>()

    ;[...reports, ...responderReportIncidents].forEach((incident) => {
      const key = String(getIncidentRecordId(incident) || incident.id || `${incident.title}-${incident.time}-${incident.location}`)

      if (!uniqueReports.has(key)) {
        uniqueReports.set(key, incident)
      }
    })

    return Array.from(uniqueReports.values()).filter((incident) =>
      matchesDashboardSearch(
        [
          incident.id,
          incident.title,
          getDashboardIncidentType(incident),
          incident.status,
          incident.severity,
          incident.location,
          incident.time,
          incident.responseTeam,
          incident.description,
        ],
        normalizedDashboardSearchQuery,
      ),
    )
  }, [reports, responderReportIncidents, normalizedDashboardSearchQuery])

  const filteredEarthquakeEvents = useMemo(
    () =>
      liveEarthquakeEvents.filter((event) =>
        matchesDashboardSearch(
          [
            'earthquake',
            'seismic',
            event.place,
            event.time,
            event.magnitude.toFixed(1),
            event.depth.toFixed(0),
          ],
          normalizedDashboardSearchQuery,
        ),
      ),
    [liveEarthquakeEvents, normalizedDashboardSearchQuery],
  )

  useEffect(() => {
    let cancelled = false

    async function loadEarthquakeCardData(silent = false): Promise<void> {
      if (!silent) {
        setEqCardStatus('loading')
      }

      try {
        const events = await fetchQuezonRegionEarthquakes(1825, 1.0)
        if (cancelled) return

        setLiveEarthquakeEvents(events)
        setEqLastUpdated(new Date())
        setEqCardStatus('ready')
      } catch {
        if (cancelled) return
        setEqCardStatus('error')
      }
    }

    void loadEarthquakeCardData()

    const refreshTimer = window.setInterval(() => {
      void loadEarthquakeCardData(true)
    }, 5 * 60 * 1000)

    return () => {
      cancelled = true
      window.clearInterval(refreshTimer)
    }
  }, [])

  const dashboardIncidentRecords = useMemo(() => {
    const sourceRecords: any[] = filteredReports

    return sourceRecords.filter((record) =>
      matchesDashboardSearch(
        [
          getIncidentRecordId(record),
          getDashboardIncidentType(record),
          getDashboardIncidentStatus(record),
          getDashboardBarangay(record),
          getDashboardLocation(record),
          getDashboardDescription(record),
        ],
        normalizedDashboardSearchQuery,
      ),
    )
  }, [filteredReports, normalizedDashboardSearchQuery])

  const approvedDashboardIncidentRecords = useMemo(
    () =>
      dashboardIncidentRecords.filter((record) => {
        const status = getDashboardIncidentStatus(record)
        return status === 'approved' || status === 'resolved'
      }),
    [dashboardIncidentRecords],
  )

  const analyticsIncidentRecords = useMemo(() => {
    return approvedDashboardIncidentRecords.map((record) => {
      const dashboardType = getDashboardIncidentType(record)

      if (dashboardType === 'Fire') {
        return { ...record, code: 'FR' as HazardType }
      }

      if (dashboardType === 'Accident') {
        return { ...record, code: 'AC' as HazardType }
      }

      if (dashboardType === 'Earthquake') {
        return { ...record, code: 'EQ' as HazardType }
      }

      return record
    })
  }, [approvedDashboardIncidentRecords, dashboardIncidentRecords])

  const fireDashboardRecords = useMemo(
    () => approvedDashboardIncidentRecords.filter((record) => getDashboardIncidentType(record) === 'Fire'),
    [approvedDashboardIncidentRecords],
  )

  const accidentDashboardRecords = useMemo(
    () => approvedDashboardIncidentRecords.filter((record) => getDashboardIncidentType(record) === 'Accident'),
    [approvedDashboardIncidentRecords],
  )

  const totalIncidentReportsCount = approvedDashboardIncidentRecords.length

  const lucenaEarthquakeEvents = useMemo(
    () => filterLucenaEvents(filteredEarthquakeEvents),
    [filteredEarthquakeEvents],
  )

  const fireRiskScore = useMemo(
    () => calculateDashboardFireRiskScore(approvedDashboardIncidentRecords),
    [approvedDashboardIncidentRecords],
  )

  const earthquakeRiskScore = useMemo(
    () => calculateEarthquakeRiskScore(lucenaEarthquakeEvents),
    [lucenaEarthquakeEvents],
  )

  const overviewMetricCards: MetricCard[] = [
    {
      label: 'Total fire incidents',
      value: fireDashboardRecords.length,
      comparison: 'Current incident records in dashboard',
      delta:
        fireDashboardRecords.length > 0
          ? `${fireDashboardRecords.filter((record) => getDashboardIncidentStatus(record) === 'pending').length} currently active`
          : 'No fire incidents recorded yet',
      accent: 'border-t-[7px] border-t-red-600',
      valueClass: 'text-red-700',
    },
    {
      label: 'Total earthquake occurrences',
      value: eqCardStatus === 'loading' ? '...' : filteredEarthquakeEvents.length,
      comparison:
        eqCardStatus === 'error'
          ? 'Live seismic API unavailable'
          : normalizedDashboardSearchQuery
            ? 'Search results in the live seismic feed'
            : 'USGS live data for Quezon region',
      delta:
        eqCardStatus === 'loading'
          ? 'Updating from live seismic feed'
          : eqCardStatus === 'error'
            ? 'Unable to refresh right now'
            : 'Auto-refresh every 5 minutes',
      accent: 'border-t-[7px] border-t-emerald-600',
      valueClass: 'text-emerald-700',
    },
    {
      label: 'Total incident reports',
      value: totalIncidentReportsCount,
      comparison: 'All current report records in dashboard',
      delta:
        accidentDashboardRecords.length > 0
          ? `${totalIncidentReportsCount} total reports included`
          : 'No accident-type reports recorded yet',
      accent: 'border-t-[7px] border-t-blue-700',
      valueClass: 'text-blue-700',
    },
    {
      label: 'Current fire risk score',
      value: `${fireRiskScore}%`,
      comparison: 'Based on active fire records',
      delta: fireRiskScore >= 70 ? 'High vigilance required' : 'Within managed threshold',
      accent: 'border-t-[7px] border-t-orange-600',
      valueClass: 'text-orange-700',
    },
    {
      label: 'Current earthquake risk score',
      value: eqCardStatus === 'loading' ? '...' : `${earthquakeRiskScore}%`,
      comparison:
        eqCardStatus === 'error'
          ? 'Live seismic API unavailable'
          : 'Lucena-only seismic recency + magnitude',
      delta:
        eqCardStatus === 'loading'
          ? 'Updating from live seismic feed'
          : eqCardStatus === 'error'
            ? 'Unable to refresh right now'
            : earthquakeRiskScore >= 70
              ? 'Heightened seismic watch'
              : 'Routine monitoring level',
      accent: 'border-t-[7px] border-t-teal-600',
      valueClass: 'text-teal-700',
    },
  ]

  const incidentTrendData = useMemo(
    () => buildLastSevenDaysTrend(approvedDashboardIncidentRecords),
    [approvedDashboardIncidentRecords],
  )

  const incidentDistributionData = useMemo(
    () => buildCountData(approvedDashboardIncidentRecords, getDashboardIncidentType),
    [approvedDashboardIncidentRecords],
  )

  const topBarangayData = useMemo(
    () =>
      buildCountData(
        approvedDashboardIncidentRecords.filter((record) => !isPlaceholderLocation(getDashboardLocation(record))),
        getDashboardBarangay,
      ).slice(0, 5),
    [approvedDashboardIncidentRecords],
  )



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
    setMapFilter(newIncident.code)
  }

  function handleLogout(): void {
    logoutUser()

    navigate('/login', {
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
    activeSection === 'incidents'
      ? 'incidentReports'
      : activeSection === 'accomplishment'
        ? 'accomplishmentReports'
        : activeSection === 'reports'
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
            incidentReports: () => handleSelectSection('incidents'),
            accomplishmentReports: () => handleSelectSection('accomplishment'),
            riskScoring: () => handleSelectSection('scoring'),
            predictiveTrends: () => handleSelectSection('trends'),
            evacuationResources: () => handleSelectSection('resources'),
            communityPortal: () => handleSelectSection('users'),
            simulationTool: () => handleSelectSection('simulation'),
            reportsAnalytics: () => handleSelectSection('reports'),
            settingsAdminControls: () => handleSelectSection('settings'),
          }}
        />

        <main className="flex min-h-screen min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 mx-3 mt-3 flex flex-col gap-4 pb-2 sm:mx-6 sm:mt-4">
            <div className="flex min-h-[86px] flex-wrap items-center gap-3 rounded-[24px] border border-slate-200 bg-white px-4 py-4 shadow-[0_12px_32px_rgba(15,23,42,0.08)] md:flex-nowrap md:px-5">
              <div className="inline-flex min-w-fit items-center px-1 py-1 text-sm font-semibold text-slate-800">
                {currentDate} | {currentTime}
              </div>

              <div className="ml-auto flex w-full flex-wrap items-center justify-end gap-2 md:w-auto md:flex-nowrap">
                <label className="order-last flex w-full min-w-0 items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-500 sm:order-none sm:min-w-[240px] sm:max-w-[360px] md:max-w-[420px]">
                  <HeaderIcon name="search" />
                  <input
                    aria-label="Search dashboard data"
                    className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                    onChange={(event) => setDashboardSearchQuery(event.target.value)}
                    placeholder="Search incidents, reports, and users..."
                    type="text"
                    value={dashboardSearchQuery}
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
                          <p className="px-3 py-8 text-center text-sm text-slate-500">
                            No notifications yet.
                          </p>
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
              <div className="flex flex-wrap items-end justify-between gap-3 px-1">
                <div>
                  <p className="text-sm font-medium text-slate-500">Hazard operations workspace</p>
                  <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl">
                    Welcome back, <span className="text-blue-800">{firstName}</span>
                  </h1>
                </div>
              </div>
            ) : null}
          </header>

          {activeSection === 'overview' ? (
            <section className="mx-auto w-full max-w-[1440px] px-3 pb-8 sm:px-5 lg:px-6 lg:pb-10">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 xl:gap-4">
                {overviewMetricCards.map((card) => (
                  <article
                    className={`group relative flex min-h-[210px] flex-col overflow-hidden rounded-[22px] border border-slate-200 bg-white p-4 shadow-[0_10px_26px_rgba(15,23,42,0.07)] transition-all duration-300 ease-out hover:-translate-y-1.5 hover:border-blue-200 hover:shadow-[0_22px_42px_rgba(15,23,42,0.14)] sm:min-h-[220px] sm:p-5 xl:min-h-[230px] ${card.accent}`}
                    key={card.label}
                  >
                    <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-blue-500/10 opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100" />
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-blue-500/0 via-blue-500/30 to-blue-500/0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

                    <div className="relative z-10">
                      <div className="flex items-start justify-between gap-3">
                        <p className="line-clamp-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400 transition-colors group-hover:text-slate-500 sm:text-[11px]">
                          {card.label}
                        </p>

                        {/* badge removed - hover effects preserved */}
                      </div>

                      <div className="mt-4 flex items-end justify-between gap-3">
                        <p className={`text-3xl font-bold tracking-tight transition-transform duration-300 group-hover:scale-[1.04] sm:text-4xl xl:text-3xl 2xl:text-4xl ${card.valueClass}`}>
                          {card.value}
                        </p>

                        <span className="rounded-full bg-slate-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-500 transition-all duration-300 group-hover:bg-blue-50 group-hover:text-blue-700 group-hover:shadow-sm">
                          Live
                        </span>
                      </div>

                      <p className="mt-3 min-h-[42px] text-sm font-medium leading-5 text-slate-600">
                        {card.comparison}
                      </p>

                      <p className="mt-3 border-t border-slate-100 pt-3 text-xs font-bold text-slate-700 transition-colors duration-300 group-hover:text-slate-900">
                        {card.delta}
                      </p>
                    </div>
                  </article>
                ))}
              </div>

              <div className="mt-5 overflow-hidden rounded-[28px] border border-blue-100 bg-white p-4 shadow-[0_16px_38px_rgba(15,23,42,0.09)] sm:p-5">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">
                      Incident Trend
                    </p>
                    <h2 className="mt-1 text-lg font-bold text-slate-900 sm:text-xl">
                      Daily Incident Reports
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Number of reports submitted by date based on current dashboard data.
                    </p>
                  </div>

                  <div className="rounded-2xl bg-blue-50 px-4 py-2 text-left sm:text-right">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-500">Peak day</p>
                    <p className="text-sm font-bold text-blue-800">
                      {incidentTrendData.length > 0
                        ? incidentTrendData.reduce((top, item) => (item.count > top.count ? item : top), incidentTrendData[0]).date
                        : 'No data'}
                    </p>
                  </div>
                </div>

                <div className="h-[300px] w-full sm:h-[330px] lg:h-[360px]">
                  <DashboardLineChart data={incidentTrendData} />
                </div>

                <div className="mt-5 grid gap-3 rounded-2xl border border-slate-100 bg-slate-50/80 p-3 text-center sm:grid-cols-3 sm:p-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-blue-600">Total last 7 days</p>
                    <p className="mt-1 text-xl font-bold text-slate-900">{incidentTrendData.reduce((sum, item) => sum + item.count, 0)}</p>
                    <p className="text-xs text-slate-500">reports</p>
                  </div>
                  <div className="sm:border-x sm:border-slate-200">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-blue-600">Average per day</p>
                    <p className="mt-1 text-xl font-bold text-slate-900">
                      {(incidentTrendData.reduce((sum, item) => sum + item.count, 0) / Math.max(incidentTrendData.length, 1)).toFixed(2)}
                    </p>
                    <p className="text-xs text-slate-500">reports</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-blue-600">Peak count</p>
                    <p className="mt-1 text-xl font-bold text-slate-900">
                      {incidentTrendData.length > 0
                        ? incidentTrendData.reduce((top, item) => (item.count > top.count ? item : top), incidentTrendData[0]).count
                        : 0}
                    </p>
                    <p className="text-xs text-slate-500">reports</p>
                  </div>
                </div>
              </div>

              <div className="mt-5 grid gap-5 xl:grid-cols-2">
                <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white p-4 shadow-[0_16px_38px_rgba(15,23,42,0.09)] sm:p-5">
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">
                    Incident Distribution
                  </p>
                  <h2 className="mt-1 text-lg font-bold text-slate-900 sm:text-xl">
                    Reports by Incident Type
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Shows which incident type has the largest share of all submitted reports.
                  </p>

                  <div className="mt-4 min-h-[720px] w-full sm:min-h-[700px] lg:min-h-[720px]">
                    <DashboardDonutChart data={incidentDistributionData} />
                  </div>

                </div>

                <div className="group overflow-hidden rounded-[28px] border border-slate-100 bg-white/90 p-4 shadow-[0_20px_50px_rgba(15,23,42,0.06)] backdrop-blur-md transition-all duration-300 hover:shadow-[0_20px_50px_rgba(15,23,42,0.12)] sm:p-5 lg:p-6">

                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
                        Barangay Hotspots
                      </p>
                      <h2 className="mt-1 text-lg font-bold tracking-tight text-slate-800 sm:text-xl">
                        Top 5 Barangays with Most Incidents
                      </h2>
                      <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">
                        Highest incident concentration based on the report location field.
                      </p>
                    </div>

                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-500 transition-colors group-hover:bg-rose-100">
                      <svg
                        className="h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                    </div>
                  </div>

                  <div className="mt-5 min-h-[340px] w-full sm:min-h-[360px]">
                    <DashboardBarChart data={topBarangayData} />
                  </div>

                </div>
              </div>
            </section>
          ) : null}
          

          {activeSection === 'reports' ? (
            <ReportsSection
              earthquakeEvents={filteredEarthquakeEvents}
              earthquakeFeedStatus={eqCardStatus}
              earthquakeLastUpdated={eqLastUpdated}
              reports={filteredReports}
              responderReports={responderReports}
              searchQuery={dashboardSearchQuery}
            />
          ) : null}

          {activeSection === 'map' ? (
            <MapSection
              incidents={filteredReports}
              mapFilter={mapFilter}
              onCreateIncident={handleCreateMapIncident}
              onIncidentReportApproved={() => void loadBackendData()}
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
            <AnalyticsSection reports={analyticsIncidentRecords} earthquakeEvents={filteredEarthquakeEvents} />
          ) : null}

          {activeSection === 'resources' ? <ResourcesSection /> : null}

          {activeSection === 'users' ? <UsersSection searchQuery={dashboardSearchQuery} /> : null}

          {activeSection === 'simulation' ? <SimulationSection /> : null}

          {activeSection === 'incidents' ? <IncidentReports /> : null}

          {activeSection === 'accomplishment' ? <AccomplishmentReports /> : null}

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