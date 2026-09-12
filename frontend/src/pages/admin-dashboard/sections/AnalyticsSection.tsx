import { useMemo, useState } from 'react'
import { jsPDF } from 'jspdf'
import type { HazardIncident, HazardType, IncidentStatus } from '../../../data/adminOperations'
import type { EarthquakeEvent } from '../../../services/earthquakes'
import { glassPanelClass, glassPanelSoftClass } from './constants'

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
  fire: number
  accident: number
  earthquake: number
  severityPressure: number
}

type RadarAxis = {
  label: string
  value: number
}

type TeamPerformanceItem = {
  team: string
  assignments: number
  resolvedCount: number
  withResponseTimeCount: number
  averageResponseMinutes: number
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

const hazardColors: Record<HazardType, string> = {
  EQ: '#10b981',
  FR: '#ef4444',
  AC: '#3b82f6',
}

const hazardLabels: Record<HazardType, string> = {
  EQ: 'Earthquake',
  FR: 'Fire',
  AC: 'Accident',
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

  return value || 'Unassigned team'
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
  if (!start || !end) return null

  const minutes = Math.round((end.getTime() - start.getTime()) / (1000 * 60))
  return minutes >= 0 ? minutes : null
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

function HorizontalBarChart({
  items,
  emptyText = 'No data available yet.',
}: {
  items: ChartItem[]
  emptyText?: string
}) {
  const maxValue = safeMax(items.map((item) => item.value))

  if (items.length === 0 || items.every((item) => item.value === 0)) {
    return <EmptyState message={emptyText} />
  }

  return (
    <div className="space-y-3">
      {items.map((item, index) => {
        const width = `${Math.max(8, (item.value / maxValue) * 100)}%`

        return (
          <article
            className="group rounded-2xl border border-slate-100 bg-white/85 p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md"
            key={item.label}
          >
            <div className="mb-2 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-800">{item.label}</p>
                {item.helper ? (
                  <p className="mt-0.5 text-xs text-slate-500">{item.helper}</p>
                ) : null}
              </div>
              <span className="shrink-0 rounded-full bg-slate-50 px-3 py-1 text-xs font-bold text-slate-900">
                {item.value}
              </span>
            </div>

            <div className="h-3 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full shadow-[0_4px_16px_rgba(15,23,42,0.14)] transition-all duration-700 group-hover:brightness-110"
                style={{
                  background: `linear-gradient(90deg, ${item.color || '#bfdbfe'}, ${
                    item.color || '#2563eb'
                  })`,
                  width,
                }}
              />
            </div>

            <p className="mt-1 text-right text-[10px] font-bold text-slate-400">
              Rank {index + 1}
            </p>
          </article>
        )
      })}
    </div>
  )
}

function DonutChart({
  items,
  total,
}: {
  items: ChartItem[]
  total: number
}) {
  const radius = 74
  const circumference = 2 * Math.PI * radius
  let runningTotal = 0

  return (
    <div className="flex flex-col items-center gap-4 rounded-[24px] border border-slate-100 bg-white/85 p-4 lg:flex-row lg:justify-center">
      <svg className="h-[230px] w-[230px]" viewBox="0 0 240 240">
        <circle cx="120" cy="120" fill="#ffffff" r="106" />
        <circle cx="120" cy="120" fill="none" r={radius} stroke="#e2e8f0" strokeWidth="28" />

        {items.map((item) => {
          const share = total > 0 ? item.value / total : 0
          const dashLength = share * circumference
          const dashOffset = -runningTotal * circumference
          runningTotal += share

          return (
            <circle
              cx="120"
              cy="120"
              fill="none"
              key={item.label}
              r={radius}
              stroke={item.color || '#2563eb'}
              strokeDasharray={`${dashLength} ${circumference - dashLength}`}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              strokeWidth="28"
              transform="rotate(-90 120 120)"
            >
              <animate
                attributeName="stroke-dasharray"
                dur="0.9s"
                fill="freeze"
                values={`0 ${circumference}; ${dashLength} ${circumference - dashLength}`}
              />
            </circle>
          )
        })}

        <circle cx="120" cy="120" fill="#ffffff" r="54" />
        <text fill="#0f172a" fontSize="32" fontWeight="800" textAnchor="middle" x="120" y="114">
          {total}
        </text>
        <text fill="#64748b" fontSize="12" fontWeight="700" textAnchor="middle" x="120" y="136">
          Records
        </text>
      </svg>

      <div className="w-full space-y-2 lg:max-w-[260px]">
        {items.map((item) => (
          <div className="rounded-2xl bg-slate-50 p-3" key={item.label}>
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: item.color || '#2563eb' }} />
                <span className="truncate text-xs font-semibold text-slate-700">{item.label}</span>
              </div>
              <span className="shrink-0 text-xs font-semibold text-slate-900">
                {percent(item.value, total)}%
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white">
              <div
                className="h-full rounded-full"
                style={{
                  backgroundColor: item.color || '#2563eb',
                  width: `${Math.max(4, percent(item.value, total))}%`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function TrendChart({ points }: { points: TrendPoint[] }) {
  if (points.length === 0 || points.every((point) => point.reports === 0 && point.earthquakes === 0)) {
    return <EmptyState message="No dated incident or earthquake activity is available yet." />
  }

  const width = 760
  const height = 280
  const padding = { top: 24, right: 20, bottom: 48, left: 42 }
  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom
  const maxValue = safeMax(points.flatMap((point) => [point.reports, point.earthquakes]))
  const xStep = points.length > 1 ? chartWidth / (points.length - 1) : chartWidth
  const getX = (index: number) => padding.left + (points.length > 1 ? index * xStep : chartWidth / 2)
  const getY = (value: number) => padding.top + chartHeight - (value / maxValue) * chartHeight
  const reportPath = points.map((point, index) => `${getX(index)},${getY(point.reports)}`).join(' ')
  const earthquakePath = points.map((point, index) => `${getX(index)},${getY(point.earthquakes)}`).join(' ')
  const labelStep = Math.max(1, Math.ceil(points.length / 8))

  return (
    <div className="rounded-[24px] border border-slate-100 bg-white/85 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-4 text-xs font-semibold text-slate-600">
          <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-blue-600" />Incident reports</span>
          <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />Live earthquakes</span>
        </div>
        <span className="text-xs text-slate-500">Peak: {maxValue}</span>
      </div>

      <div className="overflow-x-auto">
        <svg aria-label="Incident reports and live earthquakes over time" className="h-auto min-w-[620px] w-full" role="img" viewBox={`0 0 ${width} ${height}`}>
          {[0, 0.5, 1].map((ratio) => {
            const y = padding.top + chartHeight * ratio
            const value = Math.round(maxValue * (1 - ratio))
            return (
              <g key={ratio}>
                <line stroke="#e2e8f0" strokeDasharray="4 5" x1={padding.left} x2={width - padding.right} y1={y} y2={y} />
                <text fill="#94a3b8" fontSize="11" textAnchor="end" x={padding.left - 8} y={y + 4}>{value}</text>
              </g>
            )
          })}
          <polyline fill="none" points={reportPath} stroke="#2563eb" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
          <polyline fill="none" points={earthquakePath} stroke="#10b981" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
          {points.map((point, index) => (
            <g key={`${point.label}-${index}`}>
              <circle cx={getX(index)} cy={getY(point.reports)} fill="#ffffff" r="4" stroke="#2563eb" strokeWidth="2" />
              <circle cx={getX(index)} cy={getY(point.earthquakes)} fill="#ffffff" r="4" stroke="#10b981" strokeWidth="2" />
              {index % labelStep === 0 || index === points.length - 1 ? (
                <text fill="#64748b" fontSize="10" textAnchor="middle" x={getX(index)} y={height - 16}>{point.label}</text>
              ) : null}
            </g>
          ))}
        </svg>
      </div>
    </div>
  )
}

function TeamResponseTimeChart({ items }: { items: TeamPerformanceItem[] }) {
  const measurable = items.filter((item) => item.withResponseTimeCount > 0)

  if (measurable.length === 0) {
    return <EmptyState message="No response-time fields are available for team analytics yet." />
  }

  const maxMinutes = safeMax(measurable.map((item) => item.averageResponseMinutes))

  return (
    <div className="space-y-3">
      {measurable.map((item) => {
        const width = `${Math.max(8, (item.averageResponseMinutes / maxMinutes) * 100)}%`
        const tone =
          item.averageResponseMinutes <= 30
            ? 'from-emerald-200 to-emerald-500'
            : item.averageResponseMinutes <= 60
              ? 'from-amber-200 to-amber-500'
              : 'from-rose-200 to-rose-500'

        return (
          <article
            className="rounded-2xl border border-slate-100 bg-white/85 p-4 shadow-sm"
            key={`team-time-${item.team}`}
          >
            <div className="mb-2 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-800">{item.team}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {item.withResponseTimeCount} timed reports • {item.resolvedCount} resolved
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-slate-50 px-3 py-1 text-xs font-bold text-slate-900">
                {item.averageResponseMinutes} min avg
              </span>
            </div>

            <div className="h-3 overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${tone}`}
                style={{ width }}
              />
            </div>
          </article>
        )
      })}
    </div>
  )
}

function RadarChart({ axes }: { axes: RadarAxis[] }) {
  const size = 260
  const center = size / 2
  const radius = 90
  const levels = [0.25, 0.5, 0.75, 1]
  const maxValue = safeMax(axes.map((axis) => axis.value))

  const points = axes.map((axis, index) => {
    const angle = -Math.PI / 2 + (index / axes.length) * Math.PI * 2
    const distance = (axis.value / maxValue) * radius
    return {
      ...axis,
      x: center + Math.cos(angle) * distance,
      y: center + Math.sin(angle) * distance,
      lx: center + Math.cos(angle) * (radius + 24),
      ly: center + Math.sin(angle) * (radius + 24),
      ax: center + Math.cos(angle) * radius,
      ay: center + Math.sin(angle) * radius,
    }
  })

  const polygon = points.map((point) => `${point.x},${point.y}`).join(' ')

  return (
    <div className="rounded-[24px] border border-blue-100 bg-[radial-gradient(circle_at_center,#eff6ff_0%,#ffffff_60%,#f8fafc_100%)] p-4">
      <svg className="mx-auto h-[300px] w-full max-w-[360px]" viewBox={`0 0 ${size} ${size}`}>
        {levels.map((level) => {
          const levelPoints = axes.map((_, index) => {
            const angle = -Math.PI / 2 + (index / axes.length) * Math.PI * 2
            return `${center + Math.cos(angle) * radius * level},${center + Math.sin(angle) * radius * level}`
          })

          return (
            <polygon
              fill="none"
              key={level}
              points={levelPoints.join(' ')}
              stroke="#dbeafe"
              strokeWidth="1.4"
            />
          )
        })}

        {points.map((point) => (
          <g key={point.label}>
            <line stroke="#dbeafe" strokeWidth="1.4" x1={center} x2={point.ax} y1={center} y2={point.ay} />
            <text fill="#475569" fontSize="10" fontWeight="700" textAnchor="middle" x={point.lx} y={point.ly}>
              {point.label}
            </text>
          </g>
        ))}

        <polygon fill="#2563eb" opacity="0.18" points={polygon} />
        <polygon fill="none" points={polygon} stroke="#2563eb" strokeLinejoin="round" strokeWidth="3" />

        {points.map((point) => (
          <circle cx={point.x} cy={point.y} fill="#2563eb" key={`${point.label}-point`} r="4" />
        ))}
      </svg>
    </div>
  )
}

function HeatRiskMapGrid({ locations }: { locations: RiskLocation[] }) {
  const maxScore = safeMax(locations.map((location) => location.score))
  const fallbackLocations = locations.length > 0
    ? locations
    : [{ location: 'No location data', incidents: 0, score: 0, level: 'Low', responseLoad: 0, fire: 0, accident: 0, earthquake: 0, severityPressure: 0 }]

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {fallbackLocations.map((location, index) => {
        const intensity = location.score / maxScore
        const riskPercent = Math.min(100, Math.round(intensity * 100))

        const config =
          intensity >= 0.75
            ? {
                card: 'border-red-200 bg-[radial-gradient(circle_at_top_left,#fee2e2_0%,#fff7f7_46%,#ffffff_100%)]',
                text: 'text-red-800',
                badge: 'bg-red-600 text-white',
                meter: 'from-red-200 via-red-400 to-red-600',
                glow: 'bg-red-500/15',
                label: 'Critical Hotspot',
              }
            : intensity >= 0.5
              ? {
                  card: 'border-orange-200 bg-[radial-gradient(circle_at_top_left,#ffedd5_0%,#fff8ef_46%,#ffffff_100%)]',
                  text: 'text-orange-800',
                  badge: 'bg-orange-600 text-white',
                  meter: 'from-orange-200 via-orange-400 to-orange-600',
                  glow: 'bg-orange-500/15',
                  label: 'High Watch',
                }
              : intensity >= 0.25
                ? {
                    card: 'border-amber-200 bg-[radial-gradient(circle_at_top_left,#fef3c7_0%,#fffbea_46%,#ffffff_100%)]',
                    text: 'text-amber-800',
                    badge: 'bg-amber-500 text-white',
                    meter: 'from-amber-100 via-amber-300 to-amber-500',
                    glow: 'bg-amber-400/15',
                    label: 'Moderate Watch',
                  }
                : {
                    card: 'border-emerald-200 bg-[radial-gradient(circle_at_top_left,#d1fae5_0%,#f3fffa_46%,#ffffff_100%)]',
                    text: 'text-emerald-800',
                    badge: 'bg-emerald-600 text-white',
                    meter: 'from-emerald-100 via-emerald-300 to-emerald-600',
                    glow: 'bg-emerald-500/15',
                    label: 'Routine Watch',
                  }

        return (
          <article
            className={`group relative overflow-hidden rounded-[26px] border p-5 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_20px_45px_rgba(15,23,42,0.14)] ${config.card}`}
            key={location.location}
          >
            <div className={`pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full blur-2xl transition-opacity duration-300 group-hover:opacity-100 ${config.glow}`} />
            <div className="relative z-10">
              <div className="mb-5 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${config.badge}`}>
                      Rank #{index + 1}
                    </span>
                    <span className="rounded-full bg-white/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                      {config.label}
                    </span>
                  </div>

                  <p className={`line-clamp-2 min-h-[44px] text-base font-semibold leading-snug ${config.text}`}>
                    {location.location}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-white/70 bg-white/75 p-4 shadow-sm">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                    Incidents
                  </p>
                  <p className={`mt-1 text-3xl font-semibold ${config.text}`}>
                    {location.incidents}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/70 bg-white/75 p-4 shadow-sm">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                    Risk Score
                  </p>
                  <p className={`mt-1 text-3xl font-semibold ${config.text}`}>
                    {location.score}
                  </p>
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-white/70 bg-white/75 p-4 shadow-sm">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold text-slate-600">Heat / risk intensity</p>
                  <p className={`text-xs font-semibold ${config.text}`}>{riskPercent}%</p>
                </div>

                <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${config.meter} shadow-[0_6px_18px_rgba(15,23,42,0.16)] transition-all duration-700 group-hover:brightness-110`}
                    style={{ width: `${Math.max(7, riskPercent)}%` }}
                  />
                </div>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                <span className="rounded-full bg-white/70 px-3 py-1 text-center text-xs font-medium text-red-700">
                  Fire {location.fire}
                </span>
                <span className="rounded-full bg-white/70 px-3 py-1 text-center text-xs font-medium text-blue-700">
                  Accident {location.accident}
                </span>
                <span className="rounded-full bg-white/70 px-3 py-1 text-center text-xs font-medium text-emerald-700">
                  EQ {location.earthquake}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <span className={`rounded-full bg-white/80 px-4 py-2 text-xs font-semibold ${config.text}`}>
                  {location.level}
                </span>
                <span className="rounded-full bg-white/70 px-4 py-2 text-xs font-medium text-slate-600">
                  Load: {location.responseLoad}
                </span>
              </div>
            </div>
          </article>
        )
      })}
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


function getAnalyticsIncidentType(report: HazardIncident): 'Fire' | 'Accident' | 'Earthquake' | 'Other' {
  const record = report as any

  const combined = [
    record.incidentType,
    record.incident_type,
    record.hazard_type_name,
    record.type,
    record.category,
    record.incident_category,
    record.nature_of_incident,
    record.title,
    record.name,
    record.incidentTitle,
    record.incident_title,
    record.description,
    record.actionTaken,
    record.action_taken,
    record.report_text,
    record.particulars,
    record.code,
    record.hazard_code,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  const code = String(record.code || record.hazard_code || '').toUpperCase()

  if (combined.includes('fire') || code === 'FR') return 'Fire'
  if (combined.includes('earthquake') || code === 'EQ') return 'Earthquake'

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

  return 'Other'
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
    () => Array.from(new Set(analyticsReports.map((report) => getLocationName(report.location)))).sort(),
    [analyticsReports],
  )

  const availableDisasterTypes = useMemo(
    () => Array.from(new Set(analyticsReports.map((report) => getAnalyticsIncidentType(report)))).sort(),
    [analyticsReports],
  )

  const filteredReports = useMemo(() => {
    let result = analyticsReports

    if (selectedYear) {
      result = result.filter((report) => getReportDate(report).getFullYear().toString() === selectedYear)
    }

    if (selectedMonth && selectedYear) {
      result = result.filter((report) => {
        const date = getReportDate(report)
        return (
          date.getFullYear().toString() === selectedYear &&
          (date.getMonth() + 1).toString().padStart(2, '0') === selectedMonth
        )
      })
    }

    if (selectedBarangay) {
      result = result.filter((report) => getLocationName(report.location) === selectedBarangay)
    }

    if (selectedDisasterType) {
      result = result.filter((report) => getAnalyticsIncidentType(report) === selectedDisasterType)
    }

    if (selectedSeverity) {
      result = result.filter((report) => report.severity === selectedSeverity)
    }

    return result
  }, [analyticsReports, selectedBarangay, selectedDisasterType, selectedMonth, selectedSeverity, selectedYear])

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

  const fireCount = filteredReports.filter((report) => getAnalyticsIncidentType(report) === 'Fire').length
  const accidentCount = filteredReports.filter((report) => getAnalyticsIncidentType(report) === 'Accident').length
  const earthquakeReportCount = filteredReports.filter((report) => getAnalyticsIncidentType(report) === 'Earthquake').length
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

  const disasterTypeData = useMemo(
    () => [
      {
        label: hazardLabels.FR,
        value: fireCount,
        color: hazardColors.FR,
      },
      {
        label: hazardLabels.AC,
        value: accidentCount,
        color: hazardColors.AC,
      },
      {
        label: 'Earthquake',
        value: earthquakeTotalCount,
        color: hazardColors.EQ,
      },
    ],
    [accidentCount, earthquakeTotalCount, fireCount],
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

  const teamPerformanceData = useMemo<TeamPerformanceItem[]>(() => {
    const bucket = new Map<
      string,
      {
        assignments: number
        resolvedCount: number
        withResponseTimeCount: number
        responseMinutesSum: number
        onTimeCount: number
      }
    >()

    filteredReports.forEach((report) => {
      const team = getResponseTeamName(report)
      const current =
        bucket.get(team) ||
        {
          assignments: 0,
          resolvedCount: 0,
          withResponseTimeCount: 0,
          responseMinutesSum: 0,
          onTimeCount: 0,
        }

      current.assignments += 1

      if (getDisplayReportStatus(report) === 'resolved') {
        current.resolvedCount += 1
      }

      const minutes = getResponseMinutes(report)
      if (minutes !== null) {
        current.withResponseTimeCount += 1
        current.responseMinutesSum += minutes

        if (minutes <= 30) {
          current.onTimeCount += 1
        }
      }

      bucket.set(team, current)
    })

    const maxAssignments = safeMax(Array.from(bucket.values()).map((item) => item.assignments))

    return Array.from(bucket.entries())
      .map(([team, summary]) => {
        const averageResponseMinutes =
          summary.withResponseTimeCount > 0
            ? Math.round(summary.responseMinutesSum / summary.withResponseTimeCount)
            : 0

        const resolutionRate = percent(summary.resolvedCount, summary.assignments)
        const onTimeRate =
          summary.withResponseTimeCount > 0
            ? percent(summary.onTimeCount, summary.withResponseTimeCount)
            : 0

        const speedScore =
          summary.withResponseTimeCount > 0
            ? Math.max(0, 100 - Math.min(100, (averageResponseMinutes / 120) * 100))
            : 0

        const loadScore = Math.min(100, Math.round((summary.assignments / maxAssignments) * 100))

        const performanceScore = Math.round(
          speedScore * 0.45 + resolutionRate * 0.35 + onTimeRate * 0.15 + loadScore * 0.05,
        )

        return {
          team,
          assignments: summary.assignments,
          resolvedCount: summary.resolvedCount,
          withResponseTimeCount: summary.withResponseTimeCount,
          averageResponseMinutes,
          onTimeRate,
          resolutionRate,
          performanceScore,
        }
      })
      .sort((a, b) => b.performanceScore - a.performanceScore)
      .slice(0, 8)
  }, [filteredReports])

  const teamPerformanceChartData = useMemo<ChartItem[]>(
    () =>
      teamPerformanceData.map((item) => ({
        label: item.team,
        value: item.performanceScore,
        helper: `${item.resolutionRate}% resolved • ${item.onTimeRate}% <=30m • ${item.assignments} assignments`,
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
    if (teamPerformanceData.length === 0) {
      return {
        topTeam: 'N/A',
        topScore: 0,
        overallAvgResponse: 0,
        overallOnTimeRate: 0,
      }
    }

    const top = teamPerformanceData[0]
    const measuredTeams = teamPerformanceData.filter((item) => item.withResponseTimeCount > 0)

    const overallAvgResponse =
      measuredTeams.length > 0
        ? Math.round(
            measuredTeams.reduce((sum, item) => sum + item.averageResponseMinutes, 0) / measuredTeams.length,
          )
        : 0

    const overallOnTimeRate =
      measuredTeams.length > 0
        ? Math.round(measuredTeams.reduce((sum, item) => sum + item.onTimeRate, 0) / measuredTeams.length)
        : 0

    return {
      topTeam: top.team,
      topScore: top.performanceScore,
      overallAvgResponse,
      overallOnTimeRate,
    }
  }, [teamPerformanceData])

  const barangayRiskData = useMemo(() => {
    const map = new Map<string, RiskLocation>()

    filteredReports.forEach((report) => {
      const location = getLocationName(report.location)
      const current = map.get(location) || {
        location,
        incidents: 0,
        score: 0,
        level: 'Low',
        responseLoad: 0,
        fire: 0,
        accident: 0,
        earthquake: 0,
        severityPressure: 0,
      }

      const severityScore = getSeverityWeight(report.severity) * 2
      const displayStatus = getDisplayReportStatus(report)
      const statusScore = displayStatus === 'active' ? 3 : displayStatus === 'pending' ? 2 : 0
      const earthquakeExposureScore = getAnalyticsIncidentType(report) === 'Earthquake' ? 2 : 0

      current.incidents += 1
      current.score += severityScore + statusScore + earthquakeExposureScore
      current.responseLoad += displayStatus === 'resolved' ? 1 : 2
      current.severityPressure += severityScore

      if (getAnalyticsIncidentType(report) === 'Fire') current.fire += 1
      if (getAnalyticsIncidentType(report) === 'Accident') current.accident += 1
      if (getAnalyticsIncidentType(report) === 'Earthquake') current.earthquake += 1

      map.set(location, current)
    })

    // Process all earthquake events without artificial limits to ensure comprehensive risk assessment
    analysisEarthquakeEvents.forEach((event) => {
      const location = event.place || 'Near Quezon Region'
      const current = map.get(location) || {
        location,
        incidents: 0,
        score: 0,
        level: 'Low',
        responseLoad: 0,
        fire: 0,
        accident: 0,
        earthquake: 0,
        severityPressure: 0,
      }

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

  const radarAxes: RadarAxis[] = [
    { label: 'Incidents', value: barangayRiskData[0]?.incidents || 0 },
    { label: 'Risk', value: barangayRiskData[0]?.score || 0 },
    { label: 'Load', value: barangayRiskData[0]?.responseLoad || 0 },
    { label: 'Severity', value: barangayRiskData[0]?.severityPressure || 0 },
    { label: 'Fire', value: barangayRiskData[0]?.fire || 0 },
    { label: 'Earthquake', value: barangayRiskData[0]?.earthquake || 0 },
  ]

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
        pdf.setFillColor(...(item.color === '#ef4444' ? [239, 68, 68] : item.color === '#3b82f6' ? [59, 130, 246] : [16, 185, 129]))
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

    section('8. Emergency Response Performance', 'Team response metrics calculated from the filtered reports with available response data.')
    table(
      ['Team', 'Assignments', 'Resolved', 'Avg response', 'Performance'],
      teamPerformanceData.map((item) => [item.team, String(item.assignments), `${item.resolutionRate}%`, `${item.averageResponseMinutes} min`, `${item.performanceScore}/100`]),
      [55, 28, 28, 38, contentWidth - 149],
    )
    barChart(teamPerformanceChartData, 100)

    section('Filtered Incident Records', 'Detailed records included in this report.')
    table(
      ['Date', 'Type', 'Severity', 'Barangay', 'Report'],
      filteredReports.length > 0
        ? filteredReports.map((report) => [getReportDate(report).toLocaleDateString(), getAnalyticsIncidentType(report), report.severity, getLocationName(report.location), report.title])
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
    <section className="mx-auto w-full max-w-[1440px] px-3 py-6 sm:px-5 lg:px-6 lg:py-8">
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

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <AnalyticsMetricCard
              accentClass="border-t-blue-600"
              helper={`${totalIncidentReports} reports + ${earthquakeApiCount} live earthquake events.`}
              label="Total Records"
              value={totalRecords}
            />
            <AnalyticsMetricCard
              accentClass="border-t-red-600"
              helper={`${fireCount} fire-related reports in the dataset.`}
              label="Fire Reports"
              value={fireCount}
            />
            <AnalyticsMetricCard
              accentClass="border-t-sky-600"
              helper={`${accidentCount} accident-related reports in the dataset.`}
              label="Accident Reports"
              value={accidentCount}
            />
            <AnalyticsMetricCard
              accentClass="border-t-emerald-600"
              helper={`${earthquakeApiCount} live API events + ${earthquakeReportCount} report records.`}
              label="Earthquake Data"
              value={earthquakeTotalCount}
            />
            <AnalyticsMetricCard
              accentClass="border-t-violet-600"
              helper={`${highPriorityCount} high/critical reports • ${totalVictimCount} total victims.`}
              label="High Priority"
              value={highPriorityCount}
            />
          </div>
        </div>

        <div className={`${glassPanelClass} p-5 sm:p-6`}>
          <SectionHeader
            badge="Composition"
            description="Shows how the current records are distributed across Fire, Accident, and live Earthquake data."
            eyebrow="Disaster Type Analysis"
            title="Disaster Type Analysis"
          />
          <DonutChart items={disasterTypeData} total={totalRecords} />
        </div>

        <div className={`${glassPanelClass} p-5 sm:p-6`}>
          <SectionHeader
            badge="Percentage of filtered incidents"
            description="Each percentage is calculated as that severity count divided by the total number of filtered incident reports, multiplied by 100."
            eyebrow="Severity Level"
            title="Incident Severity Distribution"
          />
          <HorizontalBarChart
            emptyText="No incident severity data is available for the current filters."
            items={severityData}
          />
        </div>

        <div className={`${glassPanelClass} p-5 sm:p-6`}>
          <SectionHeader
            badge={frequencyMode === 'daily' && selectedYear && selectedMonth ? 'Daily' : frequencyMode === 'yearly' ? 'Yearly' : 'Monthly'}
            description="Tracks how often incident reports and live earthquake events occur. Use monthly, yearly, or daily analysis for a selected month."
            eyebrow="Incident Activity Over Time"
            title="Incident and Earthquake Trend"
          />
          <TrendChart points={incidentTrendData} />
        </div>

        <div className={`${glassPanelClass} p-5 sm:p-6`}>
          <SectionHeader
            badge="USGS API"
            description="Dedicated earthquake analytics from the live earthquake, including magnitude distribution, hotspots, and recent seismic activity."
            eyebrow="Earthquake Monitoring Analytics"
            title="Earthquake Monitoring Analytics"
          />

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <AnalyticsMetricCard
              accentClass="border-t-emerald-600"
              helper="Live earthquake events from the API feed."
              label="Earthquake Events"
              value={earthquakeAnalytics.total}
            />
            <AnalyticsMetricCard
              accentClass="border-t-teal-600"
              helper="Average magnitude from API earthquake events."
              label="Avg Magnitude"
              value={earthquakeAnalytics.averageMagnitude}
            />
            <AnalyticsMetricCard
              accentClass="border-t-orange-600"
              helper="Earthquakes detected within the last 30 days."
              label="Recent 30 Days"
              value={earthquakeAnalytics.active}
            />
            <AnalyticsMetricCard
              accentClass="border-t-red-600"
              helper="Magnitude 4.0 and above events."
              label="Significant EQ"
              value={earthquakeAnalytics.high}
            />
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-2">
            <div>
              <SectionHeader
                badge={`Max ${earthquakeAnalytics.maxMagnitude}`}
                description="Magnitude distribution directly from API earthquake magnitude values."
                eyebrow="Magnitude Distribution"
                title="Magnitude Distribution"
              />
              <HorizontalBarChart
                emptyText="No earthquake magnitude data available yet."
                items={earthquakeAnalytics.magnitudeDistribution}
              />
            </div>

            <div>
              <SectionHeader
                badge="Hotspots"
                description="Earthquake locations based on API place values."
                eyebrow="Earthquake Hotspots"
                title="Earthquake Hotspots"
              />
              <HorizontalBarChart
                emptyText="No earthquake hotspot data available yet."
                items={earthquakeAnalytics.hotspots}
              />
            </div>
          </div>
        </div>

        <div className={`${glassPanelClass} p-5 sm:p-6`}>
          <SectionHeader
            badge="Ranking + Radar"
            description="Compares filtered incident totals by location and ranks the highest-risk barangays using severity, status, response load, and earthquake exposure."
            eyebrow="Barangay Risk Analysis"
            title="Barangay Risk Analysis"
          />
          <div className="mb-5 grid gap-3 sm:grid-cols-2">
            <AnalyticsMetricCard
              accentClass="border-t-blue-600"
              helper="Total incident reports assigned to the current barangay and other filters."
              label="Incidents by Barangay"
              value={filteredReports.length}
            />
            <AnalyticsMetricCard
              accentClass="border-t-red-600"
              helper="Highest composite location risk in the current filtered dataset."
              label="Highest-Risk Barangay"
              value={barangayRiskData[0]?.location || 'N/A'}
            />
          </div>
          <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
            <HorizontalBarChart
              emptyText="No barangay risk records available yet."
              items={barangayRiskData.map((item) => ({
                label: item.location,
                value: item.score,
                helper: `${item.incidents} records • ${item.level}`,
                color:
                  item.score >= 12
                    ? '#dc2626'
                    : item.score >= 8
                      ? '#f97316'
                      : item.score >= 4
                        ? '#f59e0b'
                        : '#10b981',
              }))}
            />
            <RadarChart axes={radarAxes} />
          </div>
        </div>

        <div className={`${glassPanelClass} p-5 sm:p-6`}>
          <SectionHeader
            badge="Heat + Risk"
            description="Combined heat map and risk map showing incident reports and earthquake hotspot areas from the API."
            eyebrow="Heat Map / Risk Map"
            title="Heat Map and Risk Map"
          />
          <HeatRiskMapGrid locations={barangayRiskData} />
        </div>

        <div className={`${glassPanelClass} p-5 sm:p-6`}>
          <SectionHeader
            badge="Team Performance"
            description="Measures team responsiveness and operational performance using actual response timestamps, resolution rate, and on-time response share."
            eyebrow="Emergency Response Teams"
            title="Responsiveness and Performance Analytics"
          />

          <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <AnalyticsMetricCard
              accentClass="border-t-emerald-600"
              helper="Highest composite performance score in current filter window."
              label="Top Team"
              value={teamPerformanceSummary.topTeam}
            />
            <AnalyticsMetricCard
              accentClass="border-t-blue-600"
              helper="Composite team performance score out of 100."
              label="Top Score"
              value={teamPerformanceSummary.topScore}
            />
            <AnalyticsMetricCard
              accentClass="border-t-orange-600"
              helper="Mean average response time across teams with measurable timestamps."
              label="Avg Response Time"
              value={`${teamPerformanceSummary.overallAvgResponse} min`}
            />
            <AnalyticsMetricCard
              accentClass="border-t-violet-600"
              helper="Average share of team responses completed within 30 minutes."
              label="On-Time Rate"
              value={`${teamPerformanceSummary.overallOnTimeRate}%`}
            />
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <div>
              <SectionHeader
                badge="Score"
                description="Higher score indicates better speed, resolution output, and on-time response consistency."
                eyebrow="Composite Ranking"
                title="Team Performance Score"
              />
              <HorizontalBarChart
                items={teamPerformanceChartData}
                emptyText="No assigned response team data available yet."
              />
            </div>

            <div>
              <SectionHeader
                badge="Minutes"
                description="Average response time in minutes from report start to response completion per team."
                eyebrow="Speed Breakdown"
                title="Average Response Time by Team"
              />
              <TeamResponseTimeChart items={teamPerformanceData} />
            </div>
          </div>
        </div>

      </div>
    </section>
  )
}

export default AnalyticsSection
