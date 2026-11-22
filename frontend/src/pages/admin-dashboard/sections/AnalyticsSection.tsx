import { useEffect, useMemo, useState } from 'react'
import { jsPDF } from 'jspdf'
import type { HazardIncident, IncidentStatus } from '../../../data/adminOperations'
import type { EarthquakeEvent } from '../../../services/earthquakes'
import { glassPanelClass, glassPanelSoftClass } from './constants'
import { toLucenaBarangay, withAllBarangays } from '../../../data/barangays'
import { INCIDENT_TYPE_CONFIGS } from '../../../data/incidentTypeFields'
import { getResponsePerformance, type ResponsePerformanceResponse } from '../../../services/api'
import {
  ANALYTICS_TYPES,
  buildAllTypeInsights,
  countByTimeOfDay,
  countByWeekday,
  getAnalyticsTypeLabel,
  getIncidentToReportMinutes,
  getOccurredHour,
} from '../../../data/incidentCategories'
import {
  BarList,
  ChoroplethMap,
  DayHourGrid,
  HeatTable,
  Histogram,
  LineChart,
  ScatterPlot,
  ShareBar,
  ShareRows,
  SmallMultiples,
  SERIES_BLUE,
  SERIES_RED,
  STATUS_COLORS,
  normalizeBarangayKey,
  type BarItem,
  type BarangayFeature,
  type LineSeries,
  type MapValue,
  type ScatterPoint,
  type ShareSegment,
} from './analyticsCharts'
import { toTeamName } from '../../../data/teams'

type AnalyticsSectionProps = {
  reports: HazardIncident[]
  earthquakeEvents?: EarthquakeEvent[]
}

type ChartItem = {
  label: string
  value: number
  color?: string
  helper?: string
}

type RiskLocation = {
  location: string
  incidents: number
  score: number
  level: string
  responseLoad: number
  /** Incident count per analytics type label (Fire, Road Crash (RCA), ...). */
  typeCounts: Record<string, number>
  earthquake: number
  victims: number
  severityPressure: number
}

type TeamPerformanceItem = {
  team: string
  assignments: number
  resolvedCount: number
  withResponseTimeCount: number
  averageResponseMinutes: number
  medianResponseMinutes: number | null
  onTimeRate: number
  resolutionRate: number
  performanceScore: number
}

type TrendPoint = {
  label: string
  reports: number
  earthquakes: number
}

type FrequencyMode = 'monthly' | 'yearly' | 'daily'

function emptyRiskLocation(location: string): RiskLocation {
  return { location, incidents: 0, score: 0, level: 'Low', responseLoad: 0, typeCounts: {}, earthquake: 0, victims: 0, severityPressure: 0 }
}

function hexToRgb(hex: string | undefined): [number, number, number] {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex || '')
  if (!match) return [37, 99, 235]
  const value = parseInt(match[1], 16)
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

// Reference palette slots, in order, for parts-of-a-whole bars (colors follow the option's position).
const SHARE_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300']
const EARTHQUAKE_COLOR = '#008300'

// Same rules as backend/analytics/performance.py.
const ON_TIME_MINUTES = 30

function getPerformanceScore(averageMinutes: number | null, onTimeRate: number, resolutionRate: number): number {
  if (averageMinutes === null) return resolutionRate
  const speed = averageMinutes <= 15 ? 100 : averageMinutes >= 120 ? 0 : (100 * (120 - averageMinutes)) / 105
  return (speed * 40 + onTimeRate * 20 + resolutionRate * 40) / 100
}

function getSeverityWeight(severity: HazardIncident['severity']): number {
  switch (severity) {
    case 'Critical':
      return 4
    case 'High':
      return 3
    case 'Moderate':
      return 2
    case 'Low':
      return 1
    default:
      return 1
  }
}

function getEarthquakeSeverity(magnitude: number): HazardIncident['severity'] {
  if (magnitude >= 5) return 'Critical'
  if (magnitude >= 4) return 'High'
  if (magnitude >= 3) return 'Moderate'
  return 'Low'
}

function getRiskLabel(score: number): string {
  if (score >= 75) return 'Critical'
  if (score >= 55) return 'High'
  if (score >= 30) return 'Moderate'
  return 'Low'
}

function getRiskTone(score: number): string {
  if (score >= 75) return 'border-red-100 bg-red-50 text-red-700'
  if (score >= 55) return 'border-orange-100 bg-orange-50 text-orange-700'
  if (score >= 30) return 'border-amber-100 bg-amber-50 text-amber-700'
  return 'border-emerald-100 bg-emerald-50 text-emerald-700'
}

function getPriorityLabel(score: number): string {
  if (score >= 12) return 'Immediate Action'
  if (score >= 8) return 'High Attention'
  if (score >= 4) return 'Monitor Closely'
  return 'Routine Watch'
}

function percent(value: number, total: number): number {
  if (total === 0) return 0
  return Math.round((value / total) * 100)
}

function safeMax(values: number[]): number {
  return Math.max(...values, 1)
}

function sanitizeExportFilename(value: string): string {
  return value.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'all'
}

function getLocationName(location: string): string {
  if (!location || location.trim() === '-' || location.trim().toLowerCase() === 'n/a') {
    return 'Unspecified Location'
  }

  // One of the 33 barangays, even when the location starts with a landmark.
  const barangay = toLucenaBarangay(location)
  if (barangay) return barangay

  const barangayMatch = location.match(/(?:barangay|brgy\.?|bgy\.?)\s+([^,]+)/i)

  if (barangayMatch?.[1]) {
    const name = barangayMatch[1].replace(/\s*\(pob\.\)\s*/i, '').trim()
    return `Barangay ${name}`
  }

  const knownLocations: Array<[string, string]> = [
    ['gulang-gulang', 'Barangay Gulang-Gulang'],
    ['gulang gulang', 'Barangay Gulang-Gulang'],
    ['dalahican', 'Barangay Dalahican'],
    ['ibabang dupay', 'Barangay Ibabang Dupay'],
    ['ilayang dupay', 'Barangay Ilayang Dupay'],
    ['ilayang iyam', 'Barangay Ilayang Iyam'],
    ['ibabang iyam', 'Barangay Ibabang Iyam'],
    ['cotta', 'Barangay Cotta'],
    ['bocohan', 'Barangay Bocohan'],
    ['mayao', 'Barangay Mayao'],
    ['isabang', 'Barangay Isabang'],
    ['market view', 'Barangay Market View'],
    ['city proper', 'Lucena City Proper'],
    ['pacific mall', 'Pacific Mall Area'],
    ['sm city lucena', 'SM City Lucena Area'],
    ['grand central', 'Grand Terminal Area'],
  ]

  const lower = location.toLowerCase()
  const matched = knownLocations.find(([key]) => lower.includes(key))
  if (matched) return matched[1]

  const parts = location
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part && !/lucena city/i.test(part))

  return parts[0] || location
}

/** The report's barangay: its saved barangay if it has one, otherwise read from the location. */
function getReportBarangay(report: HazardIncident): string {
  return toLucenaBarangay((report as HazardIncident & { barangayName?: string | null }).barangayName) ?? getLocationName(report.location)
}

function getReportDate(report: HazardIncident): Date {
  const raw =
    (report as any).createdAt ||
    (report as any).created_at ||
    (report as any).date_reported ||
    (report as any).updatedAt ||
    (report as any).updated_at

  const parsed = raw ? new Date(raw) : new Date()
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed
}

function getEarthquakeEventDate(event: EarthquakeEvent): Date {
  const parsed = new Date(event.rawTimestamp)
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed
}

function getNumberField(record: unknown, keys: string[]): number | null {
  const source = record as Record<string, unknown>

  for (const key of keys) {
    const raw = source?.[key]
    const value = Number(raw)

    if (Number.isFinite(value)) return value
  }

  return null
}

