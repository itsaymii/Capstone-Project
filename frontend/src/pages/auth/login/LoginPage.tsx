import { motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import type { ClipboardEvent, FormEvent, KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import { confirmPasswordResetWithOtp, getCurrentUserProfile, requestLoginOtp, requestPasswordResetOtp, verifyLoginOtpCode } from '../../../services/auth'

interface LoginPageProps {
  onRequestRegister?: () => void
  onRequestAdminLogin?: () => void
  onAuthenticated?: () => void
  modalMode?: boolean
}

const OTP_LENGTH = 6
const LOGIN_COOLDOWN_KEY_PREFIX = 'drms-login-otp-cooldown-until'
const FORGOT_PASSWORD_COOLDOWN_KEY_PREFIX = 'drms-password-reset-otp-cooldown-until'
const OTP_COOLDOWN_SECONDS = 180

export function LoginPage({ onRequestRegister, onRequestAdminLogin: _onRequestAdminLogin, onAuthenticated, modalMode = false }: LoginPageProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [otp, setOtp] = useState('')
  const [otpEmail, setOtpEmail] = useState('')
  const [keepLoggedIn, setKeepLoggedIn] = useState(false)
  const [otpStep, setOtpStep] = useState(false)
  const [cooldownRemaining, setCooldownRemaining] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isRedirectingAfterLogin, setIsRedirectingAfterLogin] = useState(false)
  const [skipOtpNotice, setSkipOtpNotice] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [showWelcomeCard, setShowWelcomeCard] = useState(false)
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false)
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('')
  const [forgotPasswordOtp, setForgotPasswordOtp] = useState('')
  const [forgotPasswordNewPassword, setForgotPasswordNewPassword] = useState('')
  const [forgotPasswordConfirmPassword, setForgotPasswordConfirmPassword] = useState('')
  const [forgotPasswordMessage, setForgotPasswordMessage] = useState('')
  const [forgotPasswordError, setForgotPasswordError] = useState('')
  const [forgotPasswordOtpStep, setForgotPasswordOtpStep] = useState(false)
  const [forgotPasswordCooldownRemaining, setForgotPasswordCooldownRemaining] = useState(0)
  const [isForgotPasswordSubmitting, setIsForgotPasswordSubmitting] = useState(false)
  const [otpShakeActive, setOtpShakeActive] = useState(false)

  useEffect(() => {
    const navState = location.state as { registrationSuccessMessage?: string } | null
    if (navState?.registrationSuccessMessage) {
      setSuccessMessage(navState.registrationSuccessMessage)
      setShowWelcomeCard(true)
      navigate(location.pathname, { replace: true, state: null })
    }
  }, [location.pathname, location.state, navigate])

  const otpInputRefs = useRef<Array<HTMLInputElement | null>>([])

  function getPostLoginPath(): string {
    const redirectPath = (location.state as { from?: string } | null)?.from
    const profile = getCurrentUserProfile()
    const hasDashboardSession = Boolean(profile?.hasDashboardAccess || profile?.role === 'admin' || profile?.role === 'staff')

    if (hasDashboardSession) {
      if (redirectPath?.startsWith('/admin')) {
        return redirectPath
      }

      return '/admin-dashboard'
    }

    if (redirectPath && !redirectPath.startsWith('/admin')) {
      return redirectPath
    }

    return '/landing'
  }

  function getSkipOtpMessage(): string {
    const profile = getCurrentUserProfile()

    if (profile?.hasDashboardAccess || profile?.role === 'admin' || profile?.role === 'staff') {
      return 'Staff and admin accounts sign in without OTP.'
    }

    return 'Trusted login detected. OTP skipped because your previous verified login is within 5 minutes.'
  }

  function getCooldownStorageKey(): string {
    const normalizedEmail = (otpEmail || email).trim().toLowerCase() || 'unknown'
    return `${LOGIN_COOLDOWN_KEY_PREFIX}:${normalizedEmail}`
  }

  function applyCooldown(seconds: number): void {
    const clampedSeconds = Math.max(0, seconds)
    setCooldownRemaining(clampedSeconds)

    if (clampedSeconds === 0) {
      sessionStorage.removeItem(getCooldownStorageKey())
      return
    }

    const cooldownUntil = Date.now() + clampedSeconds * 1000
    sessionStorage.setItem(getCooldownStorageKey(), String(cooldownUntil))
  }

  function clearCooldown(): void {
    setCooldownRemaining(0)
    sessionStorage.removeItem(getCooldownStorageKey())
  }

  function getForgotPasswordCooldownStorageKey(): string {
    const normalizedEmail = forgotPasswordEmail.trim().toLowerCase() || 'unknown'
    return `${FORGOT_PASSWORD_COOLDOWN_KEY_PREFIX}:${normalizedEmail}`
  }

  function applyForgotPasswordCooldown(seconds: number): void {
    const clampedSeconds = Math.max(0, seconds)
    setForgotPasswordCooldownRemaining(clampedSeconds)

    if (clampedSeconds === 0) {
      sessionStorage.removeItem(getForgotPasswordCooldownStorageKey())
      return
    }

    const cooldownUntil = Date.now() + clampedSeconds * 1000
    sessionStorage.setItem(getForgotPasswordCooldownStorageKey(), String(cooldownUntil))
  }

  function clearForgotPasswordCooldown(): void {
    setForgotPasswordCooldownRemaining(0)
    sessionStorage.removeItem(getForgotPasswordCooldownStorageKey())
  }

  function setOtpAtIndex(index: number, value: string): void {
    const otpChars = Array.from({ length: OTP_LENGTH }, (_, otpIndex) => otp[otpIndex] ?? '')
    otpChars[index] = value
    setOtp(otpChars.join(''))
  }

  function handleOtpDigitChange(index: number, rawValue: string): void {
    if (otpShakeActive) {
      setOtpShakeActive(false)
    }

    const onlyDigit = rawValue.replace(/\D/g, '').slice(-1)
    setOtpAtIndex(index, onlyDigit)

    if (onlyDigit && index < OTP_LENGTH - 1) {
      otpInputRefs.current[index + 1]?.focus()
    }
  }

  function handleOtpKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Backspace') {
      if (otp[index]) {
        setOtpAtIndex(index, '')
        return
      }

      if (index > 0) {
        setOtpAtIndex(index - 1, '')
        otpInputRefs.current[index - 1]?.focus()
      }
      return
    }

    if (event.key === 'ArrowLeft' && index > 0) {
      otpInputRefs.current[index - 1]?.focus()
      return
    }

    if (event.key === 'ArrowRight' && index < OTP_LENGTH - 1) {
      otpInputRefs.current[index + 1]?.focus()
    }
  }

  function handleOtpPaste(event: ClipboardEvent<HTMLInputElement>): void {
    event.preventDefault()
    const pastedDigits = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH)
    if (!pastedDigits) {
      return
    }

    const paddedOtp = pastedDigits.padEnd(OTP_LENGTH, '')
    setOtp(paddedOtp)
    const focusIndex = Math.min(pastedDigits.length, OTP_LENGTH - 1)
    otpInputRefs.current[focusIndex]?.focus()
  }

  useEffect(() => {
    if (!otpStep) {
      return
    }

    const storedCooldownUntil = Number(sessionStorage.getItem(getCooldownStorageKey()) || '0')
    if (!storedCooldownUntil) {
      return
    }

    const secondsRemaining = Math.ceil((storedCooldownUntil - Date.now()) / 1000)
    if (secondsRemaining > 0) {
      setCooldownRemaining(secondsRemaining)
    } else {
      clearCooldown()
    }
  }, [otpStep, email])

  useEffect(() => {
    if (!otpStep) {
      return
    }

    otpInputRefs.current[0]?.focus()
  }, [otpStep])

  useEffect(() => {
    if (cooldownRemaining <= 0) {
      if (otpStep) {
        clearCooldown()
      }
      return
    }

    const timerId = window.setInterval(() => {
      setCooldownRemaining((previous) => {
        if (previous <= 1) {
          window.clearInterval(timerId)
          return 0
        }
        return previous - 1
      })
    }, 1000)

    return () => {
      window.clearInterval(timerId)
    }
  }, [cooldownRemaining])

  useEffect(() => {
    if (!showForgotPasswordModal) {
      return
    }

    const storedCooldownUntil = Number(sessionStorage.getItem(getForgotPasswordCooldownStorageKey()) || '0')
    if (!storedCooldownUntil) {
      return
    }

    const secondsRemaining = Math.ceil((storedCooldownUntil - Date.now()) / 1000)
    if (secondsRemaining > 0) {
      setForgotPasswordCooldownRemaining(secondsRemaining)
    } else {
      clearForgotPasswordCooldown()
    }
  }, [showForgotPasswordModal, forgotPasswordEmail])

  useEffect(() => {
    if (forgotPasswordCooldownRemaining <= 0) {
      if (showForgotPasswordModal) {
        clearForgotPasswordCooldown()
      }
      return
    }

    const timerId = window.setInterval(() => {
      setForgotPasswordCooldownRemaining((previous) => {
        if (previous <= 1) {
          window.clearInterval(timerId)
          return 0
        }
        return previous - 1
      })
    }, 1000)

    return () => {
      window.clearInterval(timerId)
    }
  }, [forgotPasswordCooldownRemaining, showForgotPasswordModal])

  async function handleCredentialSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    const result = await requestLoginOtp(email, password, keepLoggedIn, true)
    setIsSubmitting(false)

    if (!result.success) {
      setErrorMessage(result.error ?? 'Unable to log in right now.')
      setSkipOtpNotice('')
      if (result.retryAfterSeconds) {
        applyCooldown(result.retryAfterSeconds)
      }
      setShowWelcomeCard(false)
      setSuccessMessage('')
      return
    }

    if (result.skipOtp) {
      setOtpStep(false)
      setOtp('')
      setOtpEmail('')
      setErrorMessage('')
      setShowWelcomeCard(false)
      setSuccessMessage(result.message ?? 'Login successful.')
      setSkipOtpNotice(getSkipOtpMessage())
      setIsRedirectingAfterLogin(true)

      window.setTimeout(() => {
        if (onAuthenticated) {
          onAuthenticated()
          return
        }

        navigate(getPostLoginPath(), {
          state: {
              loginSuccessMessage: result.message ?? 'Welcome back to Lucena City DRRMO.',
          },
        })
      }, 900)
      return
    }

    setErrorMessage('')
    setSkipOtpNotice('')
    setShowWelcomeCard(false)
    setSuccessMessage(result.message ?? 'OTP sent to your email.')
    setOtpEmail(result.otpEmail ?? email.trim().toLowerCase())
    setOtpStep(true)
    applyCooldown(OTP_COOLDOWN_SECONDS)
  }

  async function handleOtpSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    const result = await verifyLoginOtpCode({ email: otpEmail || email, otp, keepLoggedIn })
    setIsSubmitting(false)

    if (!result.success) {
      setErrorMessage(result.error ?? 'Unable to verify OTP right now.')
      setOtpShakeActive(true)
      window.setTimeout(() => setOtpShakeActive(false), 380)
      setSkipOtpNotice('')
      return
    }

    clearCooldown()
    setErrorMessage('')
    setShowWelcomeCard(false)
    setSuccessMessage(result.message ?? 'Successfully logged in.')
    setIsRedirectingAfterLogin(true)

    window.setTimeout(() => {
      if (onAuthenticated) {
        onAuthenticated()
        return
      }

      navigate(getPostLoginPath(), {
        state: {
            loginSuccessMessage: result.message ?? 'Welcome back to Lucena City DRRMO.',
        },
      })
    }, 900)
  }

  async function handleResendOtp(): Promise<void> {
    if (cooldownRemaining > 0) {
      return
    }

    setIsSubmitting(true)
    const result = await requestLoginOtp(email, password, false, true)
    setIsSubmitting(false)

    if (!result.success) {
      setErrorMessage(result.error ?? 'Unable to resend OTP right now.')
      if (result.retryAfterSeconds) {
        applyCooldown(result.retryAfterSeconds)
      }
      return
    }

    setErrorMessage('')
    setShowWelcomeCard(false)
    setSuccessMessage(result.message ?? 'A new OTP was sent to your email.')
    if (result.otpEmail) {
      setOtpEmail(result.otpEmail)
    }
    applyCooldown(OTP_COOLDOWN_SECONDS)
  }

  function openForgotPasswordModal(): void {
    setForgotPasswordEmail(email)
    setForgotPasswordOtp('')
    setForgotPasswordNewPassword('')
    setForgotPasswordConfirmPassword('')
    setForgotPasswordMessage('')
    setForgotPasswordError('')
    setForgotPasswordOtpStep(false)
    setShowForgotPasswordModal(true)
  }

  function closeForgotPasswordModal(): void {
    clearForgotPasswordCooldown()
    setShowForgotPasswordModal(false)
  }

  async function sendForgotPasswordOtpRequest(): Promise<boolean> {
    setIsForgotPasswordSubmitting(true)
    const result = await requestPasswordResetOtp(forgotPasswordEmail)
    setIsForgotPasswordSubmitting(false)

    if (!result.success) {
      setForgotPasswordError(result.error ?? 'Unable to send reset instructions right now.')
      if (result.retryAfterSeconds) {
        applyForgotPasswordCooldown(result.retryAfterSeconds)
      }
      return false
    }

    if (result.otpEmail) {
      setForgotPasswordEmail(result.otpEmail)
    }

    setForgotPasswordOtpStep(true)
    setForgotPasswordMessage(result.message ?? 'Password reset OTP sent to your email.')
    applyForgotPasswordCooldown(OTP_COOLDOWN_SECONDS)
    return true
  }

  async function handleForgotPasswordResendOtp(): Promise<void> {
    if (forgotPasswordCooldownRemaining > 0) {
      return
    }

    setForgotPasswordMessage('')
    setForgotPasswordError('')
    await sendForgotPasswordOtpRequest()
  }

  async function handleForgotPasswordSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setForgotPasswordMessage('')
    setForgotPasswordError('')

    if (!forgotPasswordEmail.trim()) {
      setForgotPasswordError('Please enter your registered email address.')
      return
    }

    if (!forgotPasswordOtpStep) {
      await sendForgotPasswordOtpRequest()
      return
    }

    if (!forgotPasswordOtp.trim()) {
      setForgotPasswordError('Please enter the OTP sent to your email.')
      return
    }

    if (forgotPasswordNewPassword.length < 6) {
      setForgotPasswordError('Password must be at least 6 characters.')
      return
    }

    if (forgotPasswordNewPassword !== forgotPasswordConfirmPassword) {
      setForgotPasswordError('New password and confirm password must match.')
      return
    }

    setIsForgotPasswordSubmitting(true)
    const result = await confirmPasswordResetWithOtp({
      email: forgotPasswordEmail,
      otp: forgotPasswordOtp,
      newPassword: forgotPasswordNewPassword,
    })
    setIsForgotPasswordSubmitting(false)

    if (!result.success) {
      setForgotPasswordError(result.error ?? 'Unable to reset password right now.')
      return
    }

    setForgotPasswordMessage(result.message ?? 'Password reset successful. You can now log in with your new password.')
    setForgotPasswordOtp('')
    setForgotPasswordNewPassword('')
    setForgotPasswordConfirmPassword('')
    setForgotPasswordOtpStep(false)
    clearForgotPasswordCooldown()
    setPassword('')
  }

  return (
    <main
      className={`flex min-h-screen items-center justify-center p-4 text-slate-800 sm:p-8 ${
        modalMode ? 'bg-transparent' : 'bg-[radial-gradient(circle_at_top,#e7efff_0%,#f8fbff_42%,#eef3f9_100%)]'
      }`}
    >
      <div
        className="mx-auto w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.14)]"
        onClick={(event) => {
          if (modalMode) {
            event.stopPropagation()
          }
        }}
      >
        <div className="grid min-h-[640px] md:grid-cols-2">
          <motion.section
            animate={{ opacity: 1, x: 0 }}
            className="relative flex flex-col justify-between overflow-hidden bg-[linear-gradient(140deg,#0d2f60_0%,#174b8f_55%,#2563b0_100%)] p-10"
            initial={{ opacity: 0, x: -70 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
          >
            <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-cyan-200/20 blur-2xl" />

            <div>
              <p className="text-3xl font-semibold text-white">Unified Access</p>
              <p className="mt-2 text-sm text-blue-100">One sign-in for citizens, staff, and admin responders</p>
            </div>
            <div className="space-y-2 py-6 text-sm text-blue-100">
              <p className="inline-flex rounded-full border border-white/30 bg-white/10 px-3 py-1">Citizen Services</p>
              <p className="inline-flex rounded-full border border-white/30 bg-white/10 px-3 py-1">Staff Operations</p>
              <p className="inline-flex rounded-full border border-white/30 bg-white/10 px-3 py-1">Admin Dashboard</p>
            </div>
            <p className="text-sm text-blue-100">Your destination is decided automatically after login based on account role.</p>
          </motion.section>

          <motion.section
            animate={{ opacity: 1, x: 0 }}
            className="bg-white p-10 pt-14"
            initial={{ opacity: 0, x: 70 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
          >
            <h1 className="text-4xl font-bold tracking-tight text-slate-900">Welcome Back</h1>
            <p className="mt-2 text-sm text-slate-500">
              {otpStep ? 'Enter the OTP sent to your email' : 'Use your account to continue'}
            </p>

            <div className="mt-6 flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <span
                className={`inline-flex h-7 w-7 items-center justify-center rounded-full border ${
                  !otpStep ? 'border-[#0b2a57] bg-[#0b2a57] text-white' : 'border-emerald-600 bg-emerald-600 text-white'
                }`}
              >
                1
              </span>
              <span className={!otpStep ? 'text-slate-800' : 'text-slate-500'}>Credentials</span>
              <span className="h-px w-8 bg-slate-300" />
              <span
                className={`inline-flex h-7 w-7 items-center justify-center rounded-full border ${
                  otpStep ? 'border-[#0b2a57] bg-[#0b2a57] text-white' : 'border-slate-300 bg-white text-slate-500'
                }`}
              >
                2
              </span>
              <span className={otpStep ? 'text-slate-800' : 'text-slate-500'}>OTP</span>
            </div>

            <form className="mt-10 space-y-7" onSubmit={otpStep ? handleOtpSubmit : handleCredentialSubmit}>
              {!otpStep ? (
                <>
                  <label className="block">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Email or Username
                    </span>
                    <input
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-base outline-none placeholder:text-slate-400 transition focus:border-[#0b2a57] focus:ring-2 focus:ring-[#0b2a57]/10"
                      type="text"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="Email or Username"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Password
                    </span>
                    <div className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3">
                      <input
                        className="w-full border-0 bg-transparent px-0 py-3 text-base outline-none placeholder:text-slate-400"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="Password"
                      />
                      <button
                        className="text-xs font-semibold uppercase tracking-wide text-slate-600 hover:text-slate-800"
                        onClick={() => setShowPassword((previous) => !previous)}
                        type="button"
                      >
                        {showPassword ? 'Hide' : 'Show'}
                      </button>
                    </div>
                  </label>

                  <div className="mt-3 flex items-center justify-between gap-4">
                    <label className="inline-flex items-center gap-2 text-sm text-slate-600">
                      <input
                        checked={keepLoggedIn}
                        className="h-4 w-4"
                        onChange={(event) => setKeepLoggedIn(event.target.checked)}
                        type="checkbox"
                      />
                      Keep me logged in
                    </label>

                    <button className="text-xs font-semibold text-[#0b2a57] underline" onClick={openForgotPasswordModal} type="button">
                      Forgot password?
                    </button>
                  </div>
                </>
              ) : (
                <section className={`rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4 ${otpShakeActive ? 'otp-shake' : ''}`}>
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">One-Time Password</p>
                      <p className="mt-1 text-sm text-slate-600">Enter the 6-digit code sent to your email.</p>
                    </div>
                    {otpEmail ? <p className="text-[11px] font-medium text-slate-500">{otpEmail}</p> : null}
                  </div>

                  <div className="flex items-center gap-2 sm:gap-2.5">
                    {Array.from({ length: OTP_LENGTH }).map((_, index) => (
                      <input
                        key={`login-otp-${index}`}
                        ref={(element) => {
                          otpInputRefs.current[index] = element
                        }}
                        className="h-12 w-10 rounded-xl border border-slate-300 bg-white text-center text-lg font-bold text-slate-800 shadow-[inset_0_1px_2px_rgba(15,23,42,0.06)] outline-none transition focus:border-[#0b2a57] focus:ring-2 focus:ring-[#0b2a57]/15 sm:h-14 sm:w-12"
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={1}
                        value={otp[index] ?? ''}
                        onChange={(event) => handleOtpDigitChange(index, event.target.value)}
                        onKeyDown={(event) => handleOtpKeyDown(index, event)}
                        onPaste={handleOtpPaste}
                      />
                    ))}
                  </div>
                </section>
              )}

              <button
                className="w-full rounded-xl bg-gradient-to-r from-[#0b2a57] to-[#1d4f93] px-4 py-3 text-lg font-semibold text-white shadow-[0_12px_22px_rgba(11,42,87,0.25)] transition hover:from-[#123a73] hover:to-[#2563b0] disabled:cursor-not-allowed disabled:from-[#7f93b2] disabled:to-[#7f93b2]"
                type="submit"
                disabled={isSubmitting || isRedirectingAfterLogin}
              >
                {otpStep ? (isRedirectingAfterLogin ? 'Login successful. Redirecting...' : 'Verify Code and Log In') : 'Continue Login'}
              </button>

              {!otpStep ? (
                <p className="text-center text-sm text-slate-600">
                  Don't have an account?{' '}
                  {onRequestRegister ? (
                    <button
                      className="font-semibold text-[#0b2a57] disabled:cursor-not-allowed disabled:text-slate-400"
                      onClick={onRequestRegister}
                      type="button"
                    >
                      Create an account
                    </button>
                  ) : (
                    <Link
                      className="font-semibold text-[#0b2a57] disabled:cursor-not-allowed disabled:text-slate-400"
                      to="/register"
                    >
                      Create an account
                    </Link>
                  )}
                </p>
              ) : null}

              {otpStep ? (
                <div className="flex items-center justify-between gap-4 text-sm">
                  <button
                    className="inline-flex items-center rounded-full border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
                    onClick={handleResendOtp}
                    type="button"
                    disabled={cooldownRemaining > 0 || isSubmitting}
                  >
                    {cooldownRemaining > 0 ? `Resend OTP in ${cooldownRemaining}s` : 'Resend OTP'}
                  </button>

                  <button
                    className="inline-flex items-center rounded-full border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-100"
                    onClick={() => {
                      setOtpStep(false)
                      setOtp('')
                      setOtpEmail('')
                      setSkipOtpNotice('')
                      setErrorMessage('')
                      setSuccessMessage('')
                      clearCooldown()
                    }}
                    type="button"
                  >
                    Edit credentials
                  </button>
                </div>
              ) : null}

              {successMessage ? (
                showWelcomeCard ? (
                  <div className="rounded-xl border border-[#0b2a57]/20 bg-gradient-to-br from-[#0b2a57]/5 via-white to-red-50 px-4 py-4 shadow-sm">
                    <div className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-2.5 py-1">
                      <span className="h-2 w-2 rounded-full bg-red-500" />
                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-red-700">Account Ready</p>
                    </div>
                    <h2 className="mt-2 text-lg font-bold text-[#0b2a57]">Welcome to Lucena City DRRMO</h2>
                    <p className="mt-2 text-sm leading-relaxed text-slate-700">{successMessage}</p>
                    <p className="mt-3 text-xs font-medium text-[#0b2a57]">Proceed to login to access your dashboard.</p>
                  </div>
                ) : (
                  <div className="rounded-lg border border-[#0b2a57]/20 bg-gradient-to-r from-[#0b2a57]/5 via-white to-sky-50 px-3 py-2">
                    <p className="text-sm font-medium text-[#0b2a57]">{successMessage}</p>
                  </div>
                )
              ) : null}

              {skipOtpNotice ? (
                <p className="rounded-lg border border-[#0b2a57]/20 bg-[#0b2a57]/5 px-3 py-2 text-sm text-[#0b2a57]">{skipOtpNotice}</p>
              ) : null}

              {errorMessage ? (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{errorMessage}</p>
              ) : null}

            </form>
          </motion.section>
        </div>
      </div>

      {showForgotPasswordModal ? (
        <div className="fixed inset-0 z-[1200] bg-slate-900/45 p-4 backdrop-blur-[1px] sm:p-8" onClick={closeForgotPasswordModal}>
          <div className="mx-auto mt-8 w-full max-w-lg" onClick={(event) => event.stopPropagation()}>
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_20px_40px_rgba(15,23,42,0.22)] sm:p-6">
              <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.15em] text-slate-500">Account Recovery</p>
                  <h3 className="mt-1 text-xl font-black text-slate-900 sm:text-2xl">Forgot Password</h3>
                </div>
                <button
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                  onClick={closeForgotPasswordModal}
                  type="button"
                >
                  Close
                </button>
              </div>

              <p className="mt-4 text-sm leading-relaxed text-slate-600">
                {forgotPasswordOtpStep
                  ? 'Enter the OTP from your email and choose a new password.'
                  : 'Enter your registered email address and we will send a password reset OTP.'}
              </p>

              <form className="mt-4 space-y-3" onSubmit={handleForgotPasswordSubmit}>
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Registered Email</span>
                  <input
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-800 outline-none placeholder:text-slate-400 focus:border-[#0b2a57]"
                    onChange={(event) => setForgotPasswordEmail(event.target.value)}
                    placeholder="you@example.com"
                    type="email"
                    value={forgotPasswordEmail}
                    disabled={forgotPasswordOtpStep || isForgotPasswordSubmitting}
                  />
                </label>

                {forgotPasswordOtpStep ? (
                  <>
                    <label className="block">
                      <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">OTP Code</span>
                      <input
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-800 outline-none placeholder:text-slate-400 focus:border-[#0b2a57]"
                        onChange={(event) => setForgotPasswordOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="6-digit OTP"
                        type="text"
                        inputMode="numeric"
                        value={forgotPasswordOtp}
                      />
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">New Password</span>
                      <input
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-800 outline-none placeholder:text-slate-400 focus:border-[#0b2a57]"
                        onChange={(event) => setForgotPasswordNewPassword(event.target.value)}
                        placeholder="Enter new password"
                        type="password"
                        value={forgotPasswordNewPassword}
                      />
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Confirm New Password</span>
                      <input
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-800 outline-none placeholder:text-slate-400 focus:border-[#0b2a57]"
                        onChange={(event) => setForgotPasswordConfirmPassword(event.target.value)}
                        placeholder="Confirm new password"
                        type="password"
                        value={forgotPasswordConfirmPassword}
                      />
                    </label>
                  </>
                ) : null}

                <button
                  className="w-full rounded-lg bg-[#0b2a57] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#123a73]"
                  type="submit"
                  disabled={isForgotPasswordSubmitting}
                >
                  {isForgotPasswordSubmitting
                    ? 'Processing...'
                    : forgotPasswordOtpStep
                      ? 'Reset Password'
                      : 'Send Reset OTP'}
                </button>

                {forgotPasswordOtpStep ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <button
                      className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
                      onClick={handleForgotPasswordResendOtp}
                      type="button"
                      disabled={forgotPasswordCooldownRemaining > 0 || isForgotPasswordSubmitting}
                    >
                      {forgotPasswordCooldownRemaining > 0
                        ? `Resend OTP in ${forgotPasswordCooldownRemaining}s`
                        : 'Resend OTP'}
                    </button>

                    <button
                      className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                      onClick={() => {
                        setForgotPasswordOtpStep(false)
                        setForgotPasswordOtp('')
                        setForgotPasswordNewPassword('')
                        setForgotPasswordConfirmPassword('')
                        setForgotPasswordMessage('')
                        setForgotPasswordError('')
                        clearForgotPasswordCooldown()
                      }}
                      type="button"
                    >
                      Use Different Email
                    </button>
                  </div>
                ) : null}
              </form>

              {forgotPasswordMessage ? (
                <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">{forgotPasswordMessage}</p>
              ) : null}

              {forgotPasswordError ? (
                <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{forgotPasswordError}</p>
              ) : null}
            </section>
          </div>
        </div>
      ) : null}
    </main>
  )
}
