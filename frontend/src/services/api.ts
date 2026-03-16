import axios from 'axios'
import type {
  AdminDashboardSummaryResponse,
  DashboardCreateAccountPayload,
  DashboardCreateAccountResponse,
  AuthApiResponse,
  LoginApiPayload,
  RegisterApiPayload,
  TestApiResponse,
  VerifyOtpPayload,
} from '../types/api'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim() || 'http://127.0.0.1:8000'

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
