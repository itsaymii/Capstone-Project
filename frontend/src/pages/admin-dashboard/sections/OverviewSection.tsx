import { useEffect, useState, useCallback } from 'react'
import type { HazardIncident } from '../../../data/adminOperations'
import { glassPanelClass } from './constants'
import { fetchQuezonRegionEarthquakes, type EarthquakeEvent } from '../../../services/earthquakes'

type MetricCard = {
  label: string
  value: number | string
  comparison: string
  delta: string
  accent: string
  valueClass: string
}

type OverviewSectionProps = {
  overviewMetricCards: MetricCard[]
  incidents: HazardIncident[]
  latestFireIncidents: HazardIncident[]
}

const dashboardStatusClasses = {
  active: 'border-red-700 bg-red-700 text-white',
  pending: 'border-amber-500 bg-amber-500 text-white',
  approved: 'border-sky-700 bg-sky-700 text-white',
  resolved: 'border-emerald-700 bg-emerald-700 text-white',
} as const

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
      return 0
  }
}

function getHazardUpdateStatus(incident: HazardIncident): string {
  if (incident.status === 'active') return `${incident.severity.toLowerCase()} priority incident`
  if (incident.status === 'pending') return 'Pending field verification'
  if (incident.status === 'approved') return 'Approved and ready for response'
  return 'Recently resolved incident'
}

function eqDepthNote(magnitude: number, depth: number): string {
  if (magnitude >= 5.0) return `Strong earthquake at ${depth.toFixed(0)} km depth. Structural checks advised.`
  if (magnitude >= 4.0) return `Moderate earthquake at ${depth.toFixed(0)} km depth. Monitoring advised.`
  if (magnitude >= 3.0) return `Light earthquake at ${depth.toFixed(0)} km depth. No major damage expected.`
  return `Minor tremor at ${depth.toFixed(0)} km depth. Detected by seismic instruments.`
}

