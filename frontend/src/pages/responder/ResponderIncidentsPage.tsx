import { useState } from 'react'
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

export function ResponderIncidentsPage() {
  const navigate = useNavigate()
  const profile = getCurrentUserProfile()
  const displayName = profile?.fullName?.trim() || 'Responder'
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'RE'

  const [incidents] = useState<Incident[]>(mockIncidents)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [filters, setFilters] = useState({
    type: '',
    status: '',
    search: '',
  })

  const filteredIncidents = incidents.filter((incident) => {
    return (
      (!filters.type || incident.type === filters.type) &&
      (!filters.status || incident.status === filters.status) &&
      (!filters.search ||
        incident.location.toLowerCase().includes(filters.search.toLowerCase()) ||
        incident.id.toLowerCase().includes(filters.search.toLowerCase()))
    )
  })

  const handleSelectAll = () => {
    if (selectedIds.size === filteredIncidents.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredIncidents.map((inc) => inc.id)))
    }
  }

  const handleToggleIncident = (id: string) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedIds(newSelected)
  }

  const handleGenerateReport = () => {
    navigate('/responder-reports', {
      state: {
        selectedIncidents: incidents.filter((inc) => selectedIds.has(inc.id)),
      },
    })
  }

  const isActiveNav = (path: string) => {
    if (typeof window === 'undefined') return false
    return window.location.pathname.includes(path)
  }

  // Configuration helper for unified theme semantics
  const getIncidentTypeConfig = (type: Incident['type']) => {
    switch (type) {
      case 'Medical':
        return {
          badge: 'bg-rose-50 text-rose-700 border-rose-100',
          icon: <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        }
      case 'RTC':
        return {
          badge: 'bg-amber-50 text-amber-700 border-amber-100',
          icon: <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        }
      case 'Fire':
        return {
          badge: 'bg-orange-50 text-orange-700 border-orange-100',
          icon: <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
        }
      case 'Hazmat':
        return {
          badge: 'bg-purple-50 text-purple-700 border-purple-100',
          icon: <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        }
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-28 sm:pb-12 antialiased text-slate-800">
      
      {/* Top Application Header Bar */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-md shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6 py-4">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate('/responder-dashboard')} 
              className="p-2 -ml-2 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors"
              aria-label="Back to dashboard"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
            </button>
            <div>
              <h1 className="text-base font-bold text-slate-900 tracking-tight">Emergency Dispatch Ledger</h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container Workspace */}
      <main className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
        
        {/* Title Action Bar Block */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div>
            <h2 className="text-xl font-extrabold tracking-tight text-slate-900">Incident Master Logs</h2>
            <p className="text-xs text-slate-400 font-medium mt-0.5">Select logged responses below to compile dynamic accomplishment briefs.</p>
          </div>
          <button
            onClick={handleGenerateReport}
            disabled={selectedIds.size === 0}
            className="inline-flex items-center justify-center gap-2 bg-blue-600 text-white text-xs font-bold uppercase tracking-wider px-5 py-3 rounded-xl hover:bg-blue-700 active:scale-[0.98] disabled:opacity-35 disabled:pointer-events-none shadow-md transition-all shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>Compile Report ({selectedIds.size})</span>
          </button>
        </div>

        {/* Dynamic Filtering Control Hub */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="flex-1 relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Filter by incident token hash or geographic location..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all placeholder:text-slate-400"
              />
            </div>
            <div className="grid grid-cols-2 lg:flex gap-3">
              <select
                value={filters.type}
                onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-600 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all min-w-[140px]"
              >
                <option value="">All Categories</option>
                <option value="Medical">Medical</option>
                <option value="RTC">RTC</option>
                <option value="Fire">Fire</option>
                <option value="Hazmat">Hazmat</option>
              </select>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-600 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all min-w-[155px]"
              >
                <option value="">All Dispatch Status</option>
                <option value="Pending Report">Pending Report</option>
                <option value="Completed">Completed</option>
              </select>
            </div>
          </div>
        </div>

        {/* Master Incident Log Module Container */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          
          {/* DESKTOP MATRIX GRID VIEW */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-200 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                  <th className="px-6 py-4 w-12 text-center">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === filteredIncidents.length && filteredIncidents.length > 0}
                      onChange={handleSelectAll}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500/20 w-4 h-4 transition cursor-pointer"
                      aria-label="Select all incidents"
                    />
                  </th>
                  <th className="px-6 py-4">Incident ID</th>
                  <th className="px-6 py-4">Classification</th>
                  <th className="px-6 py-4">Geographic Location</th>
                  <th className="px-6 py-4">Time Dispatched</th>
                  <th className="px-6 py-4 text-center">Casualties</th>
                  <th className="px-6 py-4 text-right">Status State</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm font-medium">
                {filteredIncidents.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-16 text-center text-slate-400 font-medium">
                      No matching historical incident registries found.
                    </td>
                  </tr>
                ) : (
                  filteredIncidents.map((incident) => {
                    const isSelected = selectedIds.has(incident.id)
                    const typeConfig = getIncidentTypeConfig(incident.type)
                    return (
                      <tr 
                        key={incident.id} 
                        className={`transition-colors duration-150 hover:bg-slate-50/60 ${
                          isSelected ? 'bg-blue-50/30' : ''
                        }`}
                      >
                        <td className="px-6 py-4 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleIncident(incident.id)}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500/20 w-4 h-4 transition cursor-pointer"
                            aria-label={`Select incident ${incident.id}`}
                          />
                        </td>
                        <td className="px-6 py-4 font-bold text-slate-900 font-mono text-xs">{incident.id}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 border text-xs font-extrabold uppercase tracking-wider rounded-md ${typeConfig?.badge}`}>
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              {typeConfig?.icon}
                            </svg>
                            {incident.type}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-600 max-w-xs truncate">{incident.location}</td>
                        <td className="px-6 py-4 text-slate-400 font-semibold text-xs">{incident.timeOccurred}</td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${incident.victimCount > 0 ? 'bg-rose-50 border border-rose-100 text-rose-600' : 'text-slate-400 bg-slate-50'}`}>
                            {incident.victimCount}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className={`inline-flex items-center text-xs font-bold ${
                            incident.status === 'Completed' ? 'text-emerald-600' : 'text-amber-600'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full mr-2 ${
                              incident.status === 'Completed' ? 'bg-emerald-500' : 'bg-amber-500'
                            }`}></span>
                            {incident.status}
                          </span>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* COMPACT MOBILE LIST CARDS VIEW */}
          <div className="block sm:hidden divide-y divide-slate-100">
            {filteredIncidents.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm font-medium">
                No matching operational files found.
              </div>
            ) : (
              filteredIncidents.map((incident) => {
                const isSelected = selectedIds.has(incident.id)
                const typeConfig = getIncidentTypeConfig(incident.type)
                return (
                  <div 
                    key={incident.id}
                    className={`p-4 flex gap-3 transition-colors ${isSelected ? 'bg-blue-50/20' : ''}`}
                  >
                    <div className="pt-1 shrink-0">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleIncident(incident.id)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500/20 w-4.5 h-4.5 transition"
                      />
                    </div>
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-black text-slate-900">{incident.id}</span>
                        <span className="text-[11px] font-semibold text-slate-400">{incident.timeOccurred}</span>
                      </div>
                      
                      <p className="text-xs font-bold text-slate-600 truncate">{incident.location}</p>
                      
                      <div className="flex items-center justify-between gap-2 pt-1">
                        <div className="flex items-center gap-1.5">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 border text-[10px] font-black uppercase tracking-wider rounded ${typeConfig?.badge}`}>
                            {incident.type}
                          </span>
                          {incident.victimCount > 0 && (
                            <span className="text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-100 px-1.5 py-0.5 rounded">
                              {incident.victimCount} Cas
                            </span>
                          )}
                        </div>

                        <span className={`inline-flex items-center text-xs font-bold ${
                          incident.status === 'Completed' ? 'text-emerald-600' : 'text-amber-600'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                            incident.status === 'Completed' ? 'bg-emerald-500' : 'bg-amber-500'
                          }`}></span>
                          {incident.status}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </main>

      {/* --- MOBILE BOTTOM NAVIGATION BAR --- */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-[0_-4px_16px_rgba(15,23,42,0.06)] z-50 px-2 py-2">
        <div className="flex justify-around items-center">
          
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

export default ResponderIncidentsPage
