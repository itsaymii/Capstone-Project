export type AdminNavKey =
  | 'dashboardOverview'
  | 'hazardDatabase'
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
  | 'database'
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
  { key: 'hazardDatabase', label: 'Database', to: '/admin-hazard-database', icon: 'database' },
  { key: 'gisMapping', label: 'Mapping', to: '/admin-dashboard?section=map', icon: 'mapping' },
  { key: 'riskScoring', label: 'Scoring', to: '/admin-risk-scoring', icon: 'risk' },
  { key: 'predictiveTrends', label: 'Trends', to: '/admin-predictive-trends', icon: 'trend' },
  { key: 'evacuationResources', label: 'Resources', to: '/admin-evacuation-resources', icon: 'resources' },
  { key: 'communityPortal', label: 'Portal', to: '/admin-community-portal', icon: 'community' },
  { key: 'simulationTool', label: 'Simulation', to: '/admin-dashboard?section=simulation', icon: 'simulation' },
  { key: 'reportsAnalytics', label: 'Reports', to: '/admin-reports', icon: 'reports' },
  { key: 'settingsAdminControls', label: 'Settings', to: '/admin-profile-settings', icon: 'settings' },
]