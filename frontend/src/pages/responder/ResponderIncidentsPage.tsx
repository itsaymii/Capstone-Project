import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FC } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { MobileNavBar } from '../../components/MobileNavBar'
import { ResponderPageHeader } from '../../components/ResponderPageHeader'
import {
  STAGE_BADGE_CLASSES,
  STAGE_LABELS,
  getCurrentResponder,
  getReportStage,
  isOwnReport,
} from '../../data/responderReports'
import type { ReportStage } from '../../data/responderReports'
import axios from 'axios'
import { getCurrentUserProfile } from '../../services/auth'
import { addNotification } from '../../services/notifications'
import { createAccomplishmentReport, getIncidentReports } from '../../services/incidents'
import { getIncidentCategoryMeta, getIncidentCategoryKey } from '../../data/incidentCategories'
import { getAccountTeam, toTeamName } from '../../data/teams'

type ViewFilter = 'all' | ReportStage

interface VictimDetails {
  name: string
  age: string
  gender: 'M' | 'F' | ''
  address: string
  condition: string
}

interface IncidentReport {
  id: string
  reportCode?: string
  report_code?: string
  incidentCode?: string
  incident_code?: string
  incident_reference_code_readonly?: string
  timeOccurred?: string
  time_occurred?: string
  incidentType?: string
  incident_type?: string
  responderTeam?: string
  responder_team?: string
  location: string
  description: string
  victimCount?: number
  victim_count?: number
  victims?: VictimDetails[]
  actionTaken?: string
  action_taken?: string
  // Another team's report: the server leaves out the victims, description and actions taken.
  personalDataHidden?: boolean
  status?: string
  status_update?: string
  createdAt?: string
  created_at?: string
  createdBy?: string
  createdByRole?: string
  /** Accomplishment report code this report is already compiled into. */
  compiledIn?: string | null
}

function getStatusValue(report: IncidentReport): string {
  return report.status_update || report.status || 'Submitted'
}

function normalizeStatus(status?: string): 'approved' | 'pending' | 'submitted' {
  const value = String(status || '').trim().toLowerCase()

  if (value === 'approved' || value === 'approve' || value === 'verified') return 'approved'
  if (value === 'pending') return 'pending'

  return 'submitted'
}

function getStatusLabel(status?: string): string {
  const normalized = normalizeStatus(status)

  if (normalized === 'approved') return 'Approved'
  if (normalized === 'pending') return 'Pending'

  return 'Submitted'
}

function getStatusBadgeClass(status?: string): string {
  const normalized = normalizeStatus(status)

  if (normalized === 'approved') return 'bg-emerald-50 text-emerald-700 border-emerald-100'
  if (normalized === 'pending') return 'bg-amber-50 text-amber-700 border-amber-100'

  return 'bg-blue-50 text-blue-700 border-blue-100'
}

function getStatusDotClass(status?: string): string {
  const normalized = normalizeStatus(status)

  if (normalized === 'approved') return 'bg-emerald-500'
  if (normalized === 'pending') return 'bg-amber-500'

  return 'bg-blue-500'
}

function getReportCode(report: IncidentReport): string {
  return report.reportCode || report.report_code || report.id
}

function getIncidentCode(report: IncidentReport): string {
  return (
    report.incidentCode ||
    report.incident_code ||
    report.incident_reference_code_readonly ||
    'N/A'
  )
}

function getIncidentType(report: IncidentReport): string {
  return report.incidentType || report.incident_type || 'Incident Report'
}

function getCreatedAt(report: IncidentReport): string {
  return report.createdAt || report.created_at || ''
}

function getTimeOccurred(report: IncidentReport): string {
  return report.timeOccurred || report.time_occurred || 'N/A'
}

function getResponderTeam(report: IncidentReport): string {
  return toTeamName(report.responderTeam || report.responder_team) || 'Responder Team'
}

function getVictimCount(report: IncidentReport): number {
  return Number(report.victimCount ?? report.victim_count ?? report.victims?.length ?? 0)
}

