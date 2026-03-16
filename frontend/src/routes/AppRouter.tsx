import { Navigate, Route, Routes } from 'react-router-dom'
import { AdminLoginPage } from '../pages/auth/admin/AdminLoginPage'
import { LoginPage } from '../pages/auth/login/LoginPage'
import { AdminReportsPage } from '../pages/admin-reports/AdminReportsPage'
import { AdminModulePlaceholderPage } from '../pages/admin-shared/AdminModulePlaceholderPage'
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
      <Route path="/admin-page" element={<AdminLoginPage />} />
      <Route path="/admin-dashboard" element={<ProtectedRoute element={<AdminDashboardPage />} redirectTo="/admin-page" />} />
      <Route
        path="/admin-hazard-database"
        element={
          <ProtectedRoute
            element={
              <AdminModulePlaceholderPage
                activeKey="hazardDatabase"
                description="Hazard record management, incident cataloging, and structured validation tools can be added here without changing the shared admin navigation again."
                eyebrow="Admin Operations"
                title="Hazard Database"
              />
            }
            redirectTo="/admin-page"
          />
        }
      />
      <Route path="/admin-reports" element={<ProtectedRoute element={<AdminReportsPage />} redirectTo="/admin-page" />} />
      <Route
        path="/admin-disaster-map"
        element={<ProtectedRoute element={<Navigate replace to="/admin-dashboard?section=map" />} redirectTo="/admin-page" />}
      />
      <Route
        path="/admin-risk-scoring"
        element={
          <ProtectedRoute
            element={
              <AdminModulePlaceholderPage
                activeKey="riskScoring"
                description="Risk scoring dashboards, threshold models, and prioritization matrices can be implemented here while keeping the sidebar structure stable."
                eyebrow="Admin Operations"
                title="Risk Scoring"
              />
            }
            redirectTo="/admin-page"
          />
        }
      />
      <Route
        path="/admin-predictive-trends"
        element={
          <ProtectedRoute
            element={
              <AdminModulePlaceholderPage
                activeKey="predictiveTrends"
                description="Trend forecasting, seasonal risk projections, and predictive charts can be developed on this route when the analytics layer is ready."
                eyebrow="Admin Operations"
                title="Predictive Trends"
              />
            }
            redirectTo="/admin-page"
          />
        }
      />
      <Route
        path="/admin-evacuation-resources"
        element={
          <ProtectedRoute
            element={
              <AdminModulePlaceholderPage
                activeKey="evacuationResources"
                description="Evacuation center capacity, relief inventory, and deployment coordination views can be added here as a dedicated module."
                eyebrow="Admin Operations"
                title="Evacuation & Resources"
              />
            }
            redirectTo="/admin-page"
          />
        }
      />
      <Route
        path="/admin-community-portal"
        element={
          <ProtectedRoute
            element={
              <AdminModulePlaceholderPage
                activeKey="communityPortal"
                description="Community submissions, feedback moderation, and local coordination tools can be placed here behind the same admin navigation."
                eyebrow="Admin Operations"
                title="Community Portal"
              />
            }
            redirectTo="/admin-page"
          />
        }
      />
      <Route
        path="/admin-simulation"
        element={<ProtectedRoute element={<Navigate replace to="/admin-dashboard?section=simulation" />} redirectTo="/admin-page" />}
      />
      <Route path="/landing" element={<LandingPage />} />
      <Route path="/disaster-map" element={<DisasterMapPage />} />
      <Route path="/simulation" element={<SimulationPage />} />
      <Route
        path="/admin-profile-settings"
        element={<ProtectedRoute element={<ProfileSettingsPage variant="admin" />} redirectTo="/admin-page" />}
      />
      <Route
        path="/profile-settings"
        element={<ProtectedRoute element={<ProfileSettingsPage />} redirectTo="/admin-page" />}
      />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
