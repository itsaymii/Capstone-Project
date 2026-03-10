import axios from 'axios'
import { loginAccount, registerAccount, verifyLoginOtp, verifyRegisterOtp } from './api'

type RegisterPayload = {
  fullName: string
  email: string
  password: string
}

type LoginPayload = {
  email: string
  password: string
  keepLoggedIn: boolean
}

type SessionUser = {
  fullName: string
  email: string
}

type AuthResult = {
  success: boolean
  error?: string
  message?: string
  retryAfterSeconds?: number
}

const AUTH_KEY = 'drms-auth'
const SESSION_USER_KEY = 'drms-session-user'
export const AUTH_CHANGED_EVENT = 'drms-auth-changed'

const DEV_AUTH_BYPASS_ENABLED = import.meta.env.DEV && import.meta.env.VITE_DEV_AUTH_BYPASS === 'true'
const DEV_AUTH_BYPASS_NAME = import.meta.env.VITE_DEV_AUTH_BYPASS_NAME?.trim() || 'Developer Mode User'
const DEV_AUTH_BYPASS_EMAIL =
  import.meta.env.VITE_DEV_AUTH_BYPASS_EMAIL?.trim().toLowerCase() || 'developer@local.test'

function emitAuthChanged(): void {
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT))
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function parseApiError(
  error: unknown,
  fallback: string,
): {
  message: string
  retryAfterSeconds?: number
} {
  if (axios.isAxiosError(error)) {
    const errorData = error.response?.data as { error?: string; retryAfterSeconds?: number } | undefined
    const apiError = errorData?.error
    if (apiError) {
      return {
        message: apiError,
        retryAfterSeconds: errorData?.retryAfterSeconds,
      }
    }
  }

  return { message: fallback }
}

function writeSessionUser(targetStore: Storage, user: SessionUser): void {
  targetStore.setItem(SESSION_USER_KEY, JSON.stringify(user))
}

function clearSessionUser(targetStore: Storage): void {
  targetStore.removeItem(SESSION_USER_KEY)
}

function getActiveAuthStore(): Storage | null {
  if (sessionStorage.getItem(AUTH_KEY) === 'true') {
    return sessionStorage
  }

  if (localStorage.getItem(AUTH_KEY) === 'true') {
    return localStorage
  }

  if (sessionStorage.getItem(SESSION_USER_KEY)) {
    return sessionStorage
  }

  if (localStorage.getItem(SESSION_USER_KEY)) {
    return localStorage
  }

  return null
}

export async function registerUser(payload: RegisterPayload): Promise<AuthResult> {
  const requested = await requestRegisterOtp(payload)
  if (!requested.success) {
    return requested
  }

  return {
    success: false,
    error: 'OTP verification is required to complete registration.',
  }
}

export async function requestRegisterOtp(payload: RegisterPayload): Promise<AuthResult> {
  const fullName = payload.fullName.trim()
  const email = normalizeEmail(payload.email)
  const password = payload.password

  if (!fullName || !email || !password) {
    return { success: false, error: 'Please fill in all required fields.' }
  }

  try {
    const response = await registerAccount({ fullName, email, password })
    return {
      success: true,
      message: response.message,
    }
  } catch (error) {
    const parsedError = parseApiError(error, 'Unable to register right now.')
    return {
      success: false,
      error: parsedError.message,
      retryAfterSeconds: parsedError.retryAfterSeconds,
    }
  }
}

export async function verifyRegisterOtpCode(email: string, otp: string): Promise<AuthResult> {
  const normalizedEmail = normalizeEmail(email)
  const trimmedOtp = otp.trim()

  if (!normalizedEmail || !trimmedOtp) {
    return { success: false, error: 'Email and OTP are required.' }
  }

  try {
    const response = await verifyRegisterOtp({ email: normalizedEmail, otp: trimmedOtp })
    return {
      success: true,
      message: response.message,
    }
  } catch (error) {
    const parsedError = parseApiError(error, 'Unable to verify OTP right now.')
    return {
      success: false,
      error: parsedError.message,
    }
  }
}

