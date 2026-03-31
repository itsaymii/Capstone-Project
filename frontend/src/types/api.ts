export interface TestApiResponse {
  message: string
}

export interface AuthUser {
  id?: number
  fullName: string
  email: string
  username?: string
  isAdmin?: boolean
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
}

export interface LoginApiPayload {
  email: string
  password: string
  forceOtp?: boolean
  loginContext?: 'admin' | 'citizen'
}

export interface VerifyOtpPayload {
  email: string
  otp: string
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

export interface DashboardCreateAccountPayload {
  fullName: string
  email: string
  username?: string
  password: string
  isAdmin: boolean
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
  isAdmin: boolean
  isActive: boolean
}

export interface DashboardUpdateAccountResponse {
  message: string
  user: AuthUser
}

export interface DashboardDeleteAccountResponse {
  message: string
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
