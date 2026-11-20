import { useEffect, useState } from 'react'
import type { FC } from 'react'
import { useNavigate } from 'react-router-dom'
import { MobileNavBar } from '../../components/MobileNavBar'
import { ResponderPageHeader } from '../../components/ResponderPageHeader'
import { getCurrentUserProfile } from '../../services/auth'
import { getAccomplishmentReports } from '../../services/incidents'
import { ReportListCard, ReportRow, SheetHeader, TypeTag, formatReportWhen, incidentTypeMeta } from '../../components/ResponderReportUI'
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
  const teamName = getAccountTeam(getCurrentUserProfile())

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
          badge={teamName ? `Team ${teamName}` : undefined}
          description="Your team’s approved incident reports, compiled into one report."
        />

        {compiledReports.length > 0 ? (
          <div className="grid grid-cols-[1fr_auto] gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <input
              type="search"
              placeholder="Search by report code"
              aria-label="Search accomplishment reports"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            <button
              type="button"
              onClick={() => setSortOrder((current) => (current === 'newest' ? 'oldest' : 'newest'))}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
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
          <ReportListCard
            labelledBy="compiled-list"
            title={`${filteredAndSortedReports.length} accomplishment report${filteredAndSortedReports.length === 1 ? '' : 's'}`}
          >
            <ul className="divide-y divide-slate-100">
              {filteredAndSortedReports.map((report) => {
                const types = typesOf(report)
                const people = report.reports.reduce((sum, item) => sum + (Number(item.victimCount) || 0), 0)
                const count = report.reports.length || report.totalReports
                return (
                  <ReportRow
                    key={report.id}
                    color="#4f46e5"
                    title={report.compiledCode}
                    when={formatReportWhen(report.createdAt)}
                    subtitle={`${count} incident report${count === 1 ? '' : 's'}, ${people} ${people === 1 ? 'person' : 'people'} involved`}
                    onOpen={() => setSelectedCompiled(report)}
                    openLabel={`Open ${report.compiledCode}`}
                    meta={
                      types.length > 0 ? (
                        <>
                          {types.map(([type, typeCount]) => (
                            <TypeTag key={type} type={type} count={typeCount} />
                          ))}
                        </>
                      ) : undefined
                    }
                  />
                )
              })}
            </ul>
          </ReportListCard>
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
            <SheetHeader
              title={selectedCompiled.compiledCode}
              subtitle={`Compiled ${new Date(selectedCompiled.createdAt).toLocaleDateString(undefined, { dateStyle: 'long' })}`}
              onClose={() => setSelectedCompiled(null)}
            />

            <div className="p-5 pb-8 overflow-y-auto space-y-5 text-slate-700 bg-slate-50/30">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <h3 className="text-sm font-black text-slate-900">
                  Incident reports ({selectedCompiled.reports.length})
                </h3>


              </div>

              <div className="space-y-6">
                {selectedCompiled.reports.map((report, index) => (
                  <div
                    key={report.id || index}
                    className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4 relative overflow-hidden"
                  >
                    <div className="absolute top-0 bottom-0 left-0 w-1" style={{ backgroundColor: incidentTypeMeta(report.incidentType).color }} />

                    <div className="border-b border-slate-100 pb-3">
                      <div className="min-w-0">
                        <span className="block text-xs font-semibold text-slate-500">
                          Report {index + 1} of {selectedCompiled.reports.length}
                        </span>
                        <h4 className="mt-0.5 text-sm font-bold text-slate-900">{incidentTypeMeta(report.incidentType).label}</h4>
                        <p className="text-xs text-slate-500">
                          {report.reportCode}
                          {report.incidentCode ? `, ${report.incidentCode}` : ''}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div className="space-y-1 bg-slate-50/60 p-2.5 rounded-xl border border-slate-100">
                        <span className="block text-xs font-semibold text-slate-500">
                          Location
                        </span>
                        <span className="text-slate-800 font-semibold leading-relaxed block">
                          {report.location}
                        </span>
                      </div>

                      <div className="space-y-1 bg-slate-50/60 p-2.5 rounded-xl border border-slate-100">
                        <span className="block text-xs font-semibold text-slate-500">
                          People involved
                        </span>
                        <span className="inline-flex items-center font-bold text-slate-800 mt-0.5">
                          <span className={`w-1.5 h-1.5 rounded-full mr-2 ${report.victimCount > 0 ? 'bg-amber-500' : 'bg-slate-400'}`} />
                          {report.victimCount} {report.victimCount === 1 ? 'person' : 'people'}
                        </span>
                      </div>

                      <div className="sm:col-span-2 space-y-1">
                        <span className="block text-xs font-semibold text-slate-500">
                          Description
                        </span>
                        <p className="bg-slate-50/30 p-3 rounded-xl border border-slate-100 text-slate-600 leading-relaxed font-medium whitespace-pre-wrap">
                          {report.personalDataHidden ? HIDDEN_FOR_OTHER_TEAMS : report.description || 'No description was written.'}
                        </p>
                      </div>

                      <div className="sm:col-span-2 space-y-1">
                        <span className="block text-xs font-semibold text-slate-500">
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