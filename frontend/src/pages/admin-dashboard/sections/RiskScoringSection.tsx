import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { getBarangayRiskRanking, getBarangayRiskScore, getBarangays, getCitywideEarthquakeRisk } from '../../../services/api'
import type {
  Barangay,
  BarangayHazardProfileItem,
  BarangayRiskRankingItem,
  BarangayRiskScoreResponse,
  BarangayScoreHistoryItem,
  CitywideEarthquakeRiskResponse,
  IncidentTrendComparison,
} from '../../../types/api'
import { glassPanelClass } from './constants'

// ---------------------------------------------------------------------------
// Colors. Series use the dataviz palette in fixed order; risk levels use the
// status colors and always appear with an icon and a label.
// ---------------------------------------------------------------------------

const SERIES_BLUE = '#2a78d6'
const SERIES_ORANGE = '#eb6834'
const SERIES_AQUA = '#1baf7a'
const INK_MUTED = '#64748b'
const GRID = '#e2e8f0'
const SURFACE = '#ffffff'

type RiskLevelKey = 'low' | 'moderate' | 'high' | 'critical'

type RiskLevel = {
  key: RiskLevelKey
  label: string
  min: number
  max: number
  color: string
  guidance: string[]
}

// Same thresholds as before: Critical >= 8.5, High >= 7, Moderate >= 5.
const RISK_LEVELS: RiskLevel[] = [
  {
    key: 'low',
    label: 'Low',
    min: 0,
    max: 5,
    color: '#0ca30c',
    guidance: [
      'Keep standard readiness and routine patrols.',
      'Continue community awareness campaigns.',
      'Review this barangay again next month.',
    ],
  },
  {
    key: 'moderate',
    label: 'Moderate',
    min: 5,
    max: 7,
    color: '#fab219',
    guidance: [
      'Monitor incidents in this barangay every week.',
      'Check that the nearest team and vehicle are ready to respond.',
      'Coordinate with barangay officials on prevention for the top hazard.',
    ],
  },
  {
    key: 'high',
    label: 'High',
    min: 7,
    max: 8.5,
    color: '#ec835a',
    guidance: [
      'Pre-position a response team and vehicle near the hotspot.',
      'Run prevention seminars or drills on the top hazard.',
      'Review new incidents with barangay officials weekly.',
    ],
  },
  {
    key: 'critical',
    label: 'Critical',
    min: 8.5,
    max: 10,
    color: '#d03b3b',
    guidance: [
      'Put this barangay on priority dispatch.',
      'Deploy additional teams and equipment to the area.',
      'Coordinate daily with barangay officials until the score goes down.',
    ],
  },
]

function getRiskLevel(score: number): RiskLevel {
  return [...RISK_LEVELS].reverse().find((level) => score >= level.min) ?? RISK_LEVELS[0]
}

const COMPONENTS = [
  { key: 'frequency', label: 'Frequency', weight: 0.4, color: SERIES_BLUE },
  { key: 'severity', label: 'Severity', weight: 0.4, color: SERIES_ORANGE },
  { key: 'recency', label: 'Recency', weight: 0.2, color: SERIES_AQUA },
] as const

// ---------------------------------------------------------------------------
// Period filter
// ---------------------------------------------------------------------------

type PeriodMode = 'rolling' | 'range' | 'month'

type PeriodState = {
  mode: PeriodMode
  days: number
  startDate: string
  endDate: string
  year: string
  month: string
}

const ROLLING_OPTIONS = [30, 60, 90, 180, 365]

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, index) => ({
  value: String(index + 1),
  label: new Date(2026, index, 1).toLocaleDateString(undefined, { month: 'long' }),
}))

