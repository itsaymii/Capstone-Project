import axios from 'axios'
import type {
  AuthApiResponse,
  LoginApiPayload,
  RegisterApiPayload,
  TestApiResponse,
  VerifyOtpPayload,
} from '../types/api'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
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
