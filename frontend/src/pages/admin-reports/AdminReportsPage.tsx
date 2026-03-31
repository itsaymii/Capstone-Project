import { useEffect, useMemo, useState } from 'react'
import { AdminSidebar } from '../../components/AdminSidebar'
import {
  hazardIncidents,
  hazardMeta,
  incidentStatusClasses,
  type HazardIncident,
  type IncidentStatus,
} from '../../data/adminOperations'
import {
  fetchQuezonRegionEarthquakes,
  type EarthquakeEvent,
} from '../../services/earthquakes'

type ReportFilter = 'all' | IncidentStatus

function getEarthquakeSeverity(magnitude: number): HazardIncident['severity'] {
  if (magnitude >= 5) return 'Critical'
  if (magnitude >= 4) return 'High'
  if (magnitude >= 3) return 'Moderate'
  return 'Low'
}

function getEarthquakeStatus(event: EarthquakeEvent): IncidentStatus {
  const hoursSinceEvent = (Date.now() - event.rawTimestamp) / (1000 * 60 * 60)

  if (event.magnitude >= 4.5 || hoursSinceEvent <= 24) {
    return 'active'
  }

  if (event.magnitude >= 3.5 || hoursSinceEvent <= 72) {
    return 'pending'
  }

  return 'resolved'
}

function getEarthquakeDescription(event: EarthquakeEvent): string {
  if (event.magnitude >= 5) {
    return `Strong seismic event near ${event.place}. Magnitude ${event.magnitude.toFixed(1)}, depth ${event.depth.toFixed(1)} km. Immediate structural assessment recommended.`
  }

  if (event.magnitude >= 4) {
    return `Moderate earthquake recorded near ${event.place}. Magnitude ${event.magnitude.toFixed(1)}, depth ${event.depth.toFixed(1)} km with possible light shaking.`
  }

  return `Minor seismic activity near ${event.place}. Magnitude ${event.magnitude.toFixed(1)}, depth ${event.depth.toFixed(1)} km. Monitoring remains active.`
}

