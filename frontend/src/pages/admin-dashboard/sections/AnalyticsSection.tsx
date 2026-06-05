import { useMemo } from 'react'
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

type TrendItem = {
  label: string
  fire: number
  accident: number
  earthquake: number
  total: number
}

type RadarAxis = {
  label: string
  value: number
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

const statusLabels: Record<IncidentStatus, string> = {
  active: 'Active',
  pending: 'Pending',
  approved: 'Approved',
  resolved: 'Resolved',
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

function parseIncidentHour(time: string): number {
  const value = String(time || '').trim()
  const match = value.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)

  if (!match) return 8

  let hour = Number(match[1])
  const period = match[3].toUpperCase()

  if (period === 'PM' && hour !== 12) hour += 12
  if (period === 'AM' && hour === 12) hour = 0

  return hour
}

function getPeakHourBucket(hour: number): string {
  if (hour >= 0 && hour < 6) return '12AM - 6AM'
  if (hour >= 6 && hour < 12) return '6AM - 12PM'
  if (hour >= 12 && hour < 18) return '12PM - 6PM'
  return '6PM - 12AM'
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

function getMonthLabel(date: Date): string {
  return date.toLocaleDateString(undefined, { month: 'short' })
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

function MultiLineTrendChart({ items }: { items: TrendItem[] }) {
  const width = 920
  const height = 360
  const padding = { top: 44, right: 48, bottom: 58, left: 56 }
  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom
  const maxValue = safeMax(items.flatMap((item) => [item.fire, item.accident, item.earthquake, item.total]))
  const stepX = items.length > 1 ? chartWidth / (items.length - 1) : chartWidth

  const getPoints = (key: keyof Pick<TrendItem, 'fire' | 'accident' | 'earthquake' | 'total'>) =>
    items.map((item, index) => {
      const x = padding.left + (items.length > 1 ? index * stepX : chartWidth / 2)
      const y = padding.top + chartHeight - (item[key] / maxValue) * chartHeight
      return { x, y, value: item[key], label: item.label }
    })

  const toPath = (points: Array<{ x: number; y: number }>) =>
    points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')

  const series = [
    { key: 'total' as const, label: 'Total', color: '#1d4ed8', points: getPoints('total') },
    { key: 'fire' as const, label: 'Fire', color: '#ef4444', points: getPoints('fire') },
    { key: 'accident' as const, label: 'Accident', color: '#3b82f6', points: getPoints('accident') },
    { key: 'earthquake' as const, label: 'Earthquake API', color: '#10b981', points: getPoints('earthquake') },
  ]

  return (
    <div className="relative overflow-hidden rounded-[24px] border border-blue-100 bg-[radial-gradient(circle_at_top_left,#dbeafe_0%,#ffffff_45%,#f8fafc_100%)] p-3">
      <div className="mb-3 flex flex-wrap gap-2 px-2 pt-1">
        {series.map((item) => (
          <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm" key={item.label}>
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
            {item.label}
          </span>
        ))}
      </div>

      <svg className="h-[330px] w-full" preserveAspectRatio="xMidYMid meet" viewBox={`0 0 ${width} ${height}`}>
        {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
          const y = padding.top + chartHeight - tick * chartHeight
          const value = Math.round(maxValue * tick)

          return (
            <g key={tick}>
              <line
                stroke="#dbeafe"
                strokeDasharray="7 7"
                x1={padding.left}
                x2={width - padding.right}
                y1={y}
                y2={y}
              />
              <text fill="#64748b" fontSize="11" fontWeight="700" textAnchor="end" x={padding.left - 12} y={y + 4}>
                {value}
              </text>
            </g>
          )
        })}

        {series.map((item) => (
          <g key={item.label}>
            <path
              d={toPath(item.points)}
              fill="none"
              stroke={item.color}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={item.key === 'total' ? 5 : 3}
              opacity={item.key === 'total' ? 1 : 0.8}
            />
            {item.points.map((point) => (
              <circle
                cx={point.x}
                cy={point.y}
                fill="#ffffff"
                key={`${item.label}-${point.label}`}
                r={item.key === 'total' ? 6 : 4}
                stroke={item.color}
                strokeWidth="3"
              />
            ))}
          </g>
        ))}

        {items.map((item, index) => {
          const x = padding.left + (items.length > 1 ? index * stepX : chartWidth / 2)

          return (
            <text fill="#64748b" fontSize="11" fontWeight="800" key={item.label} textAnchor="middle" x={x} y={height - 22}>
              {item.label}
            </text>
          )
        })}
      </svg>
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

function GaugeChart({
  value,
  label,
}: {
  value: number
  label: string
}) {
  const normalized = Math.min(100, Math.max(0, value))
  const angle = -90 + (normalized / 100) * 180
  const needleLength = 72
  const radians = (angle * Math.PI) / 180
  const x2 = 110 + needleLength * Math.cos(radians)
  const y2 = 110 + needleLength * Math.sin(radians)

  return (
    <div className="rounded-[24px] border border-slate-100 bg-white/85 p-4 text-center">
      <svg className="mx-auto h-[180px] w-[240px]" viewBox="0 0 220 150">
        <path d="M 35 110 A 75 75 0 0 1 185 110" fill="none" stroke="#e2e8f0" strokeLinecap="round" strokeWidth="22" />
        <path d="M 35 110 A 75 75 0 0 1 85 39" fill="none" stroke="#10b981" strokeLinecap="round" strokeWidth="22" />
        <path d="M 85 39 A 75 75 0 0 1 135 39" fill="none" stroke="#f59e0b" strokeLinecap="round" strokeWidth="22" />
        <path d="M 135 39 A 75 75 0 0 1 185 110" fill="none" stroke="#ef4444" strokeLinecap="round" strokeWidth="22" />
        <line x1="110" x2={x2} y1="110" y2={y2} stroke="#0f172a" strokeLinecap="round" strokeWidth="5" />
        <circle cx="110" cy="110" fill="#0f172a" r="8" />
        <text fill="#0f172a" fontSize="26" fontWeight="800" textAnchor="middle" x="110" y="140">
          {value}
        </text>
      </svg>
      <p className="text-sm font-semibold text-slate-800">{label}</p>
      <p className="mt-1 text-xs text-slate-500">Lower minutes means faster response performance.</p>
    </div>
  )
}

function ResponseTimeAnalysis({
  items,
  averageResponseMinutes,
}: {
  items: ChartItem[]
  averageResponseMinutes: number
}) {
  return (
    <div className={`${glassPanelClass} p-5 sm:p-6`}>
      <SectionHeader
        badge={`${averageResponseMinutes} min avg`}
        description="Bar chart shows incident volume by time block; gauge shows estimated average response performance."
        eyebrow="Response Time Analysis"
        title="Response Time Analysis"
      />

      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <HorizontalBarChart items={items} />
        <GaugeChart label="Average Response Time" value={averageResponseMinutes} />
      </div>
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

function SeverityBubbleChart({ items }: { items: ChartItem[] }) {
  const maxValue = safeMax(items.map((item) => item.value))
  const colors = ['#10b981', '#f59e0b', '#f97316', '#dc2626']

  return (
    <div className="rounded-[24px] border border-slate-100 bg-[radial-gradient(circle_at_top_left,#f8fafc_0%,#ffffff_45%,#eff6ff_100%)] p-5">
      <div className="flex min-h-[300px] flex-wrap items-center justify-center gap-6">
        {items.map((item, index) => {
          const size = 78 + (item.value / maxValue) * 92

          return (
            <div
              className="group flex flex-col items-center gap-3 text-center"
              key={item.label}
              style={{ minWidth: 150 }}
            >
              <div
                className="flex items-center justify-center rounded-full text-white shadow-[0_18px_42px_rgba(15,23,42,0.18)] transition-all duration-300 group-hover:-translate-y-1 group-hover:scale-105"
                style={{
                  width: size,
                  height: size,
                  background: `radial-gradient(circle at 35% 30%, #ffffff66 0%, ${colors[index % colors.length]} 34%, ${colors[index % colors.length]} 100%)`,
                }}
              >
                <span className="text-3xl font-semibold">{item.value}</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">{item.label}</p>
                <p className="text-xs text-slate-500">Severity category</p>
              </div>
            </div>
          )
        })}
      </div>
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

  const totalIncidentReports = analyticsReports.length
  const earthquakeApiCount = earthquakeEvents.length
  const totalRecords = totalIncidentReports + earthquakeApiCount

  const activeCount = analyticsReports.filter((report) => report.status === 'active').length
  const pendingCount = analyticsReports.filter((report) => report.status === 'pending').length

  const fireCount = analyticsReports.filter((report) => getAnalyticsIncidentType(report) === 'Fire').length
  const accidentCount = analyticsReports.filter((report) => getAnalyticsIncidentType(report) === 'Accident').length
  const earthquakeReportCount = analyticsReports.filter((report) => getAnalyticsIncidentType(report) === 'Earthquake').length
  const earthquakeTotalCount = earthquakeReportCount + earthquakeApiCount

  const highPriorityCount = analyticsReports.filter(
    (report) => report.severity === 'High' || report.severity === 'Critical',
  ).length

  const activeRate = percent(activeCount, totalIncidentReports)

  const averageSeverity =
    totalIncidentReports > 0
      ? analyticsReports.reduce((total, report) => total + getSeverityWeight(report.severity), 0) /
        totalIncidentReports
      : 0

  const recentEarthquake30Days = earthquakeEvents.filter(
    (event) => event.rawTimestamp >= Date.now() - 30 * 24 * 60 * 60 * 1000,
  ).length

  const significantEarthquakes = earthquakeEvents.filter((event) => event.magnitude >= 4).length
  const maxEarthquakeMagnitude = earthquakeEvents.reduce((max, event) => Math.max(max, event.magnitude), 0)
  const averageEarthquakeMagnitude =
    earthquakeEvents.length > 0
      ? earthquakeEvents.reduce((sum, event) => sum + event.magnitude, 0) / earthquakeEvents.length
      : 0

  const riskScore = Math.min(
    100,
    Math.round(
      activeRate * 0.45 +
        percent(highPriorityCount, Math.max(totalIncidentReports, 1)) * 0.35 +
        averageSeverity * 6 +
        Math.min(recentEarthquake30Days * 2, 18) +
        Math.min(significantEarthquakes * 3, 20),
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
        label: 'Earthquake API + Reports',
        value: earthquakeTotalCount,
        color: hazardColors.EQ,
      },
    ],
    [accidentCount, earthquakeTotalCount, fireCount],
  )

  const statusDistribution = useMemo(
    () =>
      (['active', 'pending', 'approved', 'resolved'] as IncidentStatus[]).map((status) => ({
        label: statusLabels[status],
        value: analyticsReports.filter((report) => report.status === status).length,
      })),
    [analyticsReports],
  )

  const severityDistribution = useMemo(
    () =>
      (['Low', 'Moderate', 'High', 'Critical'] as HazardIncident['severity'][]).map((severity) => ({
        label: severity,
        value: analyticsReports.filter((report) => report.severity === severity).length,
      })),
    [analyticsReports],
  )

  const responseTimeData = useMemo(() => {
    const buckets = ['12AM - 6AM', '6AM - 12PM', '12PM - 6PM', '6PM - 12AM']

    return buckets.map((bucket) => {
      const incidents = analyticsReports.filter((report) => getPeakHourBucket(parseIncidentHour(report.time)) === bucket)
      const estimatedMinutes =
        bucket === '6AM - 12PM'
          ? 14
          : bucket === '12PM - 6PM'
            ? 18
            : bucket === '6PM - 12AM'
              ? 22
              : 26

      return {
        label: bucket,
        value: incidents.length,
        helper: `${estimatedMinutes} min estimated response`,
      }
    })
  }, [analyticsReports])

  const averageResponseMinutes = useMemo(() => {
    if (totalIncidentReports === 0) return 0

    const totalMinutes = analyticsReports.reduce((sum, report) => {
      const bucket = getPeakHourBucket(parseIncidentHour(report.time))
      if (bucket === '6AM - 12PM') return sum + 14
      if (bucket === '12PM - 6PM') return sum + 18
      if (bucket === '6PM - 12AM') return sum + 22
      return sum + 26
    }, 0)

    return Math.round(totalMinutes / totalIncidentReports)
  }, [analyticsReports, totalIncidentReports])

  const barangayRiskData = useMemo(() => {
    const map = new Map<string, RiskLocation>()

    analyticsReports.forEach((report) => {
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
      const statusScore = report.status === 'active' ? 3 : report.status === 'pending' ? 2 : 0
      const earthquakeExposureScore = getAnalyticsIncidentType(report) === 'Earthquake' ? 2 : 0

      current.incidents += 1
      current.score += severityScore + statusScore + earthquakeExposureScore
      current.responseLoad += report.status === 'resolved' ? 1 : 2
      current.severityPressure += severityScore

      if (getAnalyticsIncidentType(report) === 'Fire') current.fire += 1
      if (getAnalyticsIncidentType(report) === 'Accident') current.accident += 1
      if (getAnalyticsIncidentType(report) === 'Earthquake') current.earthquake += 1

      map.set(location, current)
    })

    earthquakeEvents.slice(0, 60).forEach((event) => {
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
  }, [earthquakeEvents, analyticsReports])

  const evacuationStats = useMemo(() => {
    const criticalCount = analyticsReports.filter((report) => report.severity === 'Critical').length
    const highCount = analyticsReports.filter((report) => report.severity === 'High').length
    const moderateCount = analyticsReports.filter((report) => report.severity === 'Moderate').length
    const earthquakeWatch = earthquakeEvents.filter((event) => event.magnitude >= 4).length + earthquakeReportCount

    return [
      {
        label: 'Immediate evacuation',
        value: criticalCount,
        helper: 'Critical severity zones',
        color: '#dc2626',
      },
      {
        label: 'Standby evacuation',
        value: highCount,
        helper: 'High severity watch areas',
        color: '#f97316',
      },
      {
        label: 'Earthquake standby',
        value: earthquakeWatch,
        helper: 'Magnitude 4+ events and EQ reports',
        color: '#10b981',
      },
      {
        label: 'Available support',
        value: Math.max(1, Math.round(totalRecords * 0.25)),
        helper: 'Estimated standby capacity',
        color: '#2563eb',
      },
      {
        label: 'Shelter monitoring',
        value: moderateCount,
        helper: 'Moderate severity monitoring',
        color: '#f59e0b',
      },
    ]
  }, [earthquakeEvents, earthquakeReportCount, analyticsReports, totalRecords])

  const monthlyTrend = useMemo<TrendItem[]>(() => {
    const months = Array.from({ length: 6 }, (_, index) => {
      const date = new Date()
      date.setMonth(date.getMonth() - (5 - index))
      return {
        label: getMonthLabel(date),
        month: date.getMonth(),
        year: date.getFullYear(),
      }
    })

    return months.map((monthInfo) => {
      const fire = analyticsReports.filter((report) => {
        const date = getReportDate(report)
        return getAnalyticsIncidentType(report) === 'Fire' && date.getMonth() === monthInfo.month && date.getFullYear() === monthInfo.year
      }).length

      const accident = analyticsReports.filter((report) => {
        const date = getReportDate(report)
        return getAnalyticsIncidentType(report) === 'Accident' && date.getMonth() === monthInfo.month && date.getFullYear() === monthInfo.year
      }).length

      const earthquakeReports = analyticsReports.filter((report) => {
        const date = getReportDate(report)
        return getAnalyticsIncidentType(report) === 'Earthquake' && date.getMonth() === monthInfo.month && date.getFullYear() === monthInfo.year
      }).length

      const apiEarthquakes = earthquakeEvents.filter((event) => {
        const date = new Date(event.rawTimestamp)
        return date.getMonth() === monthInfo.month && date.getFullYear() === monthInfo.year
      }).length

      const earthquake = earthquakeReports + apiEarthquakes

      return {
        label: monthInfo.label,
        fire,
        accident,
        earthquake,
        total: fire + accident + earthquake,
      }
    })
  }, [earthquakeEvents, analyticsReports])

  const earthquakeAnalytics = useMemo(() => {
    const magnitudeDistribution: ChartItem[] = [
      {
        label: 'Magnitude 1.0 - 2.9',
        value: earthquakeEvents.filter((event) => event.magnitude < 3).length,
        color: '#86efac',
        helper: 'Low intensity tremors',
      },
      {
        label: 'Magnitude 3.0 - 3.9',
        value: earthquakeEvents.filter((event) => event.magnitude >= 3 && event.magnitude < 4).length,
        color: '#22c55e',
        helper: 'Felt but usually minor',
      },
      {
        label: 'Magnitude 4.0 - 4.9',
        value: earthquakeEvents.filter((event) => event.magnitude >= 4 && event.magnitude < 5).length,
        color: '#f59e0b',
        helper: 'Moderate shaking watch',
      },
      {
        label: 'Magnitude 5.0+',
        value: earthquakeEvents.filter((event) => event.magnitude >= 5).length,
        color: '#ef4444',
        helper: 'High impact monitoring',
      },
    ]

    const hotspotMap = new Map<string, number>()

    earthquakeEvents.forEach((event) => {
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
    earthquakeEvents,
    maxEarthquakeMagnitude,
    recentEarthquake30Days,
    significantEarthquakes,
  ])

  const currentMonthTotal = monthlyTrend[monthlyTrend.length - 1]?.total || 0
  const previousMonthTotal = monthlyTrend[monthlyTrend.length - 2]?.total || 0
  const forecastDirection =
    currentMonthTotal > previousMonthTotal
      ? 'Increasing'
      : currentMonthTotal < previousMonthTotal
        ? 'Decreasing'
        : 'Stable'
  const projectedNextMonth = Math.max(
    0,
    currentMonthTotal + Math.round((currentMonthTotal - previousMonthTotal) * 0.65),
  )

  const radarAxes: RadarAxis[] = [
    { label: 'Incidents', value: barangayRiskData[0]?.incidents || 0 },
    { label: 'Risk', value: barangayRiskData[0]?.score || 0 },
    { label: 'Load', value: barangayRiskData[0]?.responseLoad || 0 },
    { label: 'Severity', value: barangayRiskData[0]?.severityPressure || 0 },
    { label: 'Fire', value: barangayRiskData[0]?.fire || 0 },
    { label: 'Earthquake', value: barangayRiskData[0]?.earthquake || 0 },
  ]

  const forecastCards = [
    {
      title: 'Next Month Projection',
      value: projectedNextMonth,
      note: `${forecastDirection} trend based on incident reports and earthquake API movement.`,
      tone: getRiskTone(riskScore),
    },
    {
      title: 'Fire Monitoring',
      value: getRiskLabel(percent(fireCount + activeCount, Math.max(totalRecords, 1))),
      note:
        fireCount > accidentCount
          ? 'Fire-related incidents are prominent in the dataset.'
          : 'Fire reports remain within routine monitoring range.',
      tone: getRiskTone(percent(fireCount + activeCount, Math.max(totalRecords, 1))),
    },
    {
      title: 'Road Accident Monitoring',
      value: getRiskLabel(percent(accidentCount + pendingCount, Math.max(totalRecords, 1))),
      note:
        accidentCount >= fireCount
          ? 'Accident-related incidents need closer traffic monitoring.'
          : 'Accident reports are lower than other major hazard groups.',
      tone: getRiskTone(percent(accidentCount + pendingCount, Math.max(totalRecords, 1))),
    },
    {
      title: 'Earthquake Monitoring',
      value: getRiskLabel(percent(recentEarthquake30Days + significantEarthquakes, Math.max(earthquakeApiCount, 1))),
      note:
        earthquakeApiCount > 0
          ? 'Live earthquake API data is included in risk scoring and evacuation standby.'
          : 'No live earthquake API records detected.',
      tone: getRiskTone(percent(recentEarthquake30Days + significantEarthquakes, Math.max(earthquakeApiCount, 1))),
    },
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
                DRRMO Analytics and Predictive Intelligence
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                Professional analytics view for incident reports and live earthquake API data:
                trends, disaster type analysis, earthquake monitoring, response performance,
                barangay risk, evacuation readiness, heat/risk mapping, forecasting, and severity distribution.
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

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <AnalyticsMetricCard
              accentClass="border-t-blue-600"
              helper={`${totalIncidentReports} reports + ${earthquakeApiCount} live earthquake API events.`}
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
              helper="High and critical severity incidents."
              label="High Priority"
              value={highPriorityCount}
            />
          </div>
        </div>

        <div className={`${glassPanelClass} p-5 sm:p-6`}>
          <SectionHeader
            badge="Line Chart"
            description="Monthly trend comparing Fire, Accident, live Earthquake API events, and total movement."
            eyebrow="Incident Trends"
            title="Incident Trends by Year / Month"
          />
          <MultiLineTrendChart items={monthlyTrend} />
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
            description="Dedicated earthquake analytics from the live earthquake API, including magnitude distribution, hotspots, and recent seismic activity."
            eyebrow="Earthquake Monitoring Analytics"
            title="Earthquake Monitoring Analytics"
          />

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <AnalyticsMetricCard
              accentClass="border-t-emerald-600"
              helper="Live earthquake events from the API feed."
              label="API Events"
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

        <ResponseTimeAnalysis
          averageResponseMinutes={averageResponseMinutes}
          items={responseTimeData}
        />

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
            badge="Evacuation"
            description="Estimated evacuation support categories based on severity pressure and live earthquake standby monitoring."
            eyebrow="Evacuation Statistics"
            title="Evacuation Statistics"
          />
          <HorizontalBarChart items={evacuationStats} />
        </div>

        <div className={`${glassPanelClass} p-5 sm:p-6`}>
          <SectionHeader
            badge="Heat + Risk"
            description="Combined heat map and risk map showing incident reports and API earthquake hotspot intensity."
            eyebrow="Heat Map / Risk Map"
            title="Heat Map and Risk Map"
          />
          <HeatRiskMapGrid locations={barangayRiskData} />
        </div>

        <div className={`${glassPanelClass} p-5 sm:p-6`}>
          <SectionHeader
            badge="Forecasting"
            description="Prediction cards based on report trends, disaster distribution, live earthquake activity, and active response load."
            eyebrow="Forecasting Analytics"
            title="Forecasting Analytics"
          />

          <div className="grid gap-4 lg:grid-cols-4">
            {forecastCards.map((card) => (
              <article
                className={`${glassPanelSoftClass} flex flex-col gap-3 p-5`}
                key={card.title}
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900">{card.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">{card.note}</p>
                </div>
                <span className={`w-fit rounded-full border px-3 py-1 text-xs font-bold ${card.tone}`}>
                  {card.value}
                </span>
              </article>
            ))}
          </div>
        </div>

        <div className={`${glassPanelClass} p-5 sm:p-6`}>
          <SectionHeader
            badge="Bubble Chart"
            description="Bubble size represents the number of incidents per severity category."
            eyebrow="Severity Bubble Chart"
            title="Severity Bubble Chart"
          />
          <SeverityBubbleChart items={severityDistribution} />
        </div>

        <div className={`${glassPanelClass} p-5 sm:p-6`}>
          <SectionHeader
            badge="Status"
            description="Final operational status summary for admin monitoring."
            eyebrow="Operational Status Summary"
            title="Incident Status Overview"
          />

          <div className="grid gap-3 sm:grid-cols-3">
            {statusDistribution.map((item) => (
              <article className="rounded-2xl border border-slate-100 bg-slate-50 p-4" key={item.label}>
                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
                  {item.label}
                </p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">{item.value}</p>
                <p className="text-xs font-medium text-slate-500">
                  {percent(item.value, totalIncidentReports)}% of reports
                </p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

export default AnalyticsSection
