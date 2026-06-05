import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FC } from 'react'
import { useNavigate } from 'react-router-dom'
import { MobileNavBar } from '../../components/MobileNavBar'
import { getCurrentUserProfile } from '../../services/auth'
import { addNotification } from '../../services/notifications'

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
  status?: string
  status_update?: string
  createdAt?: string
  created_at?: string
}

const API_BASE_URL = 'http://127.0.0.1:8000'

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
  return report.responderTeam || report.responder_team || 'Responder Team'
}

function getVictimCount(report: IncidentReport): number {
  return Number(report.victimCount ?? report.victim_count ?? report.victims?.length ?? 0)
}

function getActionTaken(report: IncidentReport): string {
  return report.actionTaken || report.action_taken || ''
}

type ResponderTeamCode = 'alpha' | 'bravo' | 'charlie' | 'unknown'

function normalizeTeamValue(value?: string): ResponderTeamCode {
  const normalized = String(value || '').trim().toLowerCase()

  if (normalized.includes('alpha')) return 'alpha'
  if (normalized.includes('bravo')) return 'bravo'
  if (normalized.includes('charlie')) return 'charlie'

  return 'unknown'
}

function getLoggedInResponderTeam(): ResponderTeamCode {
  const profile = getCurrentUserProfile() as any

  return normalizeTeamValue(
    [
      profile?.responderTeam,
      profile?.responder_team,
      profile?.team,
      profile?.teamName,
      profile?.team_name,
      profile?.username,
      profile?.fullName,
      profile?.full_name,
      profile?.email,
      profile?.role,
    ]
      .filter(Boolean)
      .join(' '),
  )
}

function getTeamDisplayName(team: ResponderTeamCode): string {
  if (team === 'alpha') return 'Alpha'
  if (team === 'bravo') return 'Bravo'
  if (team === 'charlie') return 'Charlie'

  return 'Unassigned'
}

function isReportOwnedByResponderTeam(report: IncidentReport, team: ResponderTeamCode): boolean {
  if (team === 'unknown') return false
  return normalizeTeamValue(getResponderTeam(report)) === team
}

