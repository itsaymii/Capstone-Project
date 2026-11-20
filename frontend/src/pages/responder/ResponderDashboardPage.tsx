import { useEffect, useState } from 'react'
import type { FC } from 'react'
import { useNavigate } from 'react-router-dom'
import { MobileNavBar } from '../../components/MobileNavBar'
import { WaitingReportsCard } from '../../components/WaitingReportsCard'
import { InstallAppCard } from '../../components/InstallAppCard'
import { getCurrentUserProfile } from '../../services/auth'
import { getLatestIncidentReports } from '../../services/incidents'
import { ReportListCard, ReportRow, SheetHeader, StatusText, formatReportWhen, incidentTypeMeta } from '../../components/ResponderReportUI'
import { getAccountTeam, toTeamName } from '../../data/teams'

interface Incident {
  id: string
  /** The raw incident type, for the type tag. */
  rawType: string
  createdAt: string
  type: string
  typeColor: string
  location: string
  timeOccurred: string
  status: 'Awaiting approval' | 'Approved'
  victimCount: number
  description?: string
  responderTeam?: string
  actionTaken?: string
  victims?: any[]
  // Another team's report: the server leaves out the victims, description and actions taken.
  personalDataHidden?: boolean
}

const HIDDEN_FOR_OTHER_TEAMS = 'Only the filing team can see this. It may name the people involved.'

// Same type names and colors as Create Report and the admin pages.
const mapIncidentType = (type: string) => {
  const meta = incidentTypeMeta(type)
  return { type: meta.label, typeColor: meta.color }
}

const formatTimeOfDay = (value: string) => {
  const match = /^(\d{1,2}):(\d{2})/.exec(value || '')
  if (!match) return value || 'N/A'
  const hours = Number(match[1])
  return `${hours % 12 || 12}:${match[2]} ${hours < 12 ? 'AM' : 'PM'}`
}

// Same wording as the Incidents and Reports pages.
const casualtyLabel = (count: number) => `${count} ${count === 1 ? 'person' : 'people'} involved`

