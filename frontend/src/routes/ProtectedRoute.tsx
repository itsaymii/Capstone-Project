import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { hasDashboardAccess, isAuthenticated } from '../services/auth'

type ProtectedRouteProps = {
  element: ReactNode
  redirectTo?: string
  requireDashboardAccess?: boolean
}

export function ProtectedRoute({ element, redirectTo = '/login', requireDashboardAccess = false }: ProtectedRouteProps) {
  const location = useLocation()

  if (!isAuthenticated()) {
    return <Navigate replace state={{ from: location.pathname }} to={redirectTo} />
  }

  if (requireDashboardAccess && !hasDashboardAccess()) {
    return <Navigate replace to="/landing" />
  }

  return <>{element}</>
}
