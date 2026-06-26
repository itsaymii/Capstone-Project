import { useEffect, useMemo, useState } from 'react'
import { getIncidentReports } from '../../../services/incidents'

type AccomplishmentItem = {
  id?: string
  reportCode?: string
  report_code?: string
  incidentCode?: string
  incident_code?: string
  incidentReferenceCode?: string
  incident_reference_code_readonly?: string
  incidentType?: string
  incident_type?: string
  responderTeam?: string
  responder_team?: string
  responder_username?: string
  responder?: string
  location?: string
  description?: string
  actionTaken?: string
  action_taken?: string
  report_text?: string
  status_update?: string
  victimCount?: number
  victim_count?: number
  createdAt?: string
  created_at?: string
  report_time?: string
}

function getReportCode(item: AccomplishmentItem): string {
  return item.reportCode || item.report_code || item.id || 'N/A'
}

function getIncidentCode(item: AccomplishmentItem): string {
  return (
    item.incidentCode ||
    item.incident_code ||
    item.incidentReferenceCode ||
    item.incident_reference_code_readonly ||
    'N/A'
  )
}

function getIncidentType(item: AccomplishmentItem): string {
  return item.incidentType || item.incident_type || 'Incident'
}

function getResponderTeam(item: AccomplishmentItem): string {
  return item.responderTeam || item.responder_team || item.responder_username || item.responder || '-'
}

function getActionTaken(item: AccomplishmentItem): string {
  return item.actionTaken || item.action_taken || item.report_text || item.description || 'No action details provided.'
}

function getVictimCount(item: AccomplishmentItem): number {
  return Number(item.victimCount ?? item.victim_count ?? 0)
}

function formatDate(value?: string): string {
  if (!value) return '-'

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value

  return parsed.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function getStatusBadgeStyle(status?: string): string {
  const value = String(status || '').trim().toLowerCase()

  if (value.includes('compiled') || value.includes('approved')) {
    return 'bg-emerald-50 text-emerald-700 ring-emerald-100'
  }

  if (value.includes('pending')) {
    return 'bg-amber-50 text-amber-700 ring-amber-100'
  }

  return 'bg-slate-50 text-slate-600 ring-slate-100'
}

export function AccomplishmentReports() {
  const [reports, setReports] = useState<AccomplishmentItem[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    async function loadAccomplishmentReports() {
      try {
        setIsLoading(true)
        const data = await getIncidentReports()

        if (isMounted) {
          setReports(Array.isArray(data) ? data : [])
        }
      } catch (error) {
        console.error('[AccomplishmentReports] Failed to load reports:', error)

        if (isMounted) {
          setReports([])
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void loadAccomplishmentReports()

    return () => {
      isMounted = false
    }
  }, [])

  const filteredReports = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()

    if (!query) return reports

    return reports.filter((report) =>
      [
        getReportCode(report),
        getIncidentCode(report),
        getIncidentType(report),
        getResponderTeam(report),
        report.location,
        getActionTaken(report),
        report.status_update,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    )
  }, [reports, searchQuery])

  return (
    <section className="px-4 pb-10 pt-2 sm:px-6">
      <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_38px_rgba(15,23,42,0.08)]">
        <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">
              Responder Submission
            </p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
              Accomplishment Reports
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Submitted responder accomplishment reports are displayed here for admin review.
            </p>
          </div>

          <div className="flex w-full max-w-md items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <input
              className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search accomplishment reports..."
              type="text"
              value={searchQuery}
            />
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Total Reports
            </p>
            <p className="mt-2 text-3xl font-black text-blue-800">{reports.length}</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              With Victims
            </p>
            <p className="mt-2 text-3xl font-black text-red-700">
              {reports.filter((item) => getVictimCount(item) > 0).length}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Completed
            </p>
            <p className="mt-2 text-3xl font-black text-emerald-700">
              {
                reports.filter((item) =>
                  String(item.status_update || '').toLowerCase().includes('complete'),
                ).length
              }
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Search Result
            </p>
            <p className="mt-2 text-3xl font-black text-slate-900">{filteredReports.length}</p>
          </div>
        </div>

        <div className="mt-6 grid gap-4">
          {isLoading ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
              Loading accomplishment reports...
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
              No accomplishment reports found.
            </div>
          ) : (
            filteredReports.map((report) => (
              <article
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_10px_24px_rgba(15,23,42,0.06)] transition hover:border-blue-200 hover:shadow-[0_16px_30px_rgba(15,23,42,0.09)]"
                key={getReportCode(report)}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-800">
                        {getReportCode(report)}
                      </span>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                        Incident: {getIncidentCode(report)}
                      </span>
                    </div>

                    <h3 className="mt-3 text-lg font-bold text-slate-900">
                      {getIncidentType(report)}
                    </h3>

                    <p className="mt-1 text-sm text-slate-500">
                      {report.location || 'No location provided'}
                    </p>
                  </div>

                  <div className="text-left lg:text-right">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                      Submitted
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-700">
                      {formatDate(report.createdAt || report.created_at || report.report_time)}
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                      Responder Team
                    </p>
                    <p className="mt-2 text-sm font-semibold text-slate-800">
                      {getResponderTeam(report)}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                      Victim Count
                    </p>
                    <p className="mt-2 text-3xl font-black text-red-700">
                      {getVictimCount(report)}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                      Status
                    </p>
                    <span className={`mt-2 inline-flex rounded-full border px-3 py-1 text-xs font-bold ${getStatusBadgeStyle(report.status_update)}`}>
                      {report.status_update || 'Submitted'}
                    </span>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                      Action Taken
                    </p>
                    <p className="text-xs text-slate-400">Summary</p>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-700">
                    {getActionTaken(report)}
                  </p>
                </div>
              </article>
            ))
          )}
        </div>
      </div>
    </section>
  )
}