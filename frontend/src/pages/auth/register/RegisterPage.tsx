import { motion } from 'framer-motion'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useNavigate } from 'react-router-dom'

export function RegisterPage() {
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    console.log('Register payload:', { fullName, email, password })
    navigate('/')
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4 text-slate-800 sm:p-8">
      <div className="mx-auto w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="grid min-h-[640px] md:grid-cols-2">
          <motion.section
            animate={{ opacity: 1, x: 0 }}
            className="p-10"
            initial={{ opacity: 0, x: -70 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
          >
            <h1 className="text-4xl font-semibold text-slate-900">Register</h1>
            <p className="mt-2 text-sm text-slate-500">Create an account as Citizen or Admin</p>

            <form className="mt-10 space-y-7" onSubmit={handleSubmit}>
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Full Name
                </span>
                <input
                  className="w-full border-0 border-b border-slate-300 bg-transparent px-0 py-2 text-base outline-none placeholder:text-slate-400 focus:border-slate-700"
                  type="text"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="Full Name"
                />
              </label>

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

              <button
                className="w-full rounded-lg bg-slate-900 px-4 py-3 text-lg font-medium text-white transition hover:bg-slate-800"
                type="submit"
              >
                Register now
              </button>

              <div className="flex items-center justify-between">
                <Link className="text-sm font-semibold text-slate-700 underline" to="/login">
                  Log in now
                </Link>
              </div>
            </form>
          </motion.section>

          <motion.section
            animate={{ opacity: 1, x: 0 }}
            className="relative flex flex-col justify-between bg-slate-50 p-10"
            initial={{ opacity: 0, x: 70 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
          >
            <div>
              <p className="text-3xl font-medium text-slate-800">Community Access</p>
              <p className="mt-2 text-sm text-slate-600">
                For Citizens and LCDRRMO Admin responders
              </p>
            </div>
            <div className="py-6 text-sm text-slate-600">
              <p>Citizen Access</p>
              <p>Admin Access</p>
            </div>
            <p className="text-sm text-slate-600">
              Already registered in the response portal?{' '}
              <Link className="font-semibold text-slate-800 underline" to="/login">
                Log in now
              </Link>
            </p>
          </motion.section>
        </div>
      </div>
    </main>
  )
}
