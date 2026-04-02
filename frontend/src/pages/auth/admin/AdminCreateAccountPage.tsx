import axios from 'axios'
import { motion } from 'framer-motion'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { createDashboardAccount } from '../../../services/api'
import type { UserRole } from '../../../types/api'

export function AdminCreateAccountPage() {
  const [createFullName, setCreateFullName] = useState('')
  const [createEmail, setCreateEmail] = useState('')
  const [createUsername, setCreateUsername] = useState('')
  const [createPassword, setCreatePassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [createRole, setCreateRole] = useState<UserRole>('citizen')
  const [isCreatingAccount, setIsCreatingAccount] = useState(false)
  const [createAccountMessage, setCreateAccountMessage] = useState('')
  const [createAccountError, setCreateAccountError] = useState('')

  async function handleCreateAccount(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setIsCreatingAccount(true)
    setCreateAccountMessage('')
    setCreateAccountError('')

    if (!createFullName.trim() || !createEmail.trim() || !createPassword) {
      setCreateAccountError('Please fill in all required fields.')
      setIsCreatingAccount(false)
      return
    }

    if (createPassword.length < 6) {
      setCreateAccountError('Password must be at least 6 characters.')
      setIsCreatingAccount(false)
      return
    }

    try {
      const response = await createDashboardAccount({
        fullName: createFullName,
        email: createEmail,
        username: createUsername,
        password: createPassword,
        role: createRole,
      })

      setCreateAccountMessage(response.message)
      setCreateFullName('')
      setCreateEmail('')
      setCreateUsername('')
      setCreatePassword('')
      setCreateRole('citizen')
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401 || error.response?.status === 403) {
          setCreateAccountError('Please log in as admin first, then create accounts on this page.')
        } else {
          const apiError = (error.response?.data as { error?: string } | undefined)?.error
          setCreateAccountError(apiError ?? 'Unable to create account right now.')
        }
      } else {
        setCreateAccountError('Unable to create account right now.')
      }
    } finally {
      setIsCreatingAccount(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#e7efff_0%,#f8fbff_42%,#eef3f9_100%)] p-4 text-slate-800 sm:p-8">
      <div className="mx-auto w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.14)]">
        <div className="grid min-h-[640px] md:grid-cols-2">
          <motion.section
            animate={{ opacity: 1, x: 0 }}
            className="bg-white p-10 pt-14"
            initial={{ opacity: 0, x: -70 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
          >
            <h1 className="text-4xl font-bold tracking-tight text-slate-900">Create Account</h1>
            <p className="mt-2 text-sm text-slate-500">Create citizen or admin accounts</p>

            <form className="mt-10 space-y-7" onSubmit={handleCreateAccount}>
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Full Name</span>
                <input
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-base outline-none placeholder:text-slate-400 transition focus:border-[#0b2a57] focus:ring-2 focus:ring-[#0b2a57]/10"
                  type="text"
                  value={createFullName}
                  onChange={(event) => setCreateFullName(event.target.value)}
                  placeholder="Juan Dela Cruz"
                  required
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Email Address</span>
                <input
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-base outline-none placeholder:text-slate-400 transition focus:border-[#0b2a57] focus:ring-2 focus:ring-[#0b2a57]/10"
                  type="email"
                  value={createEmail}
                  onChange={(event) => setCreateEmail(event.target.value)}
                  placeholder="name@example.com"
                  required
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Username</span>
                <input
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-base outline-none placeholder:text-slate-400 transition focus:border-[#0b2a57] focus:ring-2 focus:ring-[#0b2a57]/10"
                  type="text"
                  value={createUsername}
                  onChange={(event) => setCreateUsername(event.target.value)}
                  placeholder="username"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Password</span>
                <div className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3">
                  <input
                    className="w-full border-0 bg-transparent px-0 py-3 text-base outline-none placeholder:text-slate-400"
                    type={showPassword ? 'text' : 'password'}
                    value={createPassword}
                    onChange={(event) => setCreatePassword(event.target.value)}
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

              <label className="block text-sm text-slate-700">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Account Role</span>
                <select
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-base outline-none placeholder:text-slate-400 transition focus:border-[#0b2a57] focus:ring-2 focus:ring-[#0b2a57]/10"
                  onChange={(event) => setCreateRole(event.target.value as UserRole)}
                  value={createRole}
                >
                  <option value="citizen">Citizen</option>
                  <option value="staff">Staff</option>
                  <option value="admin">Admin</option>
                </select>
              </label>

              <button
                className="w-full rounded-xl bg-gradient-to-r from-[#0b2a57] to-[#1d4f93] px-4 py-3 text-lg font-semibold text-white shadow-[0_12px_22px_rgba(11,42,87,0.25)] transition hover:from-[#123a73] hover:to-[#2563b0] disabled:cursor-not-allowed disabled:from-[#7f93b2] disabled:to-[#7f93b2]"
                type="submit"
                disabled={isCreatingAccount}
              >
                {isCreatingAccount ? 'Creating Account...' : 'Create Account'}
              </button>

              <div>
                <Link
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-3 font-semibold text-[#0b2a57] text-base transition hover:border-[#0b2a57] hover:bg-[#f5faff] disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400 inline-flex items-center justify-center"
                  to="/login"
                >
                  Sign in page
                </Link>
              </div>

              {createAccountMessage ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                  <p className="text-sm text-emerald-700">{createAccountMessage}</p>
                </div>
              ) : null}

              {createAccountError ? (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{createAccountError}</p>
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
              <p className="text-3xl font-semibold text-white">Admin Registration</p>
              <p className="mt-2 text-sm text-blue-100">Create accounts for citizens and responders</p>
            </div>
            <div className="space-y-2 py-6 text-sm text-blue-100">
              <p className="inline-flex rounded-full border border-white/30 bg-white/10 px-3 py-1">Citizen Account</p>
              <p className="inline-flex rounded-full border border-white/30 bg-white/10 px-3 py-1">Admin Account</p>
            </div>
            <p className="text-sm text-blue-100">Use this page after admin sign-in to onboard new users quickly.</p>
          </motion.section>
        </div>
      </div>
    </main>
  )
}

