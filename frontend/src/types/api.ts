export type UserRole = 'admin' | 'staff' | 'citizen'

export interface TestApiResponse {
  message: string
}

export interface AuthUser {
  id?: number
  fullName: string
  email: string
  username?: string
  role?: UserRole
  isAdmin?: boolean
  isStaff?: boolean
  hasDashboardAccess?: boolean
  isActive?: boolean
  dateJoined?: string | null
  lastLogin?: string | null
}

export interface AuthApiResponse {
  message: string
  user?: AuthUser
  otpEmail?: string
  skipOtp?: boolean
}

export interface RegisterApiPayload {
  fullName: string
  email: string
  password: string
  username?: string
  phoneNumber?: string
}

export interface LoginApiPayload {
  email: string
  password: string
  forceOtp?: boolean
}

export interface VerifyOtpPayload {
  email: string
  otp: string
}

export interface PasswordResetRequestPayload {
  email: string
}

export interface PasswordResetConfirmPayload {
  email: string
  otp: string
  newPassword: string
}

export interface AdminDashboardSummary {
  totalUsers: number
  totalAdminUsers: number
  activeUsersLast30Days: number
  pendingOtps: number
  verifiedOtpsToday: number
}

export interface AdminDashboardSummaryResponse {
  summary: AdminDashboardSummary
}

export interface Barangay {
  id: string
  name: string
  city?: string
  province?: string
}

export interface BarangayRiskScoreBreakdown {
  frequency: number
  severity: number
  recency: number
}

export interface BarangayHazardProfileItem {
  id: string | null
  frequency: number
  severity_weight: number
  combined_score: number
}

export interface BarangayProfileResponse {
  total: number
  hazards: Record<string, BarangayHazardProfileItem>
  top_hazard: string | null
}

export interface BarangayScoreHistoryItem {
  date: string
  score: number
  frequency: number
  severity: number
  recency: number
}

export interface BarangayIncidentTrendItem {
  date: string
  count: number
}

export interface BarangayHazardShareItem {
  hazard: string
  frequency: number
  combined_score: number
  share: number
}

export interface BarangayRiskScoreResponse {
  barangay_id: string
  timeframe_days: number | null
  risk_score: {
    score: number
    breakdown: BarangayRiskScoreBreakdown
  }
  hazard_prediction: {
    hazard: string | null
    hazard_id: string | null
    confidence: string
    reason: string
    driver: string
    prediction_window_days: number
  }
  barangay_profile: BarangayProfileResponse
  score_history: BarangayScoreHistoryItem[]
  incident_trend: BarangayIncidentTrendItem[]
  hazard_share: BarangayHazardShareItem[]
}

export interface HazardInsightResponse {
  hazard: string
  timeframe: {
    rolling_days: number | null
    start_date: string | null
    end_date: string | null
  }
  raw_stats: Record<string, unknown>
  ai_insight: string
}

export interface DashboardCreateAccountPayload {
  fullName: string
  email: string
  username?: string
  password: string
  role: UserRole
}

export interface DashboardCreateAccountResponse {
  message: string
  user: AuthUser
}

export interface DashboardAccountsResponse {
  users: AuthUser[]
}

export interface DashboardUpdateAccountPayload {
  fullName: string
  email: string
  username: string
  password?: string
  role: UserRole
  isActive: boolean
}

export interface DashboardUpdateAccountResponse {
  message: string
  user: AuthUser
}

export interface DashboardDeleteAccountResponse {
  message: string
}

export interface CreateEvacuationCenterPayload {
  name: string
  latitude: number
  longitude: number
  address: string
  barangay_id?: string
}

export interface EvacuationCenter {
  id: string
  name: string
  latitude: number
  longitude: number
  address: string
  barangay?: {
    id: string
    name: string
  } | null
}

export interface SimulationProgressPayload {
  courseProgress: Record<string, number>
  completedLessonVideos: Record<string, boolean>
  completedCourses: Record<string, string>
}

export interface SimulationProgressResponse extends SimulationProgressPayload {
  updatedAt?: string | null
}

export interface SimulationAdminCourseMetrics {
  trainees: number
  completed: number
  completionRate: number
}

export interface SimulationAdminMetricsResponse {
  courses: Record<string, SimulationAdminCourseMetrics>
}
