export type AdminNavKey =
  | 'dashboardOverview'
  | 'gisMapping'
  | 'riskScoring'
  | 'predictiveTrends'
  | 'evacuationResources'
  | 'communityPortal'
  | 'simulationTool'
  | 'reportsAnalytics'
  | 'settingsAdminControls'

export type AdminNavIcon =
  | 'dashboard'
  | 'mapping'
  | 'risk'
  | 'trend'
  | 'resources'
  | 'community'
  | 'simulation'
  | 'reports'
  | 'settings'

export type AdminNavItem = {
  key: AdminNavKey
  label: string
  to: string
  icon: AdminNavIcon
}

export const adminNavItems: AdminNavItem[] = [
  { key: 'dashboardOverview', label: 'Overview', to: '/admin-dashboard', icon: 'dashboard' },
  { key: 'gisMapping', label: 'Mapping', to: '/admin-dashboard?section=map', icon: 'mapping' },
  { key: 'riskScoring', label: 'Scoring', to: '/admin-dashboard?section=scoring', icon: 'risk' },
  { key: 'predictiveTrends', label: 'Trends', to: '/admin-dashboard?section=trends', icon: 'trend' },
  { key: 'evacuationResources', label: 'Resources', to: '/admin-dashboard?section=resources', icon: 'resources' },
  { key: 'communityPortal', label: 'Users', to: '/admin-dashboard?section=users', icon: 'community' },
  { key: 'simulationTool', label: 'Simulation', to: '/admin-dashboard?section=simulation', icon: 'simulation' },
  { key: 'reportsAnalytics', label: 'Reports', to: '/admin-dashboard?section=reports', icon: 'reports' },
  { key: 'settingsAdminControls', label: 'Settings', to: '/admin-dashboard?section=settings', icon: 'settings' },
]