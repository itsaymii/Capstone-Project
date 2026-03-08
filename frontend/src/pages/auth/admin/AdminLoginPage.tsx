import { motion } from 'framer-motion'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'

export function AdminLoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [keepLoggedIn, setKeepLoggedIn] = useState(false)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    console.log('Admin login payload:', { email, password, keepLoggedIn })
    navigate('/landing')
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4 text-slate-800 sm:p-8">
      <div className="mx-auto w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-xl">
        <div className="grid min-h-[640px] md:grid-cols-2">
          <motion.section
            animate={{ opacity: 1, x: 0 }}
            className="relative flex flex-col justify-between bg-slate-100 p-10"
            initial={{ opacity: 0, x: -70 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
          >
            <div>
              <p className="text-3xl font-medium text-slate-800">Admin Access</p>
              <p className="mt-2 text-sm text-slate-600">For LCDRRMO responders and administrators</p>
            </div>
            <div className="py-6 text-sm text-slate-600">
              <p>Administrator Portal</p>
              <p>Operations and Coordination</p>
            </div>
          </motion.section>

          <motion.section
            animate={{ opacity: 1, x: 0 }}
            className="p-10"
            initial={{ opacity: 0, x: 70 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
          >
            <h1 className="text-4xl font-semibold text-slate-900">Admin Log in</h1>
            <p className="mt-2 text-sm text-slate-500">Secure access for admin users</p>

            <form className="mt-10 space-y-7" onSubmit={handleSubmit}>
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

              <button
                className="w-full rounded-lg bg-blue-700 px-4 py-3 text-lg font-medium text-white transition hover:bg-blue-600"
                type="submit"
              >
                Log in now
              </button>

              <div className="flex items-center justify-between">
                <Link className="text-sm font-semibold text-slate-700 underline" to="/login">
                  Citizen login
                </Link>
                <button className="text-sm font-semibold text-slate-700 underline" type="button">
                  Forgot your password?
                </button>
              </div>
            </form>
          </motion.section>
        </div>
      </div>
    </main>
  )
}