import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCurrentUserProfile, logoutUser } from '../../services/auth'
import notificationIcon from '../../images/notification.png'

interface Incident {
  id: string
  type: 'Medical' | 'RTC' | 'Fire' | 'Hazmat'
  location: string
  timeOccurred: string
  status: 'Pending Report' | 'Completed'
  victimCount: number
}

// Mock Data
const mockIncidents: Incident[] = [
  {
    id: 'INC-001',
    type: 'Medical',
    location: 'Barangay 1, Main St',
    timeOccurred: '2:30 PM',
    status: 'Pending Report',
    victimCount: 2,
  },
  {
    id: 'INC-002',
    type: 'RTC',
    location: 'Highway 1, Junction',
    timeOccurred: '3:15 PM',
    status: 'Pending Report',
    victimCount: 3,
  },
  {
    id: 'INC-003',
    type: 'Fire',
    location: 'Barangay 3, Warehouse',
    timeOccurred: '1:45 PM',
    status: 'Completed',
    victimCount: 0,
  },
  {
    id: 'INC-004',
    type: 'Hazmat',
    location: 'Industrial Zone',
    timeOccurred: '4:00 PM',
    status: 'Pending Report',
    victimCount: 1,
  },
  {
    id: 'INC-005',
    type: 'Medical',
    location: 'Barangay 2, School',
    timeOccurred: '2:00 PM',
    status: 'Completed',
    victimCount: 1,
  },
]

