import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AdminSidebar } from '../../components/AdminSidebar'
import {
  mapBackendIncidentToHazardIncident,
  type HazardIncident,
  type HazardType,
} from '../../data/adminOperations'
import type { AdminNavKey } from '../../data/adminNavigation'
import { getCurrentUserProfile, logoutUser } from '../../services/auth'
import { fetchPhilippinesEarthquakes, type EarthquakeEvent } from '../../services/earthquakes'
import { getIncidents, getIncidentReports } from '../../services/incidents'
import {
  NOTIFICATIONS_CHANGED_EVENT,
  getNotifications,
  markAllNotificationsRead,
  type NotificationItem,
} from '../../services/notifications'
import notificationIcon from '../../images/notification.png'
import { InlineModuleSection } from './sections/InlineModuleSection'
import { RiskScoringSection } from './sections/RiskScoringSection'
import { AnalyticsSection } from './sections/AnalyticsSection'
import { MapSection } from './sections/MapSection'
import { ReportsSection } from './sections/ReportsSection'
import { ResourcesSection } from './sections/ResourcesSection'
import { SimulationSection } from './sections/SimulationSection'
import { UsersSection } from './sections/UsersSection'
import { AccomplishmentReports } from './sections/AccomplishmentReports'
import { IncidentReports } from './sections/IncidentReports'
import { StrategicBriefingCard } from './sections/StrategicBriefingCard'
import {
  getIncidentCategoryKey,
  getIncidentCategoryLabel,
  INCIDENT_CATEGORIES,
  sortIncidentCategoryLabels,
} from '../../data/incidentCategories'
import { toLucenaBarangay, withAllBarangays } from '../../data/barangays'
import { toTeamName } from '../../data/teams'

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
  const fireRecords = records.filter((record) => getIncidentCategoryKey(record) === 'fire')
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
    // Prefer human-readable incident/report codes first so the same real incident
    // is not counted twice when it exists in both Incident and IncidentReport APIs.
    'incidentCode',
    'incident_code',
    'reportCode',
    'report_code',
    'incident_reference_code_readonly',
    'reference_code',
    'referenceCode',
    'id',
    'incidentId',
    'incident_id',
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

function parseTimeParts(value: string): { hours: number; minutes: number; seconds: number } | null {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/)
  if (!match) return null

  const hours = Number(match[1])
  const minutes = Number(match[2])
  const seconds = Number(match[3] || '0')

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59 || seconds < 0 || seconds > 59) {
    return null
  }

  return { hours, minutes, seconds }
}

function getIncidentTimelineDate(record: any): Date {
  const occurrenceValue = getRecordValue(
    record,
    'incident_datetime',
    'incidentDateTime',
    'date_reported',
    'report_time',
    'reportTime',
  )

  if (occurrenceValue) {
    const parsed = new Date(occurrenceValue)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed
    }
  }

  const createdDate = getRecordDate(record)
  const timeOnly = getRecordValue(record, 'time_occurred', 'timeOccurred')
  const timeParts = timeOnly ? parseTimeParts(timeOnly) : null

  if (timeParts) {
    const merged = new Date(createdDate)
    merged.setHours(timeParts.hours, timeParts.minutes, timeParts.seconds, 0)
    return merged
  }

  return createdDate
}

function buildDailyTrendForPeriod(records: any[], year: number): TrendDataItem[] {
  const grouped = new Map<string, number>()
  records.forEach((record) => {
    const date = getIncidentTimelineDate(record)
    const sameYear = date.getFullYear() === year
    if (sameYear) {
      const monthKey = String(date.getMonth() + 1).padStart(2, '0')
      grouped.set(monthKey, (grouped.get(monthKey) || 0) + 1)
    }
  })

  return Array.from({ length: 12 }, (_, index) => {
    const month = index + 1
    const monthKey = String(month).padStart(2, '0')
    const monthDate = new Date(year, index, 1)
    return {
      date: monthDate.toLocaleDateString(undefined, { month: 'short' }),
      isoDate: `${year}-${monthKey}`,
      dayKey: monthKey,
      count: grouped.get(monthKey) || 0,
    }
  })
}

