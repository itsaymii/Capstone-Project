import { Link } from 'react-router-dom'

export function LandingPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center p-6">
        <section className="w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-900/80 p-8 shadow-2xl backdrop-blur">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-cyan-300">
            Emergency Operations Portal
          </p>
          <h1 className="mt-3 text-3xl font-bold text-white">
            LCDRRMO Disaster Response System
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Secure access for Local Disaster Risk Reduction and Management Office personnel and
            citizens for coordinated preparedness and emergency response.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Link
              className="inline-flex items-center justify-center rounded-lg bg-cyan-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
              to="/login"
            >
              Login to Account
            </Link>
            <Link
              className="inline-flex items-center justify-center rounded-lg border border-slate-600 bg-slate-800 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:bg-slate-700"
              to="/register"
            >
              Register Account
            </Link>
          </div>

          <div className="mt-6 rounded-lg border border-slate-700 bg-slate-800/60 p-4 text-left">
            <p className="text-sm font-semibold text-slate-100">Access Types</p>
            <ul className="mt-2 space-y-1 text-sm text-slate-300">
              <li>• LCDRRMO Admin: incident management and operations control</li>
              <li>• Citizen: alerts, reporting, and community coordination</li>
            </ul>
          </div>
        </section>
      </div>
    </main>
  )
}
