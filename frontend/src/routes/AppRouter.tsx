import { Navigate, Route, Routes } from 'react-router-dom'

// ✅ Public/Auth pages (named exports - OK)
import { LoginPage } from '../pages/auth/login/LoginPage'
import { RegisterPage } from '../pages/auth/register/RegisterPage'
import { AdminDashboardPage } from '../pages/admin-dashboard/AdminDashboardPage'
import { DisasterMapPage } from '../pages/disaster-map/DisasterMapPage'
import { EmergencyHotlinesPage } from '../pages/emergency-hotlines/EmergencyHotlinesPage'
import { LandingPage } from '../pages/landing/LandingPage'
import { SimulationPage } from '../pages/simulation/SimulationPage'

// ✅ Responder pages (default exports - use default import)
import ResponderDashboardPage from '../pages/responder/ResponderDashboardPage'
import ResponderIncidentsPage from '../pages/responder/ResponderIncidentsPage'
import ResponderReportsPage from '../pages/responder/ResponderReportsPage'
import CreateReport from '../pages/responder/CreateReport'
import ProfileSettingsPage from '../pages/responder/ProfileSettings'

import { ProtectedRoute } from './ProtectedRoute'


export function AppRouter() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/landing" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Admin Routes */}
      <Route path="/admin-page" element={<Navigate replace to="/login" />} />
      <Route path="/admin-dashboard" element={<ProtectedRoute element={<AdminDashboardPage />} requiredRole="admin" requireDashboardAccess redirectTo="/login" />} />
      <Route path="/admin-hazard-database" element={<ProtectedRoute element={<Navigate replace to="/admin-dashboard" />} requiredRole="admin" requireDashboardAccess redirectTo="/login" />} />
      <Route path="/admin-reports" element={<ProtectedRoute element={<Navigate replace to="/admin-dashboard?section=reports" />} requiredRole="admin" requireDashboardAccess redirectTo="/login" />} />
      <Route path="/admin-disaster-map" element={<ProtectedRoute element={<Navigate replace to="/admin-dashboard?section=map" />} requiredRole="admin" requireDashboardAccess redirectTo="/login" />} />
      <Route path="/admin-risk-scoring" element={<ProtectedRoute element={<Navigate replace to="/admin-dashboard?section=scoring" />} requiredRole="admin" requireDashboardAccess redirectTo="/login" />} />
      <Route path="/admin-predictive-trends" element={<ProtectedRoute element={<Navigate replace to="/admin-dashboard?section=trends" />} requiredRole="admin" requireDashboardAccess redirectTo="/login" />} />
      <Route path="/admin-evacuation-resources" element={<ProtectedRoute element={<Navigate replace to="/admin-dashboard?section=resources" />} requiredRole="admin" requireDashboardAccess redirectTo="/login" />} />
      <Route path="/admin-community-portal" element={<ProtectedRoute element={<Navigate replace to="/admin-dashboard?section=users" />} requiredRole="admin" requireDashboardAccess redirectTo="/login" />} />
      <Route path="/admin-simulation" element={<ProtectedRoute element={<Navigate replace to="/admin-dashboard?section=simulation" />} requiredRole="admin" requireDashboardAccess redirectTo="/login" />} />
      <Route path="/admin-profile-settings" element={<ProtectedRoute element={<Navigate replace to="/admin-dashboard?section=settings" />} requiredRole="admin" requireDashboardAccess redirectTo="/login" />} />

      {/* Responder Routes */}
      <Route path="/responder-dashboard" element={<ProtectedRoute element={<ResponderDashboardPage />} requiredRole="staff" requireDashboardAccess redirectTo="/login" />} />
      <Route path="/responder-incidents" element={<ProtectedRoute element={<ResponderIncidentsPage />} requiredRole="staff" requireDashboardAccess redirectTo="/login" />} />
      <Route path="/responder-reports" element={<ProtectedRoute element={<ResponderReportsPage />} requiredRole="staff" requireDashboardAccess redirectTo="/login" />} />
      
      {/* ✅ FIXED: CreateReport now uses default import */}
      <Route path="/create-report" element={
        <ProtectedRoute 
          element={<CreateReport />} 
          requiredRole="staff" 
          requireDashboardAccess 
          redirectTo="/login" 
        />
      } />
      
      <Route path="/responder-profile-settings" element={<ProtectedRoute element={<ProfileSettingsPage />} requiredRole="staff" requireDashboardAccess redirectTo="/login" />} />
      <Route path="/profile-settings" element={<ProtectedRoute element={<ProfileSettingsPage />} requiredRole="staff" requireDashboardAccess redirectTo="/login" />} />

      {/* Shared / Feature Routes */}
      <Route path="/disaster-map" element={<DisasterMapPage />} />
      <Route path="/emergency-hotlines" element={<EmergencyHotlinesPage />} />
      <Route path="/simulation" element={<SimulationPage />} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}