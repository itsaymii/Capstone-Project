import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'

type ResponderPageHeaderProps = {
  title: string
  description: string
  /** Where the back button goes; the dashboard by default. */
  backTo?: string
  /** A small chip at the top right, e.g. the team name. */
  badge?: ReactNode
  /** Buttons or other controls shown under the text. */
  actions?: ReactNode
}

/** The header of the responder sub-pages (Incidents, Reports, Profile), in the same navy as the Dashboard. */
export function ResponderPageHeader({ title, description, backTo = '/responder-dashboard', badge, actions }: ResponderPageHeaderProps) {
  const navigate = useNavigate()

  return (
    <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white shadow-md">
      <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-indigo-600/10 opacity-60" aria-hidden="true" />
      <div className="relative space-y-3 p-5">
        <div className="flex items-center justify-between gap-3">
          <button
            className="-ml-1 inline-flex items-center gap-1 rounded-lg py-1 pl-1 pr-2 text-sm font-semibold text-slate-300 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            onClick={() => navigate(backTo)}
            type="button"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden="true">
              <path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Dashboard
          </button>
          {badge ? (
            <span className="truncate rounded-full border border-white/15 bg-white/10 px-2.5 py-0.5 text-xs font-bold text-blue-200">{badge}</span>
          ) : null}
        </div>
        <div>
          <h1 className="text-2xl font-black tracking-tight">{title}</h1>
          <p className="mt-1 text-sm leading-relaxed text-slate-300">{description}</p>
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </header>
  )
}