export async function loginUser(payload: LoginPayload): Promise<AuthResult> {
  const requested = await requestLoginOtp(payload.email, payload.password)
  if (!requested.success) {
    return requested
  }

  return {
    success: false,
    error: 'OTP verification is required to continue login.',
  }
}

export async function requestLoginOtp(email: string, password: string): Promise<AuthResult> {
  const normalizedEmail = normalizeEmail(email)

  if (!normalizedEmail || !password) {
    return { success: false, error: 'Please enter your email and password.' }
  }

  try {
    const response = await loginAccount({ email: normalizedEmail, password })
    return {
      success: true,
      message: response.message,
    }
  } catch (error) {
    const parsedError = parseApiError(error, 'Invalid email or password.')
    return {
      success: false,
      error: parsedError.message,
      retryAfterSeconds: parsedError.retryAfterSeconds,
    }
  }
}

export async function verifyLoginOtpCode(payload: {
  email: string
  otp: string
  keepLoggedIn: boolean
}): Promise<AuthResult> {
  const normalizedEmail = normalizeEmail(payload.email)
  const trimmedOtp = payload.otp.trim()

  if (!normalizedEmail || !trimmedOtp) {
    return { success: false, error: 'Email and OTP are required.' }
  }

  try {
    const response = await verifyLoginOtp({ email: normalizedEmail, otp: trimmedOtp })

    const sessionStore = payload.keepLoggedIn ? localStorage : sessionStorage
    const oppositeStore = payload.keepLoggedIn ? sessionStorage : localStorage

    sessionStore.setItem(AUTH_KEY, 'true')
    writeSessionUser(sessionStore, {
      fullName: response.user.fullName,
      email: response.user.email,
    })

    oppositeStore.removeItem(AUTH_KEY)
    clearSessionUser(oppositeStore)

    emitAuthChanged()

    return { success: true }
  } catch (error) {
    const parsedError = parseApiError(error, 'Unable to verify OTP.')
    return {
      success: false,
      error: parsedError.message,
    }
  }
}

export function isAuthenticated(): boolean {
  if (DEV_AUTH_BYPASS_ENABLED) {
    return true
  }

  return localStorage.getItem(AUTH_KEY) === 'true' || sessionStorage.getItem(AUTH_KEY) === 'true'
}

export function getCurrentUserDisplayName(): string | null {
  try {
    const profile = getCurrentUserProfile()
    if (!profile) {
      return null
    }

    const firstName = profile.fullName.trim().split(/\s+/)[0]
    return firstName || profile.fullName
  } catch {
    return null
  }
}

export function getCurrentUserProfile(): SessionUser | null {
  try {
    const activeStore = getActiveAuthStore()
    if (!activeStore) {
      if (DEV_AUTH_BYPASS_ENABLED) {
        return {
          fullName: DEV_AUTH_BYPASS_NAME,
          email: DEV_AUTH_BYPASS_EMAIL,
        }
      }

      return null
    }

    const raw = activeStore.getItem(SESSION_USER_KEY)
    if (!raw) {
      return null
    }

    return JSON.parse(raw) as SessionUser
  } catch {
    return null
  }
}

export function updateCurrentUserProfile(fullName: string): boolean {
  const normalizedName = fullName.trim()
  if (!normalizedName) {
    return false
  }

  const activeStore = getActiveAuthStore()
  if (!activeStore) {
    if (DEV_AUTH_BYPASS_ENABLED) {
      writeSessionUser(sessionStorage, {
        fullName: normalizedName,
        email: DEV_AUTH_BYPASS_EMAIL,
      })
      emitAuthChanged()
      return true
    }

    return false
  }

  const existingProfile = getCurrentUserProfile()
  if (!existingProfile) {
    return false
  }

  writeSessionUser(activeStore, {
    ...existingProfile,
    fullName: normalizedName,
  })

  emitAuthChanged()
  return true
}

export function logoutUser(): void {
  localStorage.removeItem(AUTH_KEY)
  clearSessionUser(localStorage)
  sessionStorage.removeItem(AUTH_KEY)
  clearSessionUser(sessionStorage)
  emitAuthChanged()
}