export const ResponderDashboardPage: FC = () => {
  const navigate = useNavigate()
  const profile = getCurrentUserProfile()

  const [recentIncidents, setRecentIncidents] = useState<Incident[]>([])
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null)
  const [isLoadingReports, setIsLoadingReports] = useState(true)
  const [reportError, setReportError] = useState<string | null>(null)

  useEffect(() => {
    async function loadIncidentReports() {
      try {
        const reports = await getLatestIncidentReports(5)

        const mappedReports: Incident[] = reports.slice(0, 5).map((report) => {
          const normalizedStatus = `${report.status || ''}`.trim().toLowerCase()
          const normalizedStatusUpdate = `${report.status_update || ''}`.trim().toLowerCase()
          const isApproved = normalizedStatus.includes('approved') || normalizedStatusUpdate.includes('approved')

          return {
            id: report.reportCode || report.incidentCode || report.id,
            rawType: report.incidentType || report.incident_type || '',
            createdAt: report.createdAt || report.created_at || '',
            ...mapIncidentType(report.incidentType || report.incident_type || ''),
            location: report.location || 'Unknown location',
            timeOccurred: formatTimeOfDay(report.timeOccurred || report.time_occurred || ''),
            status: isApproved ? 'Approved' : 'Awaiting approval',
            victimCount: report.victimCount || report.victim_count || report.victims?.length || 0,
            description: report.description,
            responderTeam: toTeamName(report.responderTeam || report.responder_team),
            actionTaken: report.actionTaken || report.action_taken || '',
            victims: report.victims || [],
            personalDataHidden: Boolean(report.personalDataHidden),
          }
        })

        setRecentIncidents(mappedReports)
      } catch (error) {
        console.error('[ResponderDashboardPage] Failed to load incident reports:', error)
        setReportError('Unable to load incident reports at this time.')
      } finally {
        setIsLoadingReports(false)
      }
    }

    void loadIncidentReports()
  }, [])

  // "Team Alpha" is greeted as "Alpha", not "Team".
  const firstName =
    toTeamName(profile?.fullName).split(/\s+/).filter(Boolean)[0] || 'Responder'
  const teamName = getAccountTeam(profile)
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  // Refactored row activation logic to open details seamlessly
  const handleRowActivation = (incident: Incident) => {
    setSelectedIncident(incident)
  }

  const renderIncidentRow = (incident: Incident) => {
    const isPending = incident.status === 'Awaiting approval'
    return (
      <ReportRow
        key={incident.id}
        color={incident.typeColor}
        title={incident.type}
        when={formatReportWhen(incident.createdAt) || incident.timeOccurred}
        subtitle={incident.location}
        onOpen={() => handleRowActivation(incident)}
        openLabel={`Open ${incident.id}, ${incident.type}`}
        meta={
          <>
            <StatusText tone={isPending ? 'amber' : 'green'}>{incident.status}</StatusText>
            {incident.responderTeam ? <span className="font-semibold text-slate-400">Team {incident.responderTeam}</span> : null}
            {incident.victimCount > 0 ? <span className="font-semibold text-rose-600">{casualtyLabel(incident.victimCount)}</span> : null}
          </>
        }
      />
    )
  }

  return (
    <div className="min-h-screen bg-slate-100 pb-28 pt-4 text-slate-800 antialiased">
      <main className="mx-auto max-w-lg space-y-4 px-4">
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white shadow-md">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-indigo-600/10 opacity-60" aria-hidden="true" />
          <div className="relative space-y-4 p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-slate-300">
                {greeting}, <span className="font-bold text-white">{firstName}</span>
              </p>
              <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-0.5 text-xs font-bold text-blue-200">
                {teamName ? `Team ${teamName}` : 'No team yet'}
              </span>
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight">Create incident report</h1>
              <p className="mt-1 text-sm leading-relaxed text-slate-300">
                File it from the scene. Once an admin approves it, you can compile it into an accomplishment report.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/create-report')}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-blue-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              New incident report
            </button>
          </div>

        </section>

        <WaitingReportsCard />

        <InstallAppCard />

        <ReportListCard
          labelledBy="recent-reports"
          title="Latest reports"
          aside={<span className="text-slate-400">All teams</span>}
          footer={
            <button
              type="button"
              onClick={() => navigate('/responder-incidents')}
              className="w-full border-t border-slate-100 bg-slate-50/60 py-3.5 text-sm font-bold text-blue-700 transition-colors hover:bg-slate-100/60"
            >
              See all incident reports
            </button>
          }
        >
          {isLoadingReports ? (
            <p className="p-5 text-sm text-slate-500">Loading reports…</p>
          ) : reportError ? (
            <p className="p-5 text-sm text-red-700">{reportError}</p>
          ) : recentIncidents.length === 0 ? (
            <p className="p-5 text-sm text-slate-500">No reports yet. Reports filed by any team show up here.</p>
          ) : (
            <ul className="divide-y divide-slate-100">{recentIncidents.slice(0, 5).map(renderIncidentRow)}</ul>
          )}
        </ReportListCard>
      </main>

      {/* Premium Incident Ledger Review Modal */}
      {selectedIncident && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/40 backdrop-blur-sm" onClick={() => setSelectedIncident(null)}>
          <div
            className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-slate-100 bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={`Incident ${selectedIncident.id}`}
          >
            <SheetHeader
              title={selectedIncident.id}
              subtitle={`Team ${selectedIncident.responderTeam || 'not set'}`}
              type={selectedIncident.rawType}
              onClose={() => setSelectedIncident(null)}
            />

            <div className="p-5 pb-8 overflow-y-auto space-y-5 text-slate-700">
              <div className="grid grid-cols-2 gap-4 bg-slate-50/60 p-4 rounded-xl border border-slate-100 text-xs">
                <div>
                  <span className="block text-xs font-semibold text-slate-500">Time it happened</span>
                  <span className="font-semibold text-slate-800 text-sm mt-0.5 block">{selectedIncident.timeOccurred}</span>
                </div>
                <div>
                  <span className="block text-xs font-semibold text-slate-500">Status</span>
                  <span className={`inline-flex items-center font-bold text-xs mt-1 ${selectedIncident.status === 'Awaiting approval' ? 'text-amber-600' : 'text-emerald-600'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${selectedIncident.status === 'Awaiting approval' ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
                    {selectedIncident.status}
                  </span>
                </div>
                <div>
                  <span className="block text-xs font-semibold text-slate-500">People involved</span>
                  <span className={`font-semibold text-sm mt-0.5 block ${selectedIncident.victimCount > 0 ? 'text-rose-600 font-bold' : 'text-slate-600'}`}>
                    {casualtyLabel(selectedIncident.victimCount)}
                  </span>
                </div>
                <div>
                  <span className="block text-xs font-semibold text-slate-500">Responding team</span>
                  <span className="font-semibold text-slate-800 text-sm mt-0.5 block truncate">{selectedIncident.responderTeam || 'Unassigned'}</span>
                </div>
              </div>

              <div className="space-y-1">
                <span className="block text-xs font-semibold text-slate-500">Location</span>
                <div className="flex items-start gap-2 bg-slate-50/40 p-3 rounded-xl border border-slate-100">
                  <svg className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                  </svg>
                  <p className="text-xs font-semibold text-slate-800">{selectedIncident.location}</p>
                </div>
              </div>

              <div className="space-y-1">
                <span className="block text-xs font-semibold text-slate-500">Description</span>
                <div className="bg-slate-50/40 p-3.5 rounded-xl border border-slate-100 min-h-[60px]">
                  <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line font-medium">
                    {selectedIncident.personalDataHidden
                      ? HIDDEN_FOR_OTHER_TEAMS
                      : selectedIncident.description || 'No description was written.'}
                  </p>
                </div>
              </div>

              <div className="space-y-1">
                <span className="block text-xs font-semibold text-slate-500">Action taken</span>
                <div className="bg-blue-50/10 p-3.5 rounded-xl border border-blue-100/50 min-h-[60px]">
                  <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line font-medium">
                    {selectedIncident.personalDataHidden
                      ? HIDDEN_FOR_OTHER_TEAMS
                      : selectedIncident.actionTaken || 'No action was written.'}
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      <MobileNavBar />
    </div>
  )
}

export default ResponderDashboardPage