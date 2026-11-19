import { useEffect, useState } from 'react'
import type { FC } from 'react'
import { useNavigate } from 'react-router-dom'
import { MobileNavBar } from '../../components/MobileNavBar'
import { ResponderPageHeader } from '../../components/ResponderPageHeader'
import { getCurrentUserProfile } from '../../services/auth'
import { getAccomplishmentReports } from '../../services/incidents'
import { getIncidentCategoryKey, getIncidentCategoryMeta } from '../../data/incidentCategories'
import { getAccountTeam, toTeamName } from '../../data/teams'

interface IndividualReport {
  id: string
  reportCode: string
  incidentCode: string
  incidentType: string
  location: string
  description: string
  actionTaken: string
  victimCount: number
  timeOccurred?: string
  responderTeam?: string
  // Another team's report: the server leaves out the description and actions taken.
  personalDataHidden?: boolean
}

const HIDDEN_FOR_OTHER_TEAMS = 'Only the filing team can see this. It may name the people involved.'

interface CompiledReport {
  id: string
  compiledCode: string
  title: string
  reports: IndividualReport[]
  totalReports: number
  createdAt: string
  status: string
  compiledBy?: string | null
}

const normalizeName = (value?: string | null) => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ')

/** Accomplishment reports this account compiled, or that hold its team's reports. */
function isOwnCompiledReport(report: CompiledReport): boolean {
  const profile = getCurrentUserProfile()
  const username = normalizeName(profile?.username)
  const team = normalizeName(getAccountTeam(profile))
  if (username && normalizeName(report.compiledBy) === username) return true
  return Boolean(team) && (report.reports || []).some((item) => normalizeName(toTeamName(item.responderTeam)) === team)
}

