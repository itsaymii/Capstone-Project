import type { FC, KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCurrentUserProfile } from '../../services/auth'

interface Incident {
  id: string
  type: 'Medical' | 'RTC' | 'Fire' | 'Hazmat'
  location: string
  timeOccurred: string
  status: 'Pending Report' | 'Completed'
  victimCount: number
}

const mockIncidents: Incident[] = [
  { id: 'INC-001', type: 'Medical', location: 'Barangay 1, Main St', timeOccurred: '2:30 PM', status: 'Pending Report', victimCount: 2 },
  { id: 'INC-002', type: 'RTC', location: 'Highway 1, Junction', timeOccurred: '3:15 PM', status: 'Pending Report', victimCount: 3 },
  { id: 'INC-003', type: 'Fire', location: 'Barangay 3, Warehouse', timeOccurred: '1:45 PM', status: 'Completed', victimCount: 0 },
  { id: 'INC-004', type: 'Hazmat', location: 'Industrial Zone', timeOccurred: '4:00 PM', status: 'Pending Report', victimCount: 1 },
  { id: 'INC-005', type: 'Medical', location: 'Barangay 2, School', timeOccurred: '2:00 PM', status: 'Completed', victimCount: 1 },
]

const ResponderDashboardPage: FC = () => {
  const navigate = useNavigate()
  const profile = getCurrentUserProfile()
  
  const displayName = profile?.fullName?.trim() || 'Responder'
  const firstName = displayName.split(/\s+/).filter(Boolean)[0] || 'Responder'
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'RE'

  const handleIncidentClick = () => {
    navigate('/responder-incidents')
  }

  const handleIncidentKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleIncidentClick()
    }
  }

  const isActiveNav = (path: string) => {
    if (typeof window === 'undefined') return false
    return window.location.pathname.includes(path)
  }

  // Incident UI helper styling
  const getIncidentTypeConfig = (type: Incident['type']) => {
    switch (type) {
      case 'Medical':
        return {
          wrapper: 'bg-rose-50 text-rose-700 border-rose-100',
          dot: 'bg-rose-500',
          icon: <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        }
      case 'RTC':
        return {
          wrapper: 'bg-amber-50 text-amber-700 border-amber-100',
          dot: 'bg-amber-500',
          icon: <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        }
      case 'Fire':
        return {
          wrapper: 'bg-orange-50 text-orange-700 border-orange-100',
          dot: 'bg-orange-500',
          icon: <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
        }
      case 'Hazmat':
        return {
          wrapper: 'bg-purple-50 text-purple-700 border-purple-100',
          dot: 'bg-purple-500',
          icon: <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        }
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-28 sm:pb-12 pt-6 antialiased text-slate-800">
      
      <main className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
        
        {/* Top Feature Banner Card */}
        <button
          onClick={() => navigate('/create-report')}
          className="w-full text-left bg-gradient-to-tr from-blue-600 via-blue-700 to-indigo-800 text-white p-6 sm:p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 group relative overflow-hidden flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 active:scale-[0.99]"
        >
          {/* Backdrop Graphic Decoration */}
          <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none transform translate-x-6 translate-y-6 group-hover:scale-105 transition-transform duration-500">
            <svg className="w-72 h-72" fill="currentColor" viewBox="0 0 24 24">
              <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </div>

          <div className="space-y-2 relative z-10 max-w-2xl">
            <span className="text-[10px] font-bold uppercase tracking-widest text-blue-100 bg-white/15 border border-white/10 px-3 py-1 rounded-md">
              Primary Dispatch Action
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-2">
              Create New Incident Report
            </h2>
            <p className="text-sm text-blue-100/85 leading-relaxed font-medium">
              Welcome back, Commander {firstName}. Click to process emergency intake files, incident logs, or file deployment summaries.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-white/15 group-hover:bg-white/20 px-5 py-3 rounded-xl border border-white/10 text-sm font-bold transition-all self-start sm:self-center shrink-0 relative z-10 shadow-sm">
            <span>Launch Form</span>
            <svg className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </div>
        </button>

        {/* Workspace Quick Links (Desktop Grid) */}
        <div className="hidden sm:grid grid-cols-2 gap-4">
          <button
            onClick={() => navigate('/responder-incidents')}
            className="group flex items-center justify-between bg-white hover:bg-slate-50/50 p-4 rounded-xl border border-slate-200 shadow-sm transition-all duration-200 text-left active:scale-[0.99]"
          >
            <div className="flex items-center gap-4">
              <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl group-hover:bg-blue-100/70 border border-blue-100/50 transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 112-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <div>
                <span className="text-sm font-bold text-slate-900 block">Incident Central</span>
                <span className="text-xs text-slate-400 font-medium">Verify active emergency operations data maps.</span>
              </div>
            </div>
            <svg className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-all group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>

          <button
            onClick={() => navigate('/responder-reports')}
            className="group flex items-center justify-between bg-white hover:bg-slate-50/50 p-4 rounded-xl border border-slate-200 shadow-sm transition-all duration-200 text-left active:scale-[0.99]"
          >
            <div className="flex items-center gap-4">
              <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl group-hover:bg-emerald-100/70 border border-emerald-100/50 transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <div>
                <span className="text-sm font-bold text-slate-900 block">Accomplishment Ledger</span>
                <span className="text-xs text-slate-400 font-medium">Audit logs and completed regional briefs.</span>
              </div>
            </div>
            <svg className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-all group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Recent Incidents List Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Live Incident Feed</h3>
              <p className="text-xs text-slate-400 font-medium mt-0.5">Showing recent emergency dispatch operations logs.</p>
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 px-3 py-1 bg-emerald-50 rounded-full border border-emerald-100">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Live Operations
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {mockIncidents.slice(0, 5).map((incident) => {
              const typeStyle = getIncidentTypeConfig(incident.type)
              return (
                  <div
                    key={incident.id}
                    role="button"
                    tabIndex={0}
                    onClick={handleIncidentClick}
                    onKeyDown={handleIncidentKeyDown}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-5 px-6 gap-4 hover:bg-slate-50/70 transition-colors cursor-pointer focus:bg-slate-50/80 focus:outline-none group"
                  >
                  <div className="flex-1 min-w-0 flex items-start gap-3">
                    <div className={`p-2 rounded-xl border shrink-0 mt-0.5 ${typeStyle?.wrapper}`}>
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
                          <span className="text-[10px] font-bold bg-rose-50 border border-rose-100 text-rose-600 px-1.5 py-0.2 rounded">
                            {incident.victimCount} Cas
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-medium text-slate-500 mt-1 truncate">{incident.location}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-6 border-t border-slate-50 sm:border-t-0 pt-2 sm:pt-0">
                    <span className={`inline-flex items-center text-[10px] font-extrabold tracking-wider uppercase px-2.5 py-1 border rounded-md ${typeStyle?.wrapper}`}>
                      {incident.type}
                    </span>
                    <div className="text-right sm:min-w-[130px]">
                      <span className={`inline-flex items-center text-xs font-bold ${
                        incident.status === 'Pending Report' ? 'text-amber-600' : 'text-emerald-600'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full mr-2 ${
                          incident.status === 'Pending Report' ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}></span>
                        {incident.status}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="border-t border-slate-100 bg-slate-50/50">
            <button
              onClick={() => navigate('/responder-incidents')}
              className="w-full py-3.5 text-xs font-bold text-blue-600 hover:text-blue-700 hover:bg-slate-100/50 transition-all flex items-center justify-center gap-1.5 uppercase tracking-wider"
            >
              <span>View Full Incident Ledger</span>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          </div>
        </div>
      </main>

      {/* --- MOBILE BOTTOM NAVIGATION BAR --- */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-[0_-4px_16px_rgba(15,23,42,0.06)] z-50 px-2 py-2">
        <div className="flex justify-around items-center">
          
          {/* Incident Button */}
          <button 
            onClick={() => navigate('/responder-incidents')}
            className={`flex flex-col items-center gap-1 py-1 px-3 transition-all active:scale-95 ${
              isActiveNav('/responder-incidents') ? 'text-blue-600 font-bold' : 'text-slate-400 hover:text-slate-600'
            }`}
            aria-label="View Incidents"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={isActiveNav('/responder-incidents') ? 2.5 : 2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <span className="text-[10px] tracking-tight">Incident</span>
          </button>

          {/* Create Report Button */}
          <button 
            onClick={() => navigate('/create-report')} 
            className={`flex flex-col items-center gap-1 py-1 px-3 transition-all active:scale-95 ${
              isActiveNav('/create-report') ? 'text-blue-600 font-bold' : 'text-slate-400 hover:text-slate-600'
            }`}
            aria-label="Create Report"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={isActiveNav('/create-report') ? 2.5 : 2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span className="text-[10px] tracking-tight">New Report</span>
          </button>

          {/* Accomplishment Report Button */}
          <button 
            onClick={() => navigate('/responder-reports')}
            className={`flex flex-col items-center gap-1 py-1 px-3 transition-all active:scale-95 ${
              isActiveNav('/responder-reports') ? 'text-blue-600 font-bold' : 'text-slate-400 hover:text-slate-600'
            }`}
            aria-label="View Reports"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={isActiveNav('/responder-reports') ? 2.5 : 2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-[10px] tracking-tight">Logs</span>
          </button>

          {/* Profile Button */}
          <button 
            onClick={() => navigate('/responder-profile-settings')} 
            className={`flex flex-col items-center gap-1 py-1 px-3 transition-all active:scale-95 ${
              isActiveNav('/responder-profile-settings') ? 'text-blue-600 font-bold' : 'text-slate-400'
            }`}
            aria-label="Profile Settings"
          >
            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-extrabold shadow-sm ${
              isActiveNav('/responder-profile-settings') 
                ? 'bg-blue-600 ring-2 ring-blue-100' 
                : 'bg-slate-400'
            }`}>
              {initials}
            </div>
            <span className="text-[10px] tracking-tight">Profile</span>
          </button>

        </div>
      </nav>
    </div>
  )
}

export default ResponderDashboardPage