function getTextField(record: unknown, keys: string[]): string {
  const source = record as Record<string, unknown>

  for (const key of keys) {
    const value = source?.[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  }

  return ''
}

function parseDateValue(value: unknown): Date | null {
  if (!value) return null

  const parsed = new Date(String(value))
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function getResponseTeamName(report: HazardIncident): string {
  const value = getTextField(report, [
    'responseTeam',
    'responderTeam',
    'responder_team',
    'team_name',
    'teamName',
    'response_team',
    'responder_username',
    'responder',
  ])

  return toTeamName(value) || 'Unassigned team'
}

function getReportStartDateTime(report: HazardIncident): Date | null {
  return parseDateValue(
    getTextField(report, [
      'reported_at',
      'createdAt',
      'created_at',
      'date_reported',
      'incident_datetime',
      'incidentDateTime',
      'timeOccurred',
      'time_occurred',
    ]),
  )
}

function getReportEndDateTime(report: HazardIncident): Date | null {
  return parseDateValue(
    getTextField(report, [
      'resolvedAt',
      'resolved_at',
      'approvedAt',
      'approved_at',
      'completedAt',
      'completed_at',
      'arrivedAt',
      'arrived_at',
      'response_completed_at',
      'updatedAt',
      'updated_at',
    ]),
  )
}

function getResponseMinutes(report: HazardIncident): number | null {
  const direct = getNumberField(report, [
    'responseTimeMinutes',
    'response_time_minutes',
    'responseMinutes',
    'response_minutes',
    'arrival_minutes',
    'response_duration',
  ])

  if (direct !== null && direct >= 0) return Math.round(direct)

  const start = getReportStartDateTime(report)
  const end = getReportEndDateTime(report)
  if (start && end) {
    const minutes = Math.round((end.getTime() - start.getTime()) / (1000 * 60))
    if (minutes >= 0) return minutes
  }

  // Responder reports have no completion timestamp; use the time from when the
  // incident happened to when the responder filed the report.
  return getIncidentToReportMinutes(report)
}

function normalizeAnalyticsStatus(status: unknown): IncidentStatus {
  const value = String(status || '').trim().toLowerCase()

  if (value.includes('approve') || value.includes('verified') || value === 'approved') return 'approved'
  if (value.includes('resolve') || value.includes('complete') || value.includes('closed') || value === 'resolved') return 'resolved'
  if (value.includes('active') || value.includes('ongoing') || value.includes('on-going') || value === 'active') return 'active'
  if (value.includes('pending') || value === 'pending') return 'pending'
  return 'pending'
}

function getReportStatus(report: HazardIncident): IncidentStatus {
  return normalizeAnalyticsStatus((report as any).status || (report as any).review_status || (report as any).operationalStatus)
}

function getDisplayReportStatus(report: HazardIncident): 'active' | 'pending' | 'resolved' {
  // Approved responder reports carry the status of the incident they created.
  const linked = String((report as any).linkedIncidentStatus || '').toLowerCase()
  if (linked) {
    if (['resolved', 'contained', 'false_alarm'].includes(linked)) return 'resolved'
    if (linked === 'reported') return 'pending'
    return 'active'
  }

  const status = getReportStatus(report)

  // UI rule for analytics: backend Approved reports are already completed/validated,
  // so they should be counted and displayed as Resolved in the status overview.
  if (status === 'approved') return 'resolved'

  return status
}

function getReportVictimCount(report: HazardIncident): number {
  const victims = (report as any).victims
  const directValue = getNumberField(report, [
    'victimCount',
    'victim_count',
    'totalVictims',
    'total_victims',
    'casualties',
    'affected_count',
    'affected',
    'injured',
    'deaths',
    'missing',
    'displaced',
    'victimCountByType',
  ])

  if (directValue !== null && directValue > 0) return Math.max(0, directValue)
  if (Array.isArray(victims) && victims.length > 0) return victims.length
  if (typeof (report as any).people_affected === 'number') return Math.max(0, (report as any).people_affected)
  if (typeof (report as any).number_of_persons === 'number') return Math.max(0, (report as any).number_of_persons)

  return 0
}

function AnalyticsMetricCard({
  label,
  value,
  helper,
  accentClass,
}: {
  label: string
  value: string | number
  helper: string
  accentClass: string
}) {
  return (
    <article
      className={`${glassPanelSoftClass} group relative overflow-hidden border-t-[7px] ${accentClass} p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(15,23,42,0.12)]`}
    >
      <div className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full bg-blue-500/10 opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100" />

      <div className="relative z-10">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
          {label}
        </p>
        <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
          {value}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          {helper}
        </p>
      </div>
    </article>
  )
}

function SectionHeader({
  eyebrow,
  title,
  description,
  badge,
}: {
  eyebrow: string
  title: string
  description: string
  badge?: string
}) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div className="max-w-2xl">
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400">
          {eyebrow}
        </p>
        <h3 className="mt-1 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
          {title}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          {description}
        </p>
      </div>

      {badge ? (
        <span className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-blue-700">
          {badge}
        </span>
      ) : null}
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex min-h-[240px] items-center justify-center rounded-[24px] border border-dashed border-slate-200 bg-slate-50 text-center text-sm font-semibold text-slate-500">
      {message}
    </div>
  )
}

function getAnalyticsRecordKey(report: HazardIncident): string {
  const record = report as any

  return String(
    record.incident_reference_code_readonly ||
      record.reference_code ||
      record.referenceCode ||
      record.reportCode ||
      record.report_code ||
      record.incidentCode ||
      record.incident_code ||
      record.incidentId ||
      record.incident_id ||
      record.id ||
      `${record.title || ''}-${record.location || ''}-${record.time || ''}`,
  )
}

function getUniqueAnalyticsReports(reports: HazardIncident[]): HazardIncident[] {
  const unique = new Map<string, HazardIncident>()

  reports.forEach((report) => {
    const key = getAnalyticsRecordKey(report)

    if (!unique.has(key)) {
      unique.set(key, report)
    }
  })

  return Array.from(unique.values())
}



