import { Link } from 'react-router-dom'
import { NavigationBar } from '../../components/NavigationBar'

const hotlineGroups = [
  {
    name: 'Lucena City Command Center',
    badge: '24/7 Dispatch',
    accentClass: 'from-[#c64f4f] via-[#db6a58] to-[#f1996c]',
    panelClass: 'from-[#fff7f4] via-[#fffdfb] to-[#fff1ea]',
    borderClass: 'border-[#efc9bf]',
    accentTextClass: 'text-[#b94b47]',
    numbers: ['911', '0970 128 5078', '0968 719 5568', '(042) 731 6009'],
  },
  {
    name: 'Lucena City Fire Station',
    badge: 'Fire Rescue',
    accentClass: 'from-[#db6b2b] via-[#eb8342] to-[#f0ab68]',
    panelClass: 'from-[#fff9f2] via-[#fffdfa] to-[#fff2e4]',
    borderClass: 'border-[#f0d1ba]',
    accentTextClass: 'text-[#cb6426]',
    numbers: ['0999 675 6455', '(042) 797 2320', '(042) 710 0110'],
  },
  {
    name: 'Lucena City Police Station',
    badge: 'Police Response',
    accentClass: 'from-[#173b67] via-[#25548d] to-[#5f8fc2]',
    panelClass: 'from-[#f4f8fc] via-[#fcfdff] to-[#edf4fb]',
    borderClass: 'border-[#c8d7e7]',
    accentTextClass: 'text-[#1d4b80]',
    numbers: ['0997 065 8944', '0998 598 5737', '(042) 373 7294', '(042) 788 4626'],
  },
]

