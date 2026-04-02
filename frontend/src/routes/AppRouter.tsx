import { Navigate, Route, Routes } from 'react-router-dom'
import { LoginPage } from '../pages/auth/login/LoginPage'
import { RegisterPage } from '../pages/auth/register/RegisterPage'
import { AdminDashboardPage } from '../pages/admin-dashboard/AdminDashboardPage'
import { DisasterMapPage } from '../pages/disaster-map/DisasterMapPage'
import { LandingPage } from '../pages/landing/LandingPage'
import { ProfileSettingsPage } from '../pages/profile/ProfileSettingsPage'
import { SimulationPage } from '../pages/simulation/SimulationPage'
import { ProtectedRoute } from './ProtectedRoute'

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/admin-page" element={<Navigate replace to="/login" />} />
      <Route path="/admin-dashboard" element={<ProtectedRoute element={<AdminDashboardPage />} requireDashboardAccess redirectTo="/login" />} />
      <Route path="/admin-hazard-database" element={<ProtectedRoute element={<Navigate replace to="/admin-dashboard" />} requireDashboardAccess redirectTo="/login" />} />
      <Route path="/admin-reports" element={<ProtectedRoute element={<Navigate replace to="/admin-dashboard?section=reports" />} requireDashboardAccess redirectTo="/login" />} />
      <Route
        path="/admin-disaster-map"
        element={<ProtectedRoute element={<Navigate replace to="/admin-dashboard?section=map" />} requireDashboardAccess redirectTo="/login" />}
      />
      <Route
        path="/admin-risk-scoring"
        element={<ProtectedRoute element={<Navigate replace to="/admin-dashboard?section=scoring" />} requireDashboardAccess redirectTo="/login" />}
      />
      <Route
        path="/admin-predictive-trends"
        element={<ProtectedRoute element={<Navigate replace to="/admin-dashboard?section=trends" />} requireDashboardAccess redirectTo="/login" />}
      />
      <Route
        path="/admin-evacuation-resources"
        element={<ProtectedRoute element={<Navigate replace to="/admin-dashboard?section=resources" />} requireDashboardAccess redirectTo="/login" />}
      />
      <Route
        path="/admin-community-portal"
        element={<ProtectedRoute element={<Navigate replace to="/admin-dashboard?section=users" />} requireDashboardAccess redirectTo="/login" />}
      />
      <Route
        path="/admin-simulation"
        element={<ProtectedRoute element={<Navigate replace to="/admin-dashboard?section=simulation" />} requireDashboardAccess redirectTo="/login" />}
      />
      <Route path="/landing" element={<LandingPage />} />
      <Route path="/disaster-map" element={<DisasterMapPage />} />
      <Route path="/simulation" element={<SimulationPage />} />
      <Route
        path="/admin-profile-settings"
        element={<ProtectedRoute element={<Navigate replace to="/admin-dashboard?section=settings" />} requireDashboardAccess redirectTo="/login" />}
      />
      <Route
        path="/profile-settings"
        element={<ProtectedRoute element={<ProfileSettingsPage />} redirectTo="/login" />}
      />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
