import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { requestLoginOtp } from '../../../services/auth'

export function AdminLoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [keepLoggedIn, setKeepLoggedIn] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false)
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('')
  const [forgotPasswordMessage, setForgotPasswordMessage] = useState('')

  useEffect(() => {
    const logoutMessage = location.state?.logoutSuccessMessage as string | undefined
    if (!logoutMessage) {
      return
    }

    setSuccessMessage(logoutMessage)
    setErrorMessage('')
    navigate(location.pathname, { replace: true, state: {} })
  }, [location.pathname, location.state, navigate])

  async function handleCredentialSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setIsSubmitting(true)

    const result = await requestLoginOtp(email, password, keepLoggedIn, false, 'admin')
    setIsSubmitting(false)

    if (!result.success) {
      setErrorMessage(result.error ?? 'Unable to log in right now.')
      setSuccessMessage('')
      return
    }

    if (!result.skipOtp) {
      setErrorMessage('Admin OTP is temporarily bypassed only for admin accounts.')
      setSuccessMessage('')
      return
    }

    setErrorMessage('')
    setSuccessMessage(result.message ?? 'Login successful. Redirecting to admin dashboard...')

    window.setTimeout(() => {
      navigate('/admin-dashboard')
    }, 700)
  }

  function openForgotPasswordModal(): void {
    setForgotPasswordEmail(email)
    setForgotPasswordMessage('')
    setShowForgotPasswordModal(true)
  }

  function closeForgotPasswordModal(): void {
    setShowForgotPasswordModal(false)
  }

  function handleForgotPasswordSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()

    if (!forgotPasswordEmail.trim()) {
      setForgotPasswordMessage('Please enter your registered email address.')
      return
    }

    setForgotPasswordMessage('If the email exists in our records, reset instructions will be sent shortly.')
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#e7efff_0%,#f8fbff_42%,#eef3f9_100%)] p-4 text-slate-800 sm:p-8">
      <div className="mx-auto w-full max-w-4xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.14)]">
        <div className="grid min-h-[600px] md:grid-cols-2 gap-0 md:gap-8">
          <motion.section
            animate={{ opacity: 1, x: 0 }}
            className="relative flex flex-col justify-between overflow-hidden bg-[linear-gradient(140deg,#0d2f60_0%,#174b8f_55%,#2563b0_100%)] p-8 md:p-10"
            initial={{ opacity: 0, x: -70 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
          >
            <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-cyan-200/20 blur-2xl" />

            <div>
              <p className="text-3xl font-semibold text-white">Admin Access</p>
              <p className="mt-2 text-sm text-blue-100">Secure entry for LCDRRMO responders and administrators</p>
            </div>
            <div className="space-y-2 py-6 text-sm text-blue-100">
              <p className="inline-flex rounded-full border border-white/30 bg-white/10 px-3 py-1">Administrator Portal</p>
              <p className="inline-flex rounded-full border border-white/30 bg-white/10 px-3 py-1">Operations and Coordination</p>
            </div>
            <p className="text-sm text-blue-100">Authorized access for emergency operations management.</p>
          </motion.section>

          <motion.section
            animate={{ opacity: 1, x: 0 }}
            className="bg-white p-6 md:p-10 pt-10 md:pt-14 flex flex-col justify-center"
            initial={{ opacity: 0, x: 70 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
          >
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900">Welcome Back</h1>
            <p className="mt-2 text-sm text-slate-500">Administrator portal access</p>

            <form className="mt-8 md:mt-10 space-y-6 md:space-y-7" onSubmit={handleCredentialSubmit}>
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

              <div className="mt-2 flex items-center justify-between gap-4">
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

              <button
                className="w-full rounded-xl bg-gradient-to-r from-[#0b2a57] to-[#1d4f93] px-4 py-3 text-base md:text-lg font-semibold text-white shadow-[0_12px_22px_rgba(11,42,87,0.25)] transition hover:from-[#123a73] hover:to-[#2563b0] disabled:cursor-not-allowed disabled:from-[#7f93b2] disabled:to-[#7f93b2] mt-2"
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Logging in...' : 'Log In to Admin Dashboard'}
              </button>


              {successMessage ? (
                <div className="rounded-lg border border-[#0b2a57]/20 bg-gradient-to-r from-[#0b2a57]/5 via-white to-sky-50 px-3 py-2 mt-2">
                  <p className="text-sm font-medium text-[#0b2a57]">{successMessage}</p>
                </div>
              ) : null}

              {errorMessage ? (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 mt-2">{errorMessage}</p>
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
                Enter your registered email address. We will send password reset instructions if your account exists in our records.
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
                  />
                </label>

                <button
                  className="w-full rounded-lg bg-[#0b2a57] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#123a73]"
                  type="submit"
                >
                  Send Reset Instructions
                </button>
              </form>

              {forgotPasswordMessage ? (
                <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">{forgotPasswordMessage}</p>
              ) : null}
            </section>
          </div>
        </div>
      ) : null}
    </main>
  )
}
