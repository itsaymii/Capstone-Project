import axios from 'axios'
import type {
  AdminDashboardSummaryResponse,
  Barangay,
  BarangayRiskScoreResponse,
  HazardInsightResponse,
  DashboardAccountsResponse,
  DashboardCreateAccountPayload,
  DashboardCreateAccountResponse,
  DashboardDeleteAccountResponse,
  DashboardResidencyVerificationResponse,
  DashboardUpdateAccountPayload,
  DashboardUpdateAccountResponse,
  SimulationAdminMetricsResponse,
  SimulationCourseCatalogResponse,
  SimulationAdminQuizDetailResponse,
  SimulationAdminQuizMutationResponse,
  SimulationQuizSubmitResponse,
  SimulationLearnerQuizDetailResponse,
  SimulationProgressPayload,
  SimulationProgressResponse,
  AuthApiResponse,
  LoginApiPayload,
  PasswordResetConfirmPayload,
  PasswordResetRequestPayload,
  RegisterApiPayload,
  TestApiResponse,
  VerifyOtpPayload,
  UserProfileUpdatePayload,
  CreateEvacuationCenterPayload,
  EvacuationCenter,
} from '../types/api'

function getApiErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const errorData = error.response?.data as
      | { error?: string; message?: string; detail?: string }
      | string
      | undefined

    if (typeof errorData === 'string' && errorData.trim()) {
      return errorData.trim()
    }

    if (typeof errorData === 'object' && errorData) {
      return errorData.error || errorData.message || errorData.detail || fallback
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  return fallback
}

function getDefaultApiBaseUrl(): string {
  if (typeof window === 'undefined') {
    return 'http://localhost:8000'
  }

  const hostname = window.location.hostname === '127.0.0.1' ? '127.0.0.1' : 'localhost'
  return `${window.location.protocol}//${hostname}:8000`
}

function normalizeApiBaseUrl(rawBaseUrl?: string): string {
  const trimmedBaseUrl = rawBaseUrl?.trim()
  if (!trimmedBaseUrl) {
    return getDefaultApiBaseUrl()
  }

  if (typeof window === 'undefined') {
    return trimmedBaseUrl
  }

  try {
    const parsedUrl = new URL(trimmedBaseUrl)
    const currentHost = window.location.hostname
    const isLocalBrowserHost = currentHost === 'localhost' || currentHost === '127.0.0.1'
    const isLocalApiHost = parsedUrl.hostname === 'localhost' || parsedUrl.hostname === '127.0.0.1'

    if (isLocalBrowserHost && isLocalApiHost) {
      parsedUrl.hostname = currentHost
      return parsedUrl.toString().replace(/\/$/, '')
    }

    return trimmedBaseUrl
  } catch {
    return trimmedBaseUrl
  }
}

const apiBaseUrl = normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL)

const api = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: true,
  xsrfCookieName: 'csrftoken',
  xsrfHeaderName: 'X-CSRFToken',
})

function getCookieValue(cookieName: string): string | null {
  if (typeof document === 'undefined') {
    return null
  }

  const cookieMatch = document.cookie
    .split('; ')
    .find((entry) => entry.startsWith(`${cookieName}=`))

  if (!cookieMatch) {
    return null
  }

  return decodeURIComponent(cookieMatch.split('=').slice(1).join('='))
}

function addCsrfHeader(headers: unknown, csrfToken: string): unknown {
  if (!headers || typeof headers !== 'object') {
    return { 'X-CSRFToken': csrfToken }
  }

  if ('set' in headers && typeof (headers as any).set === 'function') {
    ;(headers as any).set('X-CSRFToken', csrfToken)
    return headers
  }

  return {
    ...(headers as Record<string, unknown>),
    'X-CSRFToken': csrfToken,
  }
}

api.interceptors.request.use((config) => {
  const requestMethod = config.method?.toUpperCase()
  const isSafeMethod = requestMethod === 'GET' || requestMethod === 'HEAD' || requestMethod === 'OPTIONS'

  if (!isSafeMethod) {
    const csrfToken = getCookieValue('csrftoken')
    if (csrfToken) {
      config.headers = addCsrfHeader(config.headers, csrfToken) as any
    }
  }

  return config
})

