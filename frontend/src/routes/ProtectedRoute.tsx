import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { getCurrentUserProfile, hasDashboardAccess, isAuthenticated } from '../services/auth'

type ProtectedRouteProps = {
  element: ReactNode
  redirectTo?: string
  requireDashboardAccess?: boolean
  requiredRole?: 'admin' | 'staff' | 'citizen'
}

export function ProtectedRoute({ element, redirectTo = '/login', requireDashboardAccess = false, requiredRole }: ProtectedRouteProps) {
  const location = useLocation()

  if (!isAuthenticated()) {
    return <Navigate replace state={{ from: location.pathname }} to={redirectTo} />
  }

  const profile = getCurrentUserProfile()
  
  // Enforce dashboard access requirement
  if (requireDashboardAccess && !hasDashboardAccess()) {
    return <Navigate replace to="/landing" />
  }

  // Enforce role-based access control
  const actualRole = profile?.role || (profile?.isAdmin ? 'admin' : profile?.isStaff ? 'staff' : undefined)
  if (requiredRole && actualRole !== requiredRole) {
    // Redirect to appropriate dashboard based on actual role
    if (actualRole === 'admin') {
      return <Navigate replace to="/admin-dashboard" />
    }
    if (actualRole === 'staff') {
      return <Navigate replace to="/responder-dashboard" />
    }
    // Citizens trying to access restricted routes go to landing
    return <Navigate replace to="/landing" />
  }

  return <>{element}</>
}
