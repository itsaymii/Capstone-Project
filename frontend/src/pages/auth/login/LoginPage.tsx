import { motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import type { ClipboardEvent, FormEvent, KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import { requestLoginOtp, verifyLoginOtpCode } from '../../../services/auth'

interface LoginPageProps {
  onRequestRegister?: () => void
  onRequestAdminLogin?: () => void
  onAuthenticated?: () => void
  modalMode?: boolean
}

const OTP_LENGTH = 6
const LOGIN_COOLDOWN_KEY_PREFIX = 'drms-login-otp-cooldown-until'

export function LoginPage({ onRequestRegister, onRequestAdminLogin, onAuthenticated, modalMode = false }: LoginPageProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [keepLoggedIn, setKeepLoggedIn] = useState(false)
  const [otpStep, setOtpStep] = useState(false)
  const [cooldownRemaining, setCooldownRemaining] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [showWelcomeCard, setShowWelcomeCard] = useState(false)

  useEffect(() => {
    const navState = location.state as { registrationSuccessMessage?: string } | null
    if (navState?.registrationSuccessMessage) {
      setSuccessMessage(navState.registrationSuccessMessage)
      setShowWelcomeCard(true)
      navigate(location.pathname, { replace: true, state: null })
    }
  }, [location.pathname, location.state, navigate])

  const otpInputRefs = useRef<Array<HTMLInputElement | null>>([])

  function getCooldownStorageKey(): string {
    const normalizedEmail = email.trim().toLowerCase() || 'unknown'
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

  function setOtpAtIndex(index: number, value: string): void {
    const otpChars = Array.from({ length: OTP_LENGTH }, (_, otpIndex) => otp[otpIndex] ?? '')
    otpChars[index] = value
    setOtp(otpChars.join(''))
  }

  function handleOtpDigitChange(index: number, rawValue: string): void {
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

  async function handleCredentialSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    const result = await requestLoginOtp(email, password)
    setIsSubmitting(false)

    if (!result.success) {
      setErrorMessage(result.error ?? 'Unable to log in right now.')
      if (result.retryAfterSeconds) {
        applyCooldown(result.retryAfterSeconds)
      }
      setShowWelcomeCard(false)
      setSuccessMessage('')
      return
    }

    setErrorMessage('')
    setShowWelcomeCard(false)
    setSuccessMessage(result.message ?? 'OTP sent to your email.')
    setOtpStep(true)
    applyCooldown(60)
  }

  async function handleOtpSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    const result = await verifyLoginOtpCode({ email, otp, keepLoggedIn })
    setIsSubmitting(false)

    if (!result.success) {
      setErrorMessage(result.error ?? 'Unable to verify OTP right now.')
      return
    }

    clearCooldown()
    setErrorMessage('')
    if (onAuthenticated) {
      onAuthenticated()
      return
    }

    const redirectPath = (location.state as { from?: string } | null)?.from
    navigate(redirectPath ?? '/landing')
  }

  async function handleResendOtp(): Promise<void> {
    if (cooldownRemaining > 0) {
      return
    }

    setIsSubmitting(true)
    const result = await requestLoginOtp(email, password)
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
    applyCooldown(60)
  }

  return (
    <main
      className={`flex min-h-screen items-center justify-center p-4 text-slate-800 sm:p-8 ${
        modalMode ? 'bg-transparent' : 'bg-slate-100'
      }`}
    >
      <div
        className="mx-auto w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-xl"
        onClick={(event) => {
          if (modalMode) {
            event.stopPropagation()
          }
        }}
      >
        <div className="grid min-h-[640px] md:grid-cols-2">
          <motion.section
            animate={{ opacity: 1, x: 0 }}
            className="relative flex flex-col justify-between bg-slate-100 p-10"
            initial={{ opacity: 0, x: -70 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
          >
            <div>
              <p className="text-3xl font-medium text-slate-800">Citizen Access</p>
              <p className="mt-2 text-sm text-slate-600">For citizens using the response portal</p>
            </div>
            <div className="py-6 text-sm text-slate-600">
              <p>Citizen Access</p>
              <p>Community Reports</p>
            </div>
            <p className="text-sm text-slate-600">
              Not yet registered in the response portal?{' '}
              {onRequestRegister ? (
                <button className="font-semibold text-slate-800 underline" onClick={onRequestRegister} type="button">
                  Register now
                </button>
              ) : (
                <Link className="font-semibold text-slate-800 underline" to="/register">
                  Register now
                </Link>
              )}
            </p>
          </motion.section>

          <motion.section
            animate={{ opacity: 1, x: 0 }}
            className="p-10"
            initial={{ opacity: 0, x: 70 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
          >
            <h1 className="text-4xl font-semibold text-slate-900">Log in</h1>
            <p className="mt-2 text-sm text-slate-500">
              {otpStep ? 'Enter the OTP sent to your email' : 'Citizen portal access'}
            </p>

            <div className="mt-6 flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <span
                className={`inline-flex h-7 w-7 items-center justify-center rounded-full border ${
                  !otpStep ? 'border-blue-600 bg-blue-600 text-white' : 'border-emerald-600 bg-emerald-600 text-white'
                }`}
              >
                1
              </span>
              <span className={!otpStep ? 'text-slate-800' : 'text-slate-500'}>Credentials</span>
              <span className="h-px w-8 bg-slate-300" />
              <span
                className={`inline-flex h-7 w-7 items-center justify-center rounded-full border ${
                  otpStep ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 bg-white text-slate-500'
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
                      className="w-full border-0 border-b border-slate-300 bg-transparent px-0 py-2 text-base outline-none placeholder:text-slate-400 focus:border-slate-700"
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
                    <input
                      className="w-full border-0 border-b border-slate-300 bg-transparent px-0 py-2 text-base outline-none placeholder:text-slate-400 focus:border-slate-700"
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="Password"
                    />
                  </label>

                  <label className="flex items-center gap-2 text-sm text-slate-600">
                    <input
                      checked={keepLoggedIn}
                      className="h-4 w-4"
                      onChange={(event) => setKeepLoggedIn(event.target.checked)}
                      type="checkbox"
                    />
                    Keep me logged in
                  </label>
                </>
              ) : (
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">One-Time Password</span>
                  <div className="flex items-center gap-2">
                    {Array.from({ length: OTP_LENGTH }).map((_, index) => (
                      <input
                        key={`login-otp-${index}`}
                        ref={(element) => {
                          otpInputRefs.current[index] = element
                        }}
                        className="h-12 w-11 rounded-lg border border-slate-300 bg-white text-center text-lg font-semibold text-slate-800 outline-none focus:border-blue-600"
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
                </label>
              )}

              <button
                className="w-full rounded-lg bg-blue-700 px-4 py-3 text-lg font-medium text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-blue-400"
                type="submit"
                disabled={isSubmitting}
              >
                {otpStep ? 'Verify OTP and Log in' : 'Send OTP'}
              </button>

              {otpStep ? (
                <div className="flex items-center justify-between gap-4 text-sm">
                  <button
                    className="font-semibold text-slate-700 underline disabled:cursor-not-allowed disabled:text-slate-400"
                    onClick={handleResendOtp}
                    type="button"
                    disabled={cooldownRemaining > 0 || isSubmitting}
                  >
                    {cooldownRemaining > 0 ? `Resend OTP in ${cooldownRemaining}s` : 'Resend OTP'}
                  </button>

                  <button
                    className="font-semibold text-slate-700 underline"
                    onClick={() => {
                      setOtpStep(false)
                      setOtp('')
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

              {errorMessage ? (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{errorMessage}</p>
              ) : null}

              <div className="flex items-center justify-between">
                {onRequestRegister ? (
                  <button className="text-sm font-semibold text-slate-700 underline" onClick={onRequestRegister} type="button">
                    Register now
                  </button>
                ) : (
                  <Link className="text-sm font-semibold text-slate-700 underline" to="/register">
                    Register now
                  </Link>
                )}

                {onRequestAdminLogin ? (
                  <button className="text-sm font-semibold text-slate-700 underline" onClick={onRequestAdminLogin} type="button">
                    Admin login
                  </button>
                ) : (
                  <Link className="text-sm font-semibold text-slate-700 underline" to="/admin-page">
                    Admin login
                  </Link>
                )}
              </div>
            </form>
          </motion.section>
        </div>
      </div>
    </main>
  )
}
