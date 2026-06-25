import { useEffect, useMemo, useRef, useState } from 'react'
import { getBarangays, getBarangayRiskScore } from '../../../services/api'
import type {
  Barangay,
  BarangayHazardProfileItem,
  BarangayHazardShareItem,
  BarangayIncidentTrendItem,
  BarangayRiskScoreResponse,
  BarangayScoreHistoryItem,
} from '../../../types/api'
import { glassPanelClass, glassPanelSoftClass } from './constants'

type TimeframeOption = {
  label: string
  value: number
}

const scoreHistoryChartPalette = ['#1d4ed8', '#2563eb']
const hazardSharePalette = ['#2563eb', '#f59e0b', '#16a34a', '#dc2626', '#7c3aed', '#0ea5e9']

function formatDateLabel(dateString: string) {
  const date = new Date(dateString)
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function ScoreHistoryChart({ data }: { data: BarangayScoreHistoryItem[] }) {
  if (!data?.length) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
        No score history available yet.
      </div>
    )
  }

  const width = 820
  const height = 260
  const padding = { top: 24, right: 42, bottom: 32, left: 40 }
  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom
  const maxScore = Math.max(10, ...data.map((row) => row.score))
  const stepX = data.length > 1 ? chartWidth / (data.length - 1) : chartWidth

  const points = data.map((item, index) => {
    const x = padding.left + (data.length > 1 ? index * stepX : chartWidth / 2)
    const y = padding.top + chartHeight - (item.score / maxScore) * chartHeight
    return { x, y, label: item.date, value: item.score }
  })

  const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Risk trend</p>
          <h3 className="mt-2 text-lg font-semibold text-slate-900">Score history</h3>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
          Past {data.length} periods
        </span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="xMidYMid meet">
        <line x1={padding.left} y1={padding.top} x2={padding.left} y2={height - padding.bottom} stroke="#e2e8f0" />
        <line x1={padding.left} y1={height - padding.bottom} x2={width - padding.right} y2={height - padding.bottom} stroke="#e2e8f0" />

        {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
          const y = padding.top + chartHeight - tick * chartHeight
          const score = (maxScore * tick).toFixed(0)
          return (
            <g key={tick}>
              <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="#f1f5f9" />
              <text x={padding.left - 8} y={y + 4} textAnchor="end" fill="#64748b" fontSize="11">{score}</text>
            </g>
          )
        })}

        <path d={`${path} L ${points[points.length - 1].x} ${height - padding.bottom} L ${points[0].x} ${height - padding.bottom} Z`} fill="rgba(59,130,246,0.14)" />
        <path d={path} fill="none" stroke={scoreHistoryChartPalette[0]} strokeWidth="4" strokeLinecap="round" />
        <path d={path} fill="none" stroke={scoreHistoryChartPalette[1]} strokeWidth="10" opacity="0.12" strokeLinecap="round" />

        {points.map((point) => (
          <g key={point.label}>
            <circle cx={point.x} cy={point.y} r="6" fill="#fff" stroke={scoreHistoryChartPalette[0]} strokeWidth="3" />
            <text x={point.x} y={height - padding.bottom + 20} textAnchor="middle" fill="#475569" fontSize="11">
              {formatDateLabel(point.label)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  )
}

function IncidentTrendChart({ data }: { data: BarangayIncidentTrendItem[] }) {
  if (!data?.length) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
        No incident frequency data available.
      </div>
    )
  }

  const maxCount = Math.max(1, ...data.map((point) => point.count))

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Incident frequency</p>
          <h3 className="mt-2 text-lg font-semibold text-slate-900">Time series</h3>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
          {data.length} points
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {data.map((point) => (
          <div key={point.date} className="space-y-2 rounded-3xl border border-slate-100 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-800">{formatDateLabel(point.date)}</p>
              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                {point.count}
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-gradient-to-r from-sky-500 to-cyan-400"
                style={{ width: `${(point.count / maxCount) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function HazardShareDonut({ data }: { data: BarangayHazardShareItem[] }) {
  if (!data?.length) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
        No hazard share data available.
      </div>
    )
  }

  const totalShare = data.reduce((sum, item) => sum + item.share, 0)
  const radius = 68
  const circumference = 2 * Math.PI * radius
  let offset = 0

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Hazard composition</p>
          <h3 className="mt-2 text-lg font-semibold text-slate-900">Hazard share</h3>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
          {totalShare.toFixed(1)}%
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
        <div className="mx-auto">
          <svg viewBox="0 0 240 240" className="h-[220px] w-[220px]">
            <circle cx="120" cy="120" r={radius} fill="#f8fafc" />
            {data.map((item, index) => {
              const shareFraction = item.share / 100
              const dash = shareFraction * circumference
              const segment = (
                <circle
                  key={item.hazard}
                  cx="120"
                  cy="120"
                  r={radius}
                  fill="none"
                  stroke={hazardSharePalette[index % hazardSharePalette.length]}
                  strokeWidth="26"
                  strokeDasharray={`${dash} ${circumference - dash}`}
                  strokeDashoffset={-offset}
                  strokeLinecap="round"
                  transform="rotate(-90 120 120)"
                />
              )
              offset += dash
              return segment
            })}
            <circle cx="120" cy="120" r={52} fill="#ffffff" />
          </svg>
        </div>

        <div className="space-y-3">
          {data.map((item, index) => (
            <div key={item.hazard} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: hazardSharePalette[index % hazardSharePalette.length] }}
                  />
                  <p className="text-sm font-semibold text-slate-900">{item.hazard}</p>
                </div>
                <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-slate-600">
                  {item.share}%
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-500">Incidents: {item.frequency}</p>
              <p className="text-xs text-slate-500">Combined score: {item.combined_score.toFixed(1)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
function HazardContributionBars({ data }: { data: { name: string; score: number }[] }) {
  if (!data?.length) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
        No hazard contribution data available.
      </div>
    )
  }

  const maxScore = Math.max(1, ...data.map((item) => item.score))

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Hazard leaderboards</p>
          <h3 className="mt-2 text-lg font-semibold text-slate-900">Top hazards</h3>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
          Top {data.length}
        </span>
      </div>
      <div className="space-y-3">
        {data.map((item) => (
          <div key={item.name} className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                <p className="mt-1 text-xs text-slate-500">Score: {item.score.toFixed(1)}</p>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                {((item.score / maxScore) * 100).toFixed(0)}%
              </span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-sky-500 to-cyan-400"
                style={{ width: `${(item.score / maxScore) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function RiskInsightsPanel({
  scoreLabel,
  scoreChangeLabel,
  incidentTrendSummary,
  topHazard,
}: {
  scoreLabel: string
  scoreChangeLabel: string
  incidentTrendSummary: string
  topHazard: string
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-950 p-6 text-white shadow-lg">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Actionable insights</p>
          <h3 className="mt-2 text-lg font-semibold">What to focus on</h3>
        </div>
        <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-amber-300">
          {scoreLabel}
        </span>
      </div>

      <div className="mt-6 space-y-4 text-sm text-slate-300">
        <div className="rounded-3xl bg-white/5 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Trend</p>
          <p className="mt-2 font-semibold text-white">{scoreChangeLabel}</p>
        </div>

        <div className="rounded-3xl bg-white/5 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Incident direction</p>
          <p className="mt-2 font-semibold text-white">{incidentTrendSummary}</p>
        </div>

        <div className="rounded-3xl bg-white/5 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Priority hazard</p>
          <p className="mt-2 font-semibold text-white">{topHazard}</p>
        </div>

        <div className="rounded-3xl bg-white/5 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Focus</p>
          <p className="mt-2 text-sm text-slate-300">Prioritize response in barangays with rising score trends and the highest hazard share.</p>
        </div>
      </div>
    </div>
  )
}
const timeframeOptions: TimeframeOption[] = [
  { label: 'Last 30 days', value: 30 },
  { label: 'Last 60 days', value: 60 },
  { label: 'Last 90 days', value: 90 },
  { label: 'Last 180 days', value: 180 },
]

function getRiskLabel(score: number): string {
  if (score >= 8.5) return 'Critical'
  if (score >= 7) return 'High'
  if (score >= 5) return 'Moderate'
  return 'Low'
}

function getRiskTone(score: number): string {
  if (score >= 8.5) return 'border-red-100 bg-red-50 text-red-700'
  if (score >= 7) return 'border-orange-100 bg-orange-50 text-orange-700'
  if (score >= 5) return 'border-amber-100 bg-amber-50 text-amber-700'
  return 'border-emerald-100 bg-emerald-50 text-emerald-700'
}

function getScoreChangeSummary(history: BarangayScoreHistoryItem[]): string {
  if (history.length < 2) return 'No score trend available.'

  const first = history[0].score
  const last = history[history.length - 1].score
  const delta = last - first

  if (delta > 0.25) return `Score rising by ${delta.toFixed(1)} points over the current window.`
  if (delta < -0.25) return `Score improving downward by ${Math.abs(delta).toFixed(1)} points.`
  return 'Score is stable over the selected period.'
}

function getIncidentTrendSummary(trend: BarangayIncidentTrendItem[]): string {
  if (trend.length < 2) return 'No incident trend data available.'

  const first = trend[0].count
  const last = trend[trend.length - 1].count
  const delta = last - first

  if (delta > 0) return `Incident activity is rising (+${delta} cases).`
  if (delta < 0) return `Incident activity is easing (${Math.abs(delta)} fewer cases).`
  return 'Incident activity is steady.'
}

function formatValue(value: number | null | undefined): string {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return '-'
  }
  return String(value)
}

function mapHazardRows(hazards: Record<string, BarangayHazardProfileItem>): Array<{
  name: string
  item: BarangayHazardProfileItem
}> {
  return Object.entries(hazards)
    .map(([name, item]) => ({ name, item }))
    .sort((left, right) => right.item.combined_score - left.item.combined_score)
}

export function RiskScoringSection() {
  const [barangays, setBarangays] = useState<Barangay[]>([])
  const [selectedBarangayId, setSelectedBarangayId] = useState<string>('')
  const [timeframe, setTimeframe] = useState<number>(90)
  const [riskData, setRiskData] = useState<BarangayRiskScoreResponse | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const skipInitialRiskFetch = useRef(false)

  useEffect(() => {
    let isMounted = true

    async function loadBarangays() {
      try {
        setError(null)
        const results = await getBarangays()
        if (!isMounted) return
        setBarangays(results)

        if (results.length === 0) {
          return
        }

        // Auto-select the first barangay with recent incident data.
        for (const item of results) {
          try {
            const data = await getBarangayRiskScore(item.id, { days: timeframe })
            if (!isMounted) return
            if (data.barangay_profile?.total > 0) {
              skipInitialRiskFetch.current = true
              setSelectedBarangayId(item.id)
              setRiskData(data)
              return
            }
          } catch (err) {
            console.warn('[RiskScoringSection] Auto-select check failed for', item.id, err)
          }
        }

        if (!isMounted) return
        setSelectedBarangayId(results[0].id)
      } catch (err) {
        console.error('[RiskScoringSection] Failed to load barangays:', err)
        if (!isMounted) return
        setError('Failed to load barangay list. Please try again.')
        setBarangays([])
      }
    }

    void loadBarangays()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (!selectedBarangayId) {
      return
    }

    let isMounted = true

    async function loadRiskScore() {
      if (skipInitialRiskFetch.current) {
        skipInitialRiskFetch.current = false
        return
      }

      try {
        setIsLoading(true)
        setError(null)
        const data = await getBarangayRiskScore(selectedBarangayId, { days: timeframe })
        if (!isMounted) return
        setRiskData(data)
      } catch (err) {
        console.error('[RiskScoringSection] Failed to load risk score:', err)
        if (!isMounted) return
        setError('Unable to fetch barangay risk score. Please try again.')
        setRiskData(null)
      } finally {
        if (!isMounted) return
        setIsLoading(false)
      }
    }

    void loadRiskScore()

    return () => {
      isMounted = false
    }
  }, [selectedBarangayId, timeframe])

  const selectedBarangay = useMemo(
    () => barangays.find((barangay) => barangay.id === selectedBarangayId),
    [barangays, selectedBarangayId],
  )

  const hazardRows = useMemo(
    () => mapHazardRows(riskData?.barangay_profile?.hazards || {}),
    [riskData],
  )

  const maxHazardScore = Math.max(1, ...hazardRows.map((row) => row.item.combined_score))
  const score = riskData?.risk_score?.score ?? 0
  const scoreLabel = getRiskLabel(score)
  const scoreTone = getRiskTone(score)
  const scoreChangeLabel = getScoreChangeSummary(riskData?.score_history || [])
  const incidentTrendSummary = getIncidentTrendSummary(riskData?.incident_trend || [])
  const topHazard = hazardRows[0]?.name || 'N/A'

  return (
    <section className="mx-auto w-full max-w-[1440px] px-3 pb-8 sm:px-5 lg:px-6 lg:pb-10">
      <div className="grid gap-4">
        <div className={`${glassPanelClass} p-6`}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Risk scoring workspace
              </p>
              <h1 className="mt-1 text-2xl font-bold text-slate-900">Barangay Risk Scoring</h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
                Visualize risk score, hazard prediction, and recent incident drivers for any barangay.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
              <label className="block text-sm font-medium text-slate-600">
                Barangay
                <select
                  className="mt-2 block w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-blue-200"
                  value={selectedBarangayId}
                  onChange={(event) => setSelectedBarangayId(event.target.value)}
                >
                  <option value="">Select barangay</option>
                  {barangays.map((barangay) => (
                    <option key={barangay.id} value={barangay.id}>
                      {barangay.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm font-medium text-slate-600">
                Timeframe
                <select
                  className="mt-2 block w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-blue-200"
                  value={timeframe}
                  onChange={(event) => setTimeframe(Number(event.target.value))}
                >
                  {timeframeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {error ? (
            <div className="mt-6 rounded-3xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <div className="mt-6 grid gap-4">
            <div className="grid gap-4 grid-cols-1">
              <article className={`${glassPanelSoftClass} p-6`}> 
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Overall Risk</p>
                    <p className="mt-3 text-4xl font-bold text-slate-900">{isLoading ? 'Loading…' : score ? score.toFixed(1) : '-'}</p>
                    <p className="mt-2 text-sm text-slate-600">Score out of 10</p>
                  </div>
                  <span className={`rounded-2xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] ${scoreTone}`}>
                    {isLoading ? 'Loading' : scoreLabel}
                  </span>
                </div>
              </article>

              <article className={`${glassPanelSoftClass} p-6`}>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Frequency</p>
                <p className="mt-3 text-3xl font-bold text-slate-900">{isLoading ? '…' : formatValue(riskData?.risk_score.breakdown.frequency)}</p>
                <p className="mt-2 text-sm text-slate-600">Incidents drive this component.</p>
              </article>

              <article className={`${glassPanelSoftClass} p-6`}>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Severity</p>
                <p className="mt-3 text-3xl font-bold text-slate-900">{isLoading ? '…' : formatValue(riskData?.risk_score.breakdown.severity)}</p>
                <p className="mt-2 text-sm text-slate-600">Average incident severity weight.</p>
              </article>

              <article className={`${glassPanelSoftClass} p-6`}>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Recency</p>
                <p className="mt-3 text-3xl font-bold text-slate-900">{isLoading ? '…' : formatValue(riskData?.risk_score.breakdown.recency)}</p>
                <p className="mt-2 text-sm text-slate-600">Fresh incident share within timeframe.</p>
              </article>
            </div>

            <div className={`${glassPanelSoftClass} p-6`}>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Top Prediction</p>
              <p className="mt-3 text-xl font-semibold text-slate-900">
                {riskData?.hazard_prediction?.hazard || 'No prediction yet'}
              </p>
              <p className="mt-3 text-sm text-slate-600">
                Confidence: {riskData?.hazard_prediction?.confidence || 'N/A'}
              </p>

              <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Driver</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">{riskData?.hazard_prediction?.driver || '-'}</p>
                <p className="mt-3 text-sm text-slate-600">{riskData?.hazard_prediction?.reason || 'Prediction reason is not available.'}</p>
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <article className={`${glassPanelSoftClass} p-6`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Profile summary</p>
                  <h2 className="mt-1 text-lg font-bold text-slate-900">Incident profile</h2>
                </div>
                <div className="text-sm text-slate-500">
                  Total incidents: {riskData?.barangay_profile?.total ?? '0'}
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-3xl border border-slate-200 bg-white px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Barangay</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{selectedBarangay?.name || 'Unknown'}</p>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-white px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Top hazard</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{riskData?.barangay_profile?.top_hazard || 'N/A'}</p>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-white px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Window</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{timeframeOptions.find((option) => option.value === timeframe)?.label}</p>
                </div>
              </div>
            </article>

            <article className={`${glassPanelSoftClass} p-6`}>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Action guidance</p>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                Use this score to prioritize barangays for hazard response and local preparedness. Higher scores indicate stronger recent incident activity and more severe hazards.
              </p>

              <div className={`mt-6 rounded-3xl border px-4 py-4 ${scoreTone}`}>
                <p className="text-sm font-semibold uppercase tracking-[0.18em]">Recommended response</p>
                <p className="mt-2 text-lg font-bold">{scoreLabel}</p>
              </div>
            </article>
          </div>
        </div>

        <div className="space-y-4">
          <article className={`${glassPanelClass} p-6`}>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Risk Breakdown</p>
            <h2 className="mt-1 text-lg font-bold text-slate-900">Hazard contributions</h2>
            <p className="mt-2 text-sm text-slate-600">Compare each hazard type by incident count, severity weight, and combined contribution to the barangay risk profile.</p>

            {isLoading && !riskData ? (
              <div className="mt-6 py-12 text-center text-sm text-slate-500">Loading risk breakdown…</div>
            ) : hazardRows.length === 0 ? (
              <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
                No incident hazard data is available for this barangay in the selected period.
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                {hazardRows.map(({ name, item }) => (
                  <div key={name} className={`${glassPanelSoftClass} p-4`}>
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{name}</p>
                        <p className="mt-1 text-xs text-slate-500">Combined score: {item.combined_score.toFixed(1)}</p>
                      </div>
                      <div className="grid gap-2 text-sm text-slate-600 sm:text-right">
                        <p>Incidents: {item.frequency}</p>
                        <p>Avg severity: {item.severity_weight.toFixed(1)}</p>
                      </div>
                    </div>
                    <div className="mt-4 h-2 rounded-full bg-slate-200">
                      <div
                        className="h-2 rounded-full bg-gradient-to-r from-sky-500 to-cyan-400"
                        style={{ width: `${Math.min(100, (item.combined_score / maxHazardScore) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </article>

          <article className={`${glassPanelSoftClass} p-6`}> 
            <div className="grid gap-4">
              <ScoreHistoryChart data={riskData?.score_history || []} />
              <div className="space-y-4">
                <HazardShareDonut data={riskData?.hazard_share || []} />
                <HazardContributionBars data={hazardRows.slice(0, 5).map((row) => ({ name: row.name, score: row.item.combined_score }))} />
              </div>
            </div>
          </article>

          <article className={`${glassPanelSoftClass} p-6`}>
            <IncidentTrendChart data={riskData?.incident_trend || []} />
          </article>

          <article className={`${glassPanelSoftClass} p-6`}>
            <RiskInsightsPanel
              scoreLabel={scoreLabel}
              scoreChangeLabel={scoreChangeLabel}
              incidentTrendSummary={incidentTrendSummary}
              topHazard={topHazard}
            />
          </article>

          <article className={`${glassPanelSoftClass} p-6`}>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Interpretation</p>
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <p><span className="font-semibold text-slate-900">Critical</span> means this barangay has sustained high incident volume and severity recently. Prioritize response and community awareness.</p>
              <p><span className="font-semibold text-slate-900">High</span> indicates elevated risk with meaningful incident history in the selected window.</p>
              <p><span className="font-semibold text-slate-900">Moderate</span> indicates the barangay should be monitored, especially when major hazards are detected nearby.</p>
              <p><span className="font-semibold text-slate-900">Low</span> indicates a lower recent threat level, but always confirm with ongoing incident reporting.</p>
            </div>
          </article>
        </div>
      </div>
    </section>
  )
}
