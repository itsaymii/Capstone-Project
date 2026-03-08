export interface TestApiResponse {
  message: string
}

export interface AuthUser {
  fullName: string
  email: string
}

export interface AuthApiResponse {
  message: string
  user: AuthUser
}

export interface RegisterApiPayload {
  fullName: string
  email: string
  password: string
}

export interface LoginApiPayload {
  email: string
  password: string
}

export interface VerifyOtpPayload {
  email: string
  otp: string
}
