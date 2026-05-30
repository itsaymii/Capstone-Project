import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { getCurrentUserProfile } from '../services/auth'

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
    if (path === '/responder-dashboard') return location.pathname === '/responder-dashboard'
    return location.pathname.includes(path)
  }

  // Navigation Items Config for cleaner, bug-free rendering
  const navItems = [
    {
      label: 'Dashboard',
      path: '/responder-dashboard',
      icon: (isActive: boolean) => (
        <svg className={`w-5 h-5 transition-colors duration-200 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
        </svg>
      )
    },
    {
      label: 'Incidents',
      path: '/responder-incidents',
      icon: (isActive: boolean) => (
        <svg className={`w-5 h-5 transition-colors duration-200 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      )
    },
    { isFloatingButton: true }, // Dock Spacer Placeholder
    {
      label: 'Reports',
      path: '/responder-reports',
      icon: (isActive: boolean) => (
        <svg className={`w-5 h-5 transition-colors duration-200 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      )
    },
    {
      label: 'Profile',
      path: '/responder-profile-settings',
      isProfile: true
    }
  ]

  return (
    <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-slate-200/60 pb-safe shadow-[0_-8px_30px_rgb(0,0,0,0.04)] z-50 px-2">
      <div className="relative flex justify-between items-center h-16 max-w-md mx-auto px-2">
        
        {navItems.map((item, index) => {
          // 1. Render the middle Floating Action Button
          if (item.isFloatingButton) {
            return (
              <div key="fab-button" className="relative flex items-center justify-center w-14 h-full">
                <button
                  onClick={() => navigate('/create-report')}
                  className="absolute -top-5 flex items-center justify-center bg-gradient-to-tr from-blue-600 to-indigo-600 text-white rounded-full w-14 h-14 shadow-[0_8px_20px_rgba(37,99,235,0.4)] hover:shadow-[0_10px_25px_rgba(37,99,235,0.5)] active:scale-90 transition-all duration-200 ease-out border-4 border-white"
                  aria-label="Create Report"
                >
                  <svg className="w-6 h-6 stroke-[3]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                </button>
              </div>
            )
          }

          const isActive = isActiveNav(item.path!)

          // 2. Render standard menu links & profile avatar link
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path!)}
              className="relative flex flex-col items-center justify-center flex-1 h-full gap-1 group focus:outline-none"
              aria-label={item.label}
            >
              <div className="flex items-center justify-center transition-transform duration-200 ease-out group-active:scale-95 group-hover:-translate-y-0.5">
                {item.isProfile ? (
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-black tracking-tighter transition-all duration-200 shadow-sm ${
                    isActive
                      ? 'bg-blue-600 ring-2 ring-blue-100 scale-110 shadow-md'
                      : 'bg-slate-400 group-hover:bg-slate-500'
                  }`}>
                    {initials}
                  </div>
                ) : (
                  item.icon!(isActive)
                )}
              </div>

              <span className={`text-[10px] font-medium tracking-wide transition-colors duration-200 ${
                isActive 
                  ? 'text-blue-600 font-semibold' 
                  : 'text-slate-400 group-hover:text-slate-600'
              }`}>
                {item.label}
              </span>

              {/* Active Indicator Bar: Clean, smooth scale transition */}
              <span className={`absolute bottom-1.5 h-1 bg-blue-600 rounded-full transition-all duration-300 ease-out ${
                isActive ? 'w-4 opacity-100' : 'w-0 opacity-0'
              }`} />
            </button>
          )
        })}

      </div>
    </nav>
  )
}