const IncidentReportPage: FC = () => {
  const navigate = useNavigate()
  const currentResponderTeam = getLoggedInResponderTeam()

  const [reports, setReports] = useState<IncidentReport[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [detailsReport, setDetailsReport] = useState<IncidentReport | null>(null)

  const [searchQuery, setSearchQuery] = useState('')
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc')
  const [hazardFilter, setHazardFilter] = useState('All')
  const [isLoading, setIsLoading] = useState(true)

  const fetchReports = useCallback(async (showError = true) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/incidents/incident-reports/`, {
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to fetch incident reports')
      }

      const data = await response.json()
      const reportsData: IncidentReport[] = Array.isArray(data) ? data : data.results || []

      setReports(reportsData)
    } catch (error) {
      console.error('Error fetching incident reports:', error)
      setReports([])

      if (showError) {
        addNotification('Failed to load real incident reports from backend.')
      }
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchReports()

    const intervalId = window.setInterval(() => {
      void fetchReports(false)
    }, 10000)

    return () => window.clearInterval(intervalId)
  }, [fetchReports])

  const isWithin24Hours = (createdAt: string) => {
    if (!createdAt) return false

    const reportTime = new Date(createdAt).getTime()
    const now = new Date().getTime()
    const twentyFourHours = 24 * 60 * 60 * 1000

    return Number.isFinite(reportTime) && now - reportTime <= twentyFourHours
  }

  const canSelectReport = (report: IncidentReport): boolean => {
    return isWithin24Hours(getCreatedAt(report)) && isReportOwnedByResponderTeam(report, currentResponderTeam)
  }

  const getSelectionRestrictionMessage = (report: IncidentReport): string => {
    if (!isReportOwnedByResponderTeam(report, currentResponderTeam)) {
      return `Only ${getTeamDisplayName(currentResponderTeam)} reports can be selected by this account.`
    }

    if (!isWithin24Hours(getCreatedAt(report))) {
      return 'Only reports created within the last 24 hours can be selected.'
    }

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

        return matchesSearch && matchesHazard
      })
      .sort((a, b) => {
        const dateA = new Date(getCreatedAt(a)).getTime()
        const dateB = new Date(getCreatedAt(b)).getTime()

        return sortOrder === 'desc' ? dateB - dateA : dateA - dateB
      })
  }, [reports, searchQuery, hazardFilter, sortOrder])

  const toggleSelect = (report: IncidentReport) => {
    if (!isReportOwnedByResponderTeam(report, currentResponderTeam)) {
      addNotification(`Only ${getTeamDisplayName(currentResponderTeam)} reports can be selected by this account.`)
      return
    }

    if (!isWithin24Hours(getCreatedAt(report))) {
      addNotification('Only reports created within the last 24 hours can be selected.')
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
      addNotification(`No ${getTeamDisplayName(currentResponderTeam)} reports within the last 24 hours can be selected.`)
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
    const selectedReports = reports.filter((report) => selectedIds.includes(report.id))

    if (selectedReports.length === 0) {
      addNotification('Please select at least one report.')
      return
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/incidents/accomplishment-reports/`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: 'Accomplishment Report',
          status: 'Compiled',
          report_ids: selectedIds,
          reportIds: selectedIds,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to compile reports')
      }

      addNotification('Reports compiled successfully!')
      setSelectedIds([])
      navigate('/responder-reports')
    } catch (error) {
      console.error('Error compiling reports:', error)
      addNotification('Failed to compile reports.')
    }
  }

  const getIncidentBadgeStyle = (type: string) => {
    const lower = type.toLowerCase()

    if (lower.includes('med')) return 'bg-rose-50 text-rose-700 border-rose-100 ring-rose-500/10'
    if (lower.includes('fire')) return 'bg-orange-50 text-orange-700 border-orange-100 ring-orange-500/10'
    if (lower.includes('rtc') || lower.includes('vehic') || lower.includes('accident')) {
      return 'bg-amber-50 text-amber-700 border-amber-100 ring-amber-500/10'
    }

    return 'bg-purple-50 text-purple-700 border-purple-100 ring-purple-500/10'
  }

  return (
    <div className="min-h-screen bg-slate-100 pb-28 pt-6 text-slate-800 antialiased sm:pb-12">
      <main className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="relative space-y-5 overflow-hidden border-b border-slate-200/80 p-5 sm:p-7">
            <div className="absolute left-0 right-0 top-0 h-1.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500" />

            <div className="flex items-center gap-4">
              <button
                className="group flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-100 bg-slate-50 text-slate-500 shadow-sm transition-all hover:bg-blue-50 hover:text-blue-600 active:scale-90"
                onClick={() => navigate('/responder-dashboard')}
                title="Back to Dashboard"
                type="button"
              >
                <svg className="h-5 w-5 transform transition-transform group-hover:-translate-x-0.5" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                  <path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              <div>
                <span className="mb-0.5 block text-[10px] font-black uppercase leading-none tracking-[0.2em] text-blue-600 opacity-60">
                  Field Documentation
                </span>
                <h1 className="text-2xl font-black leading-tight tracking-tight text-slate-900 sm:text-3xl">
                  Incident Report Central
                </h1>
              </div>
            </div>

            <div className="flex flex-col justify-between gap-4 border-t border-slate-100 pt-5 sm:flex-row sm:items-center">
              <p className="max-w-lg text-sm font-medium leading-relaxed text-slate-500">
                Real incident reports from the backend will appear here. No static or mock table data is used.
              </p>

              {selectedIds.length > 0 ? (
                <button
                  className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-blue-700 active:scale-95"
                  onClick={compileReports}
                  type="button"
                >
                  Compile Reports ({selectedIds.length})
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {!isLoading && reports.length > 0 ? (
          <div className="space-y-3">
            <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800">
              Logged-in team: {getTeamDisplayName(currentResponderTeam)}. You can only select and compile {getTeamDisplayName(currentResponderTeam)} reports.
            </div>

            <div className="flex flex-col items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row">
              <input
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-800 placeholder-slate-400 transition-all focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 md:max-w-md"
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search report code, type, or location..."
                type="text"
                value={searchQuery}
              />

              <div className="flex w-full flex-col items-stretch justify-end gap-3 sm:flex-row sm:items-center md:w-auto">
                <select
                  className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-bold text-slate-700 outline-none"
                  onChange={(e) => setHazardFilter(e.target.value)}
                  value={hazardFilter}
                >
                  <option value="All">All</option>
                  {hazardTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>

                <button
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-bold text-slate-700 shadow-sm transition-all hover:border-slate-300 hover:text-slate-900 active:scale-95"
                  onClick={() => setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
                  type="button"
                >
                  {sortOrder === 'desc' ? 'Newest First' : 'Oldest First'}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {isLoading ? (
            <div className="p-16 text-center">
              <h3 className="text-lg font-bold text-slate-900">Loading real incident reports...</h3>
              <p className="mt-1 text-sm text-slate-500">Please wait while data is being fetched from backend.</p>
            </div>
          ) : reports.length === 0 ? (
            <div className="p-16 text-center">
              <div className="mx-auto max-w-md space-y-5">
                <h3 className="text-lg font-bold text-slate-900">No incident reports yet</h3>
                <p className="mt-1 text-sm text-slate-500">Create your first incident report to display it here.</p>

                <button
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-sm transition-all hover:bg-blue-700 active:scale-95"
                  onClick={() => navigate('/create-report')}
                  type="button"
                >
                  Create Report
                </button>
              </div>
            </div>
          ) : filteredAndSortedReports.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <h4 className="text-sm font-bold text-slate-800">No results found</h4>
              <p className="mt-1 text-xs text-slate-400">Try adjusting your search or hazard type filter.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead className="border-b border-slate-200/80 bg-slate-50/70">
                  <tr>
                    <th className="w-12 px-6 py-4">
                      <input
                        checked={
                          filteredAndSortedReports.filter((r) => canSelectReport(r)).length > 0 &&
                          filteredAndSortedReports.filter((r) => canSelectReport(r)).every((r) => selectedIds.includes(r.id))
                        }
                        className="h-4 w-4 rounded accent-blue-600 transition"
                        onChange={toggleSelectAll}
                        onClick={(e) => e.stopPropagation()}
                        type="checkbox"
                      />
                    </th>
                    <th className="px-6 py-4 text-xs font-extrabold uppercase tracking-wider text-slate-500">Report Code</th>
                    <th className="px-6 py-4 text-xs font-extrabold uppercase tracking-wider text-slate-500">Incident Code</th>
                    <th className="px-6 py-4 text-xs font-extrabold uppercase tracking-wider text-slate-500">Incident Type</th>
                    <th className="px-6 py-4 text-xs font-extrabold uppercase tracking-wider text-slate-500">Location</th>
                    <th className="px-6 py-4 text-xs font-extrabold uppercase tracking-wider text-slate-500">Date Recorded</th>
                    <th className="px-6 py-4 text-xs font-extrabold uppercase tracking-wider text-slate-500">Status</th>
                    <th className="px-6 py-4 text-xs font-extrabold uppercase tracking-wider text-slate-500">Selection</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filteredAndSortedReports.map((report) => {
                    const selectable = canSelectReport(report)
                    const statusValue = getStatusValue(report)

                    return (
                      <tr
                        className={`group cursor-pointer transition-colors hover:bg-slate-50/80 ${!selectable ? 'opacity-60' : ''}`}
                        key={report.id}
                        onClick={() => setDetailsReport(report)}
                        title="Click to view full details"
                      >
                        <td className="px-6 py-4">
                          <input
                            checked={selectedIds.includes(report.id)}
                            className="h-4 w-4 rounded accent-blue-600 transition disabled:cursor-not-allowed"
                            disabled={!selectable}
                            onChange={() => toggleSelect(report)}
                            onClick={(e) => e.stopPropagation()}
                            title={getSelectionRestrictionMessage(report)}
                            type="checkbox"
                          />
                        </td>

                        <td className="px-6 py-4 font-mono text-sm font-bold tracking-tight text-slate-900 transition-colors group-hover:text-blue-600">
                          {getReportCode(report)}
                        </td>

                        <td className="px-6 py-4 font-mono text-sm text-slate-500">
                          {getIncidentCode(report)}
                        </td>

                        <td className="px-6 py-4">
                          <span className={`inline-flex rounded-md border px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ring-2 ${getIncidentBadgeStyle(getIncidentType(report))}`}>
                            {getIncidentType(report)}
                          </span>
                        </td>

                        <td className="max-w-[200px] truncate px-6 py-4 text-sm font-medium text-slate-600">
                          {report.location || 'N/A'}
                        </td>

                        <td className="px-6 py-4 text-xs font-medium text-slate-500">
                          {getCreatedAt(report)
                            ? new Date(getCreatedAt(report)).toLocaleString(undefined, {
                                dateStyle: 'medium',
                                timeStyle: 'short',
                              })
                            : 'N/A'}
                        </td>

                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${getStatusBadgeClass(statusValue)}`}>
                            <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${getStatusDotClass(statusValue)}`} />
                            {getStatusLabel(statusValue)}
                          </span>
                        </td>

                        <td className="px-6 py-4">
                          {selectable ? (
                            <span className="rounded-md border border-emerald-100 bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">
                              Available
                            </span>
                          ) : !isReportOwnedByResponderTeam(report, currentResponderTeam) ? (
                            <span className="rounded-md border border-red-100 bg-red-50 px-2 py-1 text-[10px] font-bold text-red-600">
                              Team Locked
                            </span>
                          ) : (
                            <span className="rounded-md border border-slate-200 bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500">
                              Expired
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {detailsReport ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-6 py-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <h2 className="font-mono text-lg font-black tracking-tight text-slate-900">
                    {getReportCode(detailsReport)}
                  </h2>
                  <span className={`inline-flex rounded-md border px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider ring-1 ${getIncidentBadgeStyle(getIncidentType(detailsReport))}`}>
                    {getIncidentType(detailsReport)}
                  </span>
                </div>
                <p className="text-xs font-medium text-slate-400">
                  Full incident operational details
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

            <div className="space-y-6 overflow-y-auto p-6 text-slate-700">
              <div className="grid grid-cols-1 gap-x-6 gap-y-4 rounded-xl border border-slate-100 bg-slate-50/60 p-4 sm:grid-cols-2">
                <DetailItem label="Incident Identifier Code" value={getIncidentCode(detailsReport)} isMono />
                <DetailItem label="Time of Occurrence" value={getTimeOccurred(detailsReport)} />
                <DetailItem label="Assigned Field Responders" value={getResponderTeam(detailsReport)} />
                <DetailItem label="Operation Live Status" value={getStatusValue(detailsReport)} isStatus />
              </div>

              <div className="space-y-1">
                <span className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  Deployment Area Zone
                </span>
                <div className="rounded-xl border border-slate-100 bg-slate-50/40 p-3">
                  <p className="text-xs font-semibold text-slate-800">
                    {detailsReport.location || 'N/A'}
                  </p>
                </div>
              </div>

              <div className="space-y-1">
                <span className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  Detailed Description Log
                </span>
                <div className="rounded-xl border border-slate-100 bg-slate-50/40 p-3.5">
                  <p className="whitespace-pre-wrap text-xs font-medium leading-relaxed text-slate-600">
                    {detailsReport.description || 'No specific descriptive log submitted.'}
                  </p>
                </div>
              </div>

              <div className="space-y-1">
                <span className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  Mitigation & Actions Executed
                </span>
                <div className="rounded-xl border border-blue-100/50 bg-blue-50/10 p-3.5">
                  <p className="whitespace-pre-wrap text-xs font-medium leading-relaxed text-slate-700">
                    {getActionTaken(detailsReport) || 'No recorded action taken.'}
                  </p>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
                    Victims Information Directory
                  </h3>
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">
                    {getVictimCount(detailsReport)} Total
                  </span>
                </div>

                {!detailsReport.victims || detailsReport.victims.length === 0 ? (
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
}) => (
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
        {value || 'N/A'}
      </span>
    )}
  </div>
)

export default IncidentReportPage