export function EmergencyHotlinesPage() {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f7f3ee_0%,#f9fbfd_28%,#eef4f8_100%)] text-slate-900">
      <NavigationBar />

      <main className="px-6 pb-16 pt-8 sm:px-10 sm:pb-20 sm:pt-10">
        <div className="mx-auto w-full max-w-7xl">
          <div className="flex justify-start">
            <Link
              className="inline-flex items-center rounded-full border border-slate-300/90 bg-white/90 px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-[0_8px_18px_rgba(15,23,42,0.06)] backdrop-blur-sm transition hover:-translate-y-0.5 hover:border-[#1f4f82]/35 hover:text-[#1f4f82]"
              to="/landing"
            >
              Back to Home
            </Link>
          </div>

          <section className="relative mt-6 overflow-hidden rounded-[2rem] border border-[#d7dde4] bg-[linear-gradient(135deg,#112743_0%,#173960_38%,#214d77_100%)] px-6 py-10 text-white shadow-[0_28px_70px_rgba(15,23,42,0.16)] sm:px-10 sm:py-12">
            <div className="pointer-events-none absolute inset-y-0 right-0 w-[38%] bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.16)_0%,rgba(255,255,255,0)_72%)]" />
            <div className="pointer-events-none absolute -left-8 bottom-0 h-36 w-36 rounded-full bg-[#f39c7a]/20 blur-3xl" />

            <div className="relative max-w-4xl">
              <div>
                <p className="inline-flex rounded-full border border-white/15 bg-white/10 px-4 py-1 text-[11px] font-bold uppercase tracking-[0.24em] text-slate-100">
                  Emergency Directory
                </p>
                <h1 className="mt-4 max-w-3xl text-4xl font-black tracking-tight sm:text-5xl lg:text-[3.6rem] lg:leading-[1.02]">
                  Lucena City Emergency Hotline Directory
                </h1>
                <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-200 sm:text-base">
                  A cleaner quick-reference page for urgent rescue, fire, and police coordination. Use this as the first-contact directory during emergencies.
                </p>
              </div>
            </div>
          </section>

          <section className="mt-8 grid gap-6 lg:grid-cols-[1.12fr_0.88fr]">
            <article className="overflow-hidden rounded-[1.8rem] border border-slate-200/90 bg-white/85 shadow-[0_18px_44px_rgba(15,23,42,0.08)] backdrop-blur-sm">
              <div className="border-b border-slate-200/80 bg-[linear-gradient(90deg,#fff8f3_0%,#ffffff_52%,#f8fbff_100%)] px-6 py-6 sm:px-8 sm:py-7">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#c2574f]">Priority Line</p>
                    <h2 className="mt-2 text-5xl font-black leading-none tracking-tight text-[#bf514b] sm:text-6xl">911</h2>
                    <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-600 sm:text-base">
                      For critical incidents, start with the national emergency hotline before contacting the specialized local responder lines below.
                    </p>
                  </div>

                  <div className="rounded-[1.25rem] border border-[#e8cdc6] bg-white/85 px-4 py-3 text-sm font-semibold text-slate-700 shadow-[0_8px_20px_rgba(15,23,42,0.05)]">
                    Fast dispatch reference for Lucena City
                  </div>
                </div>
              </div>

              <div className="grid gap-5 px-6 py-6 sm:px-8 sm:py-8">
                {hotlineGroups.map((group) => (
                  <section
                    className={`rounded-[1.55rem] border ${group.borderClass} bg-gradient-to-br ${group.panelClass} p-5 shadow-[0_12px_26px_rgba(15,23,42,0.05)]`}
                    key={group.name}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className={`inline-flex rounded-full bg-gradient-to-r ${group.accentClass} px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-white shadow-sm`}>
                          {group.badge}
                        </p>
                        <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-900">{group.name}</h2>
                      </div>
                      <div className={`text-sm font-semibold ${group.accentTextClass}`}>Direct response numbers</div>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      {group.numbers.map((number) => (
                        <a
                          className="group rounded-[1.2rem] border border-white/90 bg-white/90 px-4 py-3 text-slate-800 shadow-[0_8px_18px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_14px_24px_rgba(15,23,42,0.08)]"
                          href={`tel:${number.replace(/[^\d+]/g, '')}`}
                          key={number}
                        >
                          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Tap to call</p>
                          <p className="mt-1 text-lg font-black tracking-wide text-slate-800">{number}</p>
                        </a>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </article>

            <aside className="space-y-6">
              <section className="overflow-hidden rounded-[1.8rem] border border-slate-200/90 bg-white/85 p-6 shadow-[0_18px_44px_rgba(15,23,42,0.08)] backdrop-blur-sm sm:p-7">
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#1f4f82]">Call Checklist</p>
                <div className="mt-5 space-y-4">
                  {[
                    'State the exact incident location immediately.',
                    'Describe whether the emergency involves fire, crime, accident, or medical danger.',
                    'Provide a callback number and keep your phone available.',
                    'Use 911 first when unsure which local unit should respond.',
                  ].map((item, index) => (
                    <div className="flex items-start gap-3" key={item}>
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#eef4fb] text-xs font-black text-[#1f4f82]">
                        0{index + 1}
                      </div>
                      <p className="pt-1 text-sm leading-relaxed text-slate-600 sm:text-[15px]">{item}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-[1.8rem] border border-slate-200/90 bg-[linear-gradient(180deg,#ffffff_0%,#f6f9fc_100%)] p-6 shadow-[0_18px_44px_rgba(15,23,42,0.08)] sm:p-7">
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#1f4f82]">Operations Address</p>
                <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-900">Lucena City Command Center</h2>
                <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
                  Lucena City Government Complex, Barangay Mayao Kanluran, Lucena City, Quezon Province
                </p>
                <div className="mt-5 rounded-[1.2rem] border border-slate-200 bg-white px-4 py-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Design Note</p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    This page is designed as a calm quick-reference surface so the essential numbers stay readable under pressure.
                  </p>
                </div>
              </section>

              <section className="rounded-[1.8rem] border border-[#dec8c0] bg-[linear-gradient(135deg,#fff6f2_0%,#fffefd_100%)] p-6 shadow-[0_16px_34px_rgba(15,23,42,0.06)] sm:p-7">
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#c2574f]">Quick Access</p>
                <a
                  className="mt-4 flex items-end justify-between rounded-[1.3rem] border border-[#ebd1ca] bg-white px-5 py-4 transition hover:-translate-y-0.5 hover:shadow-[0_12px_24px_rgba(15,23,42,0.06)]"
                  href="tel:911"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-500">National Emergency Hotline</p>
                    <p className="mt-1 text-4xl font-black tracking-tight text-[#bf514b]">911</p>
                  </div>
                  <span className="rounded-full bg-[#fff4ef] px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-[#bf514b]">
                    Call Now
                  </span>
                </a>
              </section>
            </aside>
          </section>
        </div>
      </main>
    </div>
  )
}