export function ResponderIncidentsPage() {
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

  const [incidents] = useState<Incident[]>(mockIncidents)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isTopProfileMenuOpen, setIsTopProfileMenuOpen] = useState(false)
  const [filters, setFilters] = useState({
    type: '',
    status: '',
    search: '',
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

  const filteredIncidents = incidents.filter((incident) => {
    return (
      (!filters.type || incident.type === filters.type) &&
      (!filters.status || incident.status === filters.status) &&
      (!filters.search ||
        incident.location.toLowerCase().includes(filters.search.toLowerCase()) ||
        incident.id.includes(filters.search))
    )
  })

  const handleLogout = async () => {
    await logoutUser()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50/60 font-sans antialiased text-gray-900">
      {/* Top Navigation Bar */}
      <header className="bg-white border-b border-gray-200/80 sticky top-0 z-50 shadow-sm shadow-gray-100/40">
        <div className="flex items-center justify-between px-6 py-3.5">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate('/responder-dashboard')} 
              className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-gray-100 rounded-lg transition-colors duration-200"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <h1 className="text-xl font-bold tracking-tight text-gray-900">Incidents</h1>
          </div>

          <div className="flex items-center gap-4">
            {/* Notification Icon */}
            <button className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100/80 rounded-lg transition-colors duration-200">
              <img src={notificationIcon} alt="Notifications" className="w-5 h-5 opacity-75" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white"></span>
            </button>

            {/* Profile Menu */}
            <div className="relative">
              <button
                onClick={() => setIsTopProfileMenuOpen(!isTopProfileMenuOpen)}
                className="flex items-center gap-2.5 p-1.5 hover:bg-gray-100/80 rounded-lg transition-colors duration-200"
              >
                <div className="w-7 h-7 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-full flex items-center justify-center text-white text-xs font-semibold shadow-sm">
                  {initials}
                </div>
                <span className="text-sm font-medium text-gray-700 hidden sm:inline">{firstName}</span>
                <svg className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isTopProfileMenuOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Dropdown Menu */}
              {isTopProfileMenuOpen && (
                <div className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-xl border border-gray-100 py-1 z-50 transform origin-top-right transition-all">
                  <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50">
                    <p className="text-sm font-semibold text-gray-900 truncate">{displayName}</p>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{profile?.role || 'Responder'}</p>
                  </div>
                  <div className="py-1">
                    <button className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                      Profile Settings
                    </button>
                    <button className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                      Help & Support
                    </button>
                  </div>
                  <div className="border-t border-gray-100 pt-1 mt-1">
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50/60 transition-colors"
                    >
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-gray-900">Incident Logs</h2>
            <p className="text-sm text-gray-500 mt-0.5">Manage, filter, and compile reports for field incidents.</p>
          </div>
          <button
            onClick={handleGenerateReport}
            disabled={selectedIds.size === 0}
            className="inline-flex items-center justify-center gap-2 bg-blue-600 text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-blue-700 active:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>Generate Report ({selectedIds.size})</span>
          </button>
        </div>

        {/* Filter Bar */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200/80">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1 relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Search by ID or location..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="w-full pl-9 pr-4 py-2 bg-gray-50/50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>
            <div className="grid grid-cols-2 md:flex gap-3">
              <select
                value={filters.type}
                onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                className="px-3 py-2 bg-gray-50/50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all min-w-[130px]"
              >
                <option value="">All Types</option>
                <option value="Medical">Medical</option>
                <option value="RTC">RTC</option>
                <option value="Fire">Fire</option>
                <option value="Hazmat">Hazmat</option>
              </select>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="px-3 py-2 bg-gray-50/50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all min-w-[140px]"
              >
                <option value="">All Status</option>
                <option value="Pending Report">Pending Report</option>
                <option value="Completed">Completed</option>
              </select>
            </div>
          </div>
        </div>

        {/* Incident Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200/80 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/70 border-b border-gray-200/80 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  <th className="px-6 py-3.5 w-12">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === filteredIncidents.length && filteredIncidents.length > 0}
                      onChange={handleSelectAll}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500/20 w-4 h-4 transition"
                    />
                  </th>
                  <th className="px-6 py-3.5">Incident ID</th>
                  <th className="px-6 py-3.5">Type</th>
                  <th className="px-6 py-3.5">Location</th>
                  <th className="px-6 py-3.5">Time Occurred</th>
                  <th className="px-6 py-3.5 text-center">Victims</th>
                  <th className="px-6 py-3.5 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {filteredIncidents.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-400 font-normal">
                      No matching incidents found
                    </td>
                  </tr>
                ) : (
                  filteredIncidents.map((incident) => {
                    const isSelected = selectedIds.has(incident.id);
                    return (
                      <tr 
                        key={incident.id} 
                        className={`transition-colors duration-150 hover:bg-gray-50/50 ${
                          isSelected ? 'bg-blue-50/20' : ''
                        }`}
                      >
                        <td className="px-6 py-3.5">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleIncident(incident.id)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500/20 w-4 h-4 transition"
                          />
                        </td>
                        <td className="px-6 py-3.5 font-semibold text-gray-950">{incident.id}</td>
                        <td className="px-6 py-3.5">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold tracking-wide ${
                            incident.type === 'Medical' ? 'bg-red-50 text-red-700 border border-red-100' :
                            incident.type === 'RTC' ? 'bg-yellow-50 text-yellow-700 border border-yellow-100' :
                            incident.type === 'Fire' ? 'bg-orange-50 text-orange-700 border border-orange-100' :
                            'bg-purple-50 text-purple-700 border border-purple-100'
                          }`}>
                            {incident.type}
                          </span>
                        </td>
                        <td className="px-6 py-3.5 text-gray-600 max-w-xs truncate">{incident.location}</td>
                        <td className="px-6 py-3.5 text-gray-500">{incident.timeOccurred}</td>
                        <td className="px-6 py-3.5 text-center font-medium text-gray-700">{incident.victimCount}</td>
                        <td className="px-6 py-3.5 text-right">
                          <span className={`inline-flex items-center text-xs font-semibold ${
                            incident.status === 'Completed' ? 'text-green-600' : 'text-orange-600'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                              incident.status === 'Completed' ? 'bg-green-500' : 'bg-orange-500'
                            }`}></span>
                            {incident.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}