function calculateTrendPercentChange(currentTotal: number, previousTotal: number): number | null {
  if (previousTotal === 0) {
    return currentTotal === 0 ? 0 : null
  }

  return Number((((currentTotal - previousTotal) / previousTotal) * 100).toFixed(2))
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

// Same incident type names and rules as every other admin page (see data/incidentCategories.ts).
function getDashboardIncidentType(record: any): string {
  return getIncidentCategoryLabel(record)
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
  // One of the 33 barangays when the record names one (saved barangay or location).
  const knownBarangay =
    toLucenaBarangay(getRecordValue(record?.barangay ?? {}, 'name', 'barangay_name', 'brgy_name', 'title')) ??
    toLucenaBarangay(getRecordValue(record, 'barangay_name', 'barangay', 'brgy', 'barangayName', 'barangayLabel')) ??
    toLucenaBarangay(getDashboardLocation(record))
  if (knownBarangay) return knownBarangay

  const barangayObject = record?.barangay

  if (barangayObject && typeof barangayObject === 'object') {
    const objectName = getRecordValue(
      barangayObject,
      'name',
      'barangay_name',
      'brgy_name',
      'title',
    )

    if (objectName) {
      return objectName.toLowerCase().startsWith('barangay')
        ? toTitleCase(objectName)
        : `Barangay ${toTitleCase(objectName)}`
    }
  }

  const explicitBarangay = getRecordValue(
    record,
    'barangay_name',
    'barangay',
    'brgy',
    'barangayName',
    'barangayLabel',
  )

  if (explicitBarangay) {
    return explicitBarangay.toLowerCase().startsWith('barangay')
      ? toTitleCase(explicitBarangay)
      : `Barangay ${toTitleCase(explicitBarangay)}`
  }

  const location = getDashboardLocation(record)

  if (isPlaceholderLocation(location)) return 'Unspecified location'

  const lower = location.toLowerCase()

  const barangayMatch = location.match(/(?:barangay|brgy\.?|bgy\.?)\s+([^,]+)/i)
  if (barangayMatch?.[1]) {
    return `Barangay ${toTitleCase(barangayMatch[1].replace(/\s*\(pob\.\)\s*/i, '').trim())}`
  }

  const knownAreas: Array<[string, string]> = [
    ['barangay 1', 'Barangay 1'],
    ['barangay 2', 'Barangay 2'],
    ['barangay 3', 'Barangay 3'],
    ['barangay 4', 'Barangay 4'],
    ['barangay 5', 'Barangay 5'],
    ['barangay 6', 'Barangay 6'],
    ['barangay 7', 'Barangay 7'],
    ['barangay 8', 'Barangay 8'],
    ['barangay 9', 'Barangay 9'],
    ['barangay 10', 'Barangay 10'],
    ['barangay 11', 'Barangay 11'],
    ['gulang-gulang', 'Barangay Gulang-Gulang'],
    ['gulang gulang', 'Barangay Gulang-Gulang'],
    ['dalahican', 'Barangay Dalahican'],
    ['ibabang dupay', 'Barangay Ibabang Dupay'],
    ['ilayang dupay', 'Barangay Ilayang Dupay'],
    ['ilayang iyam', 'Barangay Ilayang Iyam'],
    ['ibabang iyam', 'Barangay Ibabang Iyam'],
    ['ibabang talim', 'Barangay Ibabang Talim'],
    ['ilayang talim', 'Barangay Ilayang Talim'],
    ['mayao crossing', 'Barangay Mayao Crossing'],
    ['mayao kanluran', 'Barangay Mayao Kanluran'],
    ['mayao silangan', 'Barangay Mayao Silangan'],
    ['mayao castillo', 'Barangay Mayao Castillo'],
    ['mayao parada', 'Barangay Mayao Parada'],
    ['cotta', 'Barangay Cotta'],
    ['bocohan', 'Barangay Bocohan'],
    ['barra', 'Barangay Barra'],
    ['isabang', 'Barangay Isabang'],
    ['market view', 'Barangay Market View'],
    ['domoit', 'Barangay Domoit'],
    ['ransohan', 'Barangay Ransohan'],
    ['salinas', 'Barangay Salinas'],
    ['talao-talao', 'Barangay Talao-Talao'],
  ]

  const matchedArea = knownAreas.find(([keyword]) => lower.includes(keyword))
  if (matchedArea) return matchedArea[1]

  const cleanParts = location
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part && !/lucena city/i.test(part))

  const fallback = cleanParts.at(-1) || 'Lucena City'
  return fallback.toLowerCase().startsWith('barangay')
    ? toTitleCase(fallback)
    : `Barangay ${toTitleCase(fallback)}`
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

/** Fixed color for an incident type name, so a type keeps its color on every chart. */
function getCategoryColor(name: string, index: number): string {
  return INCIDENT_CATEGORIES.find((category) => category.label === name)?.color ?? chartPalette[index % chartPalette.length]
}

type CountDataItem = { name: string; count: number }
type TrendDataItem = { date: string; isoDate: string; dayKey: string; count: number }

function EmptyChartState({ message }: { message: string }) {
  return (
    <div className="flex h-full min-h-[220px] items-center justify-center rounded-[24px] border border-dashed border-slate-200 bg-gradient-to-br from-slate-50 to-white text-center text-sm font-semibold text-slate-500">
      {message}
    </div>
  )
}

function DashboardLineChart({
  data,
  comparisonData = [],
  currentYearLabel,
  comparisonYearLabel,
  incidentTypeLabel,
}: {
  data: TrendDataItem[]
  comparisonData?: TrendDataItem[]
  currentYearLabel?: string
  comparisonYearLabel?: string
  incidentTypeLabel?: string
}) {
  if (data.length === 0) {
    return <EmptyChartState message="No incident trend data available yet." />
  }

  const [animatedData, setAnimatedData] = useState<TrendDataItem[]>(data)
  const [animatedComparisonData, setAnimatedComparisonData] = useState<TrendDataItem[]>(comparisonData)
  const animationFrameRef = useRef<number | null>(null)
  const previousDataRef = useRef<TrendDataItem[]>(data)
  const previousComparisonDataRef = useRef<TrendDataItem[]>(comparisonData)

  useEffect(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }

    const previousData = previousDataRef.current
    const previousComparisonData = previousComparisonDataRef.current

    const previousDataMap = new Map(previousData.map((item) => [item.dayKey, item.count]))
    const previousComparisonMap = new Map(previousComparisonData.map((item) => [item.dayKey, item.count]))

    const startData = data.map((item) => ({
      ...item,
      count: previousDataMap.get(item.dayKey) ?? item.count,
    }))

    const startComparisonData = comparisonData.map((item) => ({
      ...item,
      count: previousComparisonMap.get(item.dayKey) ?? item.count,
    }))

    setAnimatedData(startData)
    setAnimatedComparisonData(startComparisonData)

    const durationMs = 420
    const startTime = performance.now()

    const easeInOutCubic = (value: number) => {
      return value < 0.5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2
    }

    const animate = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(1, elapsed / durationMs)
      const eased = easeInOutCubic(progress)

      setAnimatedData(
        data.map((targetItem, index) => {
          const startCount = startData[index]?.count ?? targetItem.count
          return {
            ...targetItem,
            count: startCount + (targetItem.count - startCount) * eased,
          }
        }),
      )

      setAnimatedComparisonData(
        comparisonData.map((targetItem, index) => {
          const startCount = startComparisonData[index]?.count ?? targetItem.count
          return {
            ...targetItem,
            count: startCount + (targetItem.count - startCount) * eased,
          }
        }),
      )

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate)
      } else {
        animationFrameRef.current = null
        previousDataRef.current = data
        previousComparisonDataRef.current = comparisonData
      }
    }

    animationFrameRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
    }
  }, [data, comparisonData])

  const displayData = animatedData.length === data.length ? animatedData : data
  const displayComparisonData =
    animatedComparisonData.length === comparisonData.length ? animatedComparisonData : comparisonData

  const width = 1120
  const height = 360
  const padding = { top: 24, right: 28, bottom: 56, left: 52 }
  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom
  const maxCount = Math.max(1, ...data.map((item) => item.count), ...comparisonData.map((item) => item.count))
  const totalCount = data.reduce((sum, item) => sum + item.count, 0)
  const peakPoint = data.reduce((top, item) => (item.count > top.count ? item : top), data[0])
  const stepX = displayData.length > 1 ? chartWidth / (displayData.length - 1) : chartWidth
  const xLabelStep = 1
  const denseMode = false
  const markerStep = 1
  const [selectedIndex, setSelectedIndex] = useState<number>(Math.max(0, data.length - 1))
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  const points = displayData.map((item, index) => {
    const x = padding.left + (displayData.length > 1 ? index * stepX : chartWidth / 2)
    const y = padding.top + chartHeight - (item.count / maxCount) * chartHeight
    return { ...item, x, y }
  })

  const linePath = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ')

  const comparisonCountByDayKey = new Map<string, number>()
  displayComparisonData.forEach((item) => {
    comparisonCountByDayKey.set(item.dayKey, item.count)
  })

  const comparisonPoints = points.map((point) => {
    const count = comparisonCountByDayKey.get(point.dayKey) || 0
    const y = padding.top + chartHeight - (count / maxCount) * chartHeight
    return {
      ...point,
      count,
      y,
    }
  })

  const comparisonPath = comparisonPoints
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ')

  const yTickCount = 5
  const yTicks = Array.from({ length: yTickCount + 1 }, (_, index) => {
    const value = Math.round((maxCount / yTickCount) * index)
    const y = padding.top + chartHeight - (value / maxCount) * chartHeight
    return { value, y }
  })

  const lastPoint = points[points.length - 1]
  const peakIndex = points.findIndex((point) => point.date === peakPoint.date && point.count === peakPoint.count)
  const safeSelectedIndex = Math.max(0, Math.min(selectedIndex, points.length - 1))
  const activeIndex = hoveredIndex === null ? safeSelectedIndex : Math.max(0, Math.min(hoveredIndex, points.length - 1))
  const activePoint = points[activeIndex]
  const activeComparisonPoint = comparisonPoints[activeIndex]
  const activeCurrentCount = Math.round(activePoint?.count || 0)
  const activeComparisonCount = Math.round(activeComparisonPoint?.count || 0)
  const activeDifference = activeCurrentCount - activeComparisonCount
  const activePercentChange = calculateTrendPercentChange(activeCurrentCount, activeComparisonCount)

  const tooltipBoxWidth = 190
  const tooltipBoxHeight = 84
  const tooltipX = activePoint
    ? Math.min(width - tooltipBoxWidth - 8, Math.max(8, activePoint.x + 12))
    : 8
  const tooltipY = activePoint
    ? Math.max(8, activePoint.y - tooltipBoxHeight - 12)
    : 8

  useEffect(() => {
    setSelectedIndex(Math.max(0, data.length - 1))
  }, [data.length, comparisonData.length])

  function resolveIndexFromMouseEvent(event: React.MouseEvent<SVGSVGElement>): number | null {
    const rect = event.currentTarget.getBoundingClientRect()
    if (!rect.width || data.length <= 1) {
      return null
    }

    const clickX = event.clientX - rect.left
    const svgX = (clickX / rect.width) * width
    const ratio = (svgX - padding.left) / chartWidth
    const nextIndex = Math.round(ratio * (data.length - 1))
    return Math.max(0, Math.min(nextIndex, data.length - 1))
  }

  function handleChartClick(event: React.MouseEvent<SVGSVGElement>) {
    const resolved = resolveIndexFromMouseEvent(event)
    if (resolved !== null) {
      setSelectedIndex(resolved)
    }
  }

  function handleChartMouseMove(event: React.MouseEvent<SVGSVGElement>) {
    const resolved = resolveIndexFromMouseEvent(event)
    if (resolved !== null) {
      setHoveredIndex(resolved)
    }
  }

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden rounded-[18px] border border-slate-200 bg-gradient-to-br from-blue-50 via-sky-50 to-cyan-50 p-3 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">

      <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-blue-200/20 blur-2xl" />

      {/* Legend: each swatch is drawn like its line on the chart (solid blue = year, dashed orange = compared year). */}
      <ul
        className="relative z-10 flex flex-wrap items-center gap-x-5 gap-y-1.5 px-1 pb-2 pt-0.5 text-xs"
        aria-label="Chart legend"
      >
        <li className="flex items-center gap-2">
          <svg width="26" height="8" aria-hidden="true">
            <line x1="1" y1="4" x2="25" y2="4" stroke="#2d5bff" strokeWidth="3" strokeLinecap="round" />
          </svg>
          <span className="font-bold text-slate-900">{currentYearLabel || 'Current year'}</span>
          <span className="text-slate-500">selected year</span>
        </li>
        {comparisonData.length > 0 ? (
          <li className="flex items-center gap-2">
            <svg width="26" height="8" aria-hidden="true">
              <line x1="1" y1="4" x2="25" y2="4" stroke="#ff7b1a" strokeWidth="3" strokeDasharray="4 4" strokeLinecap="round" />
            </svg>
            <span className="font-bold text-slate-900">{comparisonYearLabel || 'Comparison year'}</span>
            <span className="text-slate-500">compare year</span>
          </li>
        ) : null}
        <li className="flex items-center gap-2 text-slate-500">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-500" aria-hidden="true" />
          Highest month
        </li>
      </ul>

      <div className="absolute right-4 top-4 z-10 hidden rounded-xl border border-slate-200 bg-white px-3 py-2 text-right sm:right-5 sm:top-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Trend total</p>
        <p className="text-base font-semibold text-slate-900">{totalCount} reports</p>
      </div>

      <svg
        role="img"
        aria-label={`Monthly ${incidentTypeLabel || 'incident'} reports, ${currentYearLabel || 'this year'} compared with ${comparisonYearLabel || 'the year before'}`}
        className="relative z-[1] min-h-0 w-full flex-1 cursor-crosshair"
        preserveAspectRatio="xMidYMid meet"
        viewBox={`0 0 ${width} ${height}`}
        onClick={handleChartClick}
        onMouseMove={handleChartMouseMove}
        onMouseLeave={() => setHoveredIndex(null)}
      >
        <defs>
          <filter id="neonBlueGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2.6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="neonOrangeGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2.3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {yTicks.map((tick) => (
          <g key={tick.value}>
            <line
              stroke="#e5e7eb"
              strokeDasharray="7 7"
              strokeWidth="1"
              x1={padding.left}
              x2={width - padding.right}
              y1={tick.y}
              y2={tick.y}
            />
            <text fill="#6b7280" fontSize="12" fontWeight="600" x={padding.left - 10} y={tick.y + 4} textAnchor="end">
              {tick.value}
            </text>
          </g>
        ))}

        <line
          stroke="#d1d5db"
          strokeLinecap="round"
          strokeWidth="1"
          x1={padding.left}
          x2={padding.left}
          y1={padding.top}
          y2={height - padding.bottom}
        />
        <line
          stroke="#d1d5db"
          strokeLinecap="round"
          strokeWidth="1"
          x1={padding.left}
          x2={width - padding.right}
          y1={height - padding.bottom}
          y2={height - padding.bottom}
        />

        {activePoint ? (
          <line
            x1={activePoint.x}
            x2={activePoint.x}
            y1={padding.top}
            y2={height - padding.bottom}
            stroke="#9ca3af"
            strokeDasharray="5 5"
            strokeWidth="1"
          />
        ) : null}

        <path
          d={linePath}
          fill="none"
          stroke="#2d5bff"
          filter="url(#neonBlueGlow)"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.5"
        />

        {comparisonData.length > 0 ? (
          <path
            d={comparisonPath}
            fill="none"
            stroke="#ff7b1a"
            filter="url(#neonOrangeGlow)"
            strokeDasharray="4 4"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2.4"
          />
        ) : null}

        {activePoint ? (
          <g>
            <rect
              x={tooltipX}
              y={tooltipY}
              rx="10"
              ry="10"
              width={tooltipBoxWidth}
              height={tooltipBoxHeight}
              fill="#ffffff"
              stroke="#cbd5e1"
              strokeWidth="1"
            />
            <text x={tooltipX + 10} y={tooltipY + 18} fill="#111827" fontSize="11" fontWeight="700">
              {activePoint.isoDate}
            </text>
            <text x={tooltipX + 10} y={tooltipY + 36} fill="#1d4ed8" fontSize="10" fontWeight="700">
              {currentYearLabel || 'Current'}: {activeCurrentCount}
            </text>
            <text x={tooltipX + 10} y={tooltipY + 52} fill="#c2410c" fontSize="10" fontWeight="700">
              {comparisonYearLabel || 'Compare'}: {activeComparisonCount}
            </text>
            <text x={tooltipX + 10} y={tooltipY + 68} fill="#334155" fontSize="10" fontWeight="700">
              Diff: {activeDifference > 0 ? '+' : ''}{activeDifference}
              {activePercentChange === null ? ' (N/A%)' : ` (${activePercentChange > 0 ? '+' : ''}${activePercentChange}%)`}
            </text>
          </g>
        ) : null}

        {points.map((point, index) => {
          const isPeak = index === peakIndex
          const isLast = index === points.length - 1
          const isSelected = index === safeSelectedIndex
          const isActive = index === activeIndex
          const shouldShowMarker = !denseMode || isPeak || isLast || index % markerStep === 0
          const shouldShowCountLabel = (!denseMode && point.count > 0) || isPeak || isLast

          return (
            <g key={`${point.date}-${point.count}-${index}`} onClick={() => setSelectedIndex(index)}>
              {isPeak || isLast ? (
                <circle cx={point.x} cy={point.y} fill="#2563eb" opacity="0.18" r="14">
                  <animate attributeName="r" dur="1.5s" repeatCount="indefinite" values="10;22;10" />
                  <animate attributeName="opacity" dur="1.5s" repeatCount="indefinite" values="0.22;0;0.22" />
                </circle>
              ) : null}

              {isSelected ? <circle cx={point.x} cy={point.y} fill="#2d5bff" opacity="0.26" r="9" /> : null}
              {isActive ? <circle cx={point.x} cy={point.y} fill="#1dd3ff" opacity="0.2" r="8" /> : null}

              {shouldShowMarker ? (
                <>
                  <circle cx={point.x} cy={point.y} fill="#ffffff" r="5" stroke="#66b7ff" strokeWidth="2" />
                  <circle cx={point.x} cy={point.y} fill={isPeak ? '#ffb020' : '#2d5bff'} r={isPeak ? '4.5' : '3.5'} />
                </>
              ) : null}

              {shouldShowCountLabel ? (
                <text fill="#111827" fontSize="11" fontWeight="600" x={point.x} y={point.y - 12} textAnchor="middle">
                  {point.count}
                </text>
              ) : null}

              {index % xLabelStep === 0 || isLast ? (
                <text fill={isLast ? '#2563eb' : '#6b7280'} fontSize="12" fontWeight="600" x={point.x} y={height - 18} textAnchor="middle">
                  {point.date}
                </text>
              ) : null}
            </g>
          )
        })}

        {lastPoint ? (
          <g>
            <circle cx={lastPoint.x} cy={lastPoint.y} fill="#00c8ff" r="4" />
            <text fill="#0a4be6" fontSize="11" fontWeight="700" x={lastPoint.x - 2} y={Math.min(lastPoint.y + 30, height - padding.bottom - 8)} textAnchor="end">
              Latest
            </text>
          </g>
        ) : null}
      </svg>

    </div>
  )
}