function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function formatShortDate(value: string): string {
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function monthName(month: number): string {
  return new Date(2026, month - 1, 1).toLocaleDateString(undefined, { month: 'long' })
}

/** API options for the chosen period, or an error message when it is incomplete. */
function resolvePeriod(period: PeriodState): {
  query: { days?: number; startDate?: string; endDate?: string; year?: number; month?: number }
  label: string
  error: string | null
} {
  if (period.mode === 'range') {
    if (!period.startDate || !period.endDate) {
      return { query: {}, label: 'Custom range', error: 'Choose both a start date and an end date.' }
    }
    if (period.startDate > period.endDate) {
      return { query: {}, label: 'Custom range', error: 'The start date must be on or before the end date.' }
    }
    const range = { startDate: period.startDate, endDate: period.endDate }
    return { query: range, label: `${formatShortDate(period.startDate)} – ${formatShortDate(period.endDate)}`, error: null }
  }

  if (period.mode === 'month') {
    const year = Number(period.year)
    const month = period.month ? Number(period.month) : undefined
    return {
      query: { year, month },
      label: month ? `${monthName(month)} ${year}` : `All of ${year}`,
      error: null,
    }
  }

  return { query: { days: period.days }, label: `Last ${period.days} days`, error: null }
}

// ---------------------------------------------------------------------------
// Small building blocks
// ---------------------------------------------------------------------------

/** Width of a chart's container, so SVG text keeps its real size. */
function useMeasuredWidth(initial = 640) {
  const [width, setWidth] = useState(initial)
  const ref = useCallback((node: HTMLDivElement | null) => {
    if (!node) return undefined
    const update = () => setWidth(Math.max(260, Math.floor(node.getBoundingClientRect().width)))
    update()
    if (typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(update)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  return [ref, width] as const
}

function RiskIcon({ level, className = 'h-3.5 w-3.5' }: { level: RiskLevelKey; className?: string }) {
  const paths: Record<RiskLevelKey, string> = {
    low: 'M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
    moderate: 'M12 9v3.75m0 3.75h.008M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
    high: 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z',
    critical: 'M12 9v3.75m0 3.75h.008M8.25 3h7.5L21 8.25v7.5L15.75 21h-7.5L3 15.75v-7.5L8.25 3Z',
  }
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d={paths[level]} />
    </svg>
  )
}

function RiskBadge({ score, size = 'sm' }: { score: number; size?: 'sm' | 'lg' }) {
  const level = getRiskLevel(score)
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-bold text-slate-900 ${size === 'lg' ? 'px-3 py-1 text-sm' : 'px-2 py-0.5 text-xs'}`}
      style={{ borderColor: level.color, backgroundColor: `${level.color}1f` }}
    >
      <span style={{ color: level.color }}>
        <RiskIcon level={level.key} className={size === 'lg' ? 'h-4 w-4' : 'h-3.5 w-3.5'} />
      </span>
      {level.label}
    </span>
  )
}

function Card({ eyebrow, title, aside, children, className = '' }: { eyebrow: string; title: string; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <article className={`${glassPanelClass} min-w-0 p-5 sm:p-6 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{eyebrow}</p>
          <h2 className="mt-1 text-lg font-bold text-slate-900">{title}</h2>
        </div>
        {aside}
      </div>
      <div className="mt-4">{children}</div>
    </article>
  )
}

function EmptyState({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">{children}</div>
}

function Tooltip({ x, y, width, children }: { x: number; y: number; width: number; children: ReactNode }) {
  const left = Math.min(Math.max(x, 90), width - 90)
  return (
    <div
      className="pointer-events-none absolute z-10 w-max max-w-[220px] -translate-x-1/2 -translate-y-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-lg"
      style={{ left, top: Math.max(y - 10, 0) }}
      role="status"
    >
      {children}
    </div>
  )
}

function SegmentedControl<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (value: T) => void }) {
  return (
    <div className="grid w-full auto-cols-fr grid-flow-col rounded-xl border border-slate-200 bg-slate-100 p-1 sm:inline-grid sm:w-auto" role="radiogroup">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={`whitespace-nowrap rounded-lg px-2 py-1.5 text-xs font-semibold transition sm:px-3 sm:text-sm ${value === option.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

const selectClass =
  'mt-1.5 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100 disabled:text-slate-400'

// ---------------------------------------------------------------------------
// Priority ranking (all barangays)
// ---------------------------------------------------------------------------

function RiskLegend() {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-xs text-slate-600">
      {RISK_LEVELS.map((level) => (
        <span key={level.key} className="inline-flex items-center gap-1">
          <span style={{ color: level.color }}>
            <RiskIcon level={level.key} />
          </span>
          {level.label}
          <span className="text-slate-400">{level.key === 'low' ? '< 5' : level.key === 'critical' ? '≥ 8.5' : `${level.min}–${level.max}`}</span>
        </span>
      ))}
    </div>
  )
}

function PriorityRanking({
  rows,
  isLoading,
  error,
  selectedId,
  onSelect,
}: {
  rows: BarangayRiskRankingItem[]
  isLoading: boolean
  error: string | null
  selectedId: string
  onSelect: (id: string) => void
}) {
  const [showAll, setShowAll] = useState(false)
  const [hovered, setHovered] = useState<{ row: BarangayRiskRankingItem; x: number; y: number } | null>(null)
  const [containerRef, width] = useMeasuredWidth(420)

  const withIncidents = rows.filter((row) => row.total_incidents > 0)
  const shown = showAll ? withIncidents : withIncidents.slice(0, 10)
  const quiet = rows.length - withIncidents.length

  return (
    <Card eyebrow="City-wide" title="Priority barangays" aside={<RiskLegend />}>
      {isLoading ? (
        <EmptyState>Scoring every barangay…</EmptyState>
      ) : error ? (
        <EmptyState>{error}</EmptyState>
      ) : withIncidents.length === 0 ? (
        <EmptyState>No barangay has incidents in this period.</EmptyState>
      ) : (
        <div ref={containerRef} className="relative w-full min-w-0" onMouseLeave={() => setHovered(null)}>
          <p className="mb-3 text-xs text-slate-500">Highest risk score first. Select a barangay to see its details.</p>
          <ol className="space-y-1">
            {shown.map((row, index) => {
              const level = getRiskLevel(row.score)
              const isSelected = row.barangay_id === selectedId
              return (
                <li key={row.barangay_id}>
                  <button
                    type="button"
                    onClick={() => onSelect(row.barangay_id)}
                    onMouseMove={(event) => {
                      const box = event.currentTarget.parentElement?.parentElement?.getBoundingClientRect()
                      if (box) setHovered({ row, x: event.clientX - box.left, y: event.clientY - box.top + 8 })
                    }}
                    onFocus={(event) => {
                      const box = event.currentTarget.parentElement?.parentElement?.getBoundingClientRect()
                      const own = event.currentTarget.getBoundingClientRect()
                      if (box) setHovered({ row, x: own.left - box.left + own.width / 2, y: own.top - box.top + 8 })
                    }}
                    onBlur={() => setHovered(null)}
                    aria-pressed={isSelected}
                    aria-label={`${row.barangay_name}: score ${row.score.toFixed(1)}, ${level.label}, ${row.total_incidents} incidents`}
                    className={`grid w-full grid-cols-[1.5rem_minmax(0,9rem)_1fr_2.5rem] items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition sm:grid-cols-[1.5rem_minmax(0,11rem)_1fr_2.5rem] ${isSelected ? 'bg-blue-50 ring-1 ring-blue-200' : 'hover:bg-slate-50'}`}
                  >
                    <span className="text-xs tabular-nums text-slate-400">{index + 1}</span>
                    <span className={`truncate ${isSelected ? 'font-bold text-slate-900' : 'font-medium text-slate-700'}`}>{row.barangay_name}</span>
                    <span className="relative h-3 rounded bg-slate-100">
                      <span className="absolute inset-y-0 left-0 rounded-r" style={{ width: `${(row.score / 10) * 100}%`, backgroundColor: level.color }} />
                    </span>
                    <span className="text-right font-semibold tabular-nums text-slate-900">{row.score.toFixed(1)}</span>
                  </button>
                </li>
              )
            })}
          </ol>
          {hovered && (
            <Tooltip x={hovered.x} y={hovered.y} width={width}>
              <p className="font-bold text-slate-900">{hovered.row.barangay_name}</p>
              <p className="mt-0.5 flex items-center gap-1.5">
                Score {hovered.row.score.toFixed(1)} <RiskBadge score={hovered.row.score} />
              </p>
              <p className="mt-1 text-slate-500">
                {hovered.row.total_incidents} incident{hovered.row.total_incidents === 1 ? '' : 's'} · Frequency {hovered.row.breakdown.frequency.toFixed(1)} · Severity {hovered.row.breakdown.severity.toFixed(1)} · Recency {hovered.row.breakdown.recency.toFixed(1)}
              </p>
            </Tooltip>
          )}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <span>
              {withIncidents.length} of {rows.length} barangays had incidents{quiet > 0 ? `; ${quiet} had none (baseline score 1.0).` : '.'}
            </span>
            {withIncidents.length > 10 && (
              <button type="button" onClick={() => setShowAll((value) => !value)} className="font-semibold text-blue-700 hover:text-blue-900">
                {showAll ? 'Show top 10' : `Show all ${withIncidents.length}`}
              </button>
            )}
          </div>
        </div>
      )}
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Selected barangay: score, how it is built, prediction
// ---------------------------------------------------------------------------

function ScoreScale({ score }: { score: number }) {
  return (
    <div>
      <div className="relative flex h-3 gap-[2px]">
        {RISK_LEVELS.map((level) => (
          <span key={level.key} className="h-full first:rounded-l last:rounded-r" style={{ width: `${((level.max - level.min) / 10) * 100}%`, backgroundColor: `${level.color}40` }} />
        ))}
        <span
          className="absolute -top-1 h-5 w-1 -translate-x-1/2 rounded-full bg-slate-900 ring-2 ring-white"
          style={{ left: `${Math.min(100, Math.max(0, (score / 10) * 100))}%` }}
          aria-hidden="true"
        />
      </div>
      <div className="relative mt-1.5 h-4 text-[11px] tabular-nums text-slate-400">
        {[0, 5, 7, 8.5, 10].map((tick) => (
          <span key={tick} className="absolute -translate-x-1/2 first:translate-x-0 last:-translate-x-full" style={{ left: `${tick * 10}%` }}>
            {tick}
          </span>
        ))}
      </div>
    </div>
  )
}

function ScoreComposition({ riskData }: { riskData: BarangayRiskScoreResponse }) {
  const breakdown = riskData.risk_score.breakdown
  const explanation = riskData.risk_score.explanation
  const parts = COMPONENTS.map((component) => {
    const value = Number(breakdown[component.key] ?? 0)
    return { ...component, value, points: value * component.weight }
  })
  const total = Math.max(0.0001, parts.reduce((sum, part) => sum + part.points, 0))
  const totalIncidents = explanation?.total_incidents ?? riskData.barangay_profile?.total ?? 0

  const notes: Record<(typeof COMPONENTS)[number]['key'], string> = {
    frequency: `${totalIncidents} incident${totalIncidents === 1 ? '' : 's'} in the period (5 incidents = 1 point, up to 10).`,
    severity: explanation ? `Average severity ${explanation.average_severity_weight} of 4.` : 'Average severity of the incidents.',
    recency: explanation
      ? `${explanation.recent_incidents_30_days} of ${totalIncidents} incidents happened in the last 30 days (counted from today).`
      : 'Share of incidents in the last 30 days.',
  }

  return (
    <div>
      <p className="text-sm font-semibold text-slate-900">How the score is built</p>
      <div className="mt-2 flex h-3 gap-[2px] overflow-hidden rounded" style={{ width: `${Math.min(100, (total / 10) * 100)}%`, minWidth: '2rem' }}>
        {parts.map((part) => (
          <span key={part.key} className="h-full" style={{ width: `${(part.points / total) * 100}%`, backgroundColor: part.color }} title={`${part.label}: ${part.points.toFixed(1)} points`} />
        ))}
      </div>
      <ul className="mt-3 space-y-2">
        {parts.map((part) => (
          <li key={part.key} className="grid grid-cols-[0.75rem_1fr_auto] items-start gap-x-2 text-sm">
            <span className="mt-1.5 h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: part.color }} aria-hidden="true" />
            <span>
              <span className="font-semibold text-slate-800">{part.label}</span>
              <span className="text-slate-500"> · {part.value.toFixed(1)} × {Math.round(part.weight * 100)}%</span>
              <span className="block text-xs text-slate-500">{notes[part.key]}</span>
            </span>
            <span className="font-semibold tabular-nums text-slate-900">{part.points.toFixed(1)}</span>
          </li>
        ))}
      </ul>
      {totalIncidents === 0 && <p className="mt-2 text-xs text-slate-500">No incidents in this period, so the minimum score of 1.0 applies.</p>}
    </div>
  )
}

function BarangayScoreCard({ name, riskData, isLoading, error }: { name: string; riskData: BarangayRiskScoreResponse | null; isLoading: boolean; error: string | null }) {
  const score = riskData?.risk_score.score ?? 0
  return (
    <Card eyebrow="Selected barangay" title={name || 'Select a barangay'}>
      {error ? (
        <EmptyState>{error}</EmptyState>
      ) : isLoading && !riskData ? (
        <EmptyState>Calculating risk score…</EmptyState>
      ) : !riskData ? (
        <EmptyState>Select a barangay to see its risk score.</EmptyState>
      ) : (
        <div className={`space-y-5 transition-opacity ${isLoading ? 'opacity-60' : ''}`}>
          <div className="flex flex-wrap items-end gap-3">
            <p className="text-5xl font-black leading-none tabular-nums text-slate-900" data-testid="risk-score">
              {score.toFixed(1)}
              <span className="ml-1 text-lg font-semibold text-slate-400">/ 10</span>
            </p>
            <RiskBadge score={score} size="lg" />
          </div>
          <ScoreScale score={score} />
          <ScoreComposition riskData={riskData} />
        </div>
      )}
    </Card>
  )
}

// The USGS sync runs daily; when the newest stored event is older than this, the feed may have stopped.
const EARTHQUAKE_FEED_STALE_DAYS = 7

function daysSince(value?: string | null): number | null {
  const time = new Date(value || '').getTime()
  return Number.isNaN(time) ? null : Math.floor((Date.now() - time) / 86_400_000)
}

function formatEventDate(value?: string | null): string {
  const date = new Date(value || '')
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}

function CitywideEarthquakeScoreCard({ riskData, isLoading, error, onRetry }: {
  riskData: CitywideEarthquakeRiskResponse | null
  isLoading: boolean
  error: string | null
  onRetry: () => void
}) {
  const events = riskData?.risk_score.explanation.total_incidents ?? 0
  const feedAge = daysSince(riskData?.latest_feed_event_at)
  const feedMissing = Boolean(riskData) && !riskData?.latest_feed_event_at
  const feedStale = feedAge !== null && feedAge > EARTHQUAKE_FEED_STALE_DAYS

  return (
    <Card eyebrow="Macro-hazard · Last 90 days" title="City-wide earthquake risk">
      {error ? (
        <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p>{error} The barangay scores below are not affected.</p>
          <button type="button" onClick={onRetry} className="mt-2 font-semibold underline underline-offset-2">
            Try again
          </button>
        </div>
      ) : isLoading && !riskData ? (
        <EmptyState>Calculating city-wide earthquake risk…</EmptyState>
      ) : !riskData ? (
        <EmptyState>City-wide earthquake risk is unavailable.</EmptyState>
      ) : (
        <div className={`space-y-4 transition-opacity ${isLoading ? 'opacity-60' : ''}`}>
          <div className="flex flex-wrap items-end gap-3">
            <p className="text-5xl font-black leading-none tabular-nums text-slate-900">
              {riskData.risk_score.score.toFixed(1)}
              <span className="ml-1 text-lg font-semibold text-slate-400">/ 10</span>
            </p>
            <RiskBadge score={riskData.risk_score.score} size="lg" />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {COMPONENTS.map((component) => (
              <div key={component.key} className="rounded-xl border border-slate-200 bg-white/70 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{component.label} · {Math.round(component.weight * 100)}% weight</p>
                <p className="mt-1 text-lg font-bold tabular-nums text-slate-900">
                  {riskData.risk_score.breakdown[component.key].toFixed(1)} <span className="text-sm font-medium text-slate-400">/ 10</span>
                </p>
              </div>
            ))}
          </div>
          {events === 0 ? (
            <p className="rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
              No earthquakes with an epicenter in the Lucena City area were recorded in the last {riskData.timeframe_days} days, so the
              lowest baseline score is shown.
              {riskData.latest_lucena_event_at ? ` The last one was on ${formatEventDate(riskData.latest_lucena_event_at)}.` : ''}
            </p>
          ) : null}
          {feedMissing || feedStale ? (
            <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
              {feedMissing
                ? 'No earthquake data has been imported yet. Run the USGS sync (sync_earthquake_events) so this score has data.'
                : `The newest stored earthquake is from ${formatEventDate(riskData.latest_feed_event_at)}. The daily USGS sync may have stopped, so this score could be out of date.`}
            </p>
          ) : null}
          <p className="text-xs leading-relaxed text-slate-500">
            Based on {events} earthquake event{events === 1 ? '' : 's'} with an epicenter inside the Lucena City area in the last{' '}
            {riskData.timeframe_days} days. Epicenters are not assigned to any barangay, so this score is separate from the barangay
            ranking and its period filter.
          </p>
        </div>
      )}
    </Card>
  )
}

function PredictionCard({ riskData }: { riskData: BarangayRiskScoreResponse | null }) {
  const prediction = riskData?.hazard_prediction
  const probability = Number(prediction?.probability ?? 0)
  const level = getRiskLevel(riskData?.risk_score.score ?? 0)

  return (
    <Card eyebrow="Next 30 days" title="Most likely hazard">
      {!prediction?.hazard ? (
        <EmptyState>{prediction?.reason || 'No incidents to base a prediction on.'}</EmptyState>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-2xl font-bold text-slate-900" data-testid="predicted-hazard">{prediction.hazard}</p>
            {prediction.confidence && (
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">{prediction.confidence} confidence</span>
            )}
          </div>
          <div>
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-slate-600">Share of weighted risk</span>
              <span className="font-bold tabular-nums text-slate-900">{probability.toFixed(1)}%</span>
            </div>
            <div className="mt-1.5 h-2.5 rounded bg-slate-100">
              <div className="h-full rounded" style={{ width: `${Math.min(100, probability)}%`, backgroundColor: SERIES_BLUE }} />
            </div>
          </div>
          <p className="text-sm leading-6 text-slate-600">{prediction.reason || prediction.driver}</p>
        </div>
      )}

      <div className="mt-5 border-t border-slate-100 pt-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          Recommended response <RiskBadge score={riskData?.risk_score.score ?? 0} />
        </p>
        <ul className="mt-2 space-y-1.5">
          {level.guidance.map((item) => (
            <li key={item} className="flex gap-2 text-sm text-slate-600">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" aria-hidden="true" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Hazard breakdown (one chart instead of the list, donut and leaderboard)
// ---------------------------------------------------------------------------

function HazardBreakdown({ hazards, isLoading }: { hazards: Record<string, BarangayHazardProfileItem>; isLoading: boolean }) {
  const rows = Object.entries(hazards)
    .map(([name, item]) => ({ name, ...item }))
    .sort((a, b) => b.combined_score - a.combined_score)
  const totalScore = rows.reduce((sum, row) => sum + row.combined_score, 0)
  const maxScore = Math.max(1, ...rows.map((row) => row.combined_score))

  return (
    <Card eyebrow="Risk breakdown" title="What drives the score">
      {isLoading && rows.length === 0 ? (
        <EmptyState>Loading hazards…</EmptyState>
      ) : rows.length === 0 ? (
        <EmptyState>No incidents for this barangay in the selected period.</EmptyState>
      ) : (
        <div>
          <p className="mb-3 text-xs text-slate-500">Weighted risk = incidents × average severity (1 Low to 4 Critical).</p>
          <div className="hidden grid-cols-[minmax(0,10rem)_1fr_4rem_4rem_4rem] gap-3 px-1 pb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400 sm:grid">
            <span>Hazard</span>
            <span>Weighted risk</span>
            <span className="text-right">Share</span>
            <span className="text-right">Incidents</span>
            <span className="text-right">Avg sev.</span>
          </div>
          <ul className="space-y-2">
            {rows.map((row) => (
              <li
                key={row.name}
                className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 rounded-lg px-1 py-1.5 sm:grid-cols-[minmax(0,10rem)_1fr_4rem_4rem_4rem] sm:items-center"
                title={`${row.name}: ${row.frequency} incidents, average severity ${row.severity_weight}`}
              >
                <span className="truncate text-sm font-semibold text-slate-800">{row.name}</span>
                <span className="text-right text-sm font-semibold tabular-nums text-slate-900 sm:hidden">
                  {totalScore > 0 ? ((row.combined_score / totalScore) * 100).toFixed(0) : 0}%
                </span>
                <span className="col-span-2 h-2.5 rounded bg-slate-100 sm:col-span-1">
                  <span className="block h-full rounded-r" style={{ width: `${(row.combined_score / maxScore) * 100}%`, backgroundColor: SERIES_BLUE }} />
                </span>
                <span className="hidden text-right text-sm font-semibold tabular-nums text-slate-900 sm:block">
                  {totalScore > 0 ? ((row.combined_score / totalScore) * 100).toFixed(0) : 0}%
                </span>
                <span className="col-span-2 text-xs text-slate-500 sm:col-span-1 sm:text-right sm:text-sm sm:tabular-nums sm:text-slate-700">
                  <span className="sm:hidden">{row.frequency} incidents · avg severity {row.severity_weight.toFixed(1)}</span>
                  <span className="hidden sm:inline">{row.frequency}</span>
                </span>
                <span className="hidden text-right text-sm tabular-nums text-slate-700 sm:block">{row.severity_weight.toFixed(1)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Score history
// ---------------------------------------------------------------------------

function ScoreHistoryChart({ data }: { data: BarangayScoreHistoryItem[] }) {
  const [containerRef, width] = useMeasuredWidth()
  const [active, setActive] = useState<number | null>(null)

  const height = 220
  const pad = { top: 16, right: 64, bottom: 28, left: 32 }
  const innerWidth = width - pad.left - pad.right
  const innerHeight = height - pad.top - pad.bottom
  const x = (index: number) => pad.left + (data.length > 1 ? (index / (data.length - 1)) * innerWidth : innerWidth / 2)
  const y = (score: number) => pad.top + innerHeight - (score / 10) * innerHeight
  const path = data.map((item, index) => `${index === 0 ? 'M' : 'L'}${x(index)},${y(item.score)}`).join(' ')
  const activeItem = active !== null ? data[active] : null

  return (
    <Card eyebrow="Risk trend" title="Score history" aside={<span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">6 periods of 30 days, up to today</span>}>
      {data.length === 0 ? (
        <EmptyState>No score history yet.</EmptyState>
      ) : (
        <div ref={containerRef} className="relative w-full min-w-0" onMouseLeave={() => setActive(null)}>
          <svg
            width={width}
            height={height}
            role="img"
            aria-label={`Risk score over the last ${data.length} periods, from ${data[0].score} to ${data[data.length - 1].score}`}
            onMouseMove={(event) => {
              const box = event.currentTarget.getBoundingClientRect()
              const relative = (event.clientX - box.left - pad.left) / Math.max(1, innerWidth)
              setActive(Math.min(data.length - 1, Math.max(0, Math.round(relative * (data.length - 1)))))
            }}
          >
            {RISK_LEVELS.map((level) => (
              <g key={level.key}>
                <rect x={pad.left} width={innerWidth} y={y(level.max)} height={y(level.min) - y(level.max)} fill={level.color} opacity={0.07} />
                {level.min > 0 && <line x1={pad.left} x2={pad.left + innerWidth} y1={y(level.min)} y2={y(level.min)} stroke={GRID} />}
                <text x={pad.left + innerWidth + 8} y={(y(level.min) + y(level.max)) / 2 + 4} fontSize={11} fill={INK_MUTED}>
                  {level.label}
                </text>
              </g>
            ))}
            {[0, 5, 10].map((tick) => (
              <text key={tick} x={pad.left - 8} y={y(tick) + 4} textAnchor="end" fontSize={11} fill={INK_MUTED}>
                {tick}
              </text>
            ))}
            {activeItem && active !== null && <line x1={x(active)} x2={x(active)} y1={pad.top} y2={pad.top + innerHeight} stroke="#94a3b8" strokeDasharray="3 3" />}
            <path d={path} fill="none" stroke={SERIES_BLUE} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            {data.map((item, index) => (
              <circle key={item.date} cx={x(index)} cy={y(item.score)} r={active === index ? 5.5 : 4} fill={SERIES_BLUE} stroke={SURFACE} strokeWidth={2} />
            ))}
            {data.map((item, index) => (
              <text key={`label-${item.date}`} x={x(index)} y={height - 8} textAnchor="middle" fontSize={11} fill={INK_MUTED}>
                {new Date(`${item.date}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </text>
            ))}
          </svg>
          {activeItem && active !== null && (
            <Tooltip x={x(active)} y={y(activeItem.score)} width={width}>
              <p className="font-semibold text-slate-900">30 days to {formatShortDate(activeItem.date)}</p>
              <p className="mt-0.5 flex items-center gap-1.5">
                Score <b className="tabular-nums">{activeItem.score.toFixed(1)}</b> <RiskBadge score={activeItem.score} />
              </p>
              <p className="mt-1 text-slate-500">
                Frequency {activeItem.frequency.toFixed(1)} · Severity {activeItem.severity.toFixed(1)} · Recency {activeItem.recency.toFixed(1)}
              </p>
            </Tooltip>
          )}
        </div>
      )}
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Period comparison (running total of incidents)
// ---------------------------------------------------------------------------

