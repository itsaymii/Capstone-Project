import { useNavigate, useLocation } from 'react-router-dom'
import { getCurrentUserProfile } from '../services/auth'
import React from 'react'

export function MobileNavBar() {
  const navigate = useNavigate()
  const location = useLocation()
  const profile = getCurrentUserProfile()

  const displayName = profile?.fullName?.trim() || 'Responder'
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'RE'

  const isActiveNav = (path: string) => {
    // Check if the current pathname includes the given path
    // This is a simple check, for more exact matching, consider `useMatch`
    return location.pathname.includes(path)
  }

  return (
    <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-[0_-4px_16px_rgba(15,23,42,0.06)] z-50 px-2 py-2">
      <div className="flex justify-around items-center">
        {/* Incidents Tab */}
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
          <span className="text-[10px] tracking-tight">Incidents</span>
        </button>

        {/* New Report Tab */}
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

        {/* Logs Tab */}
        <button
          onClick={() => navigate('/responder-reports')}
          className={`flex flex-col items-center gap-1 py-1 px-3 transition-all active:scale-95 ${
            isActiveNav('/responder-reports') ? 'text-blue-600 font-bold' : 'text-slate-400 hover:text-slate-600'
          }`}
          aria-label="Accomplishment Reports"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={isActiveNav('/responder-reports') ? 2.5 : 2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-[10px] tracking-tight">Logs</span>
        </button>

        {/* Profile Tab */}
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
  )
}