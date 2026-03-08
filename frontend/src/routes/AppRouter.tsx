import { Navigate, Route, Routes } from 'react-router-dom'

import { AdminLoginPage } from '../pages/auth/admin/AdminLoginPage'
import { LoginPage } from '../pages/auth/login/LoginPage'
import { RegisterPage } from '../pages/auth/register/RegisterPage'
import { DisasterMapPage } from '../pages/disaster-map/DisasterMapPage'
import { LandingPage } from '../pages/landing/LandingPage'
import { ProfileSettingsPage } from '../pages/profile/ProfileSettingsPage'
import { ReportIncidentPage } from '../pages/report-incident/ReportIncidentPage'
import { SimulationPage } from '../pages/simulation/SimulationPage'
import { ProtectedRoute } from './ProtectedRoute'

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/admin-page" element={<AdminLoginPage />} />
      <Route path="/landing" element={<LandingPage />} />
      <Route
        path="/disaster-map"
        element={
          <ProtectedRoute>
            <DisasterMapPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/simulation"
        element={
          <ProtectedRoute>
            <SimulationPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/report-incident"
        element={
          <ProtectedRoute>
            <ReportIncidentPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile-settings"
        element={
          <ProtectedRoute>
            <ProfileSettingsPage />
          </ProtectedRoute>
        }
      />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
