import { Link } from 'react-router-dom'

export function LandingPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6 text-slate-800">
      <section className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-10 shadow-2xl">
        <h1 className="text-4xl font-semibold text-slate-900">Community Access Portal</h1>
        <p className="mt-3 text-sm text-slate-600">
          Choose where you want to go to continue.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            className="rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            to="/login"
          >
            Go to Login
          </Link>
          <Link
            className="rounded-lg border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            to="/register"
          >
            Go to Register
          </Link>
        </div>
      </section>
    </main>
  )
}
