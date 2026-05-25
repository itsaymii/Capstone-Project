import { useState } from 'react'
import type { FC } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCurrentUserProfile, logoutUser } from '../../services/auth'
import notificationIcon from '../../images/notification.png'

// Types
interface Incident {
  id: string
  type: 'Medical' | 'RTC' | 'Fire' | 'Hazmat'
  location: string
  timeOccurred: string
  status: 'Pending Report' | 'Completed'
  victimCount: number
}

interface MetricCard {
  label: string
  value: number | string
  comparison: string
  accent: string
  valueClass: string
  icon: React.ReactNode
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
];

// Main Component: Responder Dashboard Page
const ResponderDashboardPage: FC = () => {
  const [isTopProfileMenuOpen, setIsTopProfileMenuOpen] = useState(false)

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

  const metricCards: MetricCard[] = [
    {
      label: 'Pending Incidents',
      value: mockIncidents.filter((inc) => inc.status === 'Pending Report').length,
      comparison: 'Awaiting incident reports',
      accent: 'border-t-orange-600',
      valueClass: 'text-orange-700',
      icon: (
        <svg className="w-5 h-5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
    },
    {
      label: 'Completed Reports',
      value: mockIncidents.filter((inc) => inc.status === 'Completed').length,
      comparison: 'Reports successfully submitted',
      accent: 'border-t-green-600',
      valueClass: 'text-green-700',
      icon: (
        <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      label: 'Total Incidents Today',
      value: mockIncidents.length,
      comparison: 'All incident types combined',
      accent: 'border-t-blue-600',
      valueClass: 'text-blue-700',
      icon: (
        <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
    {
      label: 'Active Responders',
      value: 12,
      comparison: 'Currently on duty',
      accent: 'border-t-purple-600',
      valueClass: 'text-purple-700',
      icon: (
        <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
    },
  ]

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
            <h1 className="text-xl font-bold tracking-tight text-gray-900">Responder Dashboard</h1>
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

        {/* Tab Navigation */}
        <div className="flex gap-0 border-t border-gray-100 px-6">
          <button
            disabled
            className="px-4 py-2.5 font-medium text-sm text-blue-600 border-b-2 border-blue-600 -mb-px"
          >
            Dashboard
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto p-6 space-y-8">
        
        {/* Welcome Section */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-gray-900">
              Welcome back, {firstName}
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">Here is an overview of ongoing incidents and recent reporting metrics.</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            onClick={() => navigate('/responder-incidents')}
            className="group relative flex items-center justify-between bg-white hover:bg-gray-50 text-gray-900 font-semibold p-4 rounded-xl border border-gray-200 shadow-sm transition-all duration-200"
          >
            <div className="flex items-center gap-3.5">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg group-hover:bg-blue-100 transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
              </div>
              <span className="text-sm font-medium tracking-tight">View & Manage Incidents</span>
            </div>
            <svg className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          <button
            onClick={() => navigate('/responder-reports')}
            className="group relative flex items-center justify-between bg-white hover:bg-gray-50 text-gray-900 font-semibold p-4 rounded-xl border border-gray-200 shadow-sm transition-all duration-200"
          >
            <div className="flex items-center gap-3.5">
              <div className="p-2 bg-green-50 text-green-600 rounded-lg group-hover:bg-green-100 transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <span className="text-sm font-medium tracking-tight">View & Create Reports</span>
            </div>
            <svg className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {metricCards.map((metric, idx) => (
            <div
              key={idx}
              className={`bg-white rounded-xl shadow-sm p-5 border border-gray-200/80 border-t-4 ${metric.accent}`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-gray-500 text-xs font-medium uppercase tracking-wider">{metric.label}</p>
                  <p className={`text-3xl font-bold tracking-tight mt-1.5 ${metric.valueClass}`}>{metric.value}</p>
                </div>
                <div className="p-1.5 bg-gray-50 rounded-lg">
                  {metric.icon}
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-4 font-normal">{metric.comparison}</p>
            </div>
          ))}
        </div>

        {/* Recent Incidents Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200/80 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-base font-bold tracking-tight text-gray-900">Recent Incidents</h3>
            <span className="text-xs font-medium text-gray-400 px-2.5 py-1 bg-gray-50 rounded-full border border-gray-100">Live Logs</span>
          </div>

          <div className="divide-y divide-gray-100">
            {mockIncidents.slice(0, 5).map((incident) => (
              <div
                key={incident.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-4 px-6 gap-3 hover:bg-gray-50/50 transition-colors cursor-pointer group"
                onClick={() => navigate('/responder-incidents')}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm text-gray-900 group-hover:text-blue-600 transition-colors">{incident.id}</p>
                    <span className="text-gray-300 text-xs">•</span>
                    <p className="text-xs text-gray-400">{incident.timeOccurred}</p>
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5 truncate">{incident.location}</p>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-6">
                  <div>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold tracking-wide ${
                      incident.type === 'Medical' ? 'bg-red-50 text-red-700 border border-red-100' :
                      incident.type === 'RTC' ? 'bg-yellow-50 text-yellow-700 border border-yellow-100' :
                      incident.type === 'Fire' ? 'bg-orange-50 text-orange-700 border border-orange-100' :
                      'bg-purple-50 text-purple-700 border border-purple-100'
                    }`}>
                      {incident.type}
                    </span>
                  </div>
                  <div className="text-right sm:min-w-[110px]">
                    <span className={`inline-flex items-center text-xs font-medium ${
                      incident.status === 'Pending Report' ? 'text-orange-600' : 'text-green-600'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                        incident.status === 'Pending Report' ? 'bg-orange-500' : 'bg-green-500'
                      }`}></span>
                      {incident.status}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-gray-100 bg-gray-50/30">
            <button
              onClick={() => navigate('/responder-incidents')}
              className="w-full py-3 text-sm text-blue-600 font-semibold hover:text-blue-700 hover:bg-gray-50/80 transition-all flex items-center justify-center gap-1"
            >
              <span>View All Incidents</span>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}

export default ResponderDashboardPage