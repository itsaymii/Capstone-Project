import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { isAuthenticated } from '../services/auth'

type ProtectedRouteProps = {
  element: ReactNode
  redirectTo?: string
}

export function ProtectedRoute({ element, redirectTo = '/login' }: ProtectedRouteProps) {
  const location = useLocation()

  if (!isAuthenticated()) {
    return <Navigate replace state={{ from: location.pathname }} to={redirectTo} />
  }

  return <>{element}</>
}
