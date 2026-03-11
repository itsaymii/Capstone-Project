export interface TestApiResponse {
  message: string
}

export interface AuthUser {
  fullName: string
  email: string
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
