import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import type { ClipboardEvent, FormEvent, KeyboardEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  ArrowLeft, 
  ShieldCheck, 
  RefreshCw, 
  AlertCircle 
} from 'lucide-react'
import { 
  confirmPasswordResetWithOtp, 
  getCurrentUserProfile, 
  requestLoginOtp, 
  requestPasswordResetOtp, 
  verifyLoginOtpCode 
} from '../../../services/auth'
import landingPageImage from '../../../images/LandingPage.jpg'
import drrmoLogo from '../../../images/drrmo.png'

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

  function getPostLoginPath(overrideProfile?: { role?: string; isAdmin?: boolean; isStaff?: boolean; hasDashboardAccess?: boolean }): string {
    const redirectPath = (location.state as { from?: string } | null)?.from
    const profile = overrideProfile ?? getCurrentUserProfile()

    const role = profile?.role
    const isAdmin = profile?.isAdmin
    const isStaff = profile?.isStaff
    const hasDashboardAccess = profile?.hasDashboardAccess

    if (role === 'admin' || isAdmin) return '/admin-dashboard'
    if (role === 'staff' || isStaff) return '/responder-dashboard'
    if (hasDashboardAccess) return '/responder-dashboard'

    if (redirectPath && !redirectPath.startsWith('/admin') && !redirectPath.startsWith('/responder')) {
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
    if (otpShakeActive) setOtpShakeActive(false)
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
    if (!pastedDigits) return

    const paddedOtp = pastedDigits.padEnd(OTP_LENGTH, '')
    setOtp(paddedOtp)
    const focusIndex = Math.min(pastedDigits.length, OTP_LENGTH - 1)
    otpInputRefs.current[focusIndex]?.focus()
  }

  useEffect(() => {
    if (!otpStep) return
    const storedCooldownUntil = Number(sessionStorage.getItem(getCooldownStorageKey()) || '0')
    if (!storedCooldownUntil) return

    const secondsRemaining = Math.ceil((storedCooldownUntil - Date.now()) / 1000)
    if (secondsRemaining > 0) {
      setCooldownRemaining(secondsRemaining)
    } else {
      clearCooldown()
    }
  }, [otpStep, email])

  useEffect(() => {
    if (!otpStep) return
    otpInputRefs.current[0]?.focus()
  }, [otpStep])

  useEffect(() => {
    if (cooldownRemaining <= 0) {
      if (otpStep) clearCooldown()
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

    return () => window.clearInterval(timerId)
  }, [cooldownRemaining, otpStep])

  useEffect(() => {
    if (!showForgotPasswordModal) return
    const storedCooldownUntil = Number(sessionStorage.getItem(getForgotPasswordCooldownStorageKey()) || '0')
    if (!storedCooldownUntil) return

    const secondsRemaining = Math.ceil((storedCooldownUntil - Date.now()) / 1000)
    if (secondsRemaining > 0) {
      setForgotPasswordCooldownRemaining(secondsRemaining)
    } else {
      clearForgotPasswordCooldown()
    }
  }, [showForgotPasswordModal, forgotPasswordEmail])

  useEffect(() => {
    if (forgotPasswordCooldownRemaining <= 0) {
      if (showForgotPasswordModal) clearForgotPasswordCooldown()
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

    return () => window.clearInterval(timerId)
  }, [forgotPasswordCooldownRemaining, showForgotPasswordModal])

  async function handleCredentialSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    const result = await requestLoginOtp(email, password, keepLoggedIn, true)
    setIsSubmitting(false)

    if (!result.success) {
      setErrorMessage(result.error ?? 'Unable to log in right now.')
      setSkipOtpNotice('')
      if (result.retryAfterSeconds) applyCooldown(result.retryAfterSeconds)
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
        navigate(getPostLoginPath(result.user), {
          state: { loginSuccessMessage: result.message ?? 'Welcome back to Lucena City DRRMO.' },
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
      navigate(getPostLoginPath(result.user), {
        state: { loginSuccessMessage: result.message ?? 'Welcome back to Lucena City DRRMO.' },
      })
    }, 900)
  }

  async function handleResendOtp(): Promise<void> {
    if (cooldownRemaining > 0) return
    setIsSubmitting(true)
    const result = await requestLoginOtp(email, password, false, true)
    setIsSubmitting(false)

    if (!result.success) {
      setErrorMessage(result.error ?? 'Unable to resend OTP right now.')
      if (result.retryAfterSeconds) applyCooldown(result.retryAfterSeconds)
      return
    }

    setErrorMessage('')
    setShowWelcomeCard(false)
    setSuccessMessage(result.message ?? 'A new OTP was sent to your email.')
    if (result.otpEmail) setOtpEmail(result.otpEmail)
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
      if (result.retryAfterSeconds) applyForgotPasswordCooldown(result.retryAfterSeconds)
      return false
    }

    if (result.otpEmail) setForgotPasswordEmail(result.otpEmail)
    setForgotPasswordOtpStep(true)
    setForgotPasswordMessage(result.message ?? 'Password reset OTP sent to your email.')
    applyForgotPasswordCooldown(OTP_COOLDOWN_SECONDS)
    return true
  }

  async function handleForgotPasswordResendOtp(): Promise<void> {
    if (forgotPasswordCooldownRemaining > 0) return
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
      className={`relative flex min-h-screen items-center justify-center p-4 text-slate-700 sm:p-8 ${modalMode ? 'bg-transparent' : 'bg-cover bg-center'}`}
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
      {/* Light Mode Premium Minimalist Container */}
      <div
        className="mx-auto w-full max-w-5xl overflow-hidden rounded-[2.5rem] border border-slate-200 bg-white/95 backdrop-blur-md shadow-[0_32px_64px_rgba(15,23,42,0.12)]"
        onClick={(event) => modalMode && event.stopPropagation()}
      >
        <div className="grid min-h-[660px] md:grid-cols-12">
          
          {/* Left Panel: Corporate Cinematic Navy Banner */}
{/* Left Panel: Corporate Cinematic Navy Banner */}
<motion.section
  animate={{ opacity: 1, x: 0 }}
  className="relative md:col-span-5 flex flex-col justify-center overflow-hidden bg-gradient-to-t from-[#0b2a57] via-[#10356c] to-[#0b2a57] p-6 border-b md:border-b-0 md:border-r border-slate-100"
  initial={{ opacity: 0, x: -40 }}
  transition={{ duration: 0.5, ease: 'easeOut' }}
>
  {/* Elegant Radial Soft Light */}
  <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-3xl pointer-events-none" />
  <div className="absolute -left-20 -bottom-20 h-72 w-72 rounded-full bg-sky-400/10 blur-3xl pointer-events-none" />
  
  <div className="relative mx-auto flex h-full w-full flex-col items-center justify-center text-center gap-6">
    
    {/* MAXIMUM SCALE LOGO (No background, pure asset visibility) */}
    <motion.button
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.98 }}
      type="button"
      onClick={() => navigate('/emergency-hotlines')}
      className="group relative flex h-95 w-95 items-center justify-center p-0 bg-transparent transition-transform duration-300 focus:outline-none"
      aria-label="Open emergency contact directory"
    >
      <img 
        src={drrmoLogo} 
        alt="DRRMO logo" 
        className="h-full w-full object-contain filter drop-shadow-[0_16px_32px_rgba(0,0,0,0.35)]" 
      />
    </motion.button>
    
    <div className="space-y-1.5 z-20">
      <h2 className="text-xl font-bold tracking-tight text-white">Lucena City DRRMO</h2>
      <p className="text-xs text-sky-200 leading-relaxed font-normal opacity-90">Disaster Risk Reduction and Management Office</p>
    </div>
  </div>
</motion.section>

          {/* Right Panel: Light Form Layout */}
          <motion.section
            animate={{ opacity: 1, x: 0 }}
            className="md:col-span-7 bg-white p-8 sm:p-12 flex flex-col justify-center"
            initial={{ opacity: 0, x: 40 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          >
            <div className="w-full max-w-md mx-auto space-y-8">
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">Welcome Back</h1>
                <p className="mt-2 text-sm text-slate-500">
                  {otpStep ? 'Enter the secure OTP code sent to your email.' : 'Sign in to access your dashboard management workspace.'}
                </p>
              </div>

              {/* Progress Stepper Component */}
              <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition-colors ${!otpStep ? 'bg-[#0b2a57] text-white shadow-[0_4px_10px_rgba(11,42,87,0.25)]' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
                  1
                </span>
                <span className={!otpStep ? 'text-slate-800' : 'text-slate-400'}>Credentials</span>
                <span className="h-px w-6 bg-slate-200" />
                <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold border transition-colors ${otpStep ? 'bg-[#0b2a57] text-white border-transparent shadow-[0_4px_10px_rgba(11,42,87,0.25)]' : 'border-slate-200 bg-slate-50 text-slate-400'}`}>
                  2
                </span>
                <span className={otpStep ? 'text-slate-800' : 'text-slate-400'}>Verification</span>
              </div>

              <form className="space-y-6" onSubmit={otpStep ? handleOtpSubmit : handleCredentialSubmit}>
                {!otpStep ? (
                  <div className="space-y-5">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Email or Username</label>
                      <div className="relative flex items-center">
                        <Mail className="absolute left-4 h-4 w-4 text-slate-400 pointer-events-none" />
                        <input
                          className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-11 pr-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-slate-100"
                          type="text"
                          value={email}
                          onChange={(event) => setEmail(event.target.value)}
                          placeholder="username@domain.com"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Password</label>
                      <div className="relative flex items-center">
                        <Lock className="absolute left-4 h-4 w-4 text-slate-400 pointer-events-none" />
                        <input
                          className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-11 pr-12 py-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-slate-100"
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(event) => setPassword(event.target.value)}
                          placeholder="••••••••"
                          required
                        />
                        <button
                          className="absolute right-4 p-1 rounded text-slate-400 hover:text-slate-600 transition focus:outline-none"
                          onClick={() => setShowPassword((prev) => !prev)}
                          type="button"
                          aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1">
                      <label className="inline-flex items-center gap-2.5 text-slate-500 cursor-pointer select-none">
                        <input
                          checked={keepLoggedIn}
                          className="h-4 w-4 rounded border-slate-300 bg-white text-[#0b2a57] focus:ring-0 focus:ring-offset-0 transition"
                          onChange={(event) => setKeepLoggedIn(event.target.checked)}
                          type="checkbox"
                        />
                        Keep me logged in
                      </label>

                      <button 
                        className="font-semibold text-slate-600 hover:text-[#0b2a57] transition  underline-offset-4" 
                        onClick={openForgotPasswordModal} 
                        type="button"
                      >
                        Forgot password?
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Premium Clean White OTP Input Section */
                  <section className={`rounded-xl border border-slate-200 bg-slate-50/60 p-5 ${otpShakeActive ? 'animate-[shake_0.3s_ease-in-out]' : ''}`}>
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">One-Time Password</p>
                        <p className="mt-0.5 text-xs text-slate-400">6-digit authorization standard code</p>
                      </div>
                      {otpEmail && <p className="text-[10px] font-medium px-2 py-0.5 rounded border border-slate-200 bg-white text-slate-600">{otpEmail}</p>}
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      {Array.from({ length: OTP_LENGTH }).map((_, index) => (
                        <input
                          key={`login-otp-${index}`}
                          ref={(el) => { otpInputRefs.current[index] = el }}
                          className="h-12 w-full rounded-xl border border-slate-200 bg-white text-center text-lg font-bold text-slate-800 shadow-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                          type="text"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          maxLength={1}
                          value={otp[index] ?? ''}
                          onChange={(e) => handleOtpDigitChange(index, e.target.value)}
                          onKeyDown={(e) => handleOtpKeyDown(index, e)}
                          onPaste={handleOtpPaste}
                        />
                      ))}
                    </div>
                  </section>
                )}

                {/* Main Action Button */}
                <motion.button
                  whileTap={{ scale: 0.99 }}
                  className="group relative w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0b2a57] to-[#123e7a] px-4 py-3 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(11,42,87,0.2)] transition hover:from-[#081e3f] hover:to-[#0d3161] disabled:cursor-not-allowed disabled:opacity-50"
                  type="submit"
                  disabled={isSubmitting || isRedirectingAfterLogin}
                >
                  <span>
                    {otpStep 
                      ? (isRedirectingAfterLogin ? 'Authentication Successful...' : 'Verify Security Code') 
                      : 'Login'}
                  </span>
                </motion.button>

                {/* Sub-navigation Links */}
                <AnimatePresence mode="wait">
                  {!otpStep ? (
                    <p className="text-center text-xs text-slate-500">
                      Don't have an account?{' '}
                      {onRequestRegister ? (
                        <button className="font-semibold text-slate-700 hover:text-[#0b2a57]  transition" onClick={onRequestRegister} type="button">
                          Create an account
                        </button>
                      ) : (
                        <Link className="font-semibold text-slate-700 hover:text-[#0b2a57]  transition" to="/register">
                          Create an account
                        </Link>
                      )}
                    </p>
                  ) : (
                    <div className="flex items-center justify-between gap-4 text-xs pt-1">
                      <button
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-semibold text-slate-600 hover:bg-slate-50 transition disabled:opacity-50"
                        onClick={handleResendOtp}
                        type="button"
                        disabled={cooldownRemaining > 0 || isSubmitting}
                      >
                        <RefreshCw className={`h-3 w-3 ${isSubmitting ? 'animate-spin' : ''}`} />
                        {cooldownRemaining > 0 ? `Resend code (${cooldownRemaining}s)` : 'Resend Code'}
                      </button>

                      <button
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-semibold text-slate-600 hover:bg-slate-50 transition"
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
                        <ArrowLeft className="h-3 w-3" />
                        Edit Credentials
                      </button>
                    </div>
                  )}
                </AnimatePresence>

                {/* Messages / Alerts Hooks */}
                {successMessage && (
                  <div className={`rounded-xl border p-4 ${showWelcomeCard ? 'border-blue-100 bg-blue-50/50' : 'border-slate-200 bg-slate-50'}`}>
                    {showWelcomeCard && (
                      <div className="inline-flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 uppercase tracking-wider mb-1.5">
                        <ShieldCheck className="h-3 w-3" /> Configuration Complete
                      </div>
                    )}
                    <p className="text-xs text-slate-600 leading-relaxed">{successMessage}</p>
                  </div>
                )}

                {skipOtpNotice && (
                  <div className="rounded-xl border border-blue-100 bg-blue-50/50 px-3 py-2.5 text-xs text-blue-700 flex items-start gap-2">
                    <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5 text-blue-600" />
                    <span>{skipOtpNotice}</span>
                  </div>
                )}

                {errorMessage && (
                  <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-xs text-red-600 flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-500" />
                    <span>{errorMessage}</span>
                  </div>
                )}
              </form>
            </div>
          </motion.section>
        </div>
      </div>

      {/* Account Recovery Light Mode Modal */}
      {showForgotPasswordModal && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm" onClick={closeForgotPasswordModal}>
          <motion.div 
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            className="w-full max-w-md mx-auto" 
            onClick={(e) => e.stopPropagation()}
          >
            <section className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-[0_24px_50px_rgba(15,23,42,0.15)] space-y-5">
              <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Security Core</p>
                  <h3 className="text-xl font-bold text-slate-900 mt-0.5">Forgot Password</h3>
                </div>
                <button
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
                  onClick={closeForgotPasswordModal}
                  type="button"
                >
                  Close
                </button>
              </div>

              <p className="text-xs text-slate-500 leading-relaxed">
                {forgotPasswordOtpStep
                  ? 'Provide the security code sent to your communication endpoint alongside your new desired token passphrase.'
                  : 'Enter your registered workspace system email address. We will route an automated standard security reset OTP.'}
              </p>

              <form className="space-y-4" onSubmit={handleForgotPasswordSubmit}>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Registered Email Endpoint</label>
                  <input
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-slate-400 transition"
                    onChange={(e) => setForgotPasswordEmail(e.target.value)}
                    placeholder="you@domain.gov.ph"
                    type="email"
                    value={forgotPasswordEmail}
                    disabled={forgotPasswordOtpStep || isForgotPasswordSubmitting}
                  />
                </div>

                {forgotPasswordOtpStep && (
                  <div className="space-y-4 border-t border-slate-100 pt-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">OTP Security Token</label>
                      <input
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-slate-400 transition font-mono tracking-wider"
                        onChange={(e) => setForgotPasswordOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="000000"
                        type="text"
                        inputMode="numeric"
                        value={forgotPasswordOtp}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">New Account Password</label>
                      <input
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-slate-400 transition"
                        onChange={(e) => setForgotPasswordNewPassword(e.target.value)}
                        placeholder="••••••••"
                        type="password"
                        value={forgotPasswordNewPassword}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Confirm New Password</label>
                      <input
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-slate-400 transition"
                        onChange={(e) => setForgotPasswordConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        type="password"
                        value={forgotPasswordConfirmPassword}
                      />
                    </div>
                  </div>
                )}

                <button
                  className="w-full rounded-xl bg-[#0b2a57] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#153e75] transition disabled:opacity-50"
                  type="submit"
                  disabled={isForgotPasswordSubmitting}
                >
                  {isForgotPasswordSubmitting ? 'Processing request...' : forgotPasswordOtpStep ? 'Update Password Keys' : 'Dispatch Security OTP'}
                </button>

                {forgotPasswordOtpStep && (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <button
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-600 hover:bg-slate-50 text-center font-semibold transition disabled:opacity-50"
                      onClick={handleForgotPasswordResendOtp}
                      type="button"
                      disabled={forgotPasswordCooldownRemaining > 0 || isForgotPasswordSubmitting}
                    >
                      {forgotPasswordCooldownRemaining > 0 ? `Resend (${forgotPasswordCooldownRemaining}s)` : 'Resend Code'}
                    </button>

                    <button
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-600 hover:bg-slate-50 text-center font-semibold transition"
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
                      Change Email
                    </button>
                  </div>
                )}
              </form>

              {forgotPasswordMessage && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  {forgotPasswordMessage}
                </div>
              )}

              {forgotPasswordError && (
                <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-600">
                  {forgotPasswordError}
                </div>
              )}
            </section>
          </motion.div>
        </div>
      )}
    </main>
  )
}