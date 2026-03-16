export interface TestApiResponse {
  message: string
}

export interface AuthUser {
  fullName: string
  email: string
  isAdmin?: boolean
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