let csrfBootstrapPromise: Promise<void> | null = null

export async function ensureCsrfCookie(): Promise<void> {
  if (!csrfBootstrapPromise) {
    csrfBootstrapPromise = api
      .get('/accounts/auth/csrf/')
      .then(() => undefined)
      .finally(() => {
        csrfBootstrapPromise = null
      })
  }

  return csrfBootstrapPromise
}

export async function getTestMessage(): Promise<TestApiResponse> {
  const { data } = await api.get<TestApiResponse>('/accounts/test/')
  return data
}

export async function registerAccount(payload: RegisterApiPayload): Promise<AuthApiResponse> {
  const formData = new FormData()
  formData.append('fullName', payload.fullName)
  formData.append('email', payload.email)
  formData.append('password', payload.password)
  if (payload.username) formData.append('username', payload.username)
  if (payload.phoneNumber) formData.append('phoneNumber', payload.phoneNumber)
  formData.append('barangayId', payload.barangayId)
  formData.append('residentialAddress', payload.residentialAddress)
  formData.append('residentConfirmation', String(payload.residentConfirmation))
  formData.append('residencyProof', payload.residencyProof)
  const { data } = await api.post<AuthApiResponse>('/accounts/auth/register/', formData)
  return data
}

export async function verifyRegisterOtp(payload: VerifyOtpPayload): Promise<AuthApiResponse> {
  const { data } = await api.post<AuthApiResponse>('/accounts/auth/register/verify-otp/', payload)
  return data
}

export async function loginAccount(payload: LoginApiPayload): Promise<AuthApiResponse> {
  const { data } = await api.post<AuthApiResponse>('/accounts/auth/login/', payload)
  return data
}

export async function verifyLoginOtp(payload: VerifyOtpPayload): Promise<AuthApiResponse> {
  const { data } = await api.post<AuthApiResponse>('/accounts/auth/login/verify-otp/', payload)
  return data
}

export async function getCurrentUserProfile(): Promise<AuthApiResponse> {
  const { data } = await api.get<AuthApiResponse>('/accounts/auth/profile/')
  return data
}

export async function updateCurrentUserProfile(payload: UserProfileUpdatePayload): Promise<AuthApiResponse> {
  const { data } = await api.patch<AuthApiResponse>('/accounts/auth/profile/', payload)
  return data
}

export async function requestPasswordReset(payload: PasswordResetRequestPayload): Promise<AuthApiResponse> {
  const { data } = await api.post<AuthApiResponse>('/accounts/auth/password-reset/', payload)
  return data
}

export async function confirmPasswordReset(payload: PasswordResetConfirmPayload): Promise<AuthApiResponse> {
  const { data } = await api.post<AuthApiResponse>('/accounts/auth/password-reset/confirm/', payload)
  return data
}

export async function getAdminDashboardSummary(): Promise<AdminDashboardSummaryResponse> {
  const { data } = await api.get<AdminDashboardSummaryResponse>('/dashboard/admin/summary/')
  return data
}

export async function createDashboardAccount(payload: DashboardCreateAccountPayload): Promise<DashboardCreateAccountResponse> {
  await ensureCsrfCookie()
  const { data } = await api.post<DashboardCreateAccountResponse>('/dashboard/admin/accounts/create/', payload)
  return data
}

export async function createEvacuationCenter(payload: CreateEvacuationCenterPayload): Promise<void> {
  await ensureCsrfCookie()
  await api.post('/api/resources/evacuation-centers/', payload)
}

export async function createEvacuationCenters(payload: CreateEvacuationCenterPayload[]): Promise<void> {
  await ensureCsrfCookie()
  await Promise.all(payload.map((item) => api.post('/api/resources/evacuation-centers/', item)))
}

interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export async function getEvacuationCenters(): Promise<EvacuationCenter[]> {
  const response = await api.get<EvacuationCenter[] | PaginatedResponse<EvacuationCenter>>(
    '/api/resources/evacuation-centers/',
  )

  if (Array.isArray(response.data)) {
    return response.data
  }

  if (response.data && Array.isArray((response.data as PaginatedResponse<EvacuationCenter>).results)) {
    return (response.data as PaginatedResponse<EvacuationCenter>).results
  }

  return []
}

