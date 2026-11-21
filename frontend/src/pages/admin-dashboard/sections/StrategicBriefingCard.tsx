import { useEffect, useState } from 'react'
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

export function StrategicBriefingCard() {
  const [data, setData] = useState<StrategicDashboardBriefingResponse | null>(null)
  const [error, setError] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true
    setError(false)
    getStrategicDashboardBriefing()
      .then((response) => {
        if (active) setData(response)
      })
      .catch((requestError) => {
        console.error('[StrategicBriefingCard] Failed to load briefing:', requestError)
        if (active) {
          setData(null)
          setError(true)
        }
      })
    return () => {
      active = false
    }
  }, [reloadKey])

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
          <p className="mt-1 text-sm text-slate-500">A city-wide readiness brief, refreshed every 30 days.</p>
        </div>
        {data && (
          <div className="text-right text-xs text-slate-500">
            <p>{sourceLabel(data.briefing)}</p>
            <p className="mt-1">{formatGeneratedAt(data.generated_at)}</p>
            <p className="mt-1">{formatRefreshAt(data.refreshes_at)}</p>
          </div>
        )}
      </div>

      {error ? (
        <div role="alert" className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p>Could not load the strategic briefing.</p>
          <button
            type="button"
            className="mt-2 font-semibold underline underline-offset-2"
            onClick={() => setReloadKey((key) => key + 1)}
          >
            Try again
          </button>
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
                {data.stats.hotspots.map((item) => item.name).join(', ') || 'None identified'}
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
