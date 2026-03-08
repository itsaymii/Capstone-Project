import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { NavigationBar } from '../../components/NavigationBar'
import { getCurrentUserProfile, updateCurrentUserProfile } from '../../services/auth'

export function ProfileSettingsPage() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    const profile = getCurrentUserProfile()
    if (!profile) {
      return
    }

    setFullName(profile.fullName)
    setEmail(profile.email)
  }, [])

  const profileInitials = useMemo(() => {
    const segments = fullName
      .trim()
      .split(/\s+/)
      .filter(Boolean)

    if (segments.length === 0) {
      return 'U'
    }

    if (segments.length === 1) {
      return segments[0].slice(0, 2).toUpperCase()
    }

    return `${segments[0][0]}${segments[1][0]}`.toUpperCase()
  }, [fullName])

  function handleSaveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const updated = updateCurrentUserProfile(fullName)
    if (!updated) {
      setErrorMessage('Unable to update profile right now. Please try again.')
      setStatusMessage('')
      return
    }

    setErrorMessage('')
    setStatusMessage('Profile settings saved successfully.')
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-800">
      <NavigationBar variant="hero" />

      <div className="mx-auto w-full max-w-4xl px-6 py-10 sm:px-8">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-lg sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Account</p>
          <h1 className="mt-2 text-3xl font-black text-slate-900 sm:text-4xl">Profile Settings</h1>
          <p className="mt-2 text-sm text-slate-600">Manage your account details used across the DRRMO portal.</p>

          <div className="mt-6 flex items-center gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#0b2a57] text-lg font-bold text-white">
              {profileInitials}
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">{fullName || 'User Profile'}</p>
              <p className="text-xs text-slate-600">{email || 'No email found'}</p>
            </div>
          </div>

          <form className="mt-6 space-y-5" onSubmit={handleSaveProfile}>
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Full Name</span>
              <input
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-600"
                type="text"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Enter your full name"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Email</span>
              <input
                className="w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-600 outline-none"
                type="email"
                value={email}
                disabled
                readOnly
              />
            </label>

            <button
              className="inline-flex rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-600"
              type="submit"
            >
              Save Changes
            </button>

            {statusMessage ? (
              <p className="rounded-lg border border-[#0b2a57]/20 bg-gradient-to-r from-[#0b2a57]/5 via-white to-sky-50 px-3 py-2 text-sm font-medium text-[#0b2a57]">
                {statusMessage}
              </p>
            ) : null}

            {errorMessage ? (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{errorMessage}</p>
            ) : null}
          </form>
        </section>
      </div>
    </main>
  )
}