export const ResponderReportsPage: FC = () => {
  const navigate = useNavigate()

  const [compiledReports, setCompiledReports] = useState<CompiledReport[]>([])
  const [selectedCompiled, setSelectedCompiled] = useState<CompiledReport | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest')
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    const fetchCompiledReports = async () => {
      try {
        setIsLoading(true)

        const reportsData = (await getAccomplishmentReports()) as CompiledReport[]
        setCompiledReports(reportsData.filter(isOwnCompiledReport))
        setLoadError('')
      } catch (error) {
        console.error('Error fetching accomplishment reports:', error)
        setLoadError('Unable to load accomplishment reports. Check your connection and try again.')
      } finally {
        setIsLoading(false)
      }
    }

    fetchCompiledReports()
  }, [])

  const filteredAndSortedReports = compiledReports
    .filter((report) => {
      const query = searchQuery.toLowerCase()

      return (
        report.compiledCode?.toLowerCase().includes(query) ||
        report.title?.toLowerCase().includes(query)
      )
    })
    .sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime()
      const dateB = new Date(b.createdAt).getTime()

      return sortOrder === 'newest' ? dateB - dateA : dateA - dateB
    })

  const getIncidentBadgeStyle = (type: string) => {
    const meta = getIncidentCategoryMeta(getIncidentCategoryKey({ incidentType: type }))
    return { color: meta.color, borderColor: `${meta.color}55`, backgroundColor: `${meta.color}14` }
  }

  // Incident types in one accomplishment report, most frequent first.
  const typesOf = (report: CompiledReport) => {
    const counts = new Map<string, number>()
    report.reports.forEach((item) => counts.set(item.incidentType, (counts.get(item.incidentType) ?? 0) + 1))
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])
  }

  return (
    <div className="min-h-screen bg-slate-100 pb-28 pt-4 text-slate-800 antialiased">
      <main className="mx-auto max-w-lg space-y-4 px-4">
        <ResponderPageHeader
          title="Accomplishment reports"
          description="Reports your team compiled from approved incident reports."
        />

        {compiledReports.length > 0 ? (
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <input
              type="search"
              placeholder="Search by report code"
              aria-label="Search accomplishment reports"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="min-w-0 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium shadow-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            <button
              type="button"
              onClick={() => setSortOrder((current) => (current === 'newest' ? 'oldest' : 'newest'))}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-700 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              {sortOrder === 'newest' ? 'Newest first' : 'Oldest first'}
            </button>
          </div>
        ) : null}

        {isLoading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
            <p className="text-sm font-semibold text-slate-500">Loading accomplishment reports…</p>
          </div>
        ) : loadError ? (
          <div className="rounded-2xl border border-red-200 bg-white p-10 text-center shadow-sm">
            <p className="text-sm font-semibold text-red-700">{loadError}</p>
          </div>
        ) : compiledReports.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
            <h2 className="text-base font-bold text-slate-900">No accomplishment reports yet</h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-500">
              Select your team's approved incident reports and compile them. The report shows up here.
            </p>
            <button
              type="button"
              onClick={() => navigate('/responder-incidents?view=ready')}
              className="mt-5 inline-flex items-center justify-center rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-sm hover:bg-blue-700"
            >
              See reports ready to compile
            </button>
          </div>
        ) : filteredAndSortedReports.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
            <h2 className="text-sm font-bold text-slate-800">No report has that code</h2>
            <p className="mt-1 text-xs text-slate-500">Check the code or clear the search.</p>
          </div>
        ) : (
          <ul className="space-y-2.5" aria-label="Accomplishment reports">
            {filteredAndSortedReports.map((report) => {
              const types = typesOf(report)
              const people = report.reports.reduce((sum, item) => sum + (Number(item.victimCount) || 0), 0)
              const count = report.reports.length || report.totalReports
              return (
                <li key={report.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedCompiled(report)}
                    className="block w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-colors hover:border-blue-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block font-mono text-sm font-black text-slate-900">{report.compiledCode}</span>
                        <span className="mt-0.5 block text-xs text-slate-500">
                          {new Date(report.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                        </span>
                      </span>
                      <span className="inline-flex shrink-0 items-center rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
                        <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
                        {report.status}
                      </span>
                    </span>

                    <span className="mt-2 block text-sm text-slate-600">
                      {count} incident report{count === 1 ? '' : 's'}, {people} {people === 1 ? 'person' : 'people'} involved
                    </span>

                    {types.length > 0 ? (
                      <span className="mt-3 flex flex-wrap gap-1.5">
                        {types.map(([type, typeCount]) => (
                          <span key={type} style={getIncidentBadgeStyle(type)} className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide">
                            {type}
                            {typeCount > 1 ? <span className="tabular-nums">×{typeCount}</span> : null}
                          </span>
                        ))}
                      </span>
                    ) : null}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </main>

      {selectedCompiled && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/40 backdrop-blur-sm" onClick={() => setSelectedCompiled(null)}>
          <div
            className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-slate-100 bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={`Accomplishment report ${selectedCompiled.compiledCode}`}
          >
            <div className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-slate-200" aria-hidden="true" />
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2.5">
                  <h2 className="text-lg font-black text-slate-900 tracking-tight font-mono">
                    {selectedCompiled.compiledCode}
                  </h2>
                </div>
                <p className="text-xs text-slate-500 font-medium">
                  Compiled{' '}
                  {new Date(selectedCompiled.createdAt).toLocaleDateString(undefined, { dateStyle: 'long' })}
                </p>
              </div>

              <button
                onClick={() => setSelectedCompiled(null)}
                className="p-2 text-sm text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-md transition-colors active:scale-95"
                aria-label="Close"
              >
                Close
              </button>
            </div>

            <div className="p-5 pb-8 overflow-y-auto space-y-5 text-slate-700 bg-slate-50/30">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">
                  Incident reports ({selectedCompiled.reports.length})
                </h3>


              </div>

              <div className="space-y-6">
                {selectedCompiled.reports.map((report, index) => (
                  <div
                    key={report.id || index}
                    className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4 relative overflow-hidden"
                  >
                    <div className="absolute top-0 bottom-0 left-0 w-1 bg-indigo-500" />

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 block uppercase tracking-wider font-mono">
                          Report {index + 1} of {selectedCompiled.reports.length}
                        </span>

                        <h4 className="font-extrabold text-sm text-slate-900 font-mono tracking-tight flex items-center gap-2">
                          <span className="text-blue-600">
                            {report.reportCode}
                          </span>
                          <span className="text-slate-300">/</span>
                          <span className="text-slate-500 text-xs">
                            {report.incidentCode}
                          </span>
                        </h4>
                      </div>

                      <span style={getIncidentBadgeStyle(report.incidentType)} className="inline-flex items-center self-start sm:self-auto text-[9px] font-extrabold tracking-wider uppercase px-2.5 py-0.5 border rounded-md">
                        {report.incidentType}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div className="space-y-1 bg-slate-50/60 p-2.5 rounded-xl border border-slate-100">
                        <span className="text-[10px] text-slate-400 block font-extrabold uppercase tracking-wider">
                          Location
                        </span>
                        <span className="text-slate-800 font-semibold leading-relaxed block">
                          {report.location}
                        </span>
                      </div>

                      <div className="space-y-1 bg-slate-50/60 p-2.5 rounded-xl border border-slate-100">
                        <span className="text-[10px] text-slate-400 block font-extrabold uppercase tracking-wider">
                          People involved
                        </span>
                        <span className="inline-flex items-center font-bold text-slate-800 mt-0.5">
                          <span className={`w-1.5 h-1.5 rounded-full mr-2 ${report.victimCount > 0 ? 'bg-amber-500' : 'bg-slate-400'}`} />
                          {report.victimCount} {report.victimCount === 1 ? 'person' : 'people'}
                        </span>
                      </div>

                      <div className="sm:col-span-2 space-y-1">
                        <span className="text-[10px] text-slate-400 block font-extrabold uppercase tracking-wider">
                          Description
                        </span>
                        <p className="bg-slate-50/30 p-3 rounded-xl border border-slate-100 text-slate-600 leading-relaxed font-medium whitespace-pre-wrap">
                          {report.personalDataHidden ? HIDDEN_FOR_OTHER_TEAMS : report.description || 'No description was written.'}
                        </p>
                      </div>

                      <div className="sm:col-span-2 space-y-1">
                        <span className="text-[10px] text-slate-400 block font-extrabold uppercase tracking-wider">
                          Action taken
                        </span>
                        <p className="bg-blue-50/10 p-3 rounded-xl border border-blue-100/40 text-slate-700 leading-relaxed font-medium whitespace-pre-wrap">
                          {report.personalDataHidden ? HIDDEN_FOR_OTHER_TEAMS : report.actionTaken || 'No action was written.'}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      )}

      <MobileNavBar />
    </div>
  )
}

export default ResponderReportsPage