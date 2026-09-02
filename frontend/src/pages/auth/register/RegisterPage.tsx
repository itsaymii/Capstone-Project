import { motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import type { ClipboardEvent, FormEvent, KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import { useNavigate } from 'react-router-dom'
import { requestRegisterOtp, verifyRegisterOtpCode } from '../../../services/auth'
import { getBarangays } from '../../../services/api'
import type { Barangay } from '../../../types/api'

import landingPageImage from '../../../images/LandingPage.jpg'
import drrmoLogo from '../../../images/drrmo.png'

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
  const [phoneNumber, setPhoneNumber] = useState('')
  const [barangays, setBarangays] = useState<Barangay[]>([])
  const [barangayId, setBarangayId] = useState('')
  const [residentialAddress, setResidentialAddress] = useState('')
  const [residencyProof, setResidencyProof] = useState<File | null>(null)
  const [residentConfirmation, setResidentConfirmation] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [otp, setOtp] = useState('')
  const [otpStep, setOtpStep] = useState(false)
  const [registrationStep, setRegistrationStep] = useState<1 | 2>(1)
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
    let isActive = true

    async function loadLucenaBarangays(): Promise<void> {
      try {
        const response = await getBarangays()
        if (isActive) {
          setBarangays(response.filter((barangay) => !barangay.city || barangay.city.toLowerCase() === 'lucena city'))
        }
      } catch {
        if (isActive) {
          setErrorMessage('Unable to load Lucena City barangays. Please refresh and try again.')
        }
      }
    }

    void loadLucenaBarangays()
    return () => {
      isActive = false
    }
  }, [])

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

  function getPostRegistrationPath(): string {
    return '/landing'
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
    if (!phoneNumber.trim()) {
      setErrorMessage('Phone number is required.')
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

  if (registrationStep === 1) {
    setErrorMessage('')
    setRegistrationStep(2)
    return
  }

    if (!barangayId) {
      setErrorMessage('Select your Lucena City barangay.')
      return
    }
    if (!residentialAddress.trim()) {
      setErrorMessage('Residential address is required.')
      return
    }
    if (!residencyProof) {
      setErrorMessage('Upload a proof of Lucena City residency.')
      return
    }
    if (!residentConfirmation) {
      setErrorMessage('Confirm that you are a Lucena City resident.')
      return
    }
    setErrorMessage('')
    setIsSubmitting(true)
    const result = await requestRegisterOtp({
      fullName,
      email,
      username,
      password,
      phoneNumber,
      barangayId,
      residentialAddress,
      residentConfirmation,
      residencyProof,
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
    
    if (result.skipOtp) {
      setSuccessMessage(result.message ?? 'Registration successful! Redirecting...')
      window.setTimeout(() => {
        if (onRegistered) {
          onRegistered()
          return
        }
        navigate(getPostRegistrationPath(), {
          state: {
            registrationLoginSuccessMessage: result.message ?? 'Welcome! Your account is now ready to use.',
          },
        })
      }, 600)
      return
    }
    
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
      phoneNumber,
      barangayId,
      residentialAddress,
      residentConfirmation,
      residencyProof: residencyProof as File,
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
      // Idinagdag ang bg-cover background ng LandingPage.jpg na may navy blend overlay para maging kamukha ng Login Page
      className={`relative flex min-h-screen items-center justify-center p-4 text-slate-800 sm:p-8 ${
        modalMode ? 'bg-transparent' : 'bg-cover bg-center'
      }`}
      style={
        modalMode
          ? undefined
          : {
              backgroundImage: `url(${landingPageImage})`,
              backgroundRepeat: 'no-repeat',
              backgroundAttachment: 'fixed',
              backgroundColor: 'rgba(15, 32, 67, 0.85)',
              backgroundBlendMode: 'multiply',
            }
      }
    >
      <div
        className="mx-auto w-full max-w-5xl overflow-hidden rounded-[2.5rem] border border-slate-200 bg-white/95 backdrop-blur-md shadow-[0_32px_64px_rgba(15,23,42,0.12)]"
        onClick={(event) => {
          if (modalMode) {
            event.stopPropagation()
          }
        }}
      >
        <div className="grid min-h-[680px] md:grid-cols-12">
          
          {/* LEFT SIDE: REGISTRATION FORM PANEL (Nasa Kaliwa na ito ngayon) */}
          <motion.section
            animate={{ opacity: 1, x: 0 }}
            className="md:col-span-7 p-8 sm:p-10 flex flex-col justify-center bg-[radial-gradient(circle_at_bottom_left,#f7faff_0%,#ffffff_70%)] relative order-2 md:order-1"
            initial={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          >
            {/* Soft Ambient Subtle Light Highlight */}
            <div className="absolute top-0 left-1/4 h-56 w-56 rounded-full bg-blue-50/40 blur-3xl pointer-events-none" />

            <div className="relative z-10">
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">Create Account</h1>
              <p className="mt-1.5 text-sm text-slate-500">
                {otpStep ? 'Enter the security key sent to your email.' : 'Sign up to create your workspace dashboard credentials.'}
              </p>
            </div>

            {/* Progress Stepper */}
            <div className="relative z-10 mt-6 flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
              <span
                className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] border font-bold ${
                  registrationStep === 1 && !otpStep ? 'border-[#0b2a57] bg-[#0b2a57] text-white shadow-[0_4px_10px_rgba(11,42,87,0.25)]' : 'border-emerald-600 bg-emerald-600 text-white'
                }`}
              >
                1
              </span>
              <span className={registrationStep === 1 && !otpStep ? 'text-slate-800 font-bold' : 'text-slate-400'}>Account</span>
              <span className="h-px w-6 bg-slate-200" />
              <span
                className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] border font-bold ${
                  registrationStep === 2 && !otpStep ? 'border-[#0b2a57] bg-[#0b2a57] text-white shadow-[0_4px_10px_rgba(11,42,87,0.25)]' : otpStep ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-200 bg-white text-slate-400'
                }`}
              >
                2
              </span>
              <span className={registrationStep === 2 && !otpStep ? 'text-slate-800 font-bold' : 'text-slate-400'}>Residency</span>
              <span className="h-px w-6 bg-slate-200" />
              <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] border font-bold ${otpStep ? 'border-[#0b2a57] bg-[#0b2a57] text-white shadow-[0_4px_10px_rgba(11,42,87,0.25)]' : 'border-slate-200 bg-white text-slate-400'}`}>3</span>
              <span className={otpStep ? 'text-slate-800 font-bold' : 'text-slate-400'}>Email</span>
            </div>

            <form className="relative z-10 mt-8 space-y-5" onSubmit={otpStep ? handleOtpSubmit : handleCredentialSubmit}>
              {!otpStep ? (
                <>
                  {registrationStep === 2 ? (
                  <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs leading-relaxed text-blue-900">
                    Registration is exclusively for Lucena City residents. Select an official Lucena barangay and submit a valid proof of residency for admin review.
                  </div>
                  ) : null}
                  {registrationStep === 1 ? (
                  <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">First Name</span>
                      <input
                        className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm outline-none placeholder:text-slate-400 transition focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-slate-100"
                        type="text"
                        value={firstName}
                        onChange={(event) => setFirstName(event.target.value)}
                        placeholder="First Name"
                        required
                      />
                    </label>

                    <label className="block">
                      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Last Name</span>
                      <input
                        className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm outline-none placeholder:text-slate-400 transition focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-slate-100"
                        type="text"
                        value={lastName}
                        onChange={(event) => setLastName(event.target.value)}
                        placeholder="Last Name"
                        required
                      />
                    </label>
                  </div>

                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Email Address</span>
                    <input
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm outline-none placeholder:text-slate-400 transition focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-slate-100"
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="name@example.com"
                      required
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Phone Number</span>
                    <input
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm outline-none placeholder:text-slate-400 transition focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-slate-100"
                      onChange={(event) => setPhoneNumber(event.target.value)}
                      placeholder="0917 123 4567"
                      required
                      type="tel"
                      value={phoneNumber}
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Username (Optional)</span>
                    <input
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm outline-none placeholder:text-slate-400 transition focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-slate-100"
                      onChange={(event) => setUsername(event.target.value)}
                      placeholder="Username"
                      type="text"
                      value={username}
                    />
                  </label>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Password</span>
                      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 transition focus-within:border-slate-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-slate-100">
                        <input
                          className="w-full border-0 bg-transparent py-2.5 text-sm outline-none placeholder:text-slate-400"
                          onChange={(event) => setPassword(event.target.value)}
                          placeholder="Password"
                          required
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                        />
                        <button className="text-[11px] font-bold uppercase tracking-wider text-slate-400 transition hover:text-slate-600" onClick={() => setShowPassword((previous) => !previous)} type="button">
                          {showPassword ? 'Hide' : 'Show'}
                        </button>
                      </div>
                    </label>

                    <label className="block">
                      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Confirm Password</span>
                      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 transition focus-within:border-slate-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-slate-100">
                        <input
                          className="w-full border-0 bg-transparent py-2.5 text-sm outline-none placeholder:text-slate-400"
                          onChange={(event) => setConfirmPassword(event.target.value)}
                          placeholder="Confirm password"
                          required
                          type={showConfirmPassword ? 'text' : 'password'}
                          value={confirmPassword}
                        />
                        <button className="text-[11px] font-bold uppercase tracking-wider text-slate-400 transition hover:text-slate-600" onClick={() => setShowConfirmPassword((previous) => !previous)} type="button">
                          {showConfirmPassword ? 'Hide' : 'Show'}
                        </button>
                      </div>
                    </label>
                  </div>
                  </>
                  ) : null}

                  {registrationStep === 2 ? (
                  <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Lucena City Barangay</span>
                      <select
                        className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm outline-none transition focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-slate-100"
                        onChange={(event) => setBarangayId(event.target.value)}
                        required
                        value={barangayId}
                      >
                        <option value="">Select barangay</option>
                        {barangays.map((barangay) => (
                          <option key={barangay.id} value={barangay.id}>{barangay.name}</option>
                        ))}
                      </select>
                    </label>

                    <label className="block">
                      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Proof of Residency</span>
                      <input
                        accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                        className="block w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-700 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white"
                        onChange={(event) => setResidencyProof(event.target.files?.[0] ?? null)}
                        required
                        type="file"
                      />
                    </label>
                  </div>

                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Residential Address</span>
                    <input
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm outline-none placeholder:text-slate-400 transition focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-slate-100"
                      onChange={(event) => setResidentialAddress(event.target.value)}
                      placeholder="House no., street, subdivision / sitio"
                      required
                      type="text"
                      value={residentialAddress}
                    />
                  </label>

                  <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-xs leading-relaxed text-slate-600">
                    <input
                      checked={residentConfirmation}
                      className="mt-0.5 h-4 w-4 accent-[#0b2a57]"
                      onChange={(event) => setResidentConfirmation(event.target.checked)}
                      required
                      type="checkbox"
                    />
                    <span>I confirm that I am a resident of Lucena City and that the submitted residency document is accurate.</span>
                  </label>
                  </>
                  ) : null}
                </>
              ) : (
                <section className={`rounded-xl border border-slate-200 bg-slate-50/60 p-5 ${otpShakeActive ? 'otp-shake' : ''}`}>
                  <div className="mb-4">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">One-Time Password Verification</p>
                    <p className="mt-0.5 text-xs text-slate-400">Please provide the 6-digit confirmation key sequence.</p>
                  </div>

                  <div className="flex items-center gap-2 justify-between">
                    {Array.from({ length: OTP_LENGTH }).map((_, index) => (
                      <input
                        key={`register-otp-${index}`}
                        ref={(element) => {
                          otpInputRefs.current[index] = element
                        }}
                        className="h-12 w-full rounded-xl border border-slate-200 bg-white text-center text-lg font-bold text-slate-800 shadow-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-[#0b2a57]/5"
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

              {!otpStep && registrationStep === 2 ? (
                <button
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  onClick={() => {
                    setRegistrationStep(1)
                    setErrorMessage('')
                  }}
                  type="button"
                >
                  Back to Account Details
                </button>
              ) : null}

              <button
                className="w-full rounded-xl bg-gradient-to-r from-[#0b2a57] to-[#123e7a] px-4 py-3 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(11,42,87,0.2)] transition hover:from-[#081e3f] hover:to-[#0d3161] disabled:cursor-not-allowed disabled:opacity-50"
                type="submit"
                disabled={isSubmitting}
              >
                {otpStep ? 'Verify Key & Complete Registry' : registrationStep === 1 ? 'Continue to Residency' : 'Register'}
              </button>

              {!otpStep ? (
                <p className="text-center text-xs text-slate-500">
                  Already have an account?{' '}
                  {onRequestLogin ? (
                    <button className="font-semibold text-slate-700 hover:text-[#0b2a57] transition" onClick={onRequestLogin} type="button">
                      Log In
                    </button>
                  ) : (
                    <Link className="font-semibold text-slate-700 hover:text-[#0b2a57] transition" to="/login">
                      Log In
                    </Link>
                  )}
                </p>
              ) : null}

              {otpStep ? (
                <div className="flex items-center justify-between gap-4 text-xs pt-1">
                  <button
                    className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-600 hover:bg-slate-50 transition disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={handleResendOtp}
                    type="button"
                    disabled={cooldownRemaining > 0 || isSubmitting}
                  >
                    {cooldownRemaining > 0 ? `Resend OTP in ${cooldownRemaining}s` : 'Resend OTP'}
                  </button>

                  <button
                    className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-600 hover:bg-slate-50 transition"
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
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5">
                  <p className="text-xs text-slate-600 leading-relaxed">{successMessage}</p>
                </div>
              ) : null}

              {errorMessage ? (
                <div className="rounded-xl border border-red-100 bg-red-50 px-3.5 py-2.5 text-xs text-red-600">
                  <span>{errorMessage}</span>
                </div>
              ) : null}

            </form>
          </motion.section>

          {/* RIGHT SIDE: BRANDING PANEL WITH LOGO (Nasa Kanan at ginamitan ng justify-center para maging pantay ang posisyon) */}
          <motion.section
            animate={{ opacity: 1, x: 0 }}
            className="relative md:col-span-5 flex flex-col justify-center overflow-hidden bg-gradient-to-t from-[#0b2a57] via-[#10356c] to-[#0b2a57] p-6 border-t md:border-t-0 md:border-l border-slate-100 order-1 md:order-2"
            initial={{ opacity: 0, x: 40 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          >
            {/* Soft Ambient Radial Highlights */}
            <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-3xl pointer-events-none" />
            <div className="absolute -left-20 -bottom-20 h-72 w-72 rounded-full bg-sky-400/10 blur-3xl pointer-events-none" />
            
            <div className="relative mx-auto flex h-full w-full flex-col items-center justify-center text-center gap-4">
              
              {/* DRRMO LOGO */}
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
                type="button"
                onClick={() => navigate('/emergency-hotlines')}
                className="group relative flex h-90 w-90 items-center justify-center p-0 bg-transparent transition-transform duration-300 focus:outline-none"
                aria-label="Open emergency contact directory"
              >
                <img 
                  src={drrmoLogo} 
                  alt="DRRMO logo" 
                  className="h-full w-full object-contain filter drop-shadow-[0_16px_32px_rgba(0,0,0,0.35)]" 
                />
              </motion.button>
              
              {/* Lucena City DRRMO Titles */}
              <div className="space-y-1 z-10">
                <h2 className="text-xl mt-[-1px] font-bold tracking-tight text-white">Lucena City DRRMO</h2>
                <p className="text-xs text-sky-200 leading-relaxed font-normal opacity-90">Disaster Risk Reduction and Management Office</p>
              </div>
            </div>
          </motion.section>

        </div>
      </div>
    </main>
  )
}