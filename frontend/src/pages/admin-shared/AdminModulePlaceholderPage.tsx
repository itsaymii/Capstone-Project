import { AdminSidebar } from '../../components/AdminSidebar'
import type { AdminNavKey } from '../../data/adminNavigation'

type AdminModulePlaceholderPageProps = {
  activeKey: AdminNavKey
  eyebrow: string
  title: string
  description: string
}

export function AdminModulePlaceholderPage({ activeKey, eyebrow, title, description }: AdminModulePlaceholderPageProps) {
  return (
    <div className="min-h-screen bg-[#181c23] text-slate-100 md:flex">
      <AdminSidebar activeKey={activeKey} />

      <main className="flex-1">
        <div className="border-b border-slate-800 bg-[#181c23]">
          <div className="mx-auto w-full max-w-6xl px-6 py-5 sm:px-10">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{eyebrow}</p>
            <h1 className="mt-1 text-2xl font-black text-white">{title}</h1>
          </div>
        </div>

        <div className="mx-auto w-full max-w-6xl px-6 py-8 sm:px-10">
          <section className="rounded-3xl border border-slate-700 bg-[#232837] p-6 shadow-[0_20px_45px_rgba(0,0,0,0.25)] sm:p-8">
            <span className="inline-flex rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-blue-200">
              Admin Workspace
            </span>
            <h2 className="mt-4 text-3xl font-black text-white">{title}</h2>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-300 sm:text-base">{description}</p>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-700 bg-[#1d2230] p-4">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Status</p>
                <p className="mt-2 text-lg font-semibold text-white">Sidebar route ready</p>
                <p className="mt-1 text-sm text-slate-400">This module now appears in the shared admin navigation.</p>
              </div>
              <div className="rounded-2xl border border-slate-700 bg-[#1d2230] p-4">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Next build step</p>
                <p className="mt-2 text-lg font-semibold text-white">Module content</p>
                <p className="mt-1 text-sm text-slate-400">Use this route as the entry point when you are ready to implement the full feature.</p>
              </div>
              <div className="rounded-2xl border border-slate-700 bg-[#1d2230] p-4">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Navigation</p>
                <p className="mt-2 text-lg font-semibold text-white">Consistent admin layout</p>
                <p className="mt-1 text-sm text-slate-400">The same sidebar is now shared across the admin workspace pages.</p>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}