export async function getDashboardAccounts(): Promise<DashboardAccountsResponse> {
  const { data } = await api.get<DashboardAccountsResponse>('/dashboard/admin/accounts/')
  return data
}

export async function getBarangays(): Promise<Barangay[]> {
  const response = await api.get<Barangay[] | PaginatedResponse<Barangay>>('/api/locations/barangays/')

  if (Array.isArray(response.data)) {
    return response.data
  }

  return (response.data as PaginatedResponse<Barangay>).results || []
}

export async function getBarangayRiskScore(
  barangayId: string,
  options?: {
    days?: number
    startDate?: string
    endDate?: string
    year?: number
    month?: number
    compareYear?: number
    compareMonth?: number
  },
): Promise<BarangayRiskScoreResponse> {
  const params = new URLSearchParams()
  params.append('barangay_id', barangayId)

  if (options?.days !== undefined) {
    params.append('days', String(options.days))
  }

  if (options?.startDate) {
    params.append('start_date', options.startDate)
  }

  if (options?.endDate) {
    params.append('end_date', options.endDate)
  }

  if (options?.year !== undefined) {
    params.append('year', String(options.year))
  }

  if (options?.month !== undefined) {
    params.append('month', String(options.month))
  }

  if (options?.compareYear !== undefined) {
    params.append('compare_year', String(options.compareYear))
  }

  if (options?.compareMonth !== undefined) {
    params.append('compare_month', String(options.compareMonth))
  }

  const { data } = await api.get<BarangayRiskScoreResponse>('/api/analytics/barangay-risk/', {
    params,
  })
  return data
}

export async function getHazardInsights(
  hazard: string,
  options?: { days?: number; startDate?: string; endDate?: string },
): Promise<HazardInsightResponse> {
  const params = new URLSearchParams()
  params.append('hazard', hazard)

  if (options?.days !== undefined) {
    params.append('days', String(options.days))
  }

  if (options?.startDate) {
    params.append('start_date', options.startDate)
  }

  if (options?.endDate) {
    params.append('end_date', options.endDate)
  }

  const { data } = await api.get<HazardInsightResponse>('/api/analytics/hazard-insights/', {
    params,
  })
  return data
}

export async function updateDashboardAccount(userId: number, payload: DashboardUpdateAccountPayload): Promise<DashboardUpdateAccountResponse> {
  await ensureCsrfCookie()
  const { data } = await api.put<DashboardUpdateAccountResponse>(`/dashboard/admin/accounts/${userId}/`, payload)
  return data
}

export async function deleteDashboardAccount(userId: number): Promise<DashboardDeleteAccountResponse> {
  await ensureCsrfCookie()
  const { data } = await api.delete<DashboardDeleteAccountResponse>(`/dashboard/admin/accounts/${userId}/`)
  return data
}

export async function updateDashboardResidencyVerification(
  userId: number,
  payload: { status: 'verified' | 'rejected'; rejectionReason?: string },
): Promise<DashboardResidencyVerificationResponse> {
  await ensureCsrfCookie()
  const { data } = await api.patch<DashboardResidencyVerificationResponse>(
    `/dashboard/admin/accounts/${userId}/residency-verification/`,
    payload,
  )
  return data
}

export async function getSimulationProgress(): Promise<SimulationProgressResponse> {
  const { data } = await api.get<SimulationProgressResponse>('/dashboard/simulation/progress/')
  return data
}

export async function saveSimulationProgress(payload: SimulationProgressPayload): Promise<SimulationProgressResponse> {
  const { data } = await api.put<SimulationProgressResponse>('/dashboard/simulation/progress/', payload)
  return data
}

export async function getSimulationAdminMetrics(): Promise<SimulationAdminMetricsResponse> {
  try {
    const { data } = await api.get<SimulationAdminMetricsResponse>('/dashboard/admin/simulation/metrics/')
    return data
  } catch (error) {
    throw new Error(getApiErrorMessage(error, 'Unable to load simulation metrics.'))
  }
}

