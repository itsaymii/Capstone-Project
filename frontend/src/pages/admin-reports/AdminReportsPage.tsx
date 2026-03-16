import { useMemo, useState } from 'react'
import { AdminSidebar } from '../../components/AdminSidebar'
import {
  hazardIncidents,
  hazardMeta,
  incidentStatusClasses,
  type HazardIncident,
  type IncidentStatus,
} from '../../data/adminOperations'

type ReportFilter = 'all' | IncidentStatus

export function AdminReportsPage() {
  const [reports, setReports] = useState<HazardIncident[]>(hazardIncidents)
  const [selectedFilter, setSelectedFilter] = useState<ReportFilter>('all')

  const filteredReports = useMemo(() => {
    if (selectedFilter === 'all') {
      return reports
    }

    return reports.filter((report) => report.status === selectedFilter)
  }, [reports, selectedFilter])

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
              </article>
            ))}
          </section>
        </div>
      </main>
    </div>
  )
}