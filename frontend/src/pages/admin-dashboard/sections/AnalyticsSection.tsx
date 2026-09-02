import { useMemo, useState } from 'react'
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

function StackedBarChart({
  items,
  total,
}: {
  items: ChartItem[]
  total: number
}) {
  return (
    <div className="rounded-[24px] border border-slate-100 bg-white/85 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-800">Stacked Disaster Share</p>
        <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
          {total} total
        </span>
      </div>

      <div className="flex h-8 overflow-hidden rounded-full bg-slate-100">
        {items.map((item) => {
          const share = percent(item.value, total)

          return (
            <div
              className="h-full transition-all duration-700"
              key={item.label}
              style={{
                backgroundColor: item.color || '#2563eb',
                width: `${Math.max(item.value > 0 ? 5 : 0, share)}%`,
              }}
              title={`${item.label}: ${share}%`}
            />
          )
        })}
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {items.map((item) => (
          <div className="rounded-2xl bg-slate-50 p-3" key={item.label}>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color || '#2563eb' }} />
              <p className="text-xs font-semibold text-slate-700">{item.label}</p>
            </div>
            <p className="mt-1 text-lg font-semibold text-slate-900">{item.value}</p>
            <p className="text-xs text-slate-500">{percent(item.value, total)}% of records</p>
          </div>
        ))}
      </div>
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

    return result
  }, [analyticsReports, selectedYear, selectedMonth])

  const totalIncidentReports = filteredReports.length
  const earthquakeApiCount = filteredEarthquakeEvents.length
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

  const recentEarthquake30Days = filteredEarthquakeEvents.filter(
    (event) => getEarthquakeEventDate(event).getTime() >= Date.now() - 30 * 24 * 60 * 60 * 1000,
  ).length

  const significantEarthquakes = filteredEarthquakeEvents.filter((event) => event.magnitude >= 4).length
  const maxEarthquakeMagnitude = filteredEarthquakeEvents.reduce((max, event) => Math.max(max, event.magnitude), 0)
  const averageEarthquakeMagnitude =
    filteredEarthquakeEvents.length > 0
      ? filteredEarthquakeEvents.reduce((sum, event) => sum + event.magnitude, 0) / filteredEarthquakeEvents.length
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
    filteredEarthquakeEvents.forEach((event) => {
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
  }, [filteredEarthquakeEvents, filteredReports])

  const earthquakeAnalytics = useMemo(() => {
    const magnitudeDistribution: ChartItem[] = [
      {
        label: 'Magnitude 1.0 - 2.9',
        value: filteredEarthquakeEvents.filter((event) => event.magnitude < 3).length,
        color: '#86efac',
        helper: 'Low intensity tremors',
      },
      {
        label: 'Magnitude 3.0 - 3.9',
        value: filteredEarthquakeEvents.filter((event) => event.magnitude >= 3 && event.magnitude < 4).length,
        color: '#22c55e',
        helper: 'Felt but usually minor',
      },
      {
        label: 'Magnitude 4.0 - 4.9',
        value: filteredEarthquakeEvents.filter((event) => event.magnitude >= 4 && event.magnitude < 5).length,
        color: '#f59e0b',
        helper: 'Moderate shaking watch',
      },
      {
        label: 'Magnitude 5.0+',
        value: filteredEarthquakeEvents.filter((event) => event.magnitude >= 5).length,
        color: '#ef4444',
        helper: 'High impact monitoring',
      },
    ]

    const hotspotMap = new Map<string, number>()

    filteredEarthquakeEvents.forEach((event) => {
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
    filteredEarthquakeEvents,
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

  return (
    <section className="mx-auto w-full max-w-[1440px] px-3 py-6 sm:px-5 lg:px-6 lg:py-8">
      <div className="space-y-6">
        <div className={`${glassPanelClass} overflow-hidden p-5 sm:p-6`}>
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
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

            <div className={`rounded-[24px] border px-5 py-4 ${getRiskTone(riskScore)}`}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em]">
                Overall Risk Score
              </p>
              <p className="mt-1 text-4xl font-semibold">{riskScore}%</p>
              <p className="text-xs font-bold">{getRiskLabel(riskScore)} monitoring level</p>
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

            {(selectedYear || selectedMonth) && (
              <button
                type="button"
                onClick={() => {
                  setSelectedYear(null)
                  setSelectedMonth(null)
                }}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Clear Filters
              </button>
            )}

            {selectedYear || selectedMonth ? (
              <p className="text-sm font-medium text-slate-600">
                Showing{selectedYear ? ` ${selectedYear}` : ''}
                {selectedMonth ? ` - ${new Date(2026, parseInt(selectedMonth, 10) - 1).toLocaleString('default', { month: 'long' })}` : ''}
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
            badge="Donut + Stacked Bar"
            description="Shows both percentage share and stacked comparison of Fire, Accident, and live Earthquake data."
            eyebrow="Disaster Type Analysis"
            title="Disaster Type Analysis"
          />
          <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
            <DonutChart items={disasterTypeData} total={totalRecords} />
            <StackedBarChart items={disasterTypeData} total={totalRecords} />
          </div>
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
            description="Ranks barangays and earthquake locations by incident pressure and visualizes the top hotspot profile."
            eyebrow="Barangay Risk Analysis"
            title="Barangay Risk Analysis"
          />
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
