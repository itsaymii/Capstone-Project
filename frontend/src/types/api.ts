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
  phoneNumber?: string
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

export interface UserProfileUpdatePayload {
  fullName?: string
  phoneNumber?: string
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

export interface IncidentTrendPeriod {
  year: number
  month: number | null
  start_date: string
  end_date: string
  total: number
  daily_reports: BarangayIncidentTrendItem[]
}

export interface IncidentTrendComparison {
  current_period: IncidentTrendPeriod
  comparison_period: IncidentTrendPeriod
  trend: {
    percent_change: number | null
    direction: 'increase' | 'decrease' | 'flat'
    current_total: number
    previous_total: number
  }
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
  daily_incident_reports: BarangayIncidentTrendItem[]
  incident_trend_comparison: IncidentTrendComparison
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

export interface SimulationCourseCatalogResponse {
  courses: Array<{
    id: string
    title: string
    tag: string
    difficulty: 'Beginner' | 'Intermediate' | 'Advanced'
    duration: string
    description: string
    audience: string
    objectives: string[]
    prerequisites: string[]
    accent: string
    heroImageUrl: string
    heroImageName?: string
    lessonOutline: Array<{
      id: string
      lessonType: 'video' | 'lesson' | 'exam'
      title: string
      duration: string
      videoUrl: string
      videoFileName?: string
      summary: string
      points: string[]
      content: string
      examQuestions: Array<{
        id: string
        prompt: string
        options: string[]
        correctOptionIndex: number
        explanation: string
      }>
      passingScore: number
    }>
    learningMaterials: Array<{
      id: string
      title: string
      type: 'PDF' | 'Guide' | 'Checklist' | 'Worksheet' | 'External Link'
      url: string
      fileName?: string
      mimeType?: string
      description: string
    }>
  }>
}

export interface SimulationAdminQuizQuestion {
  id: number
  order: number
  prompt: string
  explanation: string
  options: string[]
  correctOptionIndex: number
}

export interface SimulationAdminQuiz {
  id: number
  courseId: string
  lessonId: string
  lessonTitle: string
  title: string
  status: 'draft' | 'published' | 'archived'
  version: number
  passingScore: number
  sourcePdfName: string
  parseConfidence: number
  parseNotes: string
  updatedAt?: string | null
  questions: SimulationAdminQuizQuestion[]
}

export interface SimulationAdminQuizDetailResponse {
  quiz: SimulationAdminQuiz | null
}

export interface SimulationAdminQuizMutationResponse {
  quiz: SimulationAdminQuiz
}

export interface SimulationLearnerQuizOption {
  id: number
  order: number
  text: string
}

export interface SimulationLearnerQuizQuestion {
  id: number
  order: number
  prompt: string
  options: SimulationLearnerQuizOption[]
}

export interface SimulationLearnerQuiz {
  id: number
  courseId: string
  lessonId: string
  lessonTitle: string
  title: string
  version: number
  passingScore: number
  questions: SimulationLearnerQuizQuestion[]
}

export interface SimulationLearnerQuizDetailResponse {
  quiz: SimulationLearnerQuiz | null
  latestAttempt: {
    score: number
    totalQuestions: number
    passed: boolean
    unanswered: number
    attemptedAt?: string | null
  } | null
}

export interface SimulationQuizSubmitResponse {
  score: number
  totalQuestions: number
  passed: boolean
  unanswered: number
  requiredScore: number
  details: Array<{
    questionId: number
    selectedChoiceId: number | null
    correctChoiceId: number | null
    isCorrect: boolean
    explanation: string
  }>
}
