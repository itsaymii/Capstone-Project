import { useState, useEffect, useCallback } from 'react'
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
  if (incident.status === 'active') {
    return `${incident.severity.toLowerCase()} priority incident`
  }

  if (incident.status === 'pending') {
    return 'Pending field verification'
  }

  return 'Recently resolved incident'
}

function eqDepthNote(magnitude: number, depth: number): string {
  if (magnitude >= 5.0) return `Strong earthquake at ${depth.toFixed(0)} km depth. Structural checks advised in Quezon Province.`
  if (magnitude >= 4.0) return `Moderate earthquake at ${depth.toFixed(0)} km depth. Felt across parts of Quezon Province.`
  if (magnitude >= 3.0) return `Light earthquake at ${depth.toFixed(0)} km depth. No structural damage expected.`
  return `Minor tremor at ${depth.toFixed(0)} km depth. Detected by seismic instruments.`
}

export function OverviewSection({ overviewMetricCards, incidents, latestFireIncidents }: OverviewSectionProps) {
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

  useEffect(() => { void loadEqData() }, [loadEqData])

  const activeMagBins = [
    { range: 'M1–2', value: eqEvents.filter((e) => e.magnitude >= 1.0 && e.magnitude < 2.0).length },
    { range: 'M2–3', value: eqEvents.filter((e) => e.magnitude >= 2.0 && e.magnitude < 3.0).length },
    { range: 'M3–4', value: eqEvents.filter((e) => e.magnitude >= 3.0 && e.magnitude < 4.0).length },
    { range: 'M4–5', value: eqEvents.filter((e) => e.magnitude >= 4.0 && e.magnitude < 5.0).length },
    { range: 'M5+',  value: eqEvents.filter((e) => e.magnitude >= 5.0).length },
  ]
  const activeMagMax = Math.max(...activeMagBins.map((b) => b.value), 1)

  const accidentIncidents = incidents.filter((incident) => incident.code === 'AC')

  const accidentSeverityData = [
    { label: 'Low', value: accidentIncidents.filter((incident) => incident.severity === 'Low').length },
    { label: 'Moderate', value: accidentIncidents.filter((incident) => incident.severity === 'Moderate').length },
    { label: 'High', value: accidentIncidents.filter((incident) => incident.severity === 'High').length },
    { label: 'Critical', value: accidentIncidents.filter((incident) => incident.severity === 'Critical').length },
  ]
  const accidentSeverityMax = Math.max(...accidentSeverityData.map((item) => item.value), 1)
  const accidentSeverityPoints = accidentSeverityData
    .map((item, index) => {
      const x = (index / Math.max(accidentSeverityData.length - 1, 1)) * 100
      const y = 92 - (item.value / accidentSeverityMax) * 70
      return `${x},${y}`
    })
    .join(' ')

  const liveSeismicEvents = [...eqEvents]
    .sort((a, b) => b.rawTimestamp - a.rawTimestamp)
    .slice(0, 3)
    .map((e) => ({
      title: e.place,
      magnitude: e.magnitude.toFixed(1),
      time: e.time,
      note: eqDepthNote(e.magnitude, e.depth),
    }))

  const hotspotMap = new Map<
    string,
    { name: string; fireRisk: number; earthquakeRisk: number; totalRisk: number }
  >()
  incidents.forEach((incident) => {
    const current = hotspotMap.get(incident.location) ?? {
      name: incident.location,
      fireRisk: 0,
      earthquakeRisk: 0,
      totalRisk: 0,
    }
    const severityWeight = getSeverityWeight(incident.severity)
    if (incident.code === 'FR') {
      current.fireRisk += severityWeight * 12
    }
    if (incident.code === 'EQ') {
      current.earthquakeRisk += severityWeight * 12
    }
    if (incident.code === 'AC') {
      current.earthquakeRisk += severityWeight * 8
    }
    current.totalRisk = current.fireRisk + current.earthquakeRisk
    hotspotMap.set(incident.location, current)
  })

  const operationalHotspots = [...hotspotMap.values()]
    .sort((left, right) => right.totalRisk - left.totalRisk)
    .slice(0, 6)

  const incidentDistributionData = [
    { label: 'Fire', value: incidents.filter((incident) => incident.code === 'FR').length, color: '#ef4444' },
    { label: 'Earthquake', value: incidents.filter((incident) => incident.code === 'EQ').length, color: '#10b981' },
    { label: 'Accident', value: incidents.filter((incident) => incident.code === 'AC').length, color: '#3b82f6' },
  ].filter((item) => item.value > 0)
  const incidentDistributionTotal = Math.max(
    incidentDistributionData.reduce((total, item) => total + item.value, 0),
    1,
  )
  const incidentDistributionGradient = incidentDistributionData
    .reduce(
      (segments, item) => {
        const start = segments.current
        const slice = (item.value / incidentDistributionTotal) * 100
        segments.values.push(`${item.color} ${start}% ${start + slice}%`)
        segments.current += slice
        return segments
      },
      { current: 0, values: [] as string[] },
    )
    .values.join(', ')

  const hazardStatusData = [
    {
      name: 'Fire',
      active: incidents.filter((incident) => incident.code === 'FR' && incident.status === 'active').length,
      other: incidents.filter((incident) => incident.code === 'FR' && incident.status !== 'active').length,
    },
    {
      name: 'Earthquake',
      active: incidents.filter((incident) => incident.code === 'EQ' && incident.status === 'active').length,
      other: incidents.filter((incident) => incident.code === 'EQ' && incident.status !== 'active').length,
    },
    {
      name: 'Accident',
      active: incidents.filter((incident) => incident.code === 'AC' && incident.status === 'active').length,
      other: incidents.filter((incident) => incident.code === 'AC' && incident.status !== 'active').length,
    },
  ].filter((item) => item.active > 0 || item.other > 0)
  const hazardStatusMax = Math.max(...hazardStatusData.map((item) => item.active + item.other), 1)

  const hazardLevelUpdates = [...incidents]
    .sort((left, right) => getSeverityWeight(right.severity) - getSeverityWeight(left.severity))
    .slice(0, 3)
    .map((incident) => ({
      barangay: incident.location,
      status: getHazardUpdateStatus(incident),
      note: incident.description,
    }))

  return (
    <>
      <section className="grid grid-cols-1 gap-6 px-6 pt-6 pb-8 md:grid-cols-2 xl:grid-cols-5">
        {overviewMetricCards.map((card) => (
          <div
            key={card.label}
            className={`group relative overflow-hidden rounded-[22px] border border-t-4 border-slate-200/70 bg-white p-6 shadow-[0_2px_8px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.08)] transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_14px_42px_rgba(15,23,42,0.17)] flex flex-col gap-2 ${card.accent}`}
          >
            <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400 transition-colors duration-200 group-hover:text-slate-500">
              {card.label}
            </span>
            <span className={`mt-1 text-4xl font-extrabold leading-none tracking-tight ${card.valueClass}`}>{card.value}</span>
            <p className="text-sm font-medium text-slate-500">Current dashboard data</p>
            <div className="mt-auto border-t border-slate-100 pt-3">
              <p className="text-[11px] text-slate-400">{card.comparison}</p>
              <p className="mt-1 text-xs font-semibold text-slate-600">{card.delta}</p>
            </div>
          </div>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-6 px-6 pb-8 xl:grid-cols-2">
        <div className={`${glassPanelClass} p-6`}>
          <div className="mb-5 flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Data Analytics</p>
              <div className="mt-1 text-xl font-semibold text-slate-900">Trend Line Chart</div>
            </div>
            <p className="text-xs text-slate-500">Accident frequency by severity level</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-[linear-gradient(180deg,#ffffff,#f8fafc)] p-4">
            <svg className="h-60 w-full" preserveAspectRatio="none" viewBox="0 0 100 100">
              {[20, 40, 60, 80].map((y) => (
                <line key={y} stroke="#e2e8f0" strokeDasharray="2 3" strokeWidth="0.6" x1="0" x2="100" y1={y} y2={y} />
              ))}
              <polyline fill="none" points={accidentSeverityPoints} stroke="#0f766e" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.6" />
              {accidentSeverityData.map((item, index) => {
                const x = (index / Math.max(accidentSeverityData.length - 1, 1)) * 100
                const y = 92 - (item.value / accidentSeverityMax) * 70
                return <circle key={item.label} cx={x} cy={y} fill="#0f766e" r="1.8" />
              })}
            </svg>

            <div className="mt-3 grid grid-cols-4 gap-2 text-center text-[11px] font-semibold text-slate-500">
              {accidentSeverityData.map((item) => (
                <div key={item.label}>
                  <p>{item.label}</p>
                  <p className="mt-1 text-slate-700">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className={`${glassPanelClass} p-6`}>
          <div className="mb-5 flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Data Analytics</p>
              <div className="mt-1 text-xl font-semibold text-slate-900">Bar Chart</div>
            </div>
            <p className="text-xs text-slate-500">Live earthquake frequency by magnitude range (5 yrs)</p>
          </div>
          {eqStatus === 'error' && (
            <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
              Failed to load live seismic data.
            </p>
          )}
          <div className="relative flex min-h-[220px] items-end gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-5">
            {eqStatus === 'loading' && (
              <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-slate-50/80">
                <span className="animate-pulse text-xs font-semibold text-teal-600">Loading seismic data...</span>
              </div>
            )}
            {activeMagBins.map((item) => (
              <div className="group flex flex-1 flex-col items-center gap-3 transition-transform duration-200 hover:-translate-y-0.5" key={item.range}>
                <span className="text-xs font-semibold text-slate-600 transition-colors duration-200 group-hover:text-indigo-700">{item.value}</span>
                <div className="flex h-40 w-full items-end rounded-[18px] bg-white p-2 shadow-[inset_0_0_0_1px_rgba(226,232,240,0.9)] transition-shadow duration-200 group-hover:shadow-[inset_0_0_0_1px_rgba(79,70,229,0.35),0_4px_12px_rgba(15,23,42,0.08)]">
                  <div
                    className="w-full rounded-[12px] bg-[linear-gradient(180deg,#4338ca,#818cf8)] transition-all duration-500"
                    style={{ height: `${eqStatus === 'loading' ? 0 : Math.max((item.value / activeMagMax) * 100, item.value > 0 ? 14 : 0)}%` }}
                  />
                </div>
                <span className="text-center text-[11px] font-semibold text-slate-500">{item.range}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 px-6 pb-8 xl:grid-cols-[1.2fr_0.9fr_1.1fr]">
        <div className={`${glassPanelClass} p-6`}>
          <div className="mb-5 flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Data Analytics</p>
              <div className="mt-1 text-xl font-semibold text-slate-900">Heatmap Snapshot</div>
            </div>
            <p className="text-xs text-slate-500">Locations with highest recorded incident pressure</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {operationalHotspots.map((item) => (
              <div
                className="rounded-2xl border p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(220,38,38,0.16)]"
                key={item.name}
                style={{
                  borderColor: `rgba(220, 38, 38, ${Math.max(item.totalRisk / 120, 0.22)})`,
                  backgroundColor: `rgba(248, 113, 113, ${Math.max(item.totalRisk / 220, 0.12)})`,
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                  <span className="rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-bold text-slate-900">{item.totalRisk}</span>
                </div>
                <div className="mt-4 space-y-2 text-xs text-slate-700">
                  <div className="flex items-center justify-between gap-3">
                    <span>Fire risk</span>
                    <span className="font-semibold">{item.fireRisk}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/80">
                    <div className="h-full rounded-full bg-red-500" style={{ width: `${item.fireRisk}%` }} />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>Earthquake risk</span>
                    <span className="font-semibold">{item.earthquakeRisk}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/80">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${item.earthquakeRisk}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={`${glassPanelClass} p-6`}>
          <div className="mb-5 flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Data Analytics</p>
              <div className="mt-1 text-xl font-semibold text-slate-900">Pie Chart</div>
            </div>
            <p className="text-xs text-slate-500">Incident distribution by hazard type</p>
          </div>

          <div className="flex flex-col items-center gap-6">
            <div className="relative flex h-48 w-48 items-center justify-center rounded-full" style={{ background: `conic-gradient(${incidentDistributionGradient})` }}>
              <div className="flex h-28 w-28 items-center justify-center rounded-full border border-slate-200 bg-white text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Total</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">{incidentDistributionTotal}</p>
                </div>
              </div>
            </div>

            <div className="grid w-full gap-3">
              {incidentDistributionData.map((item) => (
                <div className="flex items-center justify-between gap-3 text-sm" key={item.label}>
                  <div className="flex items-center gap-3">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-slate-700">{item.label}</span>
                  </div>
                  <span className="font-semibold text-slate-900">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className={`${glassPanelClass} p-6`}>
          <div className="mb-5 flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Data Analytics</p>
              <div className="mt-1 text-xl font-semibold text-slate-900">Stacked Chart</div>
            </div>
            <p className="text-xs text-slate-500">Active vs non-active incidents by hazard type</p>
          </div>

          <div className="flex min-h-[285px] items-end gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-5">
            {hazardStatusData.map((item) => {
              const activeHeight = (item.active / hazardStatusMax) * 100
              const otherHeight = (item.other / hazardStatusMax) * 100

              return (
                <div className="group flex flex-1 flex-col items-center gap-3 transition-transform duration-200 hover:-translate-y-0.5" key={item.name}>
                  <div className="flex h-56 w-full items-end rounded-[18px] bg-white p-2 shadow-[inset_0_0_0_1px_rgba(226,232,240,0.9)] transition-shadow duration-200 group-hover:shadow-[inset_0_0_0_1px_rgba(99,102,241,0.25),0_4px_12px_rgba(15,23,42,0.08)]">
                    <div className="flex w-full flex-col justify-end overflow-hidden rounded-[12px]">
                      <div className="bg-[linear-gradient(180deg,#38bdf8,#2563eb)]" style={{ height: `${Math.max(otherHeight, item.other > 0 ? 10 : 0)}%` }} />
                      <div className="bg-[linear-gradient(180deg,#f59e0b,#f97316)]" style={{ height: `${Math.max(activeHeight, item.active > 0 ? 12 : 0)}%` }} />
                    </div>
                  </div>
                  <div className="text-center text-[11px] text-slate-500">
                    <p className="font-semibold text-slate-700">{item.name}</p>
                    <p>Active {item.active}</p>
                    <p>Pending or resolved {item.other}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 px-6 pb-10 xl:grid-cols-3">
        <div className={`${glassPanelClass} p-6`}>
          <div className="mb-5 flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Recent Activity Feed</p>
              <div className="mt-1 text-xl font-semibold text-slate-900">Latest recorded fire incidents</div>
            </div>
          </div>

          <div className="space-y-3">
            {latestFireIncidents.map((incident) => (
              <article className="group rounded-2xl border border-slate-200/60 bg-white p-4 shadow-[0_1px_4px_rgba(15,23,42,0.04),0_4px_16px_rgba(15,23,42,0.06)] transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300/70 hover:shadow-[0_6px_22px_rgba(15,23,42,0.12)]" key={incident.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{incident.title}</p>
                    <p className="mt-1 text-xs text-slate-500">{incident.location} | {incident.time}</p>
                  </div>
                  <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase ${dashboardStatusClasses[incident.status]}`}>
                    {incident.status}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">{incident.description}</p>
              </article>
            ))}
            {latestFireIncidents.length === 0 ? <p className="text-sm text-slate-500">No fire incidents recorded yet.</p> : null}
          </div>
        </div>

        <div className={`${glassPanelClass} p-6`}>
          <div className="mb-5 flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Recent Activity Feed</p>
              <div className="mt-1 text-xl font-semibold text-slate-900">Latest seismic events</div>
            </div>
            <span className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase text-emerald-700">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              Live
            </span>
          </div>

          {eqStatus === 'loading' && (
            <div className="flex justify-center py-8">
              <span className="animate-pulse text-xs font-semibold text-teal-600">Loading live seismic feed…</span>
            </div>
          )}
          {eqStatus === 'error' && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
              Unable to load seismic data.
            </p>
          )}
          {eqStatus === 'idle' && (
            <div className="space-y-3">
              {liveSeismicEvents.length === 0 ? (
                <p className="text-sm text-slate-500">No recent seismic events found.</p>
              ) : (
                liveSeismicEvents.map((event) => (
                  <article className="group rounded-2xl border border-slate-200/60 bg-white p-4 shadow-[0_1px_4px_rgba(15,23,42,0.04),0_4px_16px_rgba(15,23,42,0.06)] transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300/70 hover:shadow-[0_6px_22px_rgba(15,23,42,0.12)]" key={`${event.title}-${event.time}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{event.title}</p>
                        <p className="mt-1 text-xs text-slate-500">M {event.magnitude} · {event.time}</p>
                      </div>
                      <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase text-emerald-700">
                        Seismic
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-slate-600">{event.note}</p>
                  </article>
                ))
              )}
            </div>
          )}
        </div>

        <div className={`${glassPanelClass} p-6`}>
          <div className="mb-5 flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Recent Activity Feed</p>
              <div className="mt-1 text-xl font-semibold text-slate-900">Barangay hazard level updates</div>
            </div>
          </div>

          <div className="space-y-3">
            {hazardLevelUpdates.map((update) => (
              <article className="group rounded-2xl border border-slate-200/60 bg-white p-4 shadow-[0_1px_4px_rgba(15,23,42,0.04),0_4px_16px_rgba(15,23,42,0.06)] transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300/70 hover:shadow-[0_6px_22px_rgba(15,23,42,0.12)]" key={update.barangay}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{update.barangay}</p>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{update.status}</p>
                  </div>
                  <span className="rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-[10px] font-bold uppercase text-orange-700">
                    Update
                  </span>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">{update.note}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