export function AnalyticsSection({ reports, earthquakeEvents = [] }: AnalyticsSectionProps) {
  const analyticsReports = useMemo(() => getUniqueAnalyticsReports(reports), [reports])

  const [selectedYear, setSelectedYear] = useState<string | null>(null)
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null)
  const [selectedBarangay, setSelectedBarangay] = useState<string | null>(null)
  const [selectedDisasterType, setSelectedDisasterType] = useState<string | null>(null)
  const [selectedSeverity, setSelectedSeverity] = useState<HazardIncident['severity'] | null>(null)
  const [frequencyMode, setFrequencyMode] = useState<FrequencyMode>('monthly')

  const filteredEarthquakeEvents = useMemo(() => {
    let result = earthquakeEvents

    if (selectedYear) {
      result = result.filter((event) => getEarthquakeEventDate(event).getFullYear().toString() === selectedYear)
    }

    if (selectedMonth && selectedYear) {
      result = result.filter((event) => {
        const date = getEarthquakeEventDate(event)
        return (
          date.getFullYear().toString() === selectedYear &&
          (date.getMonth() + 1).toString().padStart(2, '0') === selectedMonth
        )
      })
    }

    return result
  }, [earthquakeEvents, selectedYear, selectedMonth])

  const availableYears = useMemo(() => {
    const years = new Set<string>()

    analyticsReports.forEach((report) => {
      const date = getReportDate(report)
      years.add(date.getFullYear().toString())
    })

    filteredEarthquakeEvents.forEach((event) => {
      const date = getEarthquakeEventDate(event)
      years.add(date.getFullYear().toString())
    })

    return Array.from(years).sort((a, b) => Number(b) - Number(a))
  }, [analyticsReports, earthquakeEvents, selectedYear, selectedMonth])

  const availableMonths = useMemo(() => {
    if (!selectedYear) return []
    const months = new Set<string>()

    analyticsReports.forEach((report) => {
      const date = getReportDate(report)
      if (date.getFullYear().toString() === selectedYear) {
        months.add((date.getMonth() + 1).toString().padStart(2, '0'))
      }
    })

    filteredEarthquakeEvents.forEach((event) => {
      const date = getEarthquakeEventDate(event)
      if (date.getFullYear().toString() === selectedYear) {
        months.add((date.getMonth() + 1).toString().padStart(2, '0'))
      }
    })

    return Array.from(months)
      .sort()
      .reverse()
  }, [analyticsReports, earthquakeEvents, selectedYear])

  const availableBarangays = useMemo(
    // All 33 barangays, even those without reports yet.
    () => withAllBarangays(analyticsReports.map((report) => getReportBarangay(report))),
    [analyticsReports],
  )

  const availableDisasterTypes = useMemo(
    () => {
      const present = new Set(analyticsReports.map((report) => getAnalyticsTypeLabel(report)))
      if (earthquakeEvents.length > 0) present.add('Earthquake')
      return ANALYTICS_TYPES.map((type) => type.label).filter((label) => present.has(label))
    },
    [analyticsReports, earthquakeEvents],
  )

  // Filters other than the date, so the KPI cards can compare with the period before.
  const nonDateFilteredReports = useMemo(() => {
    let result = analyticsReports

    if (selectedBarangay) {
      result = result.filter((report) => getReportBarangay(report) === selectedBarangay)
    }

    if (selectedDisasterType) {
      result = result.filter((report) => getAnalyticsTypeLabel(report) === selectedDisasterType)
    }

    if (selectedSeverity) {
      result = result.filter((report) => report.severity === selectedSeverity)
    }

    return result
  }, [analyticsReports, selectedBarangay, selectedDisasterType, selectedSeverity])

  const filteredReports = useMemo(() => {
    if (!selectedYear) return nonDateFilteredReports

    return nonDateFilteredReports.filter((report) => {
      const date = getReportDate(report)
      if (date.getFullYear().toString() !== selectedYear) return false
      return !selectedMonth || (date.getMonth() + 1).toString().padStart(2, '0') === selectedMonth
    })
  }, [nonDateFilteredReports, selectedMonth, selectedYear])

  // The same filters on the period before: previous month, previous year, or the 30 days before the last 30.
  const periodComparison = useMemo(() => {
    const countBetween = (start: Date, end: Date) =>
      nonDateFilteredReports.filter((report) => {
        const time = getReportDate(report).getTime()
        return time >= start.getTime() && time < end.getTime()
      }).length

    if (selectedYear && selectedMonth) {
      const year = Number(selectedYear)
      const month = Number(selectedMonth) - 1
      const previousStart = new Date(year, month - 1, 1)
      return {
        current: countBetween(new Date(year, month, 1), new Date(year, month + 1, 1)),
        previous: countBetween(previousStart, new Date(year, month, 1)),
        label: previousStart.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
      }
    }

    if (selectedYear) {
      const year = Number(selectedYear)
      return {
        current: countBetween(new Date(year, 0, 1), new Date(year + 1, 0, 1)),
        previous: countBetween(new Date(year - 1, 0, 1), new Date(year, 0, 1)),
        label: String(year - 1),
      }
    }

    const now = new Date()
    const day = 24 * 60 * 60 * 1000
    return {
      current: countBetween(new Date(now.getTime() - 30 * day), new Date(now.getTime() + day)),
      previous: countBetween(new Date(now.getTime() - 60 * day), new Date(now.getTime() - 30 * day)),
      label: 'the 30 days before',
      recent: true,
    }
  }, [nonDateFilteredReports, selectedMonth, selectedYear])

  const periodChangeText = (() => {
    const { current, previous, label } = periodComparison
    const prefix = 'recent' in periodComparison ? `Last 30 days: ${current}. ` : ''
    if (previous === 0) return `${prefix}${current > 0 ? `No reports in ${label} to compare with.` : 'No reports to compare.'}`
    const change = Math.round(((current - previous) / previous) * 100)
    if (change === 0) return `${prefix}Same as ${label} (${previous}).`
    return `${prefix}${change > 0 ? '▲' : '▼'} ${Math.abs(change)}% vs ${label} (${previous}).`
  })()

  const analysisEarthquakeEvents = useMemo(() => {
    if (selectedBarangay || (selectedDisasterType && selectedDisasterType !== 'Earthquake')) return []
    if (!selectedSeverity) return filteredEarthquakeEvents
    return filteredEarthquakeEvents.filter((event) => getEarthquakeSeverity(event.magnitude) === selectedSeverity)
  }, [filteredEarthquakeEvents, selectedBarangay, selectedDisasterType, selectedSeverity])

  const incidentTrendData = useMemo<TrendPoint[]>(() => {
    const daily = frequencyMode === 'daily' && Boolean(selectedYear && selectedMonth)
    const yearly = frequencyMode === 'yearly'
    const buckets = new Map<string, { date: Date; reports: number; earthquakes: number }>()

    const getBucket = (date: Date) => {
      const key = yearly
        ? `${date.getFullYear()}`
        : daily
        ? `${date.getFullYear()}-${date.getMonth().toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`
        : `${date.getFullYear()}-${date.getMonth().toString().padStart(2, '0')}`
      const existing = buckets.get(key)

      if (existing) return existing

      const bucket = { date: new Date(date.getFullYear(), yearly ? 0 : date.getMonth(), daily ? date.getDate() : 1), reports: 0, earthquakes: 0 }
      buckets.set(key, bucket)
      return bucket
    }

    filteredReports.forEach((report) => {
      getBucket(getReportDate(report)).reports += 1
    })

    analysisEarthquakeEvents.forEach((event) => {
      getBucket(getEarthquakeEventDate(event)).earthquakes += 1
    })

    return Array.from(buckets.values())
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .map((point) => ({
        ...point,
        label: yearly
          ? point.date.toLocaleDateString(undefined, { year: 'numeric' })
          : daily
          ? point.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
          : point.date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' }),
      }))
  }, [analysisEarthquakeEvents, filteredReports, frequencyMode, selectedMonth, selectedYear])

  const totalIncidentReports = filteredReports.length
  const earthquakeApiCount = analysisEarthquakeEvents.length
  const totalRecords = totalIncidentReports + earthquakeApiCount

  const activeCount = filteredReports.filter((report) => getDisplayReportStatus(report) === 'active').length

  const typeCounts = useMemo(() => {
    const counts = new Map<string, number>()
    filteredReports.forEach((report) => {
      const label = getAnalyticsTypeLabel(report)
      counts.set(label, (counts.get(label) || 0) + 1)
    })
    return counts
  }, [filteredReports])

  const earthquakeReportCount = typeCounts.get('Earthquake') || 0
  const earthquakeTotalCount = earthquakeReportCount + earthquakeApiCount

  const highPriorityCount = filteredReports.filter(
    (report) => report.severity === 'High' || report.severity === 'Critical',
  ).length

  const activeRate = percent(activeCount, totalIncidentReports)

  const averageSeverity =
    totalIncidentReports > 0
      ? filteredReports.reduce((total, report) => total + getSeverityWeight(report.severity), 0) /
        totalIncidentReports
      : 0

  const recentEarthquake30Days = analysisEarthquakeEvents.filter(
    (event) => getEarthquakeEventDate(event).getTime() >= Date.now() - 30 * 24 * 60 * 60 * 1000,
  ).length

  const significantEarthquakes = analysisEarthquakeEvents.filter((event) => event.magnitude >= 4).length
  const maxEarthquakeMagnitude = analysisEarthquakeEvents.reduce((max, event) => Math.max(max, event.magnitude), 0)
  const averageEarthquakeMagnitude =
    analysisEarthquakeEvents.length > 0
      ? analysisEarthquakeEvents.reduce((sum, event) => sum + event.magnitude, 0) / analysisEarthquakeEvents.length
      : 0

  const totalVictimCount = filteredReports.reduce((sum, report) => sum + getReportVictimCount(report), 0)
  const recentIncidentCount = filteredReports.filter((report) => {
    const date = getReportDate(report)
    return date.getTime() >= Date.now() - 30 * 24 * 60 * 60 * 1000
  }).length

  const riskScore = Math.min(
    100,
    Math.round(
      activeRate * 0.25 +
        percent(highPriorityCount, Math.max(totalIncidentReports, 1)) * 0.25 +
        Math.min(totalVictimCount * 2, 20) +
        Math.min(recentIncidentCount * 2, 20) +
        averageSeverity * 5 +
        Math.min(recentEarthquake30Days * 1.25, 12) +
        Math.min(significantEarthquakes * 2.5, 15),
    ),
  )

  const disasterTypeData = useMemo<ChartItem[]>(
    () =>
      ANALYTICS_TYPES.map((type) => ({
        label: type.label,
        value: type.key === 'earthquake' ? earthquakeTotalCount : typeCounts.get(type.label) || 0,
        color: type.color,
      }))
        .filter((item) => item.value > 0)
        .sort((a, b) => b.value - a.value),
    [earthquakeTotalCount, typeCounts],
  )

  const detailInsights = useMemo(() => buildAllTypeInsights(filteredReports), [filteredReports])
  const [insightTypeChoice, setInsightTypeChoice] = useState<string | null>(null)
  const activeInsights =
    detailInsights.find((item) => item.label === (selectedDisasterType || insightTypeChoice)) || detailInsights[0] || null

  const timeOfDayData = useMemo<ChartItem[]>(
    () => countByTimeOfDay(filteredReports).map((item, index) => ({ ...item, color: ['#6366f1', '#f59e0b', '#f97316', '#1e3a8a'][index] })),
    [filteredReports],
  )
  const weekdayData = useMemo<ChartItem[]>(
    () => countByWeekday(filteredReports, getReportDate).map((item) => ({ ...item, color: '#0ea5e9' })),
    [filteredReports],
  )

  const severityData = useMemo<ChartItem[]>(
    () => (['Critical', 'High', 'Moderate', 'Low'] as const).map((severity) => {
      const value = filteredReports.filter((report) => report.severity === severity).length
      return {
        label: severity,
        value,
        helper: `${percent(value, totalIncidentReports)}% of filtered incident reports`,
        color:
          severity === 'Critical'
            ? '#dc2626'
            : severity === 'High'
              ? '#f97316'
              : severity === 'Moderate'
                ? '#f59e0b'
                : '#10b981',
      }
    }),
    [filteredReports, totalIncidentReports],
  )

  // Team performance comes from the backend (analytics/performance.py) with the same filters.
  // When the server cannot be reached, the same rules are applied in the browser instead.
  const [serverPerformance, setServerPerformance] = useState<ResponsePerformanceResponse | null>(null)
  const [performanceSource, setPerformanceSource] = useState<'loading' | 'server' | 'browser'>('loading')

  useEffect(() => {
    // Earthquake and Other have no responder teams on the server side.
    const config = selectedDisasterType ? INCIDENT_TYPE_CONFIGS.find((item) => item.label === selectedDisasterType) : null
    if (selectedDisasterType && !config) {
      setServerPerformance(null)
      setPerformanceSource('browser')
      return
    }

    let cancelled = false
    setPerformanceSource('loading')
    getResponsePerformance({
      year: selectedYear || undefined,
      month: selectedMonth || undefined,
      barangay: selectedBarangay || undefined,
      incidentTypes: config ? [config.incidentType] : undefined,
      severity: selectedSeverity || undefined,
    })
      .then((data) => {
        if (cancelled) return
        setServerPerformance(data)
        setPerformanceSource('server')
      })
      .catch((error) => {
        if (cancelled) return
        console.warn('[AnalyticsSection] Team performance API unavailable, using browser calculation.', error)
        setServerPerformance(null)
        setPerformanceSource('browser')
      })

    return () => {
      cancelled = true
    }
  }, [selectedBarangay, selectedDisasterType, selectedMonth, selectedSeverity, selectedYear])

  const localTeamPerformanceData = useMemo<TeamPerformanceItem[]>(() => {
    const bucket = new Map<string, { assignments: number; resolvedCount: number; minutes: number[] }>()

    filteredReports.forEach((report) => {
      const team = getResponseTeamName(report)
      const current = bucket.get(team) || { assignments: 0, resolvedCount: 0, minutes: [] }
      current.assignments += 1
      if (getDisplayReportStatus(report) === 'resolved') current.resolvedCount += 1
      const minutes = getResponseMinutes(report)
      if (minutes !== null) current.minutes.push(minutes)
      bucket.set(team, current)
    })

    return Array.from(bucket.entries())
      .map(([team, summary]) => {
        const measured = summary.minutes.length
        const average = measured > 0 ? summary.minutes.reduce((total, value) => total + value, 0) / measured : null
        const sorted = [...summary.minutes].sort((a, b) => a - b)
        const middle = Math.floor(sorted.length / 2)
        const median = measured === 0 ? null : measured % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
        const resolutionRate = percent(summary.resolvedCount, summary.assignments)
        const onTimeRate = percent(summary.minutes.filter((value) => value <= ON_TIME_MINUTES).length, measured)

        return {
          team,
          assignments: summary.assignments,
          resolvedCount: summary.resolvedCount,
          withResponseTimeCount: measured,
          averageResponseMinutes: average === null ? 0 : Math.round(average),
          medianResponseMinutes: median === null ? null : Math.round(median),
          onTimeRate,
          resolutionRate,
          performanceScore: Math.round(getPerformanceScore(average, onTimeRate, resolutionRate)),
        }
      })
      .sort((a, b) => b.performanceScore - a.performanceScore || b.assignments - a.assignments)
  }, [filteredReports])

  const teamPerformanceData = useMemo<TeamPerformanceItem[]>(() => {
    if (performanceSource !== 'server' || !serverPerformance) return localTeamPerformanceData.slice(0, 8)

    return serverPerformance.teams.slice(0, 8).map((team) => ({
      team: team.team,
      assignments: team.assignments,
      resolvedCount: team.resolved,
      withResponseTimeCount: team.measured,
      averageResponseMinutes: Math.round(team.average_minutes ?? 0),
      medianResponseMinutes: team.median_minutes === null ? null : Math.round(team.median_minutes),
      onTimeRate: Math.round(team.on_time_rate),
      resolutionRate: Math.round(team.resolution_rate),
      performanceScore: Math.round(team.score),
    }))
  }, [localTeamPerformanceData, performanceSource, serverPerformance])

  const teamPerformanceChartData = useMemo<ChartItem[]>(
    () =>
      teamPerformanceData.map((item) => ({
        label: item.team,
        value: item.performanceScore,
        helper: `${item.resolutionRate}% resolved • ${item.withResponseTimeCount > 0 ? `${item.onTimeRate}% within ${ON_TIME_MINUTES} min` : 'no timed reports'} • ${item.assignments} reports`,
        color:
          item.performanceScore >= 80
            ? '#16a34a'
            : item.performanceScore >= 60
              ? '#f59e0b'
              : '#dc2626',
      })),
    [teamPerformanceData],
  )

  const teamPerformanceSummary = useMemo(() => {
    const top = teamPerformanceData[0]

    if (performanceSource === 'server' && serverPerformance) {
      const overall = serverPerformance.overall
      return {
        topTeam: top?.team || 'N/A',
        topScore: top?.performanceScore ?? 0,
        overallAvgResponse: overall.average_minutes === null ? null : Math.round(overall.average_minutes),
        overallMedianResponse: overall.median_minutes === null ? null : Math.round(overall.median_minutes),
        overallOnTimeRate: Math.round(overall.on_time_rate),
        overallResolutionRate: Math.round(overall.resolution_rate),
        measured: overall.measured,
        assignments: overall.assignments,
      }
    }

    const allMinutes = filteredReports
      .map((report) => getResponseMinutes(report))
      .filter((minutes): minutes is number => minutes !== null)
      .sort((a, b) => a - b)
    const middle = Math.floor(allMinutes.length / 2)
    const resolved = filteredReports.filter((report) => getDisplayReportStatus(report) === 'resolved').length

    return {
      topTeam: top?.team || 'N/A',
      topScore: top?.performanceScore ?? 0,
      overallAvgResponse: allMinutes.length ? Math.round(allMinutes.reduce((a, b) => a + b, 0) / allMinutes.length) : null,
      overallMedianResponse: allMinutes.length
        ? Math.round(allMinutes.length % 2 ? allMinutes[middle] : (allMinutes[middle - 1] + allMinutes[middle]) / 2)
        : null,
      overallOnTimeRate: percent(allMinutes.filter((minutes) => minutes <= ON_TIME_MINUTES).length, allMinutes.length),
      overallResolutionRate: percent(resolved, filteredReports.length),
      measured: allMinutes.length,
      assignments: filteredReports.length,
    }
  }, [filteredReports, performanceSource, serverPerformance, teamPerformanceData])

  // Speed and resolution per severity level (server only; it knows the linked incident's severity).
  const severityPerformanceData = useMemo<ChartItem[]>(() => {
    if (performanceSource !== 'server' || !serverPerformance) return []
    const colors: Record<string, string> = { critical: '#dc2626', high: '#f97316', moderate: '#f59e0b', low: '#10b981' }
    return serverPerformance.by_severity
      .filter((item) => item.severity !== 'unknown')
      .map((item) => ({
        label: item.severity.charAt(0).toUpperCase() + item.severity.slice(1),
        value: Math.round(item.resolution_rate),
        helper: `${item.assignments} reports • ${item.average_minutes === null ? 'no timed reports' : `${Math.round(item.average_minutes)} min avg response`}`,
        color: colors[item.severity] || '#64748b',
      }))
  }, [performanceSource, serverPerformance])

  const barangayRiskData = useMemo(() => {
    const map = new Map<string, RiskLocation>()

    filteredReports.forEach((report) => {
      const location = getReportBarangay(report)
      const current = map.get(location) || emptyRiskLocation(location)

      const severityScore = getSeverityWeight(report.severity) * 2
      const displayStatus = getDisplayReportStatus(report)
      const statusScore = displayStatus === 'active' ? 3 : displayStatus === 'pending' ? 2 : 0
      const earthquakeExposureScore = getAnalyticsTypeLabel(report) === 'Earthquake' ? 2 : 0

      current.incidents += 1
      current.score += severityScore + statusScore + earthquakeExposureScore
      current.responseLoad += displayStatus === 'resolved' ? 1 : 2
      current.severityPressure += severityScore

      const typeLabel = getAnalyticsTypeLabel(report)
      if (typeLabel === 'Earthquake') current.earthquake += 1
      else current.typeCounts[typeLabel] = (current.typeCounts[typeLabel] || 0) + 1
      current.victims += getReportVictimCount(report)

      map.set(location, current)
    })

    // Process all earthquake events without artificial limits to ensure comprehensive risk assessment
    analysisEarthquakeEvents.forEach((event) => {
      const location = event.place || 'Near Quezon Region'
      const current = map.get(location) || emptyRiskLocation(location)

      const magnitudeScore = event.magnitude >= 5 ? 8 : event.magnitude >= 4 ? 5 : event.magnitude >= 3 ? 3 : 1

      current.incidents += 1
      current.score += magnitudeScore
      current.responseLoad += event.magnitude >= 4 ? 2 : 1
      current.earthquake += 1
      current.severityPressure += magnitudeScore

      map.set(location, current)
    })

    return [...map.values()]
      .map((item) => ({
        ...item,
        level: getPriorityLabel(item.score),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
  }, [analysisEarthquakeEvents, filteredReports])

  const earthquakeAnalytics = useMemo(() => {
    const magnitudeDistribution: ChartItem[] = [
      {
        label: 'Magnitude 1.0 - 2.9',
        value: analysisEarthquakeEvents.filter((event) => event.magnitude < 3).length,
        color: '#86efac',
        helper: 'Low intensity tremors',
      },
      {
        label: 'Magnitude 3.0 - 3.9',
        value: analysisEarthquakeEvents.filter((event) => event.magnitude >= 3 && event.magnitude < 4).length,
        color: '#22c55e',
        helper: 'Felt but usually minor',
      },
      {
        label: 'Magnitude 4.0 - 4.9',
        value: analysisEarthquakeEvents.filter((event) => event.magnitude >= 4 && event.magnitude < 5).length,
        color: '#f59e0b',
        helper: 'Moderate shaking watch',
      },
      {
        label: 'Magnitude 5.0+',
        value: analysisEarthquakeEvents.filter((event) => event.magnitude >= 5).length,
        color: '#ef4444',
        helper: 'High impact monitoring',
      },
    ]

    const hotspotMap = new Map<string, number>()

    analysisEarthquakeEvents.forEach((event) => {
      const location = event.place || 'Near Quezon Region'
      hotspotMap.set(location, (hotspotMap.get(location) || 0) + 1)
    })

    const hotspots = [...hotspotMap.entries()]
      .map(([label, value]) => ({
        label,
        value,
        color: '#10b981',
        helper: 'USGS API earthquake events',
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)

    return {
      total: earthquakeApiCount,
      active: recentEarthquake30Days,
      high: significantEarthquakes,
      averageMagnitude: averageEarthquakeMagnitude.toFixed(1),
      maxMagnitude: maxEarthquakeMagnitude.toFixed(1),
      magnitudeDistribution,
      hotspots,
    }
  }, [
    averageEarthquakeMagnitude,
    earthquakeApiCount,
    analysisEarthquakeEvents,
    maxEarthquakeMagnitude,
    recentEarthquake30Days,
    significantEarthquakes,
  ])


  // Reports per period for each incident type, with empty periods filled in so lines do not skip gaps.
  const typeTrend = useMemo(() => {
    const daily = frequencyMode === 'daily' && Boolean(selectedYear && selectedMonth)
    const yearly = frequencyMode === 'yearly'
    const startOf = (date: Date) =>
      new Date(date.getFullYear(), yearly ? 0 : date.getMonth(), daily ? date.getDate() : 1)
    const step = (date: Date) =>
      new Date(date.getFullYear() + (yearly ? 1 : 0), date.getMonth() + (!yearly && !daily ? 1 : 0), date.getDate() + (daily ? 1 : 0))

    const dates = [
      ...filteredReports.map((report) => getReportDate(report)),
      ...analysisEarthquakeEvents.map((event) => getEarthquakeEventDate(event)),
    ]
    if (dates.length === 0) return { periods: [] as string[], total: [] as number[], earthquakes: [] as number[], byType: [] as LineSeries[] }

    let first = startOf(new Date(Math.min(...dates.map((date) => date.getTime()))))
    let last = startOf(new Date(Math.max(...dates.map((date) => date.getTime()))))
    if (selectedYear && !yearly) {
      // Show the whole selected year (or month) even when the first or last periods are empty.
      first = selectedMonth && daily ? new Date(Number(selectedYear), Number(selectedMonth) - 1, 1) : selectedMonth ? first : new Date(Number(selectedYear), 0, 1)
      if (!selectedMonth) last = new Date(Math.min(new Date(Number(selectedYear), 11, 1).getTime(), startOf(new Date()).getTime()))
      if (selectedMonth && daily) last = new Date(Math.min(new Date(Number(selectedYear), Number(selectedMonth), 0).getTime(), startOf(new Date()).getTime()))
    }

    const keys: number[] = []
    for (let cursor = first; cursor.getTime() <= last.getTime() && keys.length < 400; cursor = step(cursor)) keys.push(cursor.getTime())
    const index = new Map(keys.map((key, position) => [key, position]))

    const total = keys.map(() => 0)
    const earthquakes = keys.map(() => 0)
    const perType = new Map<string, number[]>()

    filteredReports.forEach((report) => {
      const position = index.get(startOf(getReportDate(report)).getTime())
      if (position === undefined) return
      total[position] += 1
      const label = getAnalyticsTypeLabel(report)
      const values = perType.get(label) || keys.map(() => 0)
      values[position] += 1
      perType.set(label, values)
    })
    analysisEarthquakeEvents.forEach((event) => {
      const position = index.get(startOf(getEarthquakeEventDate(event)).getTime())
      if (position !== undefined) earthquakes[position] += 1
    })

    const periods = keys.map((key) => {
      const date = new Date(key)
      return yearly
        ? String(date.getFullYear())
        : daily
          ? date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
          : `${date.toLocaleDateString(undefined, { month: 'short' })} '${String(date.getFullYear()).slice(2)}`
    })

    const byType = ANALYTICS_TYPES.filter((type) => perType.has(type.label)).map((type) => ({
      label: type.label,
      color: type.color,
      values: perType.get(type.label)!,
    }))

    return { periods, total, earthquakes, byType }
  }, [analysisEarthquakeEvents, filteredReports, frequencyMode, selectedMonth, selectedYear])

  const trendPeak = useMemo(() => {
    const peak = Math.max(0, ...typeTrend.total)
    return peak > 0 ? { value: peak, period: typeTrend.periods[typeTrend.total.indexOf(peak)] } : null
  }, [typeTrend])

  // counts[day][hour], day 0 = Monday; hour = when the incident occurred.
  const dayHourCounts = useMemo(() => {
    const counts = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0))
    filteredReports.forEach((report) => {
      const hour = getOccurredHour(report)
      if (hour === null) return
      const day = (getReportDate(report).getDay() + 6) % 7
      counts[day][hour] += 1
    })
    return counts
  }, [filteredReports])

  // Headline for the day × hour grid, read from the same counts the grid draws.
  // Ties are named instead of silently picking the first day or hour.
  const busiestSlot = useMemo(() => {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    const shortDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    const hourText = (hour: number) => new Date(2026, 0, 1, hour).toLocaleTimeString(undefined, { hour: 'numeric' })
    const hourRange = (hour: number) => `${hourText(hour)}–${hourText((hour + 1) % 24)}`
    const incidents = (count: number) => `${count} ${count === 1 ? 'incident' : 'incidents'}`

    const dayTotals = dayHourCounts.map((hours) => hours.reduce((sum, value) => sum + value, 0))
    const hourTotals = Array.from({ length: 24 }, (_, hour) => dayHourCounts.reduce((sum, hours) => sum + hours[hour], 0))
    const dayMax = Math.max(0, ...dayTotals)
    const hourMax = Math.max(0, ...hourTotals)
    const cellMax = Math.max(0, ...dayHourCounts.flat())
    if (cellMax === 0) return null

    const topDays = dayTotals.flatMap((total, index) => (total === dayMax ? [index] : []))
    const topHours = hourTotals.flatMap((total, index) => (total === hourMax ? [index] : []))
    const topCells = dayHourCounts.flatMap((hours, day) => hours.flatMap((value, hour) => (value === cellMax ? [{ day, hour }] : [])))

    const dayPart =
      topDays.length === 1
        ? `${days[topDays[0]]} is the busiest day (${dayMax})`
        : topDays.length === 2
          ? `${days[topDays[0]]} and ${days[topDays[1]]} tie as the busiest days (${dayMax} each)`
          : `${topDays.length} days tie as the busiest (${dayMax} each)`
    const hourPart =
      topHours.length === 1
        ? `${hourRange(topHours[0])} is the busiest hour (${hourMax})`
        : topHours.length === 2
          ? `${hourRange(topHours[0])} and ${hourRange(topHours[1])} tie as the busiest hours (${hourMax} each)`
          : `${topHours.length} hours tie as the busiest (${hourMax} each)`

    // Same rule as the grid's outline: only when a few squares stand out.
    const standsOut = cellMax >= 2 && topCells.length <= 3
    const peakNote = !standsOut
      ? `No single hour stands out: at most ${incidents(cellMax)} in any one hour.`
      : topCells.length === 1
        ? `The single busiest hour (outlined) was ${days[topCells[0].day]}, ${hourRange(topCells[0].hour)}, with ${incidents(cellMax)}.`
        : `The busiest single hours (outlined) were ${topCells.map(({ day, hour }) => `${shortDays[day]} ${hourRange(hour)}`).join(', ')}, with ${incidents(cellMax)} each.`

    return { title: `${dayPart}; ${hourPart}`, peakNote, topDays, topHours }
  }, [dayHourCounts])

  // Barangay boundaries for the map (public/lucena_barangays.geojson).
  const [barangayFeatures, setBarangayFeatures] = useState<BarangayFeature[]>([])
  const [mapStatus, setMapStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    let cancelled = false
    fetch('/lucena_barangays.geojson')
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`))))
      .then((data: { features?: BarangayFeature[] }) => {
        if (cancelled) return
        setBarangayFeatures((data.features || []).filter((feature) => feature.geometry))
        setMapStatus('ready')
      })
      .catch((error) => {
        if (cancelled) return
        console.warn('[AnalyticsSection] Barangay boundaries unavailable.', error)
        setMapStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Incidents per barangay, keyed like the map's barangay names.
  const barangayStats = useMemo(() => {
    const stats = new Map<string, { name: string; incidents: number; victims: number; highPriority: number; types: Map<string, number> }>()
    filteredReports.forEach((report) => {
      const name = getReportBarangay(report)
      const key = normalizeBarangayKey(name)
      if (!key || key === 'unspecifiedlocation') return
      const current = stats.get(key) || { name, incidents: 0, victims: 0, highPriority: 0, types: new Map<string, number>() }
      current.incidents += 1
      current.victims += getReportVictimCount(report)
      if (report.severity === 'High' || report.severity === 'Critical') current.highPriority += 1
      const type = getAnalyticsTypeLabel(report)
      current.types.set(type, (current.types.get(type) || 0) + 1)
      stats.set(key, current)
    })
    return stats
  }, [filteredReports])

  const barangayMapValues = useMemo(() => {
    const values = new Map<string, MapValue>()
    barangayStats.forEach((item, key) => {
      const topType = Array.from(item.types.entries()).sort((a, b) => b[1] - a[1])[0]
      values.set(key, {
        value: item.incidents,
        rows: [
          { label: 'incidents', value: item.incidents.toLocaleString(), color: SERIES_RED },
          { label: 'high or critical', value: item.highPriority.toLocaleString() },
          { label: 'victims', value: item.victims.toLocaleString() },
          ...(topType ? [{ label: `most: ${topType[0]}`, value: topType[1].toLocaleString() }] : []),
        ],
      })
    })
    return values
  }, [barangayStats])

  const barangayRanking = useMemo<BarItem[]>(
    () =>
      Array.from(barangayStats.values())
        .sort((a, b) => b.incidents - a.incidents || a.name.localeCompare(b.name))
        .map((item) => ({ label: item.name, value: item.incidents, note: `${item.highPriority} high or critical · ${item.victims} victims` })),
    [barangayStats],
  )

  const selectedBarangayKey = selectedBarangay ? normalizeBarangayKey(selectedBarangay) : null

  function handleMapSelect(key: string): void {
    const match = availableBarangays.find((name) => normalizeBarangayKey(name) === key)
    if (!match) return
    setSelectedBarangay((current) => (current === match ? null : match))
  }

  // Top barangays × incident types.
  const barangayTypeTable = useMemo(() => {
    const columns = ANALYTICS_TYPES.filter((type) =>
      Array.from(barangayStats.values()).some((item) => item.types.has(type.label)),
    )
    const top = Array.from(barangayStats.values())
      .sort((a, b) => b.incidents - a.incidents || a.name.localeCompare(b.name))
      .slice(0, 10)
    return {
      rows: top.map((item) => item.name),
      columns: columns.map((type) => ({ label: type.label, color: type.color })),
      cells: top.map((item) => columns.map((type) => item.types.get(type.label) || 0)),
      shown: top.length,
      total: barangayStats.size,
    }
  }, [barangayStats])

  const incidentTypeBars = useMemo<BarItem[]>(
    () => disasterTypeData.filter((item) => item.label !== 'Earthquake').map((item) => ({ label: item.label, value: item.value, color: item.color })),
    [disasterTypeData],
  )

  const severitySegments = useMemo<ShareSegment[]>(() => {
    const count = (severity: HazardIncident['severity']) => filteredReports.filter((report) => report.severity === severity).length
    return [
      { label: 'Critical', value: count('Critical'), color: STATUS_COLORS.critical },
      { label: 'High', value: count('High'), color: STATUS_COLORS.serious },
      { label: 'Moderate', value: count('Moderate'), color: STATUS_COLORS.warning, textColor: '#0b0b0b' },
      { label: 'Low', value: count('Low'), color: STATUS_COLORS.good },
    ]
  }, [filteredReports])

  const severityByType = useMemo(() => {
    const levels: Array<HazardIncident['severity']> = ['Critical', 'High', 'Moderate', 'Low']
    return incidentTypeBars.map((type) => {
      const reportsOfType = filteredReports.filter((report) => getAnalyticsTypeLabel(report) === type.label)
      return {
        label: type.label,
        segments: levels.map((level, index) => ({
          label: level,
          value: reportsOfType.filter((report) => report.severity === level).length,
          color: severitySegments[index].color,
        })),
      }
    })
  }, [filteredReports, incidentTypeBars, severitySegments])

  const teamScatterPoints = useMemo<ScatterPoint[]>(
    () =>
      teamPerformanceData
        .filter((item) => item.withResponseTimeCount > 0)
        .map((item) => ({
          label: item.team,
          x: item.averageResponseMinutes,
          y: item.resolutionRate,
          size: item.assignments,
          rows: [
            { label: 'avg response', value: `${item.averageResponseMinutes} min`, color: SERIES_BLUE },
            { label: 'resolved', value: `${item.resolutionRate}%` },
            { label: `within ${ON_TIME_MINUTES} min`, value: `${item.onTimeRate}%` },
            { label: 'reports', value: String(item.assignments) },
            { label: 'score', value: `${item.performanceScore}/100` },
          ],
        })),
    [teamPerformanceData],
  )

  const handleExport = () => {
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const margin = 14
    const contentWidth = pageWidth - margin * 2
    let cursorY = 18

    const filterValue = (value: string | null, fallback: string) => value || fallback
    const filters = [
      ['Month', filterValue(selectedMonth, 'All months')],
      ['Year', filterValue(selectedYear, 'All years')],
      ['Barangay', filterValue(selectedBarangay, 'All barangays')],
      ['Disaster Type', filterValue(selectedDisasterType, 'All disaster types')],
      ['Severity Level', filterValue(selectedSeverity, 'All severity levels')],
    ]

    const ensureSpace = (height: number) => {
      if (cursorY + height > pageHeight - 18) {
        pdf.addPage()
        cursorY = 18
      }
    }

    const text = (value: string, size = 8.5, color: [number, number, number] = [51, 65, 85], bold = false) => {
      pdf.setFont('helvetica', bold ? 'bold' : 'normal')
      pdf.setFontSize(size)
      pdf.setTextColor(...color)
      const lines = pdf.splitTextToSize(value, contentWidth)
      ensureSpace(lines.length * 4.2 + 2)
      pdf.text(lines, margin, cursorY)
      cursorY += lines.length * 4.2 + 2
    }

    const section = (title: string, description?: string) => {
      ensureSpace(description ? 17 : 12)
      pdf.setFillColor(15, 23, 42)
      pdf.roundedRect(margin, cursorY - 4, contentWidth, 9, 2, 2, 'F')
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(12)
      pdf.setTextColor(255, 255, 255)
      pdf.text(title, margin + 4, cursorY + 2)
      cursorY += 11
      if (description) text(description, 8, [71, 85, 105])
    }

    const table = (headers: string[], rows: string[][], widths: number[]) => {
      const rowPadding = 3
      const rowHeight = (cells: string[], size = 7.5) => {
        pdf.setFontSize(size)
        return Math.max(...cells.map((cell, index) => pdf.splitTextToSize(cell, widths[index] - rowPadding * 2).length), 1) * 3.8 + rowPadding * 2
      }

      const drawHeader = () => {
        const height = 9
        ensureSpace(height)
        let x = margin
        pdf.setFillColor(226, 232, 240)
        pdf.rect(margin, cursorY, contentWidth, height, 'F')
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(7.5)
        pdf.setTextColor(30, 41, 59)
        headers.forEach((header, index) => {
          pdf.text(header, x + rowPadding, cursorY + 5.8)
          x += widths[index]
        })
        cursorY += height
      }

      drawHeader()
      rows.forEach((cells, rowIndex) => {
        const height = rowHeight(cells)
        if (cursorY + height > pageHeight - 18) {
          pdf.addPage()
          cursorY = 18
          drawHeader()
        }
        if (rowIndex % 2 === 0) {
          pdf.setFillColor(248, 250, 252)
          pdf.rect(margin, cursorY, contentWidth, height, 'F')
        }
        let x = margin
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(7.5)
        pdf.setTextColor(51, 65, 85)
        cells.forEach((cell, index) => {
          const lines = pdf.splitTextToSize(cell, widths[index] - rowPadding * 2)
          pdf.text(lines, x + rowPadding, cursorY + 4.8)
          x += widths[index]
        })
        cursorY += height
      })
      cursorY += 5
    }

    const barChart = (items: Array<{ label: string; value: number; color?: string }>, total: number) => {
      const chartHeight = Math.max(18, items.length * 10 + 5)
      ensureSpace(chartHeight)
      const labelWidth = 48
      const barWidth = contentWidth - labelWidth - 22
      const maxValue = safeMax(items.map((item) => item.value))
      items.forEach((item) => {
        const y = cursorY
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(7.5)
        pdf.setTextColor(51, 65, 85)
        pdf.text(item.label.slice(0, 26), margin, y + 4)
        pdf.setFillColor(226, 232, 240)
        pdf.roundedRect(margin + labelWidth, y, barWidth, 5, 1.5, 1.5, 'F')
        pdf.setFillColor(...hexToRgb(item.color))
        pdf.roundedRect(margin + labelWidth, y, Math.max(item.value > 0 ? 2 : 0, (item.value / maxValue) * barWidth), 5, 1.5, 1.5, 'F')
        pdf.text(`${item.value} (${percent(item.value, total)}%)`, margin + labelWidth + barWidth + 4, y + 4)
        cursorY += 10
      })
      cursorY += 3
    }

    const trendChart = () => {
      if (incidentTrendData.length === 0) {
        text('No frequency data is available for the selected filters.', 8, [100, 116, 139])
        return
      }
      const chartTop = cursorY
      const chartHeight = 48
      const chartWidth = contentWidth - 12
      const maxValue = safeMax(incidentTrendData.flatMap((point) => [point.reports, point.earthquakes]))
      ensureSpace(chartHeight + 14)
      pdf.setDrawColor(203, 213, 225)
      pdf.line(margin + 6, chartTop, margin + 6, chartTop + chartHeight)
      pdf.line(margin + 6, chartTop + chartHeight, margin + chartWidth, chartTop + chartHeight)
      const pointX = (index: number) => margin + 6 + (incidentTrendData.length > 1 ? (index / (incidentTrendData.length - 1)) * (chartWidth - 6) : (chartWidth - 6) / 2)
      const pointY = (value: number) => chartTop + chartHeight - (value / maxValue) * chartHeight
      const drawSeries = (color: [number, number, number], values: number[]) => {
        pdf.setDrawColor(...color)
        pdf.setFillColor(...color)
        values.forEach((value, index) => {
          const x = pointX(index)
          const y = pointY(value)
          if (index > 0) pdf.line(pointX(index - 1), pointY(values[index - 1]), x, y)
          pdf.circle(x, y, 1.2, 'F')
        })
      }
      drawSeries([37, 99, 235], incidentTrendData.map((point) => point.reports))
      drawSeries([16, 185, 129], incidentTrendData.map((point) => point.earthquakes))
      pdf.setFontSize(7)
      pdf.setTextColor(71, 85, 105)
      incidentTrendData.forEach((point, index) => {
        if (index % Math.max(1, Math.ceil(incidentTrendData.length / 7)) === 0 || index === incidentTrendData.length - 1) {
          pdf.text(point.label, pointX(index), chartTop + chartHeight + 7, { align: 'center' })
        }
      })
      cursorY = chartTop + chartHeight + 13
      text('Blue: incident reports. Green: live earthquake events.', 7.5, [100, 116, 139])
    }

    pdf.setFillColor(15, 23, 42)
    pdf.rect(0, 0, pageWidth, 34, 'F')
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(19)
    pdf.setTextColor(255, 255, 255)
    pdf.text('DRRMO Analytics Report', margin, 15)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    pdf.text('Lucena City Disaster Risk Reduction and Management Office', margin, 22)
    pdf.text(`Generated ${new Date().toLocaleString()}`, margin, 28)
    cursorY = 45

    section('Applied Filters', 'Every section and value in this report reflects the selected filters.')
    table(['Filter', 'Applied value'], filters, [45, contentWidth - 45])

    section('1. Executive Summary', 'Headline measures for the filtered analytics scope.')
    table(
      ['Metric', 'Value', 'Interpretation'],
      [
        ['Total records', String(totalRecords), 'Incident reports plus scoped live earthquake events'],
        ['Incident reports', String(totalIncidentReports), 'Filtered system incident records'],
        ['Live earthquake events', String(earthquakeApiCount), 'Scoped API events'],
        ['High priority', String(highPriorityCount), 'High and Critical incident reports'],
        ['Total victims', String(totalVictimCount), 'Victim count available in filtered reports'],
        ['Overall risk score', `${riskScore}%`, `${getRiskLabel(riskScore)} monitoring level`],
      ],
      [45, 25, contentWidth - 70],
    )

    section('2. Barangay Summary', 'Location totals and current highest-risk locations.')
    barChart(barangayRiskData.map((item) => ({ label: item.location, value: item.incidents, color: '#3b82f6' })), totalIncidentReports)
    table(
      ['Location', 'Incidents', 'Risk score', 'Priority'],
      barangayRiskData.map((item) => [item.location, String(item.incidents), String(item.score), item.level]),
      [68, 28, 28, contentWidth - 124],
    )

    section('3. Disaster Type Summary', 'Distribution of disaster types in the filtered record set.')
    barChart(disasterTypeData, totalRecords)
    table(['Disaster type', 'Count', 'Share'], disasterTypeData.map((item) => [item.label, String(item.value), `${percent(item.value, totalRecords)}%`]), [75, 35, contentWidth - 110])

    section('4. Severity Level Summary', 'Severity percentages use: severity count / filtered incident reports x 100.')
    barChart(severityData, totalIncidentReports)
    table(['Severity', 'Count', 'Percentage'], severityData.map((item) => [item.label, String(item.value), `${percent(item.value, totalIncidentReports)}%`]), [75, 35, contentWidth - 110])

    section('5. Incident Frequency', `Frequency view: ${frequencyMode}. This shows how often records occur within the selected time scope.`)
    trendChart()
    table(['Period', 'Incident reports', 'Live earthquakes'], incidentTrendData.map((point) => [point.label, String(point.reports), String(point.earthquakes)]), [80, 50, contentWidth - 130])

    section('6. Disaster Trends', 'Earthquake magnitude distribution and monitored hotspot activity from the filtered live feed.')
    barChart(earthquakeAnalytics.magnitudeDistribution, earthquakeAnalytics.total)
    table(['Magnitude band', 'Events', 'Meaning'], earthquakeAnalytics.magnitudeDistribution.map((item) => [item.label, String(item.value), item.helper || '']), [60, 28, contentWidth - 88])
    table(['Earthquake hotspot', 'Events'], earthquakeAnalytics.hotspots.map((item) => [item.label, String(item.value)]), [contentWidth - 35, 35])

    section('7. Predictive Analytics', 'Calculated monitoring indicators based only on the filtered incident and earthquake data.')
    table(
      ['Indicator', 'Value', 'Context'],
      [
        ['Overall risk score', `${riskScore}%`, `${getRiskLabel(riskScore)} monitoring level`],
        ['Average incident severity', averageSeverity.toFixed(2), 'Weighted Low=1, Moderate=2, High=3, Critical=4'],
        ['Recent incident reports', String(recentIncidentCount), 'Reports in the recent monitoring window'],
        ['Significant earthquakes', String(significantEarthquakes), 'Magnitude 4.0 and above'],
        ['Highest-risk location', barangayRiskData[0]?.location || 'No matching location', 'Top current composite risk score'],
      ],
      [55, 38, contentWidth - 93],
    )

    section(
      '8. Emergency Response Performance',
      `Response time = minutes from the incident to the filed report; on time = within ${ON_TIME_MINUTES} minutes. Score = speed 40% + on-time 20% + resolved 40%.`,
    )
    table(
      ['Team', 'Reports', 'Resolved', 'Avg response', 'On time', 'Score'],
      teamPerformanceData.map((item) => [
        item.team,
        String(item.assignments),
        `${item.resolutionRate}%`,
        item.withResponseTimeCount > 0 ? `${item.averageResponseMinutes} min` : 'N/A',
        item.withResponseTimeCount > 0 ? `${item.onTimeRate}%` : 'N/A',
        `${item.performanceScore}/100`,
      ]),
      [50, 22, 24, 30, 24, contentWidth - 150],
    )
    barChart(teamPerformanceChartData, 100)

    section('9. Incident Details Insights', 'Type-specific figures from the details saved on each responder report.')
    if (detailInsights.length === 0) {
      text('No incident details are available for the selected filters.', 8, [100, 116, 139])
    }
    detailInsights.forEach((insight) => {
      text(`${insight.label} (${insight.reports} reports, ${insight.withDetails} with details)`, 9.5, [15, 23, 42], true)
      table(
        ['Measure', 'Value', 'Notes'],
        [
          ...insight.kpis.map((kpi) => [kpi.label, kpi.value, kpi.helper]),
          ...insight.charts
            .filter((chart) => chart.items.length > 0)
            .map((chart) => [
              chart.title,
              chart.items[0].label,
              chart.items.slice(0, 3).map((item) => `${item.label}: ${item.value}`).join(', '),
            ]),
        ],
        [50, 45, contentWidth - 95],
      )
    })

    section('10. When Incidents Happen', 'Time of day uses the time the incident occurred; day of week uses the report date.')
    table(
      ['Time of day', 'Incidents', 'Share'],
      timeOfDayData.map((item) => [item.label, String(item.value), `${percent(item.value, totalIncidentReports)}%`]),
      [75, 35, contentWidth - 110],
    )
    table(
      ['Day of week', 'Incidents', 'Share'],
      weekdayData.map((item) => [item.label, String(item.value), `${percent(item.value, totalIncidentReports)}%`]),
      [75, 35, contentWidth - 110],
    )

    section('Filtered Incident Records', 'Detailed records included in this report.')
    table(
      ['Date', 'Type', 'Severity', 'Barangay', 'Report'],
      filteredReports.length > 0
        ? filteredReports.map((report) => [getReportDate(report).toLocaleDateString(), getAnalyticsTypeLabel(report), report.severity, getReportBarangay(report), report.title])
        : [['-', '-', '-', '-', 'No incident reports match the selected filters.']],
      [25, 30, 28, 48, contentWidth - 131],
    )

    const pageCount = pdf.getNumberOfPages()
    for (let page = 1; page <= pageCount; page += 1) {
      pdf.setPage(page)
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(7)
      pdf.setTextColor(100, 116, 139)
      pdf.text(`DRRMO Analytics Report | Page ${page} of ${pageCount}`, margin, pageHeight - 8)
    }

    pdf.save(`analytics-report-${sanitizeExportFilename(selectedYear || 'all-years')}.pdf`)
  }

  return (
    <section className="w-full px-3 pb-8 pt-2 sm:px-6 lg:pb-10">
      <div className="space-y-6">
        <div className={`${glassPanelClass} overflow-hidden p-5 sm:p-6`}>
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-blue-600">
                Analytics Page
              </p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                DRRMO Analytics and Monitoring
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                View incident reports and earthquake data with easy-to-read charts and maps. Monitor 
                incident trends, disaster types, earthquake activity, 
                response performance, barangay risk levels, evacuation readiness, heat maps, future 
                risk estimates, and incident severity.
              </p>
            </div>

            <div className="flex shrink-0 flex-col items-stretch gap-3 lg:items-end">
              <button
                type="button"
                onClick={handleExport}
                className="order-first rounded-2xl border border-blue-200 bg-blue-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Export Filtered Report
              </button>
              <div className={`rounded-[24px] border px-5 py-4 ${getRiskTone(riskScore)}`}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em]">
                  Overall Risk Score
                </p>
                <p className="mt-1 text-4xl font-semibold">{riskScore}%</p>
                <p className="text-xs font-bold">{getRiskLabel(riskScore)} monitoring level</p>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-4 lg:items-end">
            <div className="flex flex-col gap-2">
              <label htmlFor="year-select" className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-600">
                Filter by Year
              </label>
              <select
                id="year-select"
                value={selectedYear ?? ''}
                onChange={(e) => {
                  setSelectedYear(e.target.value || null)
                  setSelectedMonth(null)
                }}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 transition hover:border-slate-400"
              >
                <option value="">All Years</option>
                {availableYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>

            {selectedYear && availableMonths.length > 0 && (
              <div className="flex flex-col gap-2">
                <label htmlFor="month-select" className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-600">
                  Filter by Month
                </label>
                <select
                  id="month-select"
                  value={selectedMonth ?? ''}
                  onChange={(e) => setSelectedMonth(e.target.value || null)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 transition hover:border-slate-400"
                >
                  <option value="">All Months in {selectedYear}</option>
                  {availableMonths.map((month) => {
                    const monthNum = parseInt(month, 10)
                    const monthName = new Date(2026, monthNum - 1).toLocaleString('default', { month: 'long' })
                    return (
                      <option key={month} value={month}>
                        {monthName}
                      </option>
                    )
                  })}
                </select>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <label htmlFor="barangay-select" className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-600">
                Filter by Barangay
              </label>
              <select
                id="barangay-select"
                value={selectedBarangay ?? ''}
                onChange={(e) => setSelectedBarangay(e.target.value || null)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 transition hover:border-slate-400"
              >
                <option value="">All Barangays</option>
                {availableBarangays.map((barangay) => <option key={barangay} value={barangay}>{barangay}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="disaster-type-select" className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-600">
                Filter by Disaster Type
              </label>
              <select
                id="disaster-type-select"
                value={selectedDisasterType ?? ''}
                onChange={(e) => setSelectedDisasterType(e.target.value || null)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 transition hover:border-slate-400"
              >
                <option value="">All Disaster Types</option>
                {availableDisasterTypes.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="severity-select" className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-600">
                Filter by Severity
              </label>
              <select
                id="severity-select"
                value={selectedSeverity ?? ''}
                onChange={(e) => setSelectedSeverity((e.target.value || null) as HazardIncident['severity'] | null)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 transition hover:border-slate-400"
              >
                <option value="">All Severity Levels</option>
                {(['Critical', 'High', 'Moderate', 'Low'] as const).map((severity) => (
                  <option key={severity} value={severity}>{severity}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="frequency-select" className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-600">
                Frequency View
              </label>
              <select
                id="frequency-select"
                value={frequencyMode}
                onChange={(e) => {
                  const nextMode = e.target.value as FrequencyMode
                  setFrequencyMode(nextMode)
                  if (nextMode === 'yearly') setSelectedMonth(null)
                }}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 transition hover:border-slate-400"
              >
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
                {selectedYear && selectedMonth ? <option value="daily">Daily for selected month</option> : null}
              </select>
            </div>

            {(selectedYear || selectedMonth || selectedBarangay || selectedDisasterType || selectedSeverity) && (
              <button
                type="button"
                onClick={() => {
                  setSelectedYear(null)
                  setSelectedMonth(null)
                  setSelectedBarangay(null)
                  setSelectedDisasterType(null)
                  setSelectedSeverity(null)
                  setFrequencyMode('monthly')
                }}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Clear Filters
              </button>
            )}

            {selectedYear || selectedMonth || selectedBarangay || selectedDisasterType || selectedSeverity ? (
              <p className="text-sm font-medium text-slate-600">
                Showing{selectedYear ? ` ${selectedYear}` : ''}
                {selectedMonth ? ` - ${new Date(2026, parseInt(selectedMonth, 10) - 1).toLocaleString('default', { month: 'long' })}` : ''}
                {selectedBarangay ? ` • ${selectedBarangay}` : ''}
                {selectedDisasterType ? ` • ${selectedDisasterType}` : ''}
                {selectedSeverity ? ` • ${selectedSeverity}` : ''}
              </p>
            ) : null}
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <AnalyticsMetricCard
              accentClass="border-t-blue-600"
              helper={periodChangeText}
              label="Incident Reports"
              value={totalIncidentReports}
            />
            <AnalyticsMetricCard
              accentClass="border-t-red-600"
              helper={`Persons recorded as victims in ${totalIncidentReports.toLocaleString()} reports.`}
              label="Victims"
              value={totalVictimCount.toLocaleString()}
            />
            <AnalyticsMetricCard
              accentClass="border-t-orange-600"
              helper={
                teamPerformanceSummary.overallMedianResponse === null
                  ? 'No timed reports in this view.'
                  : `Incident to filed report • median ${teamPerformanceSummary.overallMedianResponse} min.`
              }
              label="Avg Response Time"
              value={teamPerformanceSummary.overallAvgResponse === null ? 'N/A' : `${teamPerformanceSummary.overallAvgResponse} min`}
            />
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <div className={`${glassPanelClass} p-5 sm:p-6`}>
            <SectionHeader
              badge="What"
              description="Incident reports per type for the current filters. Earthquakes are counted in their own section below."
              eyebrow="Incident Types"
              title={
                incidentTypeBars[0]
                  ? `${incidentTypeBars[0].label} is the most reported incident (${percent(incidentTypeBars[0].value, totalIncidentReports)}%)`
                  : 'Incident types'
              }
            />
            <BarList emptyText="No incident reports for these filters." items={incidentTypeBars} valueLabel="reports" />
          </div>

          <div className={`${glassPanelClass} p-5 sm:p-6`}>
            <SectionHeader
              badge="How serious"
              description="Share of incident reports at each severity level, from the linked incident."
              eyebrow="Severity"
              title={
                totalIncidentReports > 0
                  ? `${percent(highPriorityCount, totalIncidentReports)}% of incidents are High or Critical`
                  : 'Incident severity'
              }
            />
            <ShareBar emptyText="No incident reports for these filters." segments={severitySegments} />
            <p className="mt-3 text-xs leading-relaxed text-slate-500">
              Average severity {averageSeverity.toFixed(1)} on a 1 (Low) to 4 (Critical) scale.
            </p>
            {severityByType.length > 1 ? (
              <div className="mt-5">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Severity mix by incident type</p>
                <ShareRows
                  legend={severitySegments.map((segment) => ({ label: segment.label, color: segment.color }))}
                  rows={severityByType}
                />
              </div>
            ) : null}
          </div>
        </div>

        <div className={`${glassPanelClass} p-5 sm:p-6`}>
          <SectionHeader
            badge={frequencyMode === 'daily' && selectedYear && selectedMonth ? 'Daily' : frequencyMode === 'yearly' ? 'Yearly' : 'Monthly'}
            description="Total incident reports per period, then one small chart per incident type on the same scale so they can be compared. Change the period with Frequency View above."
            eyebrow="Incidents Over Time"
            title={trendPeak ? `Reports peaked in ${trendPeak.period} (${trendPeak.value})` : 'Incidents over time'}
          />
          <LineChart
            emptyText="No incident reports for these filters."
            periods={typeTrend.periods}
            series={[{ label: 'Incident reports', color: SERIES_BLUE, values: typeTrend.total }]}
          />
          {typeTrend.byType.length > 1 ? (
            <div className="mt-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">By incident type</p>
              <SmallMultiples periods={typeTrend.periods} series={typeTrend.byType} />
            </div>
          ) : null}
        </div>

        <div className={`${glassPanelClass} p-5 sm:p-6`}>
          <SectionHeader
            badge="When"
            description={`${busiestSlot ? `${busiestSlot.peakNote} ` : ''}Each square is one hour of one weekday: yellow-green for few incidents, through yellow and orange, to red for the most. The busiest day and hour totals are shown in red. Use it to plan responder shifts and stand-by teams.`}
            eyebrow="Incident Timing"
            title={busiestSlot ? busiestSlot.title : 'When incidents happen'}
          />
          <DayHourGrid counts={dayHourCounts} />
        </div>

        <div className={`${glassPanelClass} p-5 sm:p-6`}>
          <SectionHeader
            badge="Where"
            description="Yellow-green barangays had few incident reports; red ones had the most. Hover for details; click a barangay to filter the whole page to it (click again to clear)."
            eyebrow="Barangay Risk Map"
            title={barangayRanking[0] ? `${barangayRanking[0].label} has the most incidents (${barangayRanking[0].value})` : 'Where incidents happen'}
          />
          <div className="mx-auto max-w-4xl">
              {mapStatus === 'loading' ? (
                <EmptyState message="Loading barangay map..." />
              ) : mapStatus === 'error' || barangayFeatures.length === 0 ? (
                <EmptyState message="The barangay map could not be loaded. The table below still shows incidents per barangay." />
              ) : (
                <ChoroplethMap
                  features={barangayFeatures}
                  metricLabel="Incident reports"
                  onSelect={handleMapSelect}
                  selectedKey={selectedBarangayKey}
                  values={barangayMapValues}
                />
              )}
          </div>
        </div>

        <div className={`${glassPanelClass} p-5 sm:p-6`}>
          <SectionHeader
            badge={barangayTypeTable.total > barangayTypeTable.shown ? `Top ${barangayTypeTable.shown} of ${barangayTypeTable.total}` : 'Barangay × type'}
            description="Reports for each barangay and incident type. Yellow-green means few reports and red means the most, so you can see which hazard each barangay needs to prepare for."
            eyebrow="Barangay Risk Analysis"
            title="Incident types by barangay"
          />
          <HeatTable
            cells={barangayTypeTable.cells}
            columns={barangayTypeTable.columns}
            emptyText="No barangay data for these filters."
            rowLabel="Barangay"
            rows={barangayTypeTable.rows}
          />
        </div>

        <div className={`${glassPanelClass} p-5 sm:p-6`}>
          <SectionHeader
            badge={activeInsights ? `${activeInsights.withDetails} of ${activeInsights.reports} with details` : 'Report details'}
            description="Breaks down the details responders fill in for each incident type, like vehicle types and causes of road crashes, causes and damage of fires, or chief complaints of medical cases. Follows the filters above."
            eyebrow="Incident Details Insights"
            title="Incident Details Insights"
          />

          {detailInsights.length === 0 || !activeInsights ? (
            <EmptyState message="No incident details are available for the current filters." />
          ) : (
            <>
              <div aria-label="Incident type" className="mb-5 flex flex-wrap gap-2" role="tablist">
                {detailInsights.map((insight) => {
                  const active = insight.key === activeInsights.key
                  return (
                    <button
                      aria-selected={active}
                      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                        active ? 'border-slate-900 bg-slate-900 text-white shadow-sm' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                      key={insight.key}
                      onClick={() => setInsightTypeChoice(insight.label)}
                      role="tab"
                      type="button"
                    >
                      <span className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ backgroundColor: insight.color }} />
                      {insight.label} <span className="opacity-75">{insight.reports}</span>
                    </button>
                  )
                })}
              </div>

              {activeInsights.withDetails === 0 ? (
                <EmptyState message={`The ${activeInsights.label} reports in this view were filed before details were recorded.`} />
              ) : (
                <>
                  {activeInsights.kpis.length > 0 ? (
                    <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      {activeInsights.kpis.map((kpi) => (
                        <AnalyticsMetricCard accentClass="border-t-slate-700" helper={kpi.helper} key={kpi.label} label={kpi.label} value={kpi.value} />
                      ))}
                    </div>
                  ) : null}

                  <div className="grid gap-6 xl:grid-cols-2">
                    {activeInsights.charts.map((chart) => (
                      <div key={chart.title}>
                        <div className="mb-3">
                          <h4 className="text-base font-semibold text-slate-900">{chart.title}</h4>
                          <p className="text-xs text-slate-500">{chart.description}</p>
                        </div>
                        {chart.share ? (
                          <ShareBar
                            emptyText={`No ${chart.title.toLowerCase()} recorded yet.`}
                            segments={chart.items.map((item, index) => {
                              // Level fields (triage, injury severity, outcome) carry their own red-to-green colors.
                              const color = chart.colors?.[index] ?? SHARE_COLORS[index % SHARE_COLORS.length]
                              return {
                                label: item.label,
                                value: item.value,
                                color,
                                textColor: ['#eda100', '#fab219'].includes(color) ? '#0b0b0b' : undefined,
                              }
                            })}
                            unit={chart.unit ?? 'reports'}
                          />
                        ) : (
                          <BarList
                            emptyText={`No ${chart.title.toLowerCase()} recorded yet.`}
                            items={chart.items.map((item) => ({ label: item.label, value: item.value, color: activeInsights.color, note: item.helper }))}
                            maxItems={6}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>

        <div className={`${glassPanelClass} p-5 sm:p-6`}>
          <SectionHeader
            badge={performanceSource === 'server' ? 'Live from server' : performanceSource === 'loading' ? 'Loading...' : 'Calculated in browser'}
            description="Compares response teams by response time, reports finished on time, and incidents resolved. Follows the filters above."
            eyebrow="Emergency Response Teams"
            title="Responsiveness and Performance Analytics"
          />

          <p className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-600">
            <span className="font-semibold text-slate-800">How this is measured: </span>
            response time is the minutes from when the incident happened to when the responder filed the report (dispatch and arrival
            times are not recorded yet). On time means within {ON_TIME_MINUTES} minutes. Resolved means the incident status is resolved
            or contained. Score = speed 40% + on-time 20% + resolved 40%; teams with no timed reports are scored on resolved only.
          </p>

          <p className="mb-6 text-sm text-slate-600">
            {teamPerformanceSummary.measured > 0 ? (
              <>
                Overall: <span className="font-semibold text-slate-900">{teamPerformanceSummary.overallOnTimeRate}%</span> of timed reports filed within{' '}
                {ON_TIME_MINUTES} minutes, and <span className="font-semibold text-slate-900">{teamPerformanceSummary.overallResolutionRate}%</span> of
                incidents resolved ({teamPerformanceSummary.measured} of {teamPerformanceSummary.assignments} reports timed).
              </>
            ) : (
              <>
                Overall: <span className="font-semibold text-slate-900">{teamPerformanceSummary.overallResolutionRate}%</span> of incidents resolved. No
                reports in this view have a response time.
              </>
            )}
          </p>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
            <div>
              <h4 className="text-base font-semibold text-slate-900">Speed vs. incidents resolved</h4>
              <p className="mb-3 text-xs text-slate-500">
                Each dot is a team. Left = faster, higher = more incidents resolved. Teams without timed reports are not shown here.
              </p>
              <ScatterPlot
                emptyText="No team has timed reports for these filters."
                points={teamScatterPoints}
                xLabel="Average response time (minutes)"
                xTarget={ON_TIME_MINUTES}
                yLabel="Incidents resolved (%)"
              />
            </div>
            <div>
              <h4 className="text-base font-semibold text-slate-900">Performance score</h4>
              <p className="mb-3 text-xs text-slate-500">Out of 100, highest first.</p>
              <BarList
                emptyText="No response team data for these filters."
                format={(value) => `${value}`}
                items={[...teamPerformanceData].sort((a, b) => b.performanceScore - a.performanceScore).map((item) => ({
                  label: item.team,
                  value: item.performanceScore,
                  note: `${item.resolutionRate}% resolved · ${item.withResponseTimeCount > 0 ? `${item.averageResponseMinutes} min avg` : 'no timed reports'} · ${item.assignments} reports`,
                }))}
                valueLabel="score"
              />
              {severityPerformanceData.length > 0 ? (
                <div className="mt-6">
                  <h4 className="text-base font-semibold text-slate-900">Resolved by severity</h4>
                  <p className="mb-3 text-xs text-slate-500">Share of incidents resolved at each severity level.</p>
                  <BarList
                    format={(value) => `${value}%`}
                    items={severityPerformanceData.map((item) => ({ label: item.label, value: item.value, note: item.helper }))}
                    valueLabel="resolved"
                  />
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className={`${glassPanelClass} p-5 sm:p-6`}>
          <SectionHeader
            badge="USGS live feed"
            description="Earthquakes from the live feed for the selected period: magnitude bands, activity over time, and the places with the most events."
            eyebrow="Earthquake Monitoring"
            title={
              earthquakeAnalytics.total > 0
                ? `${earthquakeAnalytics.total} earthquakes; strongest M${earthquakeAnalytics.maxMagnitude}`
                : 'Earthquake monitoring'
            }
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <AnalyticsMetricCard accentClass="border-t-teal-600" helper="Average magnitude of these events." label="Avg Magnitude" value={earthquakeAnalytics.averageMagnitude} />
            <AnalyticsMetricCard accentClass="border-t-orange-600" helper="Events in the last 30 days." label="Recent 30 Days" value={earthquakeAnalytics.active} />
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-2">
            <div>
              <h4 className="text-base font-semibold text-slate-900">Magnitude distribution</h4>
              <p className="mb-3 text-xs text-slate-500">Number of events in each magnitude band.</p>
              <Histogram
                bins={earthquakeAnalytics.magnitudeDistribution.map((item) => ({ label: item.label.replace('Magnitude ', 'M'), value: item.value }))}
                color={EARTHQUAKE_COLOR}
                emptyText="No earthquake data available yet."
              />
            </div>
            <div>
              <h4 className="text-base font-semibold text-slate-900">Earthquakes over time</h4>
              <p className="mb-3 text-xs text-slate-500">Events per period, using Frequency View above.</p>
              <LineChart
                emptyText="No earthquake data available yet."
                height={200}
                periods={typeTrend.periods}
                series={[{ label: 'Earthquakes', color: EARTHQUAKE_COLOR, values: typeTrend.earthquakes }]}
              />
            </div>
          </div>

          <div className="mt-6">
            <h4 className="text-base font-semibold text-slate-900">Earthquake hotspots</h4>
            <p className="mb-3 text-xs text-slate-500">Places with the most events in the feed.</p>
            <BarList
              emptyText="No earthquake hotspot data available yet."
              items={earthquakeAnalytics.hotspots.map((item) => ({ label: item.label, value: item.value, color: EARTHQUAKE_COLOR }))}
              valueLabel="events"
            />
          </div>
        </div>

      </div>
    </section>
  )
}

export default AnalyticsSection