export async function getSimulationCoursesCatalog(): Promise<SimulationCourseCatalogResponse> {
  const { data } = await api.get<SimulationCourseCatalogResponse>('/dashboard/simulation/courses/')
  return data
}

export async function syncSimulationCoursesCatalog(courses: SimulationCourseCatalogResponse['courses']): Promise<SimulationCourseCatalogResponse> {
  await ensureCsrfCookie()
  const { data } = await api.put<SimulationCourseCatalogResponse>('/dashboard/admin/simulation/courses/sync/', {
    courses,
  })
  return data
}

export async function getAdminSimulationQuiz(courseId: string, lessonId: string): Promise<SimulationAdminQuizDetailResponse> {
  const params = new URLSearchParams()
  params.append('course_id', courseId)
  params.append('lesson_id', lessonId)
  try {
    const { data } = await api.get<SimulationAdminQuizDetailResponse>('/dashboard/admin/simulation/quizzes/module/', {
      params,
    })
    return data
  } catch (error) {
    throw new Error(getApiErrorMessage(error, 'Unable to load quiz details.'))
  }
}

export async function uploadAdminSimulationQuizPdf(payload: {
  courseId: string
  lessonId: string
  lessonTitle?: string
  title?: string
  passingScore?: number
  pdf: File
}): Promise<SimulationAdminQuizMutationResponse> {
  await ensureCsrfCookie()
  const formData = new FormData()
  formData.append('courseId', payload.courseId)
  formData.append('lessonId', payload.lessonId)
  if (payload.lessonTitle) formData.append('lessonTitle', payload.lessonTitle)
  if (payload.title) formData.append('title', payload.title)
  if (payload.passingScore !== undefined) formData.append('passingScore', String(payload.passingScore))
  formData.append('pdf', payload.pdf)

  try {
    const { data } = await api.post<SimulationAdminQuizMutationResponse>(
      '/dashboard/admin/simulation/quizzes/upload-pdf/',
      formData,
    )
    return data
  } catch (error) {
    throw new Error(getApiErrorMessage(error, 'Failed to parse uploaded PDF.'))
  }
}

export async function updateAdminSimulationQuiz(
  quizId: number,
  payload: {
    title: string
    lessonTitle?: string
    passingScore: number
    questions: Array<{
      prompt: string
      options: string[]
      correctOptionIndex: number
      explanation: string
    }>
  },
): Promise<SimulationAdminQuizMutationResponse> {
  await ensureCsrfCookie()
  try {
    const { data } = await api.put<SimulationAdminQuizMutationResponse>(`/dashboard/admin/simulation/quizzes/${quizId}/`, payload)
    return data
  } catch (error) {
    throw new Error(getApiErrorMessage(error, 'Unable to save quiz draft.'))
  }
}

export async function publishAdminSimulationQuiz(quizId: number): Promise<SimulationAdminQuizMutationResponse> {
  await ensureCsrfCookie()
  try {
    const { data } = await api.post<SimulationAdminQuizMutationResponse>(`/dashboard/admin/simulation/quizzes/${quizId}/publish/`)
    return data
  } catch (error) {
    throw new Error(getApiErrorMessage(error, 'Failed to publish quiz.'))
  }
}

export async function getSimulationModuleQuiz(courseId: string, lessonId: string): Promise<SimulationLearnerQuizDetailResponse> {
  const params = new URLSearchParams()
  params.append('course_id', courseId)
  params.append('lesson_id', lessonId)
  const { data } = await api.get<SimulationLearnerQuizDetailResponse>('/dashboard/simulation/quizzes/module/', {
    params,
  })
  return data
}

export async function submitSimulationQuizAttempt(
  quizId: number,
  answers: Record<string, number>,
): Promise<SimulationQuizSubmitResponse> {
  await ensureCsrfCookie()
  const { data } = await api.post<SimulationQuizSubmitResponse>(`/dashboard/simulation/quizzes/${quizId}/submit/`, {
    answers,
  })
  return data
}
