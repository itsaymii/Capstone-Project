import { motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import type { ClipboardEvent, FormEvent, KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import { useNavigate } from 'react-router-dom'
import { requestRegisterOtp, verifyRegisterOtpCode } from '../../../services/auth'

interface RegisterPageProps {
  onRequestLogin?: () => void
  onRegistered?: () => void
  modalMode?: boolean
}

const OTP_LENGTH = 6
const REGISTER_COOLDOWN_KEY_PREFIX = 'drms-register-otp-cooldown-until'
const OTP_COOLDOWN_SECONDS = 180

export function RegisterPage({ onRequestLogin, onRegistered, modalMode = false }: RegisterPageProps) {
  const navigate = useNavigate()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [otp, setOtp] = useState('')
  const [otpStep, setOtpStep] = useState(false)
  const [cooldownRemaining, setCooldownRemaining] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [otpShakeActive, setOtpShakeActive] = useState(false)
  const otpInputRefs = useRef<Array<HTMLInputElement | null>>([])

  function getCooldownStorageKey(): string {
    const normalizedEmail = email.trim().toLowerCase() || 'unknown'
    return `${REGISTER_COOLDOWN_KEY_PREFIX}:${normalizedEmail}`
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

  function buildFullName(): string {
    return `${firstName.trim()} ${lastName.trim()}`.trim()
  }

  async function handleCredentialSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const fullName = buildFullName()
    if (!fullName) {
      setErrorMessage('Please provide your first name and last name.')
      return
    }

    if (!email.trim()) {
      setErrorMessage('Email address is required.')
      return
    }

    if (!password) {
      setErrorMessage('Password is required.')
      return
    }

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters.')
      return
    }

    if (password !== confirmPassword) {
      setErrorMessage('Password and confirm password do not match.')
      return
    }

    setErrorMessage('')
    setIsSubmitting(true)
    const result = await requestRegisterOtp({
      fullName,
      email,
      username,
      password,
    })
    setIsSubmitting(false)

    if (!result.success) {
      setErrorMessage(result.error ?? 'Unable to register right now.')
      if (result.retryAfterSeconds) {
        applyCooldown(result.retryAfterSeconds)
      }
      setSuccessMessage('')
      return
    }

    setErrorMessage('')
    setSuccessMessage(result.message ?? 'OTP sent to your email.')
    setOtpStep(true)
    applyCooldown(OTP_COOLDOWN_SECONDS)
  }

  async function handleOtpSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    const result = await verifyRegisterOtpCode(email, otp)
    setIsSubmitting(false)

    if (!result.success) {
      setErrorMessage(result.error ?? 'Unable to verify OTP right now.')
      setOtpShakeActive(true)
      window.setTimeout(() => setOtpShakeActive(false), 380)
      return
    }

    clearCooldown()
    setErrorMessage('')
    if (onRegistered) {
      onRegistered()
      return
    }
    const registrationSuccessMessage =
      result.message ?? 'Registration successful! You can now log in using your verified account.'
    navigate('/login', {
      state: {
        registrationSuccessMessage,
      },
    })
  }

  async function handleResendOtp(): Promise<void> {
    if (cooldownRemaining > 0) {
      return
    }

    setIsSubmitting(true)
    const result = await requestRegisterOtp({
      fullName: buildFullName(),
      email,
      username,
      password,
    })
    setIsSubmitting(false)

    if (!result.success) {
      setErrorMessage(result.error ?? 'Unable to resend OTP right now.')
      if (result.retryAfterSeconds) {
        applyCooldown(result.retryAfterSeconds)
      }
      return
    }

    setErrorMessage('')
    setSuccessMessage(result.message ?? 'A new OTP was sent to your email.')
    applyCooldown(OTP_COOLDOWN_SECONDS)
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
            className="bg-white p-10 pt-14"
            initial={{ opacity: 0, x: -70 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
          >
            <h1 className="text-4xl font-bold tracking-tight text-slate-900">Create Your Account</h1>
            <p className="mt-2 text-sm text-slate-500">
              {otpStep ? 'Enter the OTP sent to your email' : 'Create an account'}
            </p>

            <div className="mt-6 flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <span
                className={`inline-flex h-7 w-7 items-center justify-center rounded-full border ${
                  !otpStep ? 'border-[#0b2a57] bg-[#0b2a57] text-white' : 'border-emerald-600 bg-emerald-600 text-white'
                }`}
              >
                1
              </span>
              <span className={!otpStep ? 'text-slate-800' : 'text-slate-500'}>Details</span>
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
                  <div className="grid gap-5 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">First Name</span>
                      <input
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-base outline-none placeholder:text-slate-400 transition focus:border-[#0b2a57] focus:ring-2 focus:ring-[#0b2a57]/10"
                        type="text"
                        value={firstName}
                        onChange={(event) => setFirstName(event.target.value)}
                        placeholder="First Name"
                        required
                      />
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Last Name</span>
                      <input
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-base outline-none placeholder:text-slate-400 transition focus:border-[#0b2a57] focus:ring-2 focus:ring-[#0b2a57]/10"
                        type="text"
                        value={lastName}
                        onChange={(event) => setLastName(event.target.value)}
                        placeholder="Last Name"
                        required
                      />
                    </label>
                  </div>

                  <label className="block">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Email Address</span>
                    <input
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-base outline-none placeholder:text-slate-400 transition focus:border-[#0b2a57] focus:ring-2 focus:ring-[#0b2a57]/10"
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="name@example.com"
                      required
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Username (Optional)</span>
                    <input
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-base outline-none placeholder:text-slate-400 transition focus:border-[#0b2a57] focus:ring-2 focus:ring-[#0b2a57]/10"
                      type="text"
                      value={username}
                      onChange={(event) => setUsername(event.target.value)}
                      placeholder="Username"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Password</span>
                    <div className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3">
                      <input
                        className="w-full border-0 bg-transparent px-0 py-3 text-base outline-none placeholder:text-slate-400"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="Password"
                        required
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

                  <label className="block">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Confirm Password</span>
                    <div className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3">
                      <input
                        className="w-full border-0 bg-transparent px-0 py-3 text-base outline-none placeholder:text-slate-400"
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        placeholder="Confirm Password"
                        required
                      />
                      <button
                        className="text-xs font-semibold uppercase tracking-wide text-slate-600 hover:text-slate-800"
                        onClick={() => setShowConfirmPassword((previous) => !previous)}
                        type="button"
                      >
                        {showConfirmPassword ? 'Hide' : 'Show'}
                      </button>
                    </div>
                  </label>

                </>
              ) : (
                <section className={`rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4 ${otpShakeActive ? 'otp-shake' : ''}`}>
                  <div className="mb-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">One-Time Password</p>
                    <p className="mt-1 text-sm text-slate-600">Enter the 6-digit code sent to your email.</p>
                  </div>

                  <div className="flex items-center gap-2 sm:gap-2.5">
                    {Array.from({ length: OTP_LENGTH }).map((_, index) => (
                      <input
                        key={`register-otp-${index}`}
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
                disabled={isSubmitting}
              >
                {otpStep ? 'Verify Code and Create Account' : 'Send Verification Code'}
              </button>

              {!otpStep ? (
                <p className="text-center text-sm text-slate-600">
                  Already have an account?{' '}
                  {onRequestLogin ? (
                    <button className="font-semibold text-[#0b2a57] underline" onClick={onRequestLogin} type="button">
                      Sign in
                    </button>
                  ) : (
                    <Link className="font-semibold text-[#0b2a57] underline" to="/login">
                      Sign in
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
                      setErrorMessage('')
                      setSuccessMessage('')
                      clearCooldown()
                    }}
                    type="button"
                  >
                    Edit details
                  </button>
                </div>
              ) : null}

              {successMessage ? (
                <div className="rounded-lg border border-[#0b2a57]/20 bg-gradient-to-r from-[#0b2a57]/5 via-white to-sky-50 px-3 py-2">
                  <p className="text-sm font-medium text-[#0b2a57]">{successMessage}</p>
                </div>
              ) : null}

              {errorMessage ? (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{errorMessage}</p>
              ) : null}

            </form>
          </motion.section>

          <motion.section
            animate={{ opacity: 1, x: 0 }}
            className="relative flex flex-col justify-between overflow-hidden bg-[linear-gradient(140deg,#0d2f60_0%,#174b8f_55%,#2563b0_100%)] p-10"
            initial={{ opacity: 0, x: 70 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
          >
            <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-cyan-200/20 blur-2xl" />

            <div>
              <p className="text-3xl font-semibold text-white">Community Access</p>
              <p className="mt-2 text-sm text-blue-100">
                For Citizens and LCDRRMO Admin responders
              </p>
            </div>
            <div className="space-y-2 py-6 text-sm text-blue-100">
              <p className="inline-flex rounded-full border border-white/30 bg-white/10 px-3 py-1">Citizen Access</p>
              <p className="inline-flex rounded-full border border-white/30 bg-white/10 px-3 py-1">Admin Access</p>
            </div>
            <p className="text-sm text-blue-100">Secure and monitored onboarding for community members.</p>
          </motion.section>
        </div>
      </div>
    </main>
  )
}