const ALL_YEARS = 'all'

/**
 * Reports by incident type: the donut and a ranked list side by side. Hovering or focusing a type
 * highlights it in both, and the donut's middle shows that type's count and share.
 */
function DashboardDonutChart({
  data,
  previousCounts,
  previousLabel,
  scopeLabel,
}: {
  data: CountDataItem[]
  /** Counts per type for the year before, to show the change; omitted for "All years". */
  previousCounts?: Map<string, number>
  previousLabel?: string
  /** e.g. "in 2026" or "in 2026, Ibabang Dupay". */
  scopeLabel: string
}) {
  const [activeName, setActiveName] = useState<string | null>(null)

  if (data.length === 0) {
    return <EmptyChartState message="No reports match these filters." />
  }

  const chartKey = data.map((item) => `${item.name}:${item.count}`).join('|')
  const total = data.reduce((sum, item) => sum + item.count, 0)
  const radius = 78
  const circumference = 2 * Math.PI * radius
  let runningTotal = 0
  const leading = data[0]
  const share = (count: number) => (total > 0 ? Math.round((count / total) * 100) : 0)
  const active = data.find((item) => item.name === activeName) ?? null

  return (
    <div className="dashboard-chart-enter w-full" key={chartKey}>
      <p className="text-sm leading-6 text-slate-600">
        <span className="font-bold text-slate-900">{leading.name}</span> is the most reported type: {share(leading.count)}% of{' '}
        {total.toLocaleString()} reports {scopeLabel}.
      </p>

      <div className="mt-4 grid items-center gap-6 md:grid-cols-[200px_1fr] lg:grid-cols-[220px_1fr]">
        <div className="relative mx-auto flex items-center justify-center">
          <svg
            className="h-[180px] w-[180px] lg:h-[200px] lg:w-[200px]"
            viewBox="0 0 240 240"
            role="img"
            aria-label={`Reports by incident type ${scopeLabel}: ${data.map((item) => `${item.name} ${item.count}`).join(', ')}`}
          >
            <circle cx="120" cy="120" fill="#ffffff" r="108" />
            <circle cx="120" cy="120" fill="none" r={radius} stroke="#e2e8f0" strokeWidth="30" />

            {data.map((item, index) => {
              const percentage = total > 0 ? item.count / total : 0
              const dashLength = percentage * circumference
              const dashOffset = -runningTotal * circumference
              runningTotal += percentage
              const dimmed = activeName !== null && activeName !== item.name

              return (
                <circle
                  cx="120"
                  cy="120"
                  fill="none"
                  key={item.name}
                  r={radius}
                  stroke={getCategoryColor(item.name, index)}
                  strokeDasharray={`${dashLength} ${circumference - dashLength}`}
                  strokeDashoffset={dashOffset}
                  strokeWidth={activeName === item.name ? 36 : 30}
                  transform="rotate(-90 120 120)"
                  className="dashboard-donut-segment cursor-pointer transition-[opacity,stroke-width] duration-200"
                  style={{ animationDelay: `${index * 100}ms`, opacity: dimmed ? 0.25 : 1 }}
                  onMouseEnter={() => setActiveName(item.name)}
                  onMouseLeave={() => setActiveName(null)}
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
            <text fill="#0f172a" fontSize="34" fontWeight="900" textAnchor="middle" x="120" y="114">
              {active ? active.count : total}
            </text>
            <text fill="#64748b" fontSize="12" fontWeight="700" textAnchor="middle" x="120" y="136">
              {active ? `${share(active.count)}% of reports` : 'Total reports'}
            </text>
          </svg>
        </div>

        <ol className="min-w-0 divide-y divide-slate-100" aria-label="Reports by incident type">
          {data.map((entry, index) => {
            const percentage = share(entry.count)
            const color = getCategoryColor(entry.name, index)
            const previous = previousCounts?.get(entry.name) ?? 0
            const change = entry.count - previous
            const isActive = activeName === entry.name

            return (
              <li
                key={entry.name}
                tabIndex={0}
                onMouseEnter={() => setActiveName(entry.name)}
                onMouseLeave={() => setActiveName(null)}
                onFocus={() => setActiveName(entry.name)}
                onBlur={() => setActiveName(null)}
                className={`dashboard-chart-row-enter rounded-lg px-2 py-2 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  isActive ? 'bg-slate-50' : ''
                }`}
                style={{ animationDelay: `${200 + index * 60}ms` }}
              >
                <div className="flex items-center gap-3 text-sm">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate font-semibold text-slate-800">{entry.name}</span>
                  <span className="shrink-0 font-bold tabular-nums text-slate-900">{entry.count}</span>
                  <span className="w-10 shrink-0 text-right text-xs font-semibold tabular-nums text-slate-500">{percentage}%</span>
                  {previousCounts ? (
                    <span
                      className={`w-20 shrink-0 text-right text-xs font-semibold tabular-nums ${
                        change > 0 ? 'text-red-600' : change < 0 ? 'text-emerald-600' : 'text-slate-400'
                      }`}
                      title={`${previous} in ${previousLabel}`}
                    >
                      {change > 0 ? `▲ ${change}` : change < 0 ? `▼ ${Math.abs(change)}` : 'same'}
                      <span className="sr-only"> compared with {previousLabel}</span>
                    </span>
                  ) : null}
                </div>
                <div className="ml-[22px] mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="dashboard-chart-bar-fill h-full rounded-full"
                    style={{ animationDelay: `${260 + index * 60}ms`, backgroundColor: color, width: `${Math.max(3, percentage)}%` }}
                  />
                </div>
              </li>
            )
          })}
        </ol>
      </div>

      {previousCounts ? (
        <p className="mt-3 text-right text-xs text-slate-400">
          ▲ ▼ change compared with {previousLabel}
        </p>
      ) : null}
    </div>
  )
}

/** Top barangays as ranked rows: rank, name, bar, count, and the change from the year before. */
function DashboardBarChart({
  data,
  emptyMessage = 'No barangay hotspot data available yet.',
  previousCounts,
  previousLabel,
  scopeLabel,
}: {
  data: CountDataItem[]
  emptyMessage?: string
  /** Counts per barangay for the year before; omitted for "All years". */
  previousCounts?: Map<string, number>
  previousLabel?: string
  /** e.g. "Fire Incident reports in 2026". */
  scopeLabel: string
}) {
  if (data.length === 0) {
    return <EmptyChartState message={emptyMessage} />
  }

  const chartKey = data.map((item) => `${item.name}:${item.count}`).join('|')
  const maxCount = Math.max(1, ...data.map((item) => item.count))
  const [first, second] = data

  return (
    <div className="dashboard-chart-enter w-full" key={chartKey}>
      <p className="text-sm leading-6 text-slate-600">
        <span className="font-bold text-slate-900">{first.name}</span> has the most {scopeLabel}: {first.count}
        {second ? (second.count === first.count ? `, tied with ${second.name}` : `, ahead of ${second.name} (${second.count})`) : ''}.
      </p>

      <ol className="mt-4 divide-y divide-slate-100" aria-label={`Top barangays by ${scopeLabel}`}>
        {data.map((item, index) => {
          const color = chartPalette[index % chartPalette.length]
          const previous = previousCounts?.get(item.name) ?? 0
          const change = item.count - previous

          return (
            <li
              className="dashboard-chart-row-enter flex items-center gap-3 py-3"
              key={item.name}
              style={{ animationDelay: `${index * 90}ms` }}
            >
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                style={{ backgroundColor: color }}
              >
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-sm font-bold text-slate-800">{item.name}</span>
                  <span className="shrink-0 text-sm font-bold tabular-nums text-slate-900">{item.count}</span>
                </div>
                <div className="relative mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="dashboard-chart-bar-fill absolute inset-y-0 left-0 rounded-full"
                    style={{
                      animationDelay: `${120 + index * 90}ms`,
                      background: `linear-gradient(90deg, ${softChartPalette[index % softChartPalette.length]}, ${color})`,
                      width: `${Math.max(6, (item.count / maxCount) * 100)}%`,
                    }}
                  />
                </div>
              </div>
              {previousCounts ? (
                <span
                  className={`w-14 shrink-0 text-right text-xs font-semibold tabular-nums ${
                    change > 0 ? 'text-red-600' : change < 0 ? 'text-emerald-600' : 'text-slate-400'
                  }`}
                  title={`${previous} in ${previousLabel}`}
                >
                  {change > 0 ? `▲ ${change}` : change < 0 ? `▼ ${Math.abs(change)}` : 'same'}
                  <span className="sr-only"> compared with {previousLabel}</span>
                </span>
              ) : null}
            </li>
          )
        })}
      </ol>

      {previousCounts ? (
        <p className="mt-2 text-right text-xs text-slate-400">▲ ▼ change compared with {previousLabel}</p>
      ) : null}
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
  const [reports, setReports] = useState<HazardIncident[]>(() => [])
  const [responderReports, setResponderReports] = useState<any[]>([])
  const [mapFilter, setMapFilter] = useState<MapFilter>('EQ')
  const [notifications, setNotifications] = useState<NotificationItem[]>(() => getNotifications())
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)
  const [isTopProfileMenuOpen, setIsTopProfileMenuOpen] = useState(false)
  const [liveEarthquakeEvents, setLiveEarthquakeEvents] = useState<EarthquakeEvent[]>([])
  const [eqLastUpdated, setEqLastUpdated] = useState<Date | null>(null)
  const [eqCardStatus, setEqCardStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [dashboardSearchQuery, setDashboardSearchQuery] = useState('')
  const [trendYear, setTrendYear] = useState<string>('')
  const [trendCompareYear, setTrendCompareYear] = useState<string>('')
  const [trendIncidentType, setTrendIncidentType] = useState<string>('')
  const [distributionYear, setDistributionYear] = useState<string>('')
  const [distributionBarangay, setDistributionBarangay] = useState<string>('')
  const [hotspotYear, setHotspotYear] = useState<string>('')
  const [hotspotIncidentType, setHotspotIncidentType] = useState<string>('')
  const isMountedRef = useRef(true)

  const loadBackendData = useCallback(async () => {
    // Load both sources independently: if one request fails, the other still shows
    // (Promise.all used to blank the whole dashboard when either call failed).
    const [incidentsResult, incidentReportsResult] = await Promise.allSettled([
      getIncidents(),
      getIncidentReports(),
    ])

    if (!isMountedRef.current) return

    if (incidentsResult.status === 'fulfilled') {
      // Keep the raw backend fields (incident_datetime, barangay, hazard_type, reference_code...)
      // next to the mapped ones, so dates, barangays and types on the dashboard are real.
      const mappedIncidents = incidentsResult.value.map((incident) => ({
        ...incident,
        ...mapBackendIncidentToHazardIncident(incident),
      })) as HazardIncident[]
      setReports(mappedIncidents)
    } else {
      console.error('[AdminDashboard] Failed to load incidents:', incidentsResult.reason)
      setReports([])
    }

    if (incidentReportsResult.status === 'fulfilled') {
      setResponderReports(incidentReportsResult.value)
    } else {
      console.error('[AdminDashboard] Failed to load incident reports:', incidentReportsResult.reason)
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
    // The incident created when a report was approved, by reference code.
    const incidentByRefCode = new Map<string, HazardIncident>()

    reports.forEach((incident) => {
      const refCode = (incident as any).reference_code || (incident as any).referenceCode || undefined

      if (refCode && incident.code) {
        refOrIdToHazardType.set(String(refCode), incident.code)
      }

      if (refCode) {
        incidentByRefCode.set(String(refCode).toUpperCase(), incident)
      }

      if (incident.id && incident.code) {
        refOrIdToHazardType.set(String(incident.id), incident.code)
      }
    })

    return responderReports.map((report) => {
      const reportCategory = getIncidentCategoryKey(report)

      let code: HazardType = reportCategory === 'fire' ? 'FR' : reportCategory === 'earthquake' ? 'EQ' : 'AC'

      if (report.incident_reference_code_readonly && refOrIdToHazardType.has(String(report.incident_reference_code_readonly))) {
        code = refOrIdToHazardType.get(String(report.incident_reference_code_readonly)) as HazardType
      } else if (report.incident_id && refOrIdToHazardType.has(String(report.incident_id))) {
        code = refOrIdToHazardType.get(String(report.incident_id)) as HazardType
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

      const linkedIncident = incidentByRefCode.get(
        String(report.incidentCode || report.incident_code || report.incident_reference_code_readonly || '').toUpperCase(),
      )

      // Prefer the severity of the linked incident; otherwise use the same rules as the backend.
      let severity: 'Low' | 'Moderate' | 'High' | 'Critical' = linkedIncident?.severity || 'Low'

      if (!linkedIncident) {
        const victimCount = Number(getRecordValue(report, 'victimCount', 'victim_count')) || 0
        if (victimCount >= 5) severity = 'Critical'
        else if (victimCount >= 3) severity = 'High'
        else if (victimCount > 0 || ['fire', 'drowning', 'crime'].includes(reportCategory)) {
          severity = 'Moderate'
        }
      }

      const reportId = getIncidentRecordId(report)
      const readableType = getDashboardIncidentType(report)
      const latitude = Number(getRecordValue(report, 'latitude', 'lat'))
      const longitude = Number(getRecordValue(report, 'longitude', 'lng', 'lon'))
      const coordinates: [number, number] =
        Number.isFinite(latitude) && Number.isFinite(longitude)
          ? [latitude, longitude]
          : [0, 0]

      return {
        ...report,
        id: report.id || reportId,
        title: `${readableType} Report - ${report.reportCode || report.report_code || report.incidentCode || report.incident_code || report.incident_reference_code_readonly || reportId}`,
        code,
        status,
        // Keep the original backend status (e.g. "Submitted", "Approved") for the Reports table.
        reportStatus: getRecordValue(report, 'status', 'status_update'),
        severity,
        // Status of the linked incident (e.g. "ongoing", "resolved"), used by Analytics.
        linkedIncidentStatus: linkedIncident?.backendStatus || '',
        location: getDashboardLocation(report),
        time: getRecordDate(report).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }),
        responseTeam: toTeamName(report.responderTeam || report.responder_team) || report.responder_username || report.responder || '-',
        description: getDashboardDescription(report) || '-',
        coordinates,
      }
    })
  }, [responderReports, reports])

  const filteredReports = useMemo(() => {
    // Use ONE authoritative source for dashboard/report counts to avoid 20 Incident
    // records + 20 IncidentReport records being displayed as 40.
    // IncidentReport is preferred because it is the responder-submitted report table.
    const sourceRecords: HazardIncident[] =
      responderReportIncidents.length > 0 ? responderReportIncidents : reports

    const uniqueReports = new Map<string, HazardIncident>()

    sourceRecords.forEach((incident) => {
      const key = String(
        getIncidentRecordId(incident) ||
          `${getDashboardIncidentType(incident)}-${getRecordDate(incident).toISOString()}-${getDashboardBarangay(incident)}-${getDashboardLocation(incident)}`,
      )

      if (!uniqueReports.has(key)) {
        uniqueReports.set(key, incident)
      }
    })

    return Array.from(uniqueReports.values()).filter((incident) =>
      matchesDashboardSearch(
        [
          getIncidentRecordId(incident),
          incident.title,
          getDashboardIncidentType(incident),
          incident.status,
          incident.severity,
          getDashboardBarangay(incident),
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
        const events = await fetchPhilippinesEarthquakes(730, 1.0)
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
      const category = getIncidentCategoryKey(record)
      const code: HazardType = category === 'fire' ? 'FR' : category === 'earthquake' ? 'EQ' : 'AC'
      return { ...record, code }
    })
  }, [approvedDashboardIncidentRecords])

  const fireDashboardRecords = useMemo(
    () => dashboardIncidentRecords.filter((record) => getIncidentCategoryKey(record) === 'fire'),
    [dashboardIncidentRecords],
  )

  const incidentTypeCount = useMemo(
    () => new Set(dashboardIncidentRecords.map((record) => getDashboardIncidentType(record))).size,
    [dashboardIncidentRecords],
  )

  const totalIncidentReportsCount = dashboardIncidentRecords.length

  const lucenaEarthquakeEvents = useMemo(
    () => filterLucenaEvents(filteredEarthquakeEvents),
    [filteredEarthquakeEvents],
  )

  const fireRiskScore = useMemo(
    () => calculateDashboardFireRiskScore(dashboardIncidentRecords),
    [dashboardIncidentRecords],
  )

  const earthquakeRiskScore = useMemo(
    () => calculateEarthquakeRiskScore(lucenaEarthquakeEvents),
    [lucenaEarthquakeEvents],
  )

  // Incident cards first, then fire, then earthquake, so related numbers sit side by side.
  const overviewMetricCards: MetricCard[] = [
    {
      label: 'Total incident reports',
      value: totalIncidentReportsCount,
      comparison: 'All current report records in dashboard',
      delta:
        totalIncidentReportsCount > 0
          ? `Across ${incidentTypeCount} incident type${incidentTypeCount === 1 ? '' : 's'}`
          : 'No incident reports recorded yet',
      accent: 'border-t-[7px] border-t-blue-700',
      valueClass: 'text-blue-700',
    },
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
      label: 'Current fire risk score',
      value: `${fireRiskScore}%`,
      comparison: 'Based on active fire records',
      delta: fireRiskScore >= 70 ? 'High vigilance required' : 'Within managed threshold',
      accent: 'border-t-[7px] border-t-orange-600',
      valueClass: 'text-orange-700',
    },
    {
      label: 'Total earthquake occurrences',
      value: eqCardStatus === 'loading' ? '...' : filteredEarthquakeEvents.length,
      comparison:
        eqCardStatus === 'error'
          ? 'Live seismic API unavailable'
          : normalizedDashboardSearchQuery
            ? 'Search results in the live seismic feed'
            : 'USGS live data, Philippines, last 2 years',
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

  const availableTrendIncidentTypes = useMemo(() => {
    return sortIncidentCategoryLabels(Array.from(new Set(dashboardIncidentRecords.map((record) => getDashboardIncidentType(record)))))
  }, [dashboardIncidentRecords])

  const trendRecords = useMemo(() => {
    if (!trendIncidentType) {
      return dashboardIncidentRecords
    }

    return dashboardIncidentRecords.filter((record) => getDashboardIncidentType(record) === trendIncidentType)
  }, [dashboardIncidentRecords, trendIncidentType])

  const trendIncidentTypeLabel = trendIncidentType || 'All incident types'

  const incidentTrendData = useMemo(
    () =>
      buildDailyTrendForPeriod(
        trendRecords,
        Number(trendYear || new Date().getFullYear()),
      ),
    [trendRecords, trendYear],
  )

  const incidentTrendComparisonData = useMemo(
    () =>
      buildDailyTrendForPeriod(
        trendRecords,
        Number(trendCompareYear || Number(trendYear || new Date().getFullYear()) - 1),
      ),
    [trendRecords, trendCompareYear, trendYear],
  )

  const availableTrendYears = useMemo(() => {
    const years = new Set<number>()
    trendRecords.forEach((record) => years.add(getIncidentTimelineDate(record).getFullYear()))

    if (years.size === 0) {
      years.add(new Date().getFullYear())
    }

    return Array.from(years)
      .sort((left, right) => right - left)
      .map((year) => String(year))
  }, [trendRecords])

  useEffect(() => {
    if (!trendYear && availableTrendYears.length > 0) {
      setTrendYear(availableTrendYears[0])
    }
  }, [availableTrendYears, trendYear])

  // Years to compare with: every year with data plus the year before the chosen one, never the chosen year itself.
  const compareYearOptions = useMemo(() => {
    const chosen = trendYear || String(new Date().getFullYear())
    return Array.from(new Set([...availableTrendYears, String(Number(chosen) - 1)]))
      .filter((year) => year !== chosen)
      .sort((left, right) => Number(right) - Number(left))
  }, [availableTrendYears, trendYear])

  // Default to the year before; if the chosen year becomes the compare year, move the compare year back too.
  useEffect(() => {
    if (!trendYear) return
    if (!trendCompareYear || trendCompareYear === trendYear) {
      setTrendCompareYear(String(Number(trendYear) - 1))
    }
  }, [trendYear, trendCompareYear])

  const incidentTrendCurrentTotal = useMemo(
    () => incidentTrendData.reduce((sum, item) => sum + item.count, 0),
    [incidentTrendData],
  )

  const incidentTrendComparisonTotal = useMemo(
    () => incidentTrendComparisonData.reduce((sum, item) => sum + item.count, 0),
    [incidentTrendComparisonData],
  )

  const incidentTrendPercentChange = useMemo(
    () => calculateTrendPercentChange(incidentTrendCurrentTotal, incidentTrendComparisonTotal),
    [incidentTrendCurrentTotal, incidentTrendComparisonTotal],
  )

  const availableHotspotYears = useMemo(() => {
    const years = new Set<number>()

    dashboardIncidentRecords.forEach((record) => {
      years.add(getIncidentTimelineDate(record).getFullYear())
    })

    if (years.size === 0) {
      years.add(new Date().getFullYear())
    }

    return Array.from(years)
      .sort((left, right) => right - left)
      .map((year) => String(year))
  }, [dashboardIncidentRecords])

  useEffect(() => {
    if (availableHotspotYears.length === 0) return

    if (!distributionYear || (distributionYear !== ALL_YEARS && !availableHotspotYears.includes(distributionYear))) {
      setDistributionYear(availableHotspotYears[0])
    }
  }, [availableHotspotYears, distributionYear])

  const distributionRecords = useMemo(() => {
    return dashboardIncidentRecords
      .filter((record) => {
        if (!distributionYear || distributionYear === ALL_YEARS) return true
        return getIncidentTimelineDate(record).getFullYear() === Number(distributionYear)
      })
      .filter((record) => {
        if (!distributionBarangay) return true
        return getDashboardBarangay(record) === distributionBarangay
      })
  }, [dashboardIncidentRecords, distributionBarangay, distributionYear])

  // The same filters one year earlier, to show how each type changed. Not shown for "All years".
  const previousDistributionCounts = useMemo(() => {
    if (!distributionYear || distributionYear === ALL_YEARS) return undefined
    const previousYear = Number(distributionYear) - 1
    const counts = new Map<string, number>()
    dashboardIncidentRecords.forEach((record) => {
      if (getIncidentTimelineDate(record).getFullYear() !== previousYear) return
      if (distributionBarangay && getDashboardBarangay(record) !== distributionBarangay) return
      const type = getDashboardIncidentType(record)
      counts.set(type, (counts.get(type) || 0) + 1)
    })
    return counts
  }, [dashboardIncidentRecords, distributionBarangay, distributionYear])

  const availableDistributionBarangays = useMemo(() => {
    const items = dashboardIncidentRecords
      .filter((record) => {
        if (!distributionYear || distributionYear === ALL_YEARS) return true
        return getIncidentTimelineDate(record).getFullYear() === Number(distributionYear)
      })
      .filter((record) => !isPlaceholderLocation(getDashboardLocation(record)))
      .map((record) => getDashboardBarangay(record))

    // All 33 barangays, even those without incidents yet.
    return withAllBarangays(items)
  }, [dashboardIncidentRecords, distributionYear])

  useEffect(() => {
    if (!distributionBarangay) return
    if (!availableDistributionBarangays.includes(distributionBarangay)) {
      setDistributionBarangay('')
    }
  }, [availableDistributionBarangays, distributionBarangay])

  const incidentDistributionData = useMemo(
    () => buildCountData(distributionRecords, getDashboardIncidentType),
    [distributionRecords],
  )

  useEffect(() => {
    if (availableHotspotYears.length === 0) return

    if (!hotspotYear || (hotspotYear !== ALL_YEARS && !availableHotspotYears.includes(hotspotYear))) {
      setHotspotYear(availableHotspotYears[0])
    }
  }, [availableHotspotYears, hotspotYear])

  const hotspotRecords = useMemo(() => {
    return dashboardIncidentRecords
      .filter((record) => !isPlaceholderLocation(getDashboardLocation(record)))
      .filter((record) => {
        if (!hotspotYear || hotspotYear === ALL_YEARS) return true
        return getIncidentTimelineDate(record).getFullYear() === Number(hotspotYear)
      })
      .filter((record) => {
        if (!hotspotIncidentType) return true
        return getDashboardIncidentType(record) === hotspotIncidentType
      })
  }, [dashboardIncidentRecords, hotspotIncidentType, hotspotYear])

  // Same type filter one year earlier, for the change shown beside each barangay. Not for "All years".
  const previousHotspotCounts = useMemo(() => {
    if (!hotspotYear || hotspotYear === ALL_YEARS) return undefined
    const previousYear = Number(hotspotYear) - 1
    const counts = new Map<string, number>()
    dashboardIncidentRecords.forEach((record) => {
      if (isPlaceholderLocation(getDashboardLocation(record))) return
      if (getIncidentTimelineDate(record).getFullYear() !== previousYear) return
      if (hotspotIncidentType && getDashboardIncidentType(record) !== hotspotIncidentType) return
      const barangay = getDashboardBarangay(record)
      counts.set(barangay, (counts.get(barangay) || 0) + 1)
    })
    return counts
  }, [dashboardIncidentRecords, hotspotIncidentType, hotspotYear])

  const topBarangayData = useMemo(
    () =>
      buildCountData(
        hotspotRecords,
        getDashboardBarangay,
      ).slice(0, 5),
    [hotspotRecords],
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
            <section className="w-full px-3 pb-8 sm:px-6 lg:pb-10">
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

              <StrategicBriefingCard />

              <div className="mt-5 overflow-hidden rounded-[28px] border border-blue-100 bg-white p-4 shadow-[0_16px_38px_rgba(15,23,42,0.09)] sm:p-5">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">
                      Incident Trend
                    </p>
                    <h2 className="mt-1 text-lg font-bold text-slate-900 sm:text-xl">
                      Disaster Trend Analysis
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Compare monthly incident counts by year and optional incident type. Timeline uses incident occurrence date/time when available, with report created date as fallback.
                    </p>
                  </div>

                </div>

                <div className="mb-4 grid gap-3 sm:grid-cols-3">
                  <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Year
                    <select
                      className="mt-2 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900"
                      value={trendYear}
                      onChange={(event) => setTrendYear(event.target.value)}
                    >
                      {availableTrendYears.map((year) => (
                        <option key={year} value={year}>{year}</option>
                      ))}
                    </select>
                  </label>

                  <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Compare with Year
                    <select
                      className="mt-2 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900"
                      value={trendCompareYear}
                      onChange={(event) => setTrendCompareYear(event.target.value)}
                    >
                      {compareYearOptions.map((year) => (
                        <option key={`compare-${year}`} value={year}>{year}</option>
                      ))}
                    </select>
                  </label>

                  <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Incident Type
                    <select
                      className="mt-2 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900"
                      value={trendIncidentType}
                      onChange={(event) => setTrendIncidentType(event.target.value)}
                    >
                      <option value="">All incident types</option>
                      {availableTrendIncidentTypes.map((type) => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Viewing: {trendIncidentTypeLabel}
                </p>

                <div className="h-[300px] w-full sm:h-[340px] lg:h-[380px]">
                  <DashboardLineChart
                    data={incidentTrendData}
                    comparisonData={incidentTrendComparisonData}
                    currentYearLabel={trendYear || 'Current year'}
                    comparisonYearLabel={trendCompareYear || 'Comparison year'}
                    incidentTypeLabel={trendIncidentTypeLabel}
                  />
                </div>

                <div className="mt-5 grid gap-3 rounded-2xl border border-slate-100 bg-slate-50/80 p-3 text-center sm:grid-cols-3 sm:p-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-blue-600">Current period total</p>
                    <p className="mt-1 text-xl font-bold text-slate-900">{incidentTrendCurrentTotal}</p>
                    <p className="text-xs text-slate-500">{trendIncidentType ? `${trendIncidentType} reports` : 'reports'}</p>
                  </div>
                  <div className="sm:border-x sm:border-slate-200">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-blue-600">Comparison period total</p>
                    <p className="mt-1 text-xl font-bold text-slate-900">
                      {incidentTrendComparisonTotal}
                    </p>
                    <p className="text-xs text-slate-500">{trendIncidentType ? `${trendIncidentType} reports` : 'reports'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-blue-600">Percent change</p>
                    <p className="mt-1 text-xl font-bold text-slate-900">
                      {incidentTrendPercentChange === null
                        ? 'N/A'
                        : `${incidentTrendPercentChange > 0 ? '+' : ''}${incidentTrendPercentChange}%`}
                    </p>
                    <p className="text-xs text-slate-500">trend vs comparison year</p>
                  </div>
                </div>
              </div>

              <div className="mt-5 space-y-5">
                <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white p-4 shadow-[0_16px_38px_rgba(15,23,42,0.09)] sm:p-5">
                  <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">
                        Incident Distribution
                      </p>
                      <h2 className="mt-1 text-lg font-bold text-slate-900 sm:text-xl">
                        Reports by Incident Type
                      </h2>
                      <p className="mt-1 text-sm text-slate-500">
                        Which incident types make up the reports. Point at a type to highlight it.
                      </p>
                    </div>
                    <div className="grid w-full gap-3 sm:w-auto sm:grid-cols-2">
                      <label className="text-xs font-semibold text-slate-600">
                        Year
                        <select
                          className="mt-1.5 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 sm:w-44"
                          value={distributionYear}
                          onChange={(event) => setDistributionYear(event.target.value)}
                        >
                          {availableHotspotYears.map((year) => (
                            <option key={`distribution-year-${year}`} value={year}>{year}</option>
                          ))}
                          <option value={ALL_YEARS}>All years</option>
                        </select>
                      </label>
                      <label className="text-xs font-semibold text-slate-600">
                        Barangay
                        <select
                          className="mt-1.5 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 sm:w-56"
                          value={distributionBarangay}
                          onChange={(event) => setDistributionBarangay(event.target.value)}
                        >
                          <option value="">All barangays</option>
                          {availableDistributionBarangays.map((barangay) => (
                            <option key={`distribution-barangay-${barangay}`} value={barangay}>{barangay}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </div>
                  <div className="mt-5">
                    <DashboardDonutChart
                      data={incidentDistributionData}
                      previousCounts={previousDistributionCounts}
                      previousLabel={distributionYear && distributionYear !== ALL_YEARS ? String(Number(distributionYear) - 1) : undefined}
                      scopeLabel={`${distributionYear === ALL_YEARS ? 'across all years' : `in ${distributionYear}`}${
                        distributionBarangay ? `, ${distributionBarangay}` : ''
                      }`}
                    />
                  </div>
                </div>
                <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white p-4 shadow-[0_16px_38px_rgba(15,23,42,0.09)] sm:p-5">
                  <div className="flex flex-wrap items-end justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-500" aria-hidden="true">
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Barangay Hotspots</p>
                        <h2 className="mt-1 text-lg font-bold text-slate-900 sm:text-xl">Top 5 Barangays with Most Incidents</h2>
                        <p className="mt-1 text-sm text-slate-500">Where reports come from most. Pick a type to see its hotspots.</p>
                      </div>
                    </div>
                    <div className="grid w-full gap-3 sm:w-auto sm:grid-cols-2">
                      <label className="text-xs font-semibold text-slate-600">
                        Year
                        <select
                          className="mt-1.5 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 sm:w-44"
                          value={hotspotYear}
                          onChange={(event) => setHotspotYear(event.target.value)}
                        >
                          {availableHotspotYears.map((year) => (
                            <option key={`hotspot-year-${year}`} value={year}>{year}</option>
                          ))}
                          <option value={ALL_YEARS}>All years</option>
                        </select>
                      </label>
                      <label className="text-xs font-semibold text-slate-600">
                        Incident type
                        <select
                          className="mt-1.5 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 sm:w-56"
                          value={hotspotIncidentType}
                          onChange={(event) => setHotspotIncidentType(event.target.value)}
                        >
                          <option value="">All incident types</option>
                          {availableTrendIncidentTypes.map((type) => (
                            <option key={`hotspot-type-${type}`} value={type}>{type}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </div>
                  <div className="mt-5">
                    <DashboardBarChart
                      data={topBarangayData}
                      previousCounts={previousHotspotCounts}
                      previousLabel={hotspotYear && hotspotYear !== ALL_YEARS ? String(Number(hotspotYear) - 1) : undefined}
                      scopeLabel={`${hotspotIncidentType ? `${hotspotIncidentType} reports` : 'reports'} ${
                        hotspotYear === ALL_YEARS ? 'across all years' : `in ${hotspotYear}`
                      }`}
                      emptyMessage={`No ${hotspotIncidentType || 'incident'} reports ${
                        hotspotYear === ALL_YEARS ? 'yet' : `in ${hotspotYear}`
                      }.`}
                    />
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
              searchQuery={dashboardSearchQuery}
              onClearSearch={() => setDashboardSearchQuery('')}
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
            <RiskScoringSection />
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