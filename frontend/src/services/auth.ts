import axios from 'axios'
import { loginAccount, registerAccount, verifyLoginOtp, verifyRegisterOtp } from './api'
import { addNotification } from './notifications'

type RegisterPayload = {
  fullName: string
  email: string
  username?: string
  password: string
}

type LoginPayload = {
  email: string
  password: string
  keepLoggedIn: boolean
}

type LoginContext = 'admin' | 'citizen'

type SessionUser = {
  fullName: string
  email: string
  photoUrl?: string
  phoneNumber?: string
  birthDate?: string
  gender?: string
  address?: string
  addressLine1?: string
  barangay?: string
  city?: string
  province?: string
  postalCode?: string
  emergencyContactName?: string
  emergencyContactNumber?: string
}

type AuthResult = {
  success: boolean
  error?: string
  message?: string
  retryAfterSeconds?: number
  otpEmail?: string
  skipOtp?: boolean
}

const AUTH_KEY = 'drms-auth'
const SESSION_USER_KEY = 'drms-session-user'
export const AUTH_CHANGED_EVENT = 'drms-auth-changed'

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
    const errorData = error.response?.data as
      | { error?: string; message?: string; detail?: string; retryAfterSeconds?: number }
      | string
      | undefined

    if (typeof errorData === 'string' && errorData.trim()) {
      return { message: errorData.trim() }
    }

    const apiError =
      (typeof errorData === 'object' && errorData?.error) ||
      (typeof errorData === 'object' && errorData?.message) ||
      (typeof errorData === 'object' && errorData?.detail)

    if (apiError) {
      return {
        message: apiError,
        retryAfterSeconds: typeof errorData === 'object' ? errorData?.retryAfterSeconds : undefined,
      }
    }

    if (!error.response) {
      return {
        message: 'Cannot connect to the backend server. Make sure Django is running on http://127.0.0.1:8000.',
      }
    }

    return {
      message: `Request failed (${error.response.status}). Please try again.`,
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

function persistAuthenticatedSession(user: SessionUser, keepLoggedIn: boolean): void {
  const sessionStore = keepLoggedIn ? localStorage : sessionStorage
  const oppositeStore = keepLoggedIn ? sessionStorage : localStorage

  sessionStore.setItem(AUTH_KEY, 'true')
  writeSessionUser(sessionStore, {
    fullName: user.fullName,
    email: user.email,
  })

  oppositeStore.removeItem(AUTH_KEY)
  clearSessionUser(oppositeStore)

  emitAuthChanged()
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
  const username = payload.username?.trim() || ''
  const password = payload.password

  if (!fullName || !email || !password) {
    return { success: false, error: 'Please fill in all required fields.' }
  }

  try {
    const response = await registerAccount({
      fullName,
      email,
      password,
      username,
    })
    addNotification('Registration OTP sent successfully.')
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
    addNotification('Registration completed successfully.')
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

export async function requestLoginOtp(
  email: string,
  password: string,
  keepLoggedIn = false,
  forceOtp = true,
  loginContext: LoginContext = 'citizen',
): Promise<AuthResult> {
  const normalizedEmail = normalizeEmail(email)

  if (!normalizedEmail || !password) {
    return { success: false, error: 'Please enter your email/username and password.' }
  }

  try {
    const response = await loginAccount({ email: normalizedEmail, password, forceOtp, loginContext })

    const hasUserPayload = Boolean(response.user)
    const shouldBypassOtp = forceOtp === false && (response.skipOtp || hasUserPayload)

    if (shouldBypassOtp && response.user) {
      persistAuthenticatedSession(
        {
          fullName: response.user.fullName,
          email: response.user.email,
        },
        keepLoggedIn,
      )
      addNotification(`Welcome back, ${response.user.fullName}. Trusted login was used.`)

      return {
        success: true,
        message: response.message ?? 'Login successful.',
        otpEmail: response.user.email,
        skipOtp: true,
      }
    }

    if (forceOtp === false) {
      return {
        success: false,
        error: response.message ?? 'Unable to complete admin login right now.',
      }
    }

    addNotification('Login OTP sent successfully.')

    return {
      success: true,
      message: response.message,
      otpEmail: response.otpEmail,
      skipOtp: false,
    }
  } catch (error) {
    const parsedError = parseApiError(error, 'Invalid email/username or password.')
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

    if (!response.user) {
      return { success: false, error: 'Unable to complete login right now.' }
    }

    persistAuthenticatedSession(
      {
        fullName: response.user.fullName,
        email: response.user.email,
      },
      payload.keepLoggedIn,
    )
    addNotification(`Login successful. Welcome, ${response.user.fullName}.`)

    return {
      success: true,
      message: response.message ?? 'Login successful.',
    }
  } catch (error) {
    const parsedError = parseApiError(error, 'Unable to verify OTP.')
    return {
      success: false,
      error: parsedError.message,
    }
  }
}

export function isAuthenticated(): boolean {
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

  addNotification('Profile name updated successfully.')
  emitAuthChanged()
  return true
}

export function updateCurrentUserAvatar(photoUrl: string | null): boolean {
  const activeStore = getActiveAuthStore()
  if (!activeStore) {
    return false
  }

  const existingProfile = getCurrentUserProfile()
  if (!existingProfile) {
    return false
  }

  writeSessionUser(activeStore, {
    ...existingProfile,
    photoUrl: photoUrl || undefined,
  })

  addNotification(photoUrl ? 'Profile picture updated successfully.' : 'Profile picture removed successfully.')
  emitAuthChanged()
  return true
}

export function updateCurrentUserPersonalInfo(payload: {
  phoneNumber: string
  birthDate: string
  gender: string
  addressLine1: string
  barangay: string
  city: string
  province: string
  postalCode: string
  emergencyContactName: string
  emergencyContactNumber: string
}): boolean {
  const activeStore = getActiveAuthStore()
  if (!activeStore) {
    return false
  }

  const existingProfile = getCurrentUserProfile()
  if (!existingProfile) {
    return false
  }

  writeSessionUser(activeStore, {
    ...existingProfile,
    phoneNumber: payload.phoneNumber.trim() || undefined,
    birthDate: payload.birthDate.trim() || undefined,
    gender: payload.gender.trim() || undefined,
    addressLine1: payload.addressLine1.trim() || undefined,
    barangay: payload.barangay.trim() || undefined,
    city: payload.city.trim() || undefined,
    province: payload.province.trim() || undefined,
    postalCode: payload.postalCode.trim() || undefined,
    // Backward-compatible combined field for older UI readers.
    address: [
      payload.addressLine1.trim(),
      payload.barangay.trim(),
      payload.city.trim(),
      payload.province.trim(),
      payload.postalCode.trim(),
    ]
      .filter(Boolean)
      .join(', ') || undefined,
    emergencyContactName: payload.emergencyContactName.trim() || undefined,
    emergencyContactNumber: payload.emergencyContactNumber.trim() || undefined,
  })

  addNotification('Personal information updated successfully.')
  emitAuthChanged()
  return true
}

export function logoutUser(): void {
  const currentUser = getCurrentUserProfile()
  localStorage.removeItem(AUTH_KEY)
  clearSessionUser(localStorage)
  sessionStorage.removeItem(AUTH_KEY)
  clearSessionUser(sessionStorage)
  addNotification(
    currentUser
      ? `You have logged out successfully, ${currentUser.fullName}.`
      : 'You have logged out successfully.',
  )
  emitAuthChanged()
}
