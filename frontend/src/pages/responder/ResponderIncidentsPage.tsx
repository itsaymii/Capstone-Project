import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { getIncidents, type BackendIncident } from '../../services/incidents'
import { addNotification } from '../../services/notifications'
import { MobileNavBar } from '../../components/MobileNavBar'
import { getCurrentUserProfile } from '../../services/auth'

export function ResponderIncidentsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const profile = getCurrentUserProfile()
  
  const [incidents, setIncidents] = useState<BackendIncident[]>([])
  const [selectedIncidents, setSelectedIncidents] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState({
    type: '',
    status: '',
    search: '',
  })

  // Fetch incidents on mount and when location changes
  useEffect(() => {
    const fetchIncidents = async () => {
      try {
        setLoading(true)
        setError(null)
        const data = await getIncidents()
        setIncidents(data)
        setSelectedIncidents(new Set())
        
        // Show success message if returning from report submission
        if (location.state?.message) {
          addNotification(location.state.message)
        }
      } catch (err) {
        console.error('Failed to fetch incidents:', err)
        setError('Failed to load incidents. Please try again.')
        addNotification('❌ Failed to load incidents')
      } finally {
        setLoading(false)
      }
    }

    fetchIncidents()
  }, [location])

  const filteredIncidents = incidents.filter((incident) => {
    const hazardType = incident.hazard_type?.name || ''
    return (
      (!filters.type || hazardType.toLowerCase().includes(filters.type.toLowerCase())) &&
      (!filters.status || incident.status === filters.status) &&
      (!filters.search ||
        hazardType.toLowerCase().includes(filters.search.toLowerCase()) ||
        incident.address.toLowerCase().includes(filters.search.toLowerCase()) ||
        incident.reference_code?.toLowerCase().includes(filters.search.toLowerCase()))
    )
  })

  const handleSelectAll = () => {
    if (selectedIncidents.size === filteredIncidents.length) {
      setSelectedIncidents(new Set())
    } else {
      setSelectedIncidents(new Set(filteredIncidents.map((inc) => inc.id)))
    }
  }

  const handleToggleIncident = (id: string) => {
    const newSelected = new Set(selectedIncidents)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedIncidents(newSelected)
  }

  const handleGenerateReport = () => {
    const selected = incidents.filter((inc) => selectedIncidents.has(inc.id))
    if (selected.length === 0) {
      addNotification('⚠️ Please select at least one incident')
      return
    }
    navigate('/create-report', {
      state: {
        selectedIncidents: selected,
        incidentId: selected[0].reference_code || selected[0].id,
      },
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'reported':
        return 'bg-blue-50 text-blue-700 border-blue-100'
      case 'verified':
        return 'bg-purple-50 text-purple-700 border-purple-100'
      case 'ongoing':
        return 'bg-amber-50 text-amber-700 border-amber-100'
      case 'contained':
        return 'bg-yellow-50 text-yellow-700 border-yellow-100'
      case 'resolved':
        return 'bg-emerald-50 text-emerald-700 border-emerald-100'
      case 'false_alarm':
        return 'bg-slate-100 text-slate-600 border-slate-200'
      default:
        return 'bg-slate-100 text-slate-600 border-slate-200'
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'low':
        return 'bg-emerald-50 text-emerald-700 border-emerald-100'
      case 'moderate':
        return 'bg-blue-50 text-blue-700 border-blue-100'
      case 'high':
        return 'bg-orange-50 text-orange-700 border-orange-100'
      case 'critical':
        return 'bg-rose-50 text-rose-700 border-rose-100 font-bold animate-pulse'
      default:
        return 'bg-slate-50 text-slate-600 border-slate-100'
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 pb-28 sm:pb-12 pt-6 antialiased text-slate-800">
      <main className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
        
        {/* Main Control Panel */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Header Navigation */}
          <div className="p-5 sm:p-7 border-b border-slate-200/80 space-y-5 overflow-hidden relative">
            {/* Subtle Accent Gradient for Status */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500" />
            
            <div className="flex items-center gap-4">
              <button 
                onClick={() => navigate('/responder-dashboard')}
                className="group flex items-center justify-center w-10 h-10 bg-slate-50 text-slate-500 hover:bg-blue-50 hover:text-blue-600 rounded-2xl transition-all border border-slate-100 shadow-sm active:scale-90"
                title="Back to Dashboard"
              >
                <svg className="w-5 h-5 transform group-hover:-translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              
              <div>
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600 opacity-60 block mb-0.5 leading-none">Operational Queue</span>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 leading-tight">Emergency Dispatch Ledger</h1>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-slate-100 pt-5">
              <p className="text-sm text-slate-500 font-medium leading-relaxed max-w-lg">
                Browse and select active incidents to document field operations and synchronize data.
              </p>
            </div>
          </div>

          {/* Lower Filter Section */}
          <div className="p-5 sm:p-6 bg-white grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider">Search</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search by ID, location, or type..."
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  className="w-full pl-3 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm placeholder:text-slate-400"
                />
                {filters.search && (
                  <button 
                    onClick={() => setFilters({ ...filters, search: '' })}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-medium"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider">Incident Type</label>
              <input
                type="text"
                placeholder="Filter by type..."
                value={filters.type}
                onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm placeholder:text-slate-400"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider">Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm cursor-pointer"
              >
                <option value="">All Statuses</option>
                <option value="reported">Reported</option>
                <option value="verified">Verified</option>
                <option value="ongoing">Ongoing</option>
                <option value="contained">Contained</option>
                <option value="resolved">Resolved</option>
                <option value="false_alarm">False Alarm</option>
              </select>
            </div>
          </div>
        </div>

        {/* Selection Info Bar */}
        {selectedIncidents.size > 0 && (
          <div className="bg-blue-600 border border-blue-700 rounded-2xl p-4 flex items-center justify-between shadow-md transition-all animate-in fade-in slide-in-from-top-2 duration-200">
            <p className="text-sm font-medium text-white px-1">
              {selectedIncidents.size} incident{selectedIncidents.size !== 1 ? 's' : ''} selected for reporting
            </p>
            <button
              onClick={handleGenerateReport}
              className="px-5 py-2 bg-white text-blue-700 font-bold text-sm rounded-xl hover:bg-blue-50 active:scale-[0.98] transition-all flex items-center gap-2 shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Generate Report
            </button>
          </div>
        )}

        {/* Incidents Table */}
        {loading ? (
          <div className="bg-white rounded-2xl p-16 text-center border border-slate-200 shadow-sm">
            <div className="flex justify-center mb-4">
              <svg className="animate-spin h-8 w-8 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
            <p className="text-slate-500 font-medium">Loading incidents from system...</p>
          </div>
        ) : error ? (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-8 text-center shadow-sm">
            <p className="text-rose-800 font-semibold">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-5 py-2 bg-rose-600 text-white font-bold rounded-xl hover:bg-rose-700 active:scale-95 transition"
            >
              Retry Connection
            </button>
          </div>
        ) : filteredIncidents.length === 0 ? (
          <div className="bg-white rounded-2xl p-16 text-center border border-slate-200 shadow-sm">
            <p className="text-slate-400 text-lg"></p>
            <p className="text-slate-500 font-medium mt-2">No matching incidents found</p>
            <p className="text-xs text-slate-400 mt-1">Try adjusting your filters or search keywords</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3.5 w-12">
                      <input
                        type="checkbox"
                        checked={selectedIncidents.size === filteredIncidents.length && filteredIncidents.length > 0}
                        onChange={handleSelectAll}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer"
                      />
                    </th>
                    <th className="px-6 py-3.5 font-semibold text-slate-700 text-xs uppercase tracking-wider">ID</th>
                    <th className="px-6 py-3.5 font-semibold text-slate-700 text-xs uppercase tracking-wider">Type</th>
                    <th className="px-6 py-3.5 font-semibold text-slate-700 text-xs uppercase tracking-wider">Location</th>
                    <th className="px-6 py-3.5 font-semibold text-slate-700 text-xs uppercase tracking-wider">Date/Time</th>
                    <th className="px-6 py-3.5 font-semibold text-slate-700 text-xs uppercase tracking-wider">Severity</th>
                    <th className="px-6 py-3.5 font-semibold text-slate-700 text-xs uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredIncidents.map((incident) => (
                    <tr key={incident.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4">
                        <input
                          type="checkbox"
                          checked={selectedIncidents.has(incident.id)}
                          onChange={() => handleToggleIncident(incident.id)}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer"
                        />
                      </td>
                      <td className="px-6 py-4 text-sm font-mono font-medium text-slate-600">
                        {incident.reference_code || `${incident.id.slice(0, 8)}...`}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className="font-semibold text-slate-900">
                          {incident.hazard_type?.name || 'Unknown'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 max-w-xs truncate">{incident.address}</td>
                      <td className="px-6 py-4 text-sm text-slate-600 whitespace-nowrap">
                        {new Date(incident.incident_datetime).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="px-6 py-4 text-xs whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-md font-bold tracking-wide border ${getSeverityColor(incident.severity_level)}`}>
                          {incident.severity_level.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-full font-semibold border ${getStatusColor(incident.status)}`}>
                          {incident.status.replace('_', ' ').toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
      <MobileNavBar />
    </div>
  )
}

export default ResponderIncidentsPage