function periodName(period: IncidentTrendComparison['current_period']): string {
  return period.month ? `${monthName(period.month)} ${period.year}` : String(period.year)
}

function cumulative(values: { date: string; count: number }[]): number[] {
  let running = 0
  return values.map((item) => (running += item.count))
}

function PeriodComparison({
  comparison,
  controls,
}: {
  comparison: IncidentTrendComparison | null | undefined
  controls: ReactNode
}) {
  const [containerRef, width] = useMeasuredWidth()
  const [active, setActive] = useState<number | null>(null)

  // Days after today have no data yet, so the current line stops at today.
  const today = toIsoDate(new Date())
  const current = (comparison?.current_period.daily_reports ?? []).filter((item) => item.date <= today)
  const previous = comparison?.comparison_period.daily_reports ?? []
  const currentRun = cumulative(current)
  const previousRun = cumulative(previous)
  const length = Math.max(comparison?.current_period.daily_reports.length ?? 0, previous.length)

  const height = 240
  const pad = { top: 16, right: 16, bottom: 28, left: 36 }
  const innerWidth = width - pad.left - pad.right
  const innerHeight = height - pad.top - pad.bottom
  const maxValue = Math.max(1, ...currentRun, ...previousRun)
  const niceMax = maxValue <= 5 ? maxValue : Math.ceil(maxValue / 5) * 5
  const x = (index: number) => pad.left + (length > 1 ? (index / (length - 1)) * innerWidth : innerWidth / 2)
  const y = (value: number) => pad.top + innerHeight - (value / niceMax) * innerHeight
  const line = (run: number[]) => run.map((value, index) => `${index === 0 ? 'M' : 'L'}${x(index)},${y(value)}`).join(' ')

  // Month ticks for long periods, day numbers for one month.
  const ticks: { index: number; label: string }[] =
    length > 62
      ? (comparison?.current_period.daily_reports ?? []).flatMap((item, index) => {
          const date = new Date(`${item.date}T00:00:00`)
          return date.getDate() === 1 ? [{ index, label: date.toLocaleDateString(undefined, { month: 'short' }) }] : []
        })
      : [0, 7, 14, 21, 28].filter((index) => index < length).map((index) => ({ index, label: `Day ${index + 1}` }))

  const percent = comparison?.trend.percent_change
  const currentTotal = comparison?.current_period.total ?? 0
  const previousTotal = comparison?.comparison_period.total ?? 0
  const change =
    !comparison
      ? ''
      : percent === null || percent === undefined
        ? currentTotal > 0
          ? `New: no incidents in ${periodName(comparison.comparison_period)}`
          : 'No incidents in either period'
        : percent === 0
          ? 'No change'
          : `${percent > 0 ? '▲' : '▼'} ${Math.abs(percent).toFixed(0)}% ${percent > 0 ? 'more' : 'fewer'} incidents`

  const yTicks = Array.from(new Set([0, Math.round(niceMax / 2), niceMax]))

  return (
    <Card eyebrow="Incident trend" title="Period comparison" aside={controls}>
      {!comparison || length === 0 ? (
        <EmptyState>No incident records for these periods.</EmptyState>
      ) : (
        <div>
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-slate-50 px-4 py-3">
              <p className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                <span className="h-0.5 w-4 rounded" style={{ backgroundColor: SERIES_BLUE }} aria-hidden="true" />
                {periodName(comparison.current_period)}
              </p>
              <p className="mt-1 text-2xl font-black tabular-nums text-slate-900">{currentTotal}</p>
              <p className="text-xs text-slate-500">incidents</p>
            </div>
            <div className="rounded-xl bg-slate-50 px-4 py-3">
              <p className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                <span className="h-0 w-4 border-t-2 border-dashed" style={{ borderColor: SERIES_ORANGE }} aria-hidden="true" />
                {periodName(comparison.comparison_period)}
              </p>
              <p className="mt-1 text-2xl font-black tabular-nums text-slate-900">{previousTotal}</p>
              <p className="text-xs text-slate-500">incidents</p>
            </div>
            <div className="rounded-xl bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold text-slate-500">Change</p>
              <p className="mt-1 text-base font-bold text-slate-900" data-testid="trend-change">{change}</p>
              <p className="text-xs text-slate-500">compared with {periodName(comparison.comparison_period)}</p>
            </div>
          </div>

          <p className="mb-2 text-xs text-slate-500">Running total of incidents from the start of each period.</p>
          <div ref={containerRef} className="relative w-full min-w-0" onMouseLeave={() => setActive(null)}>
            <svg
              width={width}
              height={height}
              role="img"
              aria-label={`Running total of incidents: ${currentTotal} in ${periodName(comparison.current_period)} and ${previousTotal} in ${periodName(comparison.comparison_period)}`}
              onMouseMove={(event) => {
                const box = event.currentTarget.getBoundingClientRect()
                const relative = (event.clientX - box.left - pad.left) / Math.max(1, innerWidth)
                setActive(Math.min(length - 1, Math.max(0, Math.round(relative * (length - 1)))))
              }}
            >
              {yTicks.map((tick) => (
                <g key={tick}>
                  <line x1={pad.left} x2={pad.left + innerWidth} y1={y(tick)} y2={y(tick)} stroke={GRID} />
                  <text x={pad.left - 8} y={y(tick) + 4} textAnchor="end" fontSize={11} fill={INK_MUTED}>
                    {tick}
                  </text>
                </g>
              ))}
              {ticks.map((tick) => (
                <text key={tick.index} x={x(tick.index)} y={height - 8} textAnchor="middle" fontSize={11} fill={INK_MUTED}>
                  {tick.label}
                </text>
              ))}
              {active !== null && <line x1={x(active)} x2={x(active)} y1={pad.top} y2={pad.top + innerHeight} stroke="#94a3b8" strokeDasharray="3 3" />}
              {previousRun.length > 0 && <path d={line(previousRun)} fill="none" stroke={SERIES_ORANGE} strokeWidth={2} strokeDasharray="6 4" strokeLinejoin="round" />}
              {currentRun.length > 0 && <path d={line(currentRun)} fill="none" stroke={SERIES_BLUE} strokeWidth={2} strokeLinejoin="round" />}
              {active !== null && active < previousRun.length && <circle cx={x(active)} cy={y(previousRun[active])} r={4} fill={SERIES_ORANGE} stroke={SURFACE} strokeWidth={2} />}
              {active !== null && active < currentRun.length && <circle cx={x(active)} cy={y(currentRun[active])} r={4} fill={SERIES_BLUE} stroke={SURFACE} strokeWidth={2} />}
            </svg>
            {active !== null && (
              <Tooltip x={x(active)} y={y(Math.max(currentRun[active] ?? 0, previousRun[active] ?? 0))} width={width}>
                <p className="font-semibold text-slate-900">Day {active + 1}</p>
                {current[active] && (
                  <p className="mt-0.5 flex items-center gap-1.5">
                    <span className="h-0.5 w-3 rounded" style={{ backgroundColor: SERIES_BLUE }} aria-hidden="true" />
                    {formatShortDate(current[active].date)}: <b className="tabular-nums">{currentRun[active]}</b> so far
                  </p>
                )}
                {previous[active] && (
                  <p className="mt-0.5 flex items-center gap-1.5">
                    <span className="h-0 w-3 border-t-2 border-dashed" style={{ borderColor: SERIES_ORANGE }} aria-hidden="true" />
                    {formatShortDate(previous[active].date)}: <b className="tabular-nums">{previousRun[active]}</b> so far
                  </p>
                )}
              </Tooltip>
            )}
          </div>
        </div>
      )}
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function RiskScoringSection() {
  const currentYear = new Date().getFullYear()
  const yearOptions = useMemo(() => Array.from({ length: 8 }, (_, index) => String(currentYear - index)), [currentYear])

  const [barangays, setBarangays] = useState<Barangay[]>([])
  const [selectedBarangayId, setSelectedBarangayId] = useState('')
  const [period, setPeriod] = useState<PeriodState>({ mode: 'rolling', days: 90, startDate: '', endDate: '', year: String(currentYear), month: '' })
  const [compareYear, setCompareYear] = useState('')
  const [compareMonth, setCompareMonth] = useState('')

  const [ranking, setRanking] = useState<BarangayRiskRankingItem[]>([])
  const [rankingLoading, setRankingLoading] = useState(true)
  const [rankingError, setRankingError] = useState<string | null>(null)

  const [riskData, setRiskData] = useState<BarangayRiskScoreResponse | null>(null)
  const [riskLoading, setRiskLoading] = useState(false)
  const [riskError, setRiskError] = useState<string | null>(null)

  const [citywideEarthquakeRisk, setCitywideEarthquakeRisk] = useState<CitywideEarthquakeRiskResponse | null>(null)
  const [citywideEarthquakeLoading, setCitywideEarthquakeLoading] = useState(true)
  const [citywideEarthquakeError, setCitywideEarthquakeError] = useState<string | null>(null)
  const [earthquakeReloadKey, setEarthquakeReloadKey] = useState(0)

  const resolved = useMemo(() => resolvePeriod(period), [period])
  const queryKey = JSON.stringify(resolved.query)
  // Compare month only makes sense when a single month is being viewed.
  const canCompareMonth = period.mode === 'month' && Boolean(period.month)

  const updatePeriod = (patch: Partial<PeriodState>) => setPeriod((current) => ({ ...current, ...patch }))

  useEffect(() => {
    let active = true
    getBarangays()
      .then((results) => {
        if (active) setBarangays(results)
      })
      .catch((error) => console.error('[RiskScoringSection] Failed to load barangays:', error))
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true
    setCitywideEarthquakeLoading(true)
    setCitywideEarthquakeError(null)
    getCitywideEarthquakeRisk()
      .then((response) => {
        if (active) setCitywideEarthquakeRisk(response)
      })
      .catch((error) => {
        console.error('[RiskScoringSection] Failed to load city-wide earthquake risk:', error)
        if (active) {
          setCitywideEarthquakeRisk(null)
          setCitywideEarthquakeError('Could not load the city-wide earthquake risk.')
        }
      })
      .finally(() => {
        if (active) setCitywideEarthquakeLoading(false)
      })
    return () => {
      active = false
    }
  }, [earthquakeReloadKey])

  // City-wide ranking for the period; it also picks the first barangay to show.
  useEffect(() => {
    if (resolved.error) return
    let active = true
    setRankingLoading(true)
    setRankingError(null)
    getBarangayRiskRanking(JSON.parse(queryKey))
      .then((response) => {
        if (!active) return
        setRanking(response.results)
        setSelectedBarangayId((current) => current || response.results.find((row) => row.total_incidents > 0)?.barangay_id || response.results[0]?.barangay_id || '')
      })
      .catch((error) => {
        console.error('[RiskScoringSection] Failed to load ranking:', error)
        if (active) setRankingError('Could not load the barangay ranking.')
      })
      .finally(() => {
        if (active) setRankingLoading(false)
      })
    return () => {
      active = false
    }
  }, [queryKey, resolved.error])

  // Details for the selected barangay.
  useEffect(() => {
    if (!selectedBarangayId || resolved.error) return
    let active = true
    setRiskLoading(true)
    setRiskError(null)
    getBarangayRiskScore(selectedBarangayId, {
      ...JSON.parse(queryKey),
      compareYear: compareYear ? Number(compareYear) : undefined,
      compareMonth: canCompareMonth && compareYear && compareMonth ? Number(compareMonth) : undefined,
    })
      .then((data) => {
        if (active) setRiskData(data)
      })
      .catch((error) => {
        console.error('[RiskScoringSection] Failed to load risk score:', error)
        if (active) {
          setRiskData(null)
          setRiskError('Could not load the risk score. Please try again.')
        }
      })
      .finally(() => {
        if (active) setRiskLoading(false)
      })
    return () => {
      active = false
    }
  }, [selectedBarangayId, queryKey, resolved.error, compareYear, compareMonth, canCompareMonth])

  const selectedBarangay = barangays.find((barangay) => barangay.id === selectedBarangayId)
  const selectedName = selectedBarangay?.name || ranking.find((row) => row.barangay_id === selectedBarangayId)?.barangay_name || ''

  const compareControls = (
    <div className="flex flex-wrap items-end gap-2">
      <label className="text-xs font-medium text-slate-600">
        Compare with
        <select className={`${selectClass} py-2`} value={compareYear} onChange={(event) => setCompareYear(event.target.value)} data-testid="compare-year">
          <option value="">Previous year</option>
          {yearOptions.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      </label>
      {canCompareMonth && (
        <label className="text-xs font-medium text-slate-600">
          Month
          <select className={`${selectClass} py-2`} value={compareMonth} disabled={!compareYear} onChange={(event) => setCompareMonth(event.target.value)}>
            <option value="">Same month</option>
            {MONTH_OPTIONS.map((month) => (
              <option key={month.value} value={month.value}>
                {month.label}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  )

  return (
    <section className="w-full px-3 pb-8 sm:px-6 lg:pb-10">
      <div className="grid gap-4">
        <div className={`${glassPanelClass} p-5 sm:p-6`}>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Risk scoring</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Barangay Risk Scoring</h1>
          <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-slate-600">
            Each barangay gets a score from 1 to 10 from how many incidents it had, how severe they were, and how recent they are. Use it to decide where to send teams and prevention work first.
          </p>

          <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,16rem)_1fr]">
            <label className="block text-sm font-medium text-slate-600">
              Barangay
              <select className={selectClass} value={selectedBarangayId} onChange={(event) => setSelectedBarangayId(event.target.value)} data-testid="barangay-select">
                <option value="">Select barangay</option>
                {barangays.map((barangay) => (
                  <option key={barangay.id} value={barangay.id}>
                    {barangay.name}
                  </option>
                ))}
              </select>
            </label>

            <div>
              <p className="text-sm font-medium text-slate-600">Period</p>
              <div className="mt-1.5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <SegmentedControl
                  value={period.mode}
                  onChange={(mode) => updatePeriod({ mode })}
                  options={[
                    { value: 'rolling', label: 'Recent days' },
                    { value: 'month', label: 'Year / month' },
                    { value: 'range', label: 'Date range' },
                  ]}
                />
                {period.mode === 'rolling' && (
                  <select className={`${selectClass} mt-0 sm:w-40`} value={period.days} onChange={(event) => updatePeriod({ days: Number(event.target.value) })} aria-label="Number of days">
                    {ROLLING_OPTIONS.map((days) => (
                      <option key={days} value={days}>
                        Last {days} days
                      </option>
                    ))}
                  </select>
                )}
                {period.mode === 'month' && (
                  <div className="flex gap-2">
                    <select className={`${selectClass} mt-0 w-28`} value={period.year} onChange={(event) => updatePeriod({ year: event.target.value })} aria-label="Year">
                      {yearOptions.map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </select>
                    <select
                      className={`${selectClass} mt-0 w-40`}
                      value={period.month}
                      onChange={(event) => {
                        updatePeriod({ month: event.target.value })
                        if (!event.target.value) setCompareMonth('')
                      }}
                      aria-label="Month"
                    >
                      <option value="">Whole year</option>
                      {MONTH_OPTIONS.map((month) => (
                        <option key={month.value} value={month.value}>
                          {month.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {period.mode === 'range' && (
                  <div className="flex flex-wrap items-center gap-2">
                    <input type="date" className={`${selectClass} mt-0 w-40`} value={period.startDate} max={period.endDate || undefined} onChange={(event) => updatePeriod({ startDate: event.target.value })} aria-label="Start date" />
                    <span className="text-sm text-slate-400">to</span>
                    <input type="date" className={`${selectClass} mt-0 w-40`} value={period.endDate} min={period.startDate || undefined} onChange={(event) => updatePeriod({ endDate: event.target.value })} aria-label="End date" />
                  </div>
                )}
              </div>
              <p className={`mt-2 text-xs ${resolved.error ? 'text-amber-700' : 'text-slate-500'}`}>
                {resolved.error ?? `Showing ${resolved.label.charAt(0).toLowerCase()}${resolved.label.slice(1)}.`}
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          <PriorityRanking rows={ranking} isLoading={rankingLoading} error={rankingError} selectedId={selectedBarangayId} onSelect={setSelectedBarangayId} />
          <div className="grid min-w-0 gap-4 lg:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            <BarangayScoreCard name={selectedName} riskData={riskData} isLoading={riskLoading} error={riskError} />
            <PredictionCard riskData={riskData} />
          </div>
        </div>

        <CitywideEarthquakeScoreCard
          riskData={citywideEarthquakeRisk}
          isLoading={citywideEarthquakeLoading}
          error={citywideEarthquakeError}
          onRetry={() => setEarthquakeReloadKey((key) => key + 1)}
        />

        <div className="grid gap-4 xl:grid-cols-2">
          <HazardBreakdown hazards={riskData?.barangay_profile?.hazards ?? {}} isLoading={riskLoading} />
          <ScoreHistoryChart data={riskData?.score_history ?? []} />
        </div>

        <PeriodComparison comparison={riskData?.incident_trend_comparison} controls={compareControls} />

      </div>
    </section>
  )
}