function getActionTaken(report: IncidentReport): string {
  return report.actionTaken || report.action_taken || ''
}

const HIDDEN_FOR_OTHER_TEAMS = "Only the filing team can see this. It may name the people involved."

function formatTimeOfDay(value: string): string {
  const match = /^(\d{1,2}):(\d{2})/.exec(value || '')
  if (!match) return value || 'N/A'
  const hours = Number(match[1])
  return `${hours % 12 || 12}:${match[2]} ${hours < 12 ? 'AM' : 'PM'}`
}

function getServerMessage(error: unknown, fallback: string): string {
  const data = axios.isAxiosError(error) ? (error.response?.data as Record<string, unknown> | undefined) : undefined
  if (!data || typeof data !== 'object') return fallback
  const first = Object.values(data)[0]
  if (Array.isArray(first)) return first.map(String).join(' ')
  return typeof first === 'string' ? first : fallback
}

const IncidentReportPage: FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const me = getCurrentResponder()
  const teamName = getAccountTeam(getCurrentUserProfile())

  const [reports, setReports] = useState<IncidentReport[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [detailsReport, setDetailsReport] = useState<IncidentReport | null>(null)

  const [searchQuery, setSearchQuery] = useState('')
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc')
  const [hazardFilter, setHazardFilter] = useState('All')
  // The dashboard links here with ?view=ready (or awaiting, compiled).
  const viewFromLink = (): ViewFilter => {
    const view = new URLSearchParams(location.search).get('view')
    return view === 'ready' || view === 'awaiting' || view === 'compiled' || view === 'other' ? view : 'all'
  }
  const [viewFilter, setViewFilter] = useState<ViewFilter>(viewFromLink)
  useEffect(() => {
    setViewFilter(viewFromLink())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search])
  const [isLoading, setIsLoading] = useState(true)

  const [isCompiling, setIsCompiling] = useState(false)

  const fetchReports = useCallback(async (showError = true) => {
    try {
      const reportsData = (await getIncidentReports()) as IncidentReport[]
      setReports(reportsData)
    } catch (error) {
      console.error('Error fetching incident reports:', error)

      if (showError) {
        setReports([])
        addNotification('Failed to load incident reports. Check your connection and try again.')
      }
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchReports()

    // Refresh every 30 seconds while the page is on screen.
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') void fetchReports(false)
    }, 30000)

    return () => window.clearInterval(intervalId)
  }, [fetchReports])



  const canSelectReport = (report: IncidentReport): boolean => getReportStage(report, me) === 'ready'

  const getSelectionRestrictionMessage = (report: IncidentReport): string => {
    if (report.compiledIn) return `Already compiled in ${report.compiledIn}.`
    if (report.createdByRole === 'admin') return 'Reports created by an admin cannot be compiled by responders.'
    if (!isOwnReport(report, me)) return 'Only reports filed by your team can be selected.'
    if (normalizeStatus(getStatusValue(report)) !== 'approved') return 'Only approved incident reports can be selected for compilation.'
    return 'Select for accomplishment report'
  }

  const hazardTypes = useMemo(() => {
    return Array.from(new Set(reports.map((report) => getIncidentType(report)).filter(Boolean)))
  }, [reports])

  const filteredAndSortedReports = useMemo(() => {
    return reports
      .filter((report) => {
        const query = searchQuery.toLowerCase()
        const location = report.location || ''

        const matchesSearch =
          getReportCode(report).toLowerCase().includes(query) ||
          getIncidentCode(report).toLowerCase().includes(query) ||
          getIncidentType(report).toLowerCase().includes(query) ||
          location.toLowerCase().includes(query)

        const matchesHazard = hazardFilter === 'All' || getIncidentType(report) === hazardFilter
        const matchesView = viewFilter === 'all' || getReportStage(report, me) === viewFilter

        return matchesSearch && matchesHazard && matchesView
      })
      .sort((a, b) => {
        const dateA = new Date(getCreatedAt(a)).getTime()
        const dateB = new Date(getCreatedAt(b)).getTime()

        return sortOrder === 'desc' ? dateB - dateA : dateA - dateB
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reports, searchQuery, hazardFilter, sortOrder, viewFilter])

  const stageCounts = useMemo(() => {
    const counts: Record<ViewFilter, number> = { all: reports.length, ready: 0, awaiting: 0, compiled: 0, other: 0 }
    reports.forEach((report) => {
      counts[getReportStage(report, me)] += 1
    })
    return counts
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reports])

  const toggleSelect = (report: IncidentReport) => {
    if (!canSelectReport(report)) {
      addNotification(getSelectionRestrictionMessage(report))
      return
    }

    setSelectedIds((prev) =>
      prev.includes(report.id)
        ? prev.filter((item) => item !== report.id)
        : [...prev, report.id],
    )
  }

  const toggleSelectAll = () => {
    const selectableReports = filteredAndSortedReports.filter((report) => canSelectReport(report))

    if (selectableReports.length === 0) {
      addNotification('None of these reports can be selected. Only approved reports filed by your team that are not yet compiled can be selected.')
      return
    }

    const selectableIds = selectableReports.map((report) => report.id)
    const allSelected = selectableIds.every((id) => selectedIds.includes(id))

    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !selectableIds.includes(id)))
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...selectableIds])))
    }
  }

  const compileReports = async () => {
    if (selectedIds.length === 0) {
      addNotification('Please select at least one report.')
      return
    }

    setIsCompiling(true)
    try {
      const compiled = await createAccomplishmentReport(selectedIds)
      addNotification(`Reports compiled successfully${compiled?.compiledCode ? ` as ${compiled.compiledCode}` : ''}.`)
      setSelectedIds([])
      navigate('/responder-reports', { replace: true })
    } catch (error) {
      console.error('Error compiling reports:', error)
      addNotification(getServerMessage(error, 'Failed to compile reports. Please try again.'))
    } finally {
      setIsCompiling(false)
    }
  }

  const getIncidentBadgeStyle = (type: string) => {
    const color = getIncidentCategoryMeta(getIncidentCategoryKey({ incidentType: type })).color
    return { color, borderColor: `${color}55`, backgroundColor: `${color}14` }
  }

  const viewOptions: { value: ViewFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'ready', label: STAGE_LABELS.ready },
    { value: 'awaiting', label: STAGE_LABELS.awaiting },
    { value: 'compiled', label: STAGE_LABELS.compiled },
  ]
  const selectableInView = filteredAndSortedReports.filter((report) => canSelectReport(report))
  const allInViewSelected = selectableInView.length > 0 && selectableInView.every((report) => selectedIds.includes(report.id))

  return (
    <div className={`min-h-screen bg-slate-100 pt-4 text-slate-800 antialiased ${selectedIds.length > 0 ? 'pb-48' : 'pb-28'}`}>
      <main className="mx-auto max-w-lg space-y-4 px-4">
        <ResponderPageHeader
          title="Incident reports"
          description={
            teamName
              ? `Reports from all teams. You can compile Team ${teamName}'s approved reports into an accomplishment report.`
              : 'Reports from all teams. Ask an admin to set your team before you compile reports.'
          }
        />

        {!isLoading && reports.length > 0 ? (
          <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm" aria-label="Filter reports">
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Show">
              {viewOptions.map((option) => {
                const isOn = viewFilter === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="tab"
                    aria-selected={isOn}
                    onClick={() => setViewFilter(option.value)}
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                      isOn ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    {option.label}
                    <span className={`rounded-full px-1.5 text-[10px] tabular-nums ${isOn ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                      {stageCounts[option.value]}
                    </span>
                  </button>
                )
              })}
            </div>

            <input
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search code, type, or barangay"
              type="search"
              aria-label="Search reports"
              value={searchQuery}
            />

            <div className="grid grid-cols-[1fr_auto] gap-2">
              <select
                className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-blue-500"
                onChange={(e) => setHazardFilter(e.target.value)}
                aria-label="Incident type"
                value={hazardFilter}
              >
                <option value="All">All incident types</option>
                {hazardTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              <button
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                onClick={() => setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
                type="button"
              >
                {sortOrder === 'desc' ? 'Newest first' : 'Oldest first'}
              </button>
            </div>
          </section>
        ) : null}

        {isLoading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
            <p className="text-sm font-semibold text-slate-500">Loading incident reports…</p>
          </div>
        ) : reports.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
            <h2 className="text-base font-bold text-slate-900">No incident reports yet</h2>
            <p className="mt-1 text-sm text-slate-500">Reports you file from the scene show up here.</p>
            <button
              className="mt-5 inline-flex items-center justify-center rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-sm hover:bg-blue-700"
              onClick={() => navigate('/create-report')}
              type="button"
            >
              Create incident report
            </button>
          </div>
        ) : filteredAndSortedReports.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
            <h2 className="text-sm font-bold text-slate-800">No reports match</h2>
            <p className="mt-1 text-xs text-slate-500">Change the search, the incident type, or pick All above.</p>
          </div>
        ) : (
          <section aria-label="Reports" className="space-y-2.5">
            {selectableInView.length > 0 ? (
              <div className="flex items-center justify-between px-1">
                <p className="text-xs font-semibold text-slate-500">
                  {filteredAndSortedReports.length} report{filteredAndSortedReports.length === 1 ? '' : 's'}
                </p>
                <button type="button" onClick={toggleSelectAll} className="text-xs font-bold text-blue-700">
                  {allInViewSelected ? 'Clear selection' : `Select all ready (${selectableInView.length})`}
                </button>
              </div>
            ) : (
              <p className="px-1 text-xs font-semibold text-slate-500">
                {filteredAndSortedReports.length} report{filteredAndSortedReports.length === 1 ? '' : 's'}
              </p>
            )}

            <ul className="space-y-2.5">
              {filteredAndSortedReports.map((report) => {
                const stage = getReportStage(report, me)
                const selectable = stage === 'ready'
                const isSelected = selectedIds.includes(report.id)
                const createdAt = new Date(getCreatedAt(report))
                const typeStyle = getIncidentBadgeStyle(getIncidentType(report))
                const victims = getVictimCount(report)

                return (
                  <li
                    key={report.id}
                    className={`flex items-stretch overflow-hidden rounded-2xl border bg-white shadow-sm transition-colors ${
                      isSelected ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-slate-200'
                    }`}
                  >
                    <span className="w-1 shrink-0" style={{ backgroundColor: typeStyle.color }} aria-hidden="true" />
                    <button
                      type="button"
                      onClick={() => setDetailsReport(report)}
                      className="min-w-0 flex-1 px-3.5 py-3 text-left focus:outline-none focus-visible:bg-slate-50"
                    >
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="inline-flex rounded-md border px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide" style={typeStyle}>
                          {getIncidentType(report)}
                        </span>
                        <span className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] font-bold ${STAGE_BADGE_CLASSES[stage]}`}>
                          {stage === 'compiled' && report.compiledIn ? `In ${report.compiledIn}` : STAGE_LABELS[stage]}
                        </span>
                        {report.createdByRole === 'admin' ? (
                          <span className="rounded-md border border-red-100 bg-red-50 px-2 py-0.5 text-[10px] font-extrabold text-red-600">Admin</span>
                        ) : null}
                      </span>
                      <span className="mt-2 block truncate text-sm font-bold text-slate-900">{report.location || 'Location not set'}</span>
                      <span className="mt-0.5 block text-xs text-slate-500">
                        {Number.isNaN(createdAt.getTime())
                          ? 'Date not recorded'
                          : createdAt.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                        {victims > 0 ? `, ${victims} ${victims === 1 ? 'person' : 'people'} involved` : ''}
                      </span>
                      <span className="mt-1.5 flex items-center justify-between gap-2">
                        <span className="truncate font-mono text-[11px] text-slate-400">
                          {getReportCode(report)} · Team {getResponderTeam(report)}
                        </span>
                        <span className="inline-flex shrink-0 items-center gap-0.5 text-xs font-bold text-blue-700">
                          View details
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                        </span>
                      </span>
                    </button>
                    {selectable ? (
                      <label className="flex w-14 shrink-0 cursor-pointer items-center justify-center border-l border-slate-100">
                        <input
                          checked={isSelected}
                          className="h-5 w-5 rounded accent-blue-600"
                          onChange={() => toggleSelect(report)}
                          type="checkbox"
                          aria-label={`Select ${getReportCode(report)} for compiling`}
                        />
                      </label>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          </section>
        )}
      </main>

      {selectedIds.length > 0 ? (
        <div className="fixed inset-x-0 bottom-24 z-40 px-4">
          <div className="mx-auto flex max-w-lg items-center gap-3 rounded-2xl bg-slate-900 p-3 pl-4 text-white shadow-xl">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">
                {selectedIds.length} report{selectedIds.length === 1 ? '' : 's'} selected
              </p>
              <button type="button" onClick={() => setSelectedIds([])} className="text-xs font-semibold text-slate-300 underline-offset-2 hover:underline">
                Clear
              </button>
            </div>
            <button
              className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-500 disabled:opacity-60"
              disabled={isCompiling}
              onClick={() => void compileReports()}
              type="button"
            >
              {isCompiling ? 'Compiling…' : 'Compile report'}
            </button>
          </div>
        </div>
      ) : null}

      {detailsReport ? (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/40 backdrop-blur-sm" onClick={() => setDetailsReport(null)}>
          <div
            className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-slate-100 bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={`Report ${getReportCode(detailsReport)}`}
          >
            <div className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-slate-200" aria-hidden="true" />
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <h2 className="font-mono text-lg font-black tracking-tight text-slate-900">
                    {getReportCode(detailsReport)}
                  </h2>
                  <span className="inline-flex rounded-md border px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider" style={getIncidentBadgeStyle(getIncidentType(detailsReport))}>
                    {getIncidentType(detailsReport)}
                  </span>
                </div>
                <p className="text-xs font-medium text-slate-500">
                  Filed {new Date(getCreatedAt(detailsReport)).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                </p>
              </div>

              <button
                className="rounded-md p-2 text-sm text-slate-400 transition-colors hover:bg-slate-200/60 hover:text-slate-600 active:scale-95"
                onClick={() => setDetailsReport(null)}
                title="Close Overview"
                type="button"
              >
                Close
              </button>
            </div>

            <div className="space-y-5 overflow-y-auto p-5 pb-8 text-slate-700">
              <div className="grid grid-cols-2 gap-x-4 gap-y-4 rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                <DetailItem label="Incident code" value={getIncidentCode(detailsReport)} isMono />
                <DetailItem label="Time it happened" value={formatTimeOfDay(getTimeOccurred(detailsReport))} />
                <DetailItem label="Responding team" value={getResponderTeam(detailsReport)} />
                <DetailItem label="Status" value={getStatusValue(detailsReport)} isStatus />
              </div>

              <div className="space-y-1">
                <span className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  Location
                </span>
                <div className="rounded-xl border border-slate-100 bg-slate-50/40 p-3">
                  <p className="text-xs font-semibold text-slate-800">
                    {detailsReport.location || 'N/A'}
                  </p>
                </div>
              </div>

              <div className="space-y-1">
                <span className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  Description
                </span>
                <div className="rounded-xl border border-slate-100 bg-slate-50/40 p-3.5">
                  <p className="whitespace-pre-wrap text-xs font-medium leading-relaxed text-slate-600">
                    {detailsReport.personalDataHidden
                      ? HIDDEN_FOR_OTHER_TEAMS
                      : detailsReport.description || 'No description was written.'}
                  </p>
                </div>
              </div>

              <div className="space-y-1">
                <span className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  Action taken
                </span>
                <div className="rounded-xl border border-blue-100/50 bg-blue-50/10 p-3.5">
                  <p className="whitespace-pre-wrap text-xs font-medium leading-relaxed text-slate-700">
                    {detailsReport.personalDataHidden
                      ? HIDDEN_FOR_OTHER_TEAMS
                      : getActionTaken(detailsReport) || 'No recorded action taken.'}
                  </p>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
                    People involved
                  </h3>
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">
                    {getVictimCount(detailsReport)} Total
                  </span>
                </div>

                {detailsReport.personalDataHidden ? (
                  <p className="text-xs font-medium italic text-slate-400">{HIDDEN_FOR_OTHER_TEAMS}</p>
                ) : !detailsReport.victims || detailsReport.victims.length === 0 ? (
                  <p className="text-xs font-medium italic text-slate-400">
                    No casualties or victim information recorded.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {detailsReport.victims.map((victim, index) => (
                      <div className="space-y-3 rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 shadow-inner" key={index}>
                        <p className="text-xs font-extrabold uppercase tracking-wide text-slate-900">
                          Victim Profile #{index + 1}
                        </p>

                        <div className="grid grid-cols-2 gap-y-2 text-xs font-medium">
                          <div className="col-span-2">
                            <span className="block text-[10px] font-bold uppercase tracking-tight text-slate-400">
                              Full Name
                            </span>
                            <span className="font-semibold text-slate-800">
                              {victim.name || 'N/A'}
                            </span>
                          </div>

                          <div>
                            <span className="block text-[10px] font-bold uppercase tracking-tight text-slate-400">
                              Age
                            </span>
                            <span className="font-semibold text-slate-800">
                              {victim.age || 'N/A'}
                            </span>
                          </div>

                          <div>
                            <span className="block text-[10px] font-bold uppercase tracking-tight text-slate-400">
                              Gender
                            </span>
                            <span className="font-semibold text-slate-800">
                              {victim.gender === 'M' ? 'Male' : victim.gender === 'F' ? 'Female' : 'N/A'}
                            </span>
                          </div>

                          <div className="col-span-2">
                            <span className="block text-[10px] font-bold uppercase tracking-tight text-slate-400">
                              Address
                            </span>
                            <span className="block text-[11px] leading-tight text-slate-700">
                              {victim.address || 'N/A'}
                            </span>
                          </div>

                          <div className="col-span-2">
                            <span className="block text-[10px] font-bold uppercase tracking-tight text-slate-400">
                              Condition
                            </span>
                            <span className="block text-[11px] leading-tight text-slate-700">
                              {victim.condition || 'N/A'}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-slate-100 bg-slate-50 px-6 py-3 text-right">
              <button
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 shadow-sm transition-all hover:bg-slate-100 hover:text-slate-700 active:scale-95"
                onClick={() => setDetailsReport(null)}
                type="button"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <MobileNavBar />
    </div>
  )
}

const DetailItem = ({
  label,
  value,
  isMono,
  isStatus,
}: {
  label: string
  value: string | number
  isMono?: boolean
  isStatus?: boolean
}) => {
  const displayValue: string | number = value

  return (
    <div className="space-y-0.5">
      <span className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
        {label}
      </span>

      {isStatus ? (
        <span className={`mt-1 inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold ${getStatusBadgeClass(String(value))}`}>
          <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${getStatusDotClass(String(value))}`} />
          {getStatusLabel(String(value))}
        </span>
      ) : (
        <span className={`block text-sm font-semibold text-slate-800 ${isMono ? 'font-mono tracking-tight text-blue-600' : ''}`}>
          {displayValue || 'N/A'}
        </span>
      )}
    </div>
  )
}

export default IncidentReportPage