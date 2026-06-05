import { useEffect, useState } from 'react'
import type { FC, KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { MobileNavBar } from '../../components/MobileNavBar'
import { getCurrentUserProfile } from '../../services/auth'

const REPORTS_KEY = 'responderIncidentReports'

interface Incident {
  id: string
  type: 'Medical' | 'RTC' | 'Fire' | 'Hazmat'
  location: string
  timeOccurred: string
  status: 'Pending Report' | 'Completed'
  victimCount: number
  description?: string
  responderTeam?: string
  actionTaken?: string
  victims?: any[]
}

interface StoredIncidentReport {
  id: string
  reportCode: string
  incidentCode: string
  timeOccurred: string
  incidentType: string
  responderTeam: string
  location: string
  description: string
  victimCount: number
  victims: any[]
  actionTaken: string
  status: string
  createdAt: string
}

const fallbackIncidents: Incident[] = [
  { id: 'INC-001', type: 'Medical', location: 'Barangay 1, Main St', timeOccurred: '2:30 PM', status: 'Pending Report', victimCount: 2 },
  { id: 'INC-002', type: 'RTC', location: 'Highway 1, Junction', timeOccurred: '3:15 PM', status: 'Pending Report', victimCount: 3 },
  { id: 'INC-003', type: 'Fire', location: 'Barangay 3, Warehouse', timeOccurred: '1:45 PM', status: 'Completed', victimCount: 0 },
  { id: 'INC-004', type: 'Hazmat', location: 'Industrial Zone', timeOccurred: '4:00 PM', status: 'Pending Report', victimCount: 1 },
  { id: 'INC-005', type: 'Medical', location: 'Barangay 2, School', timeOccurred: '2:00 PM', status: 'Completed', victimCount: 1 },
]

const mapIncidentType = (type: string): Incident['type'] => {
  const lowerType = type.toLowerCase()
  if (lowerType.includes('medical') || lowerType.includes('ambulance')) return 'Medical'
  if (lowerType.includes('fire')) return 'Fire'
  if (lowerType.includes('rca') || lowerType.includes('vehicular') || lowerType.includes('rtc')) return 'RTC'
  return 'Hazmat'
}

export const ResponderDashboardPage: FC = () => {
  const navigate = useNavigate()
  const profile = getCurrentUserProfile()

  const [recentIncidents, setRecentIncidents] = useState<Incident[]>(fallbackIncidents)
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null)

  useEffect(() => {
    const storedReports: StoredIncidentReport[] = JSON.parse(
      localStorage.getItem(REPORTS_KEY) || '[]'
    )

    if (storedReports.length > 0) {
      const mappedReports: Incident[] = storedReports.slice(0, 5).map((report) => ({
        id: report.incidentCode || report.reportCode,
        type: mapIncidentType(report.incidentType),
        location: report.location,
        timeOccurred: report.timeOccurred,
        status: 'Completed',
        victimCount: report.victimCount || report.victims?.length || 0,
        description: report.description,
        responderTeam: report.responderTeam,
        actionTaken: report.actionTaken,
        victims: report.victims,
      }))

      setRecentIncidents(mappedReports)
    }
  }, [])

  const firstName =
    profile?.fullName?.trim().split(/\s+/).filter(Boolean)[0] || 'Responder'

  // Refactored row activation logic to open details seamlessly
  const handleRowActivation = (incident: Incident) => {
    setSelectedIncident(incident)
  }

  const handleRowKeyDown = (e: KeyboardEvent, incident: Incident) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleRowActivation(incident)
    }
  }

  const getIncidentTypeConfig = (type: Incident['type']) => {
    switch (type) {
      case 'Medical':
        return {
          wrapper: 'bg-rose-50 text-rose-700 border-rose-100 ring-rose-500/10',
          icon: <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />,
        }
      case 'RTC':
        return {
          wrapper: 'bg-amber-50 text-amber-700 border-amber-100 ring-amber-500/10',
          icon: <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />,
        }
      case 'Fire':
        return {
          wrapper: 'bg-orange-50 text-orange-700 border-orange-100 ring-orange-500/10',
          icon: <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />,
        }
      case 'Hazmat':
        return {
          wrapper: 'bg-purple-50 text-purple-700 border-purple-100 ring-purple-500/10',
          icon: <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />,
        }
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 pb-28 sm:pb-12 pt-6 antialiased text-slate-800">
      <main className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
        
        {/* Call to Action Banner */}
        <button
          onClick={() => navigate('/create-report')}
          className="w-full text-left bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white p-6 sm:p-8 rounded-2xl shadow-md hover:shadow-lg transition-all duration-300 group relative overflow-hidden flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 active:scale-[0.99]"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-indigo-600/10 opacity-60 pointer-events-none" />
          <div className="absolute right-0 bottom-0 opacity-[0.03] pointer-events-none transform translate-x-4 translate-y-4 group-hover:scale-105 transition-transform duration-500">
            <svg className="w-80 h-80" fill="currentColor" viewBox="0 0 24 24">
              <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </div>

          <div className="space-y-1 relative z-10 max-w-2xl">
            <span className="inline-flex text-[10px] font-bold uppercase tracking-widest text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2.5 py-0.5 rounded-md">
              Primary Dispatch Action
            </span>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight mt-2.5">
              Create Accomplishment Report
            </h2>
            <p className="text-sm text-slate-400 leading-relaxed font-medium pt-0.5">
              Welcome back, Commander {firstName}. Log new tactical data files, ongoing intake streams, or file your sector summary briefs.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-xl text-sm font-bold shadow-sm group-hover:scale-[1.02] active:scale-95 transition-all self-start sm:self-center shrink-0 relative z-10">
            <span>Create New Report</span>
            <svg className="w-4 h-4 transform group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </div>
        </button>

        {/* Quick Route Cards Ecosystem */}
        <div className="hidden sm:grid grid-cols-2 gap-5">
          <button onClick={() => navigate('/responder-incidents')} className="group flex items-center justify-between bg-white hover:bg-slate-50/40 p-5 rounded-2xl border border-slate-200 shadow-sm transition-all duration-200 text-left active:scale-[0.99]">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl group-hover:bg-blue-100/60 border border-blue-100/50 transition-colors shadow-sm">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.25}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 112-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <div>
                <span className="text-sm font-bold text-slate-900 block tracking-tight">Incident Central</span>
                <span className="text-xs text-slate-400 font-medium mt-0.5 block">Monitor operational deployment sector zones.</span>
              </div>
            </div>
          </button>

          <button onClick={() => navigate('/responder-reports')} className="group flex items-center justify-between bg-white hover:bg-slate-50/40 p-5 rounded-2xl border border-slate-200 shadow-sm transition-all duration-200 text-left active:scale-[0.99]">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl group-hover:bg-emerald-100/60 border border-emerald-100/50 transition-colors shadow-sm">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.25}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <div>
                <span className="text-sm font-bold text-slate-900 block tracking-tight">Accomplishment Ledger</span>
                <span className="text-xs text-slate-400 font-medium mt-0.5 block">Review field summaries and archivelog assets.</span>
              </div>
            </div>
          </button>
        </div>

        {/* Realtime Local Incident Feed Frame */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white">
            <div>
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Live Incident Feed</h3>
              <p className="text-xs text-slate-400 font-medium mt-0.5">Recent submitted incident reports.</p>
            </div>
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 px-3 py-1 bg-emerald-50 rounded-full border border-emerald-100 ring-2 ring-emerald-500/10">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Live Tracking
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {recentIncidents.slice(0, 5).map((incident) => {
              const typeStyle = getIncidentTypeConfig(incident.type)

              return (
                <div
                  key={incident.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleRowActivation(incident)}
                  onKeyDown={(e) => handleRowKeyDown(e, incident)}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-5 px-6 gap-4 hover:bg-slate-50/50 transition-colors cursor-pointer focus:bg-slate-50/80 focus:outline-none group"
                >
                  <div className="flex-1 min-w-0 flex items-start gap-3.5">
                    <div className={`p-2.5 rounded-xl border shrink-0 mt-0.5 ring-2 ${typeStyle?.wrapper}`}>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        {typeStyle?.icon}
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-sm text-slate-900 group-hover:text-blue-600 transition-colors font-mono">{incident.id}</p>
                        <span className="text-slate-300 text-xs hidden sm:inline">•</span>
                        <p className="text-xs font-semibold text-slate-400">{incident.timeOccurred}</p>
                        {incident.victimCount > 0 && (
                          <span className="text-[9px] font-extrabold bg-rose-50 border border-rose-100 text-rose-600 px-1.5 py-0.5 rounded uppercase tracking-wider">
                            {incident.victimCount} Casualties
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-medium text-slate-500 mt-1 truncate">{incident.location}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-6 border-t border-slate-50 sm:border-t-0 pt-3 sm:pt-0">
                    <span className={`inline-flex items-center text-[9px] font-extrabold tracking-wider uppercase px-2.5 py-0.5 border rounded-md ring-2 ${typeStyle?.wrapper}`}>
                      {incident.type}
                    </span>

                    <div className="text-right sm:min-w-[120px]">
                      <span className={`inline-flex items-center text-xs font-bold ${incident.status === 'Pending Report' ? 'text-amber-600' : 'text-emerald-600'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full mr-2 ${incident.status === 'Pending Report' ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
                        {incident.status}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation() // Modang intercept para hindi tumalon ang page
                        setSelectedIncident(incident)
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100/70 border border-blue-100 rounded-xl transition-all active:scale-95 tracking-wide shadow-sm group/btn shrink-0"
                    >
                      <span>Details</span>
                      <svg className="w-3.5 h-3.5 transform group-hover/btn:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                      </svg>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="border-t border-slate-100 bg-slate-50/50">
            <button
              onClick={() => navigate('/responder-incidents')}
              className="w-full py-4 text-xs font-bold text-blue-600 hover:text-blue-700 hover:bg-slate-100/50 transition-all flex items-center justify-center gap-1.5 uppercase tracking-wider"
            >
              <span>View Full Incident Reports</span>
            </button>
          </div>
        </div>
      </main>

      {/* Premium Incident Ledger Review Modal */}
      {selectedIncident && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-slate-100">
            
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-black text-slate-900 tracking-tight font-mono">{selectedIncident.id}</h2>
                  <span className={`inline-flex items-center text-[9px] font-extrabold tracking-wider uppercase px-2 py-0.5 border rounded-md ring-1 ${getIncidentTypeConfig(selectedIncident.type)?.wrapper}`}>
                    {selectedIncident.type}
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-medium">Tactical Incident Overview Dossier</p>
              </div>
              <button 
                onClick={() => setSelectedIncident(null)} 
                className="p-2 text-sm text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-md transition-colors active:scale-95"
                title="Close Overview"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 text-slate-700">
              <div className="grid grid-cols-2 gap-4 bg-slate-50/60 p-4 rounded-xl border border-slate-100 text-xs">
                <div>
                  <span className="text-slate-400 block font-bold uppercase tracking-wider text-[9px]">Time Recorded</span>
                  <span className="font-semibold text-slate-800 text-sm mt-0.5 block">{selectedIncident.timeOccurred}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-bold uppercase tracking-wider text-[9px]">Status</span>
                  <span className={`inline-flex items-center font-bold text-xs mt-1 ${selectedIncident.status === 'Pending Report' ? 'text-amber-600' : 'text-emerald-600'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${selectedIncident.status === 'Pending Report' ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
                    {selectedIncident.status}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-bold uppercase tracking-wider text-[9px]">Victims Count</span>
                  <span className={`font-semibold text-sm mt-0.5 block ${selectedIncident.victimCount > 0 ? 'text-rose-600 font-bold' : 'text-slate-600'}`}>
                    {selectedIncident.victimCount} {selectedIncident.victimCount === 1 ? 'Casualty' : 'Casualties'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-bold uppercase tracking-wider text-[9px]">Assigned Team</span>
                  <span className="font-semibold text-slate-800 text-sm mt-0.5 block truncate">{selectedIncident.responderTeam || 'Unassigned'}</span>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-slate-400 block font-bold uppercase tracking-wider text-[9px]">Deployment Location</span>
                <div className="flex items-start gap-2 bg-slate-50/40 p-3 rounded-xl border border-slate-100">
                  <svg className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                  </svg>
                  <p className="text-xs font-semibold text-slate-800">{selectedIncident.location}</p>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-slate-400 block font-bold uppercase tracking-wider text-[9px]">Incident Description</span>
                <div className="bg-slate-50/40 p-3.5 rounded-xl border border-slate-100 min-h-[60px]">
                  <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line font-medium">
                    {selectedIncident.description || 'No descriptive tactical log provided for this incident report.'}
                  </p>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-slate-400 block font-bold uppercase tracking-wider text-[9px]">Mitigation & Action Taken</span>
                <div className="bg-blue-50/10 p-3.5 rounded-xl border border-blue-100/50 min-h-[60px]">
                  <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line font-medium">
                    {selectedIncident.actionTaken || 'Pending operational dispatch notes for mitigation steps.'}
                  </p>
                </div>
              </div>
            </div>

            <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 text-right">
              <button 
                type="button"
                onClick={() => setSelectedIncident(null)} 
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl shadow-sm transition-all active:scale-95"
              >
                Dismiss Overview
              </button>
            </div>
          </div>
        </div>
      )}

      <MobileNavBar />
    </div>
  )
}

export default ResponderDashboardPage