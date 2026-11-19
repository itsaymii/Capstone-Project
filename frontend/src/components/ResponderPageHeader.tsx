import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'

type ResponderPageHeaderProps = {
  title: string
  description: string
  /** Where the back button goes; the dashboard by default. */
  backTo?: string
  /** Buttons or other controls shown on the right (below the text on phones). */
  actions?: ReactNode
}

/** The header of the responder sub-pages (Incidents, Reports, Profile): back button, title and one line of help. */
export function ResponderPageHeader({ title, description, backTo = '/responder-dashboard', actions }: ResponderPageHeaderProps) {
  const navigate = useNavigate()

  return (
    <header className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white px-4 pb-4 pt-5 shadow-sm sm:px-6 sm:pb-5 sm:pt-6">
      <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500" aria-hidden="true" />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <button
            className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 transition-colors hover:bg-blue-50 hover:text-blue-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            onClick={() => navigate(backTo)}
            aria-label="Back to dashboard"
            type="button"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden="true">
              <path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className="min-w-0">
            <h1 className="text-xl font-black leading-tight tracking-tight text-slate-900 sm:text-2xl">{title}</h1>
            <p className="mt-1 max-w-xl text-sm leading-relaxed text-slate-500">{description}</p>
          </div>
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
      </div>
    </header>
  )
}