export function AdminReportsPage() {
  const [reports, setReports] = useState<HazardIncident[]>(() =>
    hazardIncidents.filter((report) => report.code !== 'EQ'),
  )
  const [selectedFilter, setSelectedFilter] = useState<ReportFilter>('all')
  const [earthquakeReports, setEarthquakeReports] = useState<HazardIncident[]>([])
  const [earthquakeFeedStatus, setEarthquakeFeedStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    let cancelled = false

    async function loadEarthquakeReports(silent = false): Promise<void> {
      if (!silent) {
        setEarthquakeFeedStatus('loading')
      }

      try {
        const events = await fetchQuezonRegionEarthquakes(1825, 1.0)
        if (cancelled) return

        const mappedReports = [...events]
          .sort((left, right) => right.rawTimestamp - left.rawTimestamp)
          .map<HazardIncident>((event) => ({
            id: event.id,
            title: `Earthquake Event - ${event.place}`,
            code: 'EQ',
            status: getEarthquakeStatus(event),
            severity: getEarthquakeSeverity(event.magnitude),
            location: event.place,
            time: event.time,
            responseTeam: 'Seismic Assessment Unit',
            description: getEarthquakeDescription(event),
            coordinates: [event.lat, event.lng],
          }))

        setEarthquakeReports(mappedReports)
        setEarthquakeFeedStatus('ready')
      } catch {
        if (cancelled) return
        setEarthquakeFeedStatus('error')
      }
    }

    void loadEarthquakeReports()

    const refreshTimer = window.setInterval(() => {
      void loadEarthquakeReports(true)
    }, 5 * 60 * 1000)

    return () => {
      cancelled = true
      window.clearInterval(refreshTimer)
    }
  }, [])

  const combinedReports = useMemo(() => [...earthquakeReports, ...reports], [earthquakeReports, reports])

  const filteredReports = useMemo(() => {
    if (selectedFilter === 'all') {
      return combinedReports
    }

    return combinedReports.filter((report) => report.status === selectedFilter)
  }, [combinedReports, selectedFilter])

  function updateReportStatus(reportId: string, nextStatus: IncidentStatus): void {
    setReports((currentReports) =>
      currentReports.map((report) => (report.id === reportId ? { ...report, status: nextStatus } : report)),
    )
  }

  return (
    <div className="min-h-screen bg-[#181c23] text-slate-100 md:flex">
      <AdminSidebar activeKey="reportsAnalytics" />

      <main className="flex-1">
        <div className="border-b border-slate-800 bg-[#181c23]">
          <div className="mx-auto w-full max-w-7xl px-6 py-5 sm:px-10">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Admin Operations</p>
            <h1 className="mt-1 text-2xl font-black text-white">Hazard Reports Desk</h1>
          </div>
        </div>

        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-8 sm:px-10">
          <section className="rounded-3xl border border-slate-700 bg-[#232837] p-6 shadow-[0_20px_45px_rgba(0,0,0,0.25)]">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Report Controls</p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold">
              <span
                className={`rounded-full px-3 py-1 ${
                  earthquakeFeedStatus === 'loading'
                    ? 'border border-amber-500/30 bg-amber-500/10 text-amber-200'
                    : earthquakeFeedStatus === 'error'
                      ? 'border border-red-500/30 bg-red-500/10 text-red-200'
                      : 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                }`}
              >
                {earthquakeFeedStatus === 'loading'
                  ? 'Loading live earthquake feed'
                  : earthquakeFeedStatus === 'error'
                    ? 'Earthquake feed unavailable'
                    : `${earthquakeReports.length} live earthquake reports loaded`}
              </span>
              <span className="text-slate-400">Earthquake cards come from the available API. Fire and accident cards remain local for now.</span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {(['all', 'active', 'pending', 'resolved'] as ReportFilter[]).map((filter) => (
                <button
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] transition ${
                    selectedFilter === filter
                      ? 'border-blue-500 bg-blue-500/15 text-blue-200'
                      : 'border-slate-700 bg-[#1d2230] text-slate-300 hover:border-slate-500'
                  }`}
                  key={filter}
                  onClick={() => setSelectedFilter(filter)}
                  type="button"
                >
                  {filter}
                </button>
              ))}
            </div>
          </section>

          <section className="grid gap-4">
            {filteredReports.map((report) => (
              <article className="rounded-3xl border border-slate-700 bg-[#232837] p-5" key={report.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-md border px-2 py-1 text-[11px] font-bold ${hazardMeta[report.code].surface} ${hazardMeta[report.code].accent}`}>
                        {hazardMeta[report.code].label}
                      </span>
                      <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] ${incidentStatusClasses[report.status]}`}>
                        {report.status}
                      </span>
                    </div>
                    <h2 className="mt-3 text-xl font-bold text-white">{report.title}</h2>
                    <p className="mt-1 text-sm text-slate-400">{report.location} • {report.time}</p>
                  </div>
                  <div className="text-right text-sm text-slate-300">
                    <p>Severity: {report.severity}</p>
                    <p className="mt-1">Team: {report.responseTeam}</p>
                  </div>
                </div>

                <p className="mt-4 text-sm leading-relaxed text-slate-300">{report.description}</p>

                {report.code === 'EQ' ? (
                  <div className="mt-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                    Live earthquake event from API feed. Status is derived automatically from magnitude and recency.
                  </div>
                ) : (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-200 transition hover:border-amber-400"
                      onClick={() => updateReportStatus(report.id, 'pending')}
                      type="button"
                    >
                      Mark Pending
                    </button>
                    <button
                      className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-200 transition hover:border-red-400"
                      onClick={() => updateReportStatus(report.id, 'active')}
                      type="button"
                    >
                      Mark Active
                    </button>
                    <button
                      className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-200 transition hover:border-emerald-400"
                      onClick={() => updateReportStatus(report.id, 'resolved')}
                      type="button"
                    >
                      Mark Resolved
                    </button>
                  </div>
                )}
              </article>
            ))}
          </section>
        </div>
      </main>
    </div>
  )
}