export function OverviewSection({
  overviewMetricCards,
  incidents,
  latestFireIncidents,
}: OverviewSectionProps) {
  const [eqEvents, setEqEvents] = useState<EarthquakeEvent[]>([])
  const [eqStatus, setEqStatus] = useState<'loading' | 'idle' | 'error'>('loading')

  const loadEqData = useCallback(async () => {
    setEqStatus('loading')

    try {
      const events = await fetchQuezonRegionEarthquakes()
      setEqEvents(events)
      setEqStatus('idle')
    } catch {
      setEqStatus('error')
    }
  }, [])

  useEffect(() => {
    void loadEqData()
  }, [loadEqData])

  const liveSeismicEvents = [...eqEvents]
    .sort((a, b) => b.rawTimestamp - a.rawTimestamp)
    .slice(0, 3)
    .map((event) => ({
      title: event.place,
      magnitude: event.magnitude.toFixed(1),
      time: event.time,
      note: eqDepthNote(event.magnitude, event.depth),
    }))

  const priorityIncidents = [...incidents]
    .sort((left, right) => getSeverityWeight(right.severity) - getSeverityWeight(left.severity))
    .slice(0, 5)

  const barangayUpdates = [...incidents]
    .sort((left, right) => getSeverityWeight(right.severity) - getSeverityWeight(left.severity))
    .slice(0, 5)
    .map((incident) => ({
      barangay: incident.location,
      status: getHazardUpdateStatus(incident),
      note: incident.description,
      severity: incident.severity,
    }))

  return (
    <>
      <section className="grid grid-cols-1 gap-6 px-6 pt-6 pb-8 md:grid-cols-2 xl:grid-cols-5">
        {overviewMetricCards.map((card) => (
          <div
            key={card.label}
            className={`group relative flex flex-col gap-2 overflow-hidden rounded-[22px] border border-t-4 border-slate-200/70 bg-white p-6 shadow-[0_2px_8px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.08)] transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_14px_42px_rgba(15,23,42,0.17)] ${card.accent}`}
          >
            <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
              {card.label}
            </span>

            <span className={`mt-1 text-4xl font-extrabold leading-none tracking-tight ${card.valueClass}`}>
              {card.value}
            </span>

            <p className="text-sm font-medium text-slate-500">
              {card.comparison}
            </p>

            <div className="mt-auto border-t border-slate-100 pt-3">
              <p className="text-xs font-semibold text-slate-600">
                {card.delta}
              </p>
            </div>
          </div>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-6 px-6 pb-10 xl:grid-cols-[1.1fr_1fr_1fr]">
        <div className={`${glassPanelClass} p-6`}>
          <div className="mb-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Command Priority
            </p>
            <h2 className="mt-1 text-xl font-semibold text-slate-900">
              Highest Priority Incidents
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Incidents ranked by severity for fast admin review.
            </p>
          </div>

          <div className="space-y-3">
            {priorityIncidents.length > 0 ? (
              priorityIncidents.map((incident) => (
                <article
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  key={incident.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {incident.title}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {incident.location} | {incident.time}
                      </p>
                    </div>

                    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase ${dashboardStatusClasses[incident.status]}`}>
                      {incident.status}
                    </span>
                  </div>

                  <p className="mt-3 text-sm leading-relaxed text-slate-600">
                    {incident.description}
                  </p>
                </article>
              ))
            ) : (
              <p className="text-sm text-slate-500">No priority incidents found.</p>
            )}
          </div>
        </div>

        <div className={`${glassPanelClass} p-6`}>
          <div className="mb-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Fire Monitoring
            </p>
            <h2 className="mt-1 text-xl font-semibold text-slate-900">
              Latest Fire Incidents
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Recent fire-related reports for operational monitoring.
            </p>
          </div>

          <div className="space-y-3">
            {latestFireIncidents.length > 0 ? (
              latestFireIncidents.map((incident) => (
                <article
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  key={incident.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {incident.title}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {incident.location} | {incident.time}
                      </p>
                    </div>

                    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase ${dashboardStatusClasses[incident.status]}`}>
                      {incident.status}
                    </span>
                  </div>

                  <p className="mt-3 text-sm leading-relaxed text-slate-600">
                    {incident.description}
                  </p>
                </article>
              ))
            ) : (
              <p className="text-sm text-slate-500">No fire incidents recorded yet.</p>
            )}
          </div>
        </div>

        <div className={`${glassPanelClass} p-6`}>
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Live Monitoring
              </p>
              <h2 className="mt-1 text-xl font-semibold text-slate-900">
                Latest Seismic Events
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Recent earthquake updates from the seismic feed.
              </p>
            </div>

            <span className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase text-emerald-700">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              Live
            </span>
          </div>

          {eqStatus === 'loading' ? (
            <div className="flex justify-center py-8">
              <span className="animate-pulse text-xs font-semibold text-teal-600">
                Loading live seismic feed…
              </span>
            </div>
          ) : null}

          {eqStatus === 'error' ? (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
              Unable to load seismic data.
            </p>
          ) : null}

          {eqStatus === 'idle' ? (
            <div className="space-y-3">
              {liveSeismicEvents.length > 0 ? (
                liveSeismicEvents.map((event) => (
                  <article
                    className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                    key={`${event.title}-${event.time}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {event.title}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          M {event.magnitude} · {event.time}
                        </p>
                      </div>

                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase text-emerald-700">
                        Seismic
                      </span>
                    </div>

                    <p className="mt-3 text-sm leading-relaxed text-slate-600">
                      {event.note}
                    </p>
                  </article>
                ))
              ) : (
                <p className="text-sm text-slate-500">No recent seismic events found.</p>
              )}
            </div>
          ) : null}
        </div>
      </section>

      <section className="px-6 pb-10">
        <div className={`${glassPanelClass} p-6`}>
          <div className="mb-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Barangay Status Board
            </p>
            <h2 className="mt-1 text-xl font-semibold text-slate-900">
              Hazard Level Updates
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Quick status summary of locations with recent or high-priority activity.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {barangayUpdates.length > 0 ? (
              barangayUpdates.map((update) => (
                <article
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  key={`${update.barangay}-${update.status}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {update.barangay}
                      </p>
                      <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                        {update.status}
                      </p>
                    </div>

                    <span className="rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-[10px] font-bold uppercase text-orange-700">
                      {update.severity}
                    </span>
                  </div>

                  <p className="mt-3 text-sm leading-relaxed text-slate-600">
                    {update.note}
                  </p>
                </article>
              ))
            ) : (
              <p className="text-sm text-slate-500">No barangay updates available yet.</p>
            )}
          </div>
        </div>
      </section>
    </>
  )
}

export default OverviewSection