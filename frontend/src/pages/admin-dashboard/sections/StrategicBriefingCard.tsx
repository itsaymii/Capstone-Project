import { useEffect, useState } from 'react'
import axios from 'axios'
import { getStrategicDashboardBriefing } from '../../../services/api'
import type { StrategicDashboardBriefingResponse } from '../../../types/api'

function formatGeneratedAt(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? 'Generation time unavailable'
    : `Generated ${date.toLocaleString()}`
}

function formatRefreshAt(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? 'Refresh time unavailable'
    : `Next refresh ${date.toLocaleString()}`
}

const SEVERITY_ORDER = ['low', 'moderate', 'high', 'critical'] as const
const SEVERITY_STYLE: Record<(typeof SEVERITY_ORDER)[number], { label: string; bar: string; dot: string }> = {
  low: { label: 'Low', bar: 'bg-emerald-500', dot: 'bg-emerald-500' },
  moderate: { label: 'Moderate', bar: 'bg-amber-400', dot: 'bg-amber-400' },
  high: { label: 'High', bar: 'bg-orange-500', dot: 'bg-orange-500' },
  critical: { label: 'Critical', bar: 'bg-red-600', dot: 'bg-red-600' },
}

function formatShortDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}

/** How the incidents of the window split by severity, as one bar plus a legend with counts. */
function SeverityMix({ bySeverity, total }: { bySeverity: Record<string, number>; total: number }) {
  const rows = SEVERITY_ORDER.map((level) => ({ level, count: Number(bySeverity?.[level] ?? 0) }))
  const counted = rows.reduce((sum, row) => sum + row.count, 0)
  const share = (count: number) => (counted ? Math.round((count / counted) * 100) : 0)
  const summary = rows.map((row) => `${SEVERITY_STYLE[row.level].label} ${row.count}`).join(', ')

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-bold text-slate-900">Severity mix</h3>
        <p className="text-xs text-slate-500">{total.toLocaleString()} incidents</p>
      </div>
      {counted === 0 ? (
        <p className="mt-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-500">No incidents in this window.</p>
      ) : (
        <>
          <div className="mt-2.5 flex h-3 w-full overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`Severity of incidents: ${summary}`}>
            {rows.map((row) =>
              row.count > 0 ? (
                <div
                  key={row.level}
                  className={`h-full ${SEVERITY_STYLE[row.level].bar} border-r-2 border-white last:border-r-0`}
                  style={{ width: `${(row.count / counted) * 100}%` }}
                  title={`${SEVERITY_STYLE[row.level].label}: ${row.count}`}
                />
              ) : null,
            )}
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
            {rows.map((row) => (
              <div key={row.level} className="min-w-0">
                <dt className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${SEVERITY_STYLE[row.level].dot}`} aria-hidden="true" />
                  {SEVERITY_STYLE[row.level].label}
                </dt>
                <dd className="mt-0.5 text-sm font-bold tabular-nums text-slate-900">
                  {row.count.toLocaleString()} <span className="text-xs font-semibold text-slate-400">{share(row.count)}%</span>
                </dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </div>
  )
}

/** The barangays with the most incidents in the window, longest bar first. */
function HotspotBars({ hotspots }: { hotspots: Array<{ name: string; count: number }> }) {
  const top = Math.max(1, ...hotspots.map((item) => item.count))
  return (
    <div>
      <h3 className="text-sm font-bold text-slate-900">Hotspots</h3>
      {hotspots.length === 0 ? (
        <p className="mt-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-500">None identified in this window.</p>
      ) : (
        <ol className="mt-2.5 space-y-2.5">
          {hotspots.map((item, index) => (
            <li key={item.name}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 break-words font-semibold text-slate-800">
                  <span className="mr-1.5 text-xs font-bold text-blue-700">{index + 1}</span>
                  {item.name}
                </span>
                <span className="shrink-0 font-bold tabular-nums text-slate-900">{item.count}</span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-blue-600" style={{ width: `${(item.count / top) * 100}%`, opacity: 1 - index * 0.2 }} />
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

function sourceLabel(briefing: StrategicDashboardBriefingResponse['briefing']): string {
  if (briefing.source === 'gemini') return 'Gemini-generated'
  if (briefing.source_reason === 'api_key_not_configured') return 'Rule-based fallback · AI key not configured'
  if (briefing.source_reason === 'sdk_unavailable') return 'Rule-based fallback · Gemini SDK unavailable'
  return 'Rule-based fallback · Gemini generation unavailable'
}

function formatWindow(window: StrategicDashboardBriefingResponse['window']): string {
  const format = (value: string) => {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
  }
  const start = format(window.start)
  const end = format(window.end)
  return start && end ? `${start} – ${end}` : `Last ${window.days} days`
}

// How a failed request is explained: "busy" is another admin's refresh still running, not broken data.
type LoadProblem =
  | { kind: 'busy'; waitSeconds: number }
  | { kind: 'throttled' }
  | { kind: 'forbidden' }
  | { kind: 'failed' }

// Wait at most this long before the automatic retry, and retry a busy briefing at most this many times.
const MAX_BUSY_WAIT_SECONDS = 30
const MAX_AUTO_RETRIES = 3

function describeProblem(error: unknown): LoadProblem {
  if (!axios.isAxiosError(error) || !error.response) return { kind: 'failed' }
  const { status, headers } = error.response
  if (status === 503) {
    const header = Number(headers?.['retry-after'])
    const waitSeconds = Number.isFinite(header) && header > 0 ? Math.min(MAX_BUSY_WAIT_SECONDS, Math.ceil(header)) : 5
    return { kind: 'busy', waitSeconds }
  }
  if (status === 429) return { kind: 'throttled' }
  if (status === 401 || status === 403) return { kind: 'forbidden' }
  return { kind: 'failed' }
}

export function StrategicBriefingCard() {
  const [data, setData] = useState<StrategicDashboardBriefingResponse | null>(null)
  const [problem, setProblem] = useState<LoadProblem | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [autoRetries, setAutoRetries] = useState(0)
  const [countdown, setCountdown] = useState(0)

  useEffect(() => {
    let active = true
    setProblem(null)
    getStrategicDashboardBriefing()
      .then((response) => {
        if (!active) return
        setData(response)
        setAutoRetries(0)
      })
      .catch((requestError) => {
        console.error('[StrategicBriefingCard] Failed to load briefing:', requestError)
        if (active) {
          setData(null)
          const next = describeProblem(requestError)
          setProblem(next)
          setCountdown(next.kind === 'busy' ? next.waitSeconds : 0)
        }
      })
    return () => {
      active = false
    }
  }, [reloadKey])

  // A busy briefing (another refresh in progress) is fetched again by itself after the server's wait.
  const willAutoRetry = problem?.kind === 'busy' && autoRetries < MAX_AUTO_RETRIES
  useEffect(() => {
    if (!willAutoRetry) return
    if (countdown <= 0) {
      setAutoRetries((count) => count + 1)
      setReloadKey((key) => key + 1)
      return
    }
    const timer = window.setTimeout(() => setCountdown((seconds) => seconds - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [willAutoRetry, countdown])

  const retryNow = () => {
    setAutoRetries(0)
    setReloadKey((key) => key + 1)
  }

  return (
    <section
      aria-labelledby="strategic-briefing-title"
      className="mt-5 overflow-hidden rounded-[28px] border border-blue-100 bg-white p-5 shadow-[0_16px_38px_rgba(15,23,42,0.09)] sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-blue-700">AI-powered · 30-day view</p>
          <h2 id="strategic-briefing-title" className="mt-1 text-xl font-bold text-slate-900">
            Strategic Quarterly Briefing
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            A city-wide readiness brief, refreshed every 30 days. It always covers the last 30 days and does not change with the
            dashboard filters.
          </p>
        </div>
      </div>
      {data ? (
        <ul className="mt-3 flex flex-wrap gap-2 text-xs" aria-label="About this briefing">
          <li className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 font-semibold text-blue-800">
            Data window: {formatWindow(data.window)}
          </li>
          <li
            className={`rounded-full border px-2.5 py-1 font-semibold ${
              data.briefing.source === 'gemini' ? 'border-blue-100 bg-white text-blue-700' : 'border-amber-200 bg-amber-50 text-amber-800'
            }`}
          >
            {sourceLabel(data.briefing)}
          </li>
          <li className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-slate-600" title={formatGeneratedAt(data.generated_at)}>
            Generated {formatShortDate(data.generated_at)}
          </li>
          <li className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-slate-600" title={formatRefreshAt(data.refreshes_at)}>
            Next refresh {formatShortDate(data.refreshes_at)}
          </li>
        </ul>
      ) : null}

      {problem?.kind === 'busy' ? (
        <div role="status" aria-live="polite" className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          <p className="font-semibold">The briefing is being prepared.</p>
          <p className="mt-1">
            Another refresh is still running, so nothing is wrong with the data.{' '}
            {willAutoRetry ? `Trying again in ${countdown} second${countdown === 1 ? '' : 's'}…` : 'Try again in a moment.'}
          </p>
          <button type="button" className="mt-2 font-semibold underline underline-offset-2" onClick={retryNow}>
            Try now
          </button>
        </div>
      ) : problem ? (
        <div role="alert" className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p>
            {problem.kind === 'throttled'
              ? 'The briefing was requested too many times in a short while. Wait a minute, then try again.'
              : problem.kind === 'forbidden'
                ? 'Only admins can view the strategic briefing. Log in again with an admin account.'
                : 'Could not load the strategic briefing. Check the connection to the server, then try again.'}
          </p>
          {problem.kind !== 'forbidden' ? (
            <button type="button" className="mt-2 font-semibold underline underline-offset-2" onClick={retryNow}>
              Try again
            </button>
          ) : null}
        </div>
      ) : !data ? (
        <div aria-busy="true" className="mt-5 space-y-3">
          <div className="h-5 w-2/3 animate-pulse rounded bg-slate-100" />
          <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
          <div className="h-4 w-5/6 animate-pulse rounded bg-slate-100" />
          <p className="text-xs text-slate-500">Loading the cached briefing or generating a fresh one…</p>
        </div>
      ) : (
        <>
          <div className="mt-5 grid gap-4 lg:grid-cols-[1.15fr_1fr]">
            {/* The briefing's message first: headline, summary and the two numbers that frame it. */}
            <div className="flex flex-col rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50/80 via-white to-white p-4 sm:p-5">
              <h3 className="text-lg font-bold leading-snug text-slate-900">{data.briefing.headline}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-700">{data.briefing.summary}</p>
              <dl className="mt-auto grid grid-cols-2 gap-3 pt-4">
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <dt className="text-xs font-semibold text-slate-500">Incidents, last 30 days</dt>
                  <dd className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{data.stats.total.toLocaleString()}</dd>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <dt className="text-xs font-semibold text-slate-500">High or critical</dt>
                  <dd className="mt-1 text-2xl font-bold tabular-nums text-red-700">
                    {data.stats.high_critical_count.toLocaleString()}
                    <span className="ml-1.5 text-sm font-semibold text-slate-500">{data.stats.high_critical_percentage}%</span>
                  </dd>
                </div>
              </dl>
            </div>

            <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
              <SeverityMix bySeverity={data.stats.by_severity} total={data.stats.total} />
              <div className="border-t border-slate-100 pt-4">
                <HotspotBars hotspots={data.stats.hotspots} />
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
              <h3 className="text-sm font-bold text-slate-900">Key findings</h3>
              <ul className="mt-2 space-y-2">
                {data.briefing.key_findings.map((finding, index) => (
                  <li key={`${index}-${finding}`} className="flex gap-2.5 text-sm leading-6 text-slate-700">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" aria-hidden="true" />
                    {finding}
                  </li>
                ))}
              </ul>
            </section>
            <section className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 sm:p-5">
              <h3 className="text-sm font-bold text-slate-900">Recommended actions for the next quarter</h3>
              <ol className="mt-2 space-y-2">
                {data.briefing.recommended_actions.map((action, index) => (
                  <li key={`${index}-${action}`} className="flex gap-2.5 text-sm leading-6 text-slate-700">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-50 text-[11px] font-bold text-blue-700">
                      {index + 1}
                    </span>
                    {action}
                  </li>
                ))}
              </ol>
            </section>
          </div>
        </>
      )}
    </section>
  )
}
