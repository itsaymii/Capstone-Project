import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { isAuthenticated } from '../services/auth'

type ProtectedRouteProps = {
  element: ReactNode
}

export function ProtectedRoute({ element }: ProtectedRouteProps) {
  const location = useLocation()

  if (!isAuthenticated()) {
    return <Navigate replace state={{ from: location.pathname }} to="/login" />
  }

  return <>{element}</>
}
