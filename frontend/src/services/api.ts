import axios from 'axios'
import type {
  AdminDashboardSummaryResponse,
  DashboardAccountsResponse,
  DashboardCreateAccountPayload,
  DashboardCreateAccountResponse,
  DashboardDeleteAccountResponse,
  DashboardUpdateAccountPayload,
  DashboardUpdateAccountResponse,
  AuthApiResponse,
  LoginApiPayload,
  RegisterApiPayload,
  TestApiResponse,
  VerifyOtpPayload,
} from '../types/api'

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
})

export async function getTestMessage(): Promise<TestApiResponse> {
  const { data } = await api.get<TestApiResponse>('/accounts/test/')
  return data
}

export async function registerAccount(payload: RegisterApiPayload): Promise<AuthApiResponse> {
  const { data } = await api.post<AuthApiResponse>('/accounts/auth/register/', payload)
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

export async function getAdminDashboardSummary(): Promise<AdminDashboardSummaryResponse> {
  const { data } = await api.get<AdminDashboardSummaryResponse>('/dashboard/admin/summary/')
  return data
}

export async function createDashboardAccount(payload: DashboardCreateAccountPayload): Promise<DashboardCreateAccountResponse> {
  const { data } = await api.post<DashboardCreateAccountResponse>('/dashboard/admin/accounts/create/', payload)
  return data
}

export async function getDashboardAccounts(): Promise<DashboardAccountsResponse> {
  const { data } = await api.get<DashboardAccountsResponse>('/dashboard/admin/accounts/')
  return data
}

export async function updateDashboardAccount(userId: number, payload: DashboardUpdateAccountPayload): Promise<DashboardUpdateAccountResponse> {
  const { data } = await api.put<DashboardUpdateAccountResponse>(`/dashboard/admin/accounts/${userId}/`, payload)
  return data
}

export async function deleteDashboardAccount(userId: number): Promise<DashboardDeleteAccountResponse> {
  const { data } = await api.delete<DashboardDeleteAccountResponse>(`/dashboard/admin/accounts/${userId}/`)
  return data
}
