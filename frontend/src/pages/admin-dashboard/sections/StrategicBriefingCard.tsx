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
          {data ? (
            <p className="mt-1 text-xs font-semibold text-slate-600">Data window: {formatWindow(data.window)}</p>
          ) : null}
        </div>
        {data && (
          <div className="text-xs text-slate-500 sm:text-right">
            <p>{sourceLabel(data.briefing)}</p>
            <p className="mt-1">{formatGeneratedAt(data.generated_at)}</p>
            <p className="mt-1">{formatRefreshAt(data.refreshes_at)}</p>
          </div>
        )}
      </div>

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
          <dl className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl bg-slate-50 p-3">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Incidents · last 30 days</dt>
              <dd className="mt-1 text-xl font-bold tabular-nums text-slate-900">{data.stats.total.toLocaleString()}</dd>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Monthly average</dt>
              <dd className="mt-1 text-xl font-bold tabular-nums text-slate-900">{data.stats.monthly_average.toLocaleString()}</dd>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">High or Critical</dt>
              <dd className="mt-1 text-xl font-bold tabular-nums text-slate-900">
                {data.stats.high_critical_count.toLocaleString()}
                <span className="ml-1 text-sm font-semibold text-slate-500">({data.stats.high_critical_percentage}%)</span>
              </dd>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Hotspots</dt>
              <dd className="mt-1 text-sm font-bold text-slate-900">
                {data.stats.hotspots.length ? (
                  <span className="break-words">{data.stats.hotspots.map((item) => `${item.name} (${item.count})`).join(', ')}</span>
                ) : (
                  'None identified'
                )}
              </dd>
            </div>
          </dl>

          <div className="mt-5">
            <h3 className="text-base font-bold text-slate-900">{data.briefing.headline}</h3>
            <p className="mt-1.5 max-w-4xl text-sm leading-6 text-slate-700">{data.briefing.summary}</p>
          </div>

          <div className="mt-5 grid gap-6 lg:grid-cols-2">
            <section>
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
            <section>
              <h3 className="text-sm font-bold text-slate-900">Recommended actions · next quarter</h3>
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
