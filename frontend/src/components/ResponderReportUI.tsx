// Building blocks shared by the responder Dashboard, Incidents and Reports pages, so a report looks the
// same wherever it appears: one row layout, one way to show its type and status, one details-sheet header.
import type { ReactNode } from 'react'
import { getIncidentCategoryKey, getIncidentCategoryMeta } from '../data/incidentCategories'

/** Display name and color of an incident type, as on Create Report and the admin pages. */
export function incidentTypeMeta(type: string): { label: string; color: string } {
  const meta = getIncidentCategoryMeta(getIncidentCategoryKey({ incidentType: type }))
  return { label: meta.key === 'other' && type ? type : meta.label, color: meta.color }
}

/** "3:05 PM" for today, "Nov 19" for this year, "Nov 19, 2025" for older dates. */
export function formatReportWhen(value?: string | null): string {
  const date = new Date(value || '')
  if (Number.isNaN(date.getTime())) return ''
  const now = new Date()
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  }
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }),
  })
}

export type StatusTone = 'green' | 'amber' | 'blue' | 'indigo' | 'slate'

const TONE_CLASSES: Record<StatusTone, { text: string; dot: string }> = {
  green: { text: 'text-emerald-700', dot: 'bg-emerald-500' },
  amber: { text: 'text-amber-700', dot: 'bg-amber-500' },
  blue: { text: 'text-blue-700', dot: 'bg-blue-500' },
  indigo: { text: 'text-indigo-700', dot: 'bg-indigo-500' },
  slate: { text: 'text-slate-500', dot: 'bg-slate-400' },
}

/** A status as a colored dot and a word: "Approved", "Awaiting approval", "Ready to compile"… */
export function StatusText({ tone, children }: { tone: StatusTone; children: ReactNode }) {
  const classes = TONE_CLASSES[tone]
  return (
    <span className={`inline-flex items-center gap-1.5 font-semibold ${classes.text}`}>
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${classes.dot}`} aria-hidden="true" />
      {children}
    </span>
  )
}

/** An incident type as a small tag with its color. */
export function TypeTag({ type, count }: { type: string; count?: number }) {
  const { label, color } = incidentTypeMeta(type)
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700">
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
      <span className="truncate">{label}</span>
      {count && count > 1 ? <span className="tabular-nums text-slate-400">×{count}</span> : null}
    </span>
  )
}

type ReportRowProps = {
  /** Color of the bar on the left (the incident type's color). */
  color?: string
  title: string
  /** Short date or time on the right. */
  when?: string
  subtitle?: ReactNode
  /** Status, team and similar details on the third line. */
  meta?: ReactNode
  onOpen: () => void
  openLabel?: string
  /** Shown on the right instead of the arrow, e.g. a checkbox. */
  trailing?: ReactNode
  selected?: boolean
}

/** One report in a list. The whole row opens its details; `trailing` sits beside it. */
export function ReportRow({ color, title, when, subtitle, meta, onOpen, openLabel, trailing, selected = false }: ReportRowProps) {
  return (
    <li className={`flex items-stretch transition-colors ${selected ? 'bg-blue-50/70' : ''}`}>
      <button
        type="button"
        onClick={onOpen}
        aria-label={openLabel}
        className="flex min-w-0 flex-1 items-stretch gap-3 py-3 pl-4 pr-3 text-left transition-colors hover:bg-slate-50 focus:outline-none focus-visible:bg-slate-50"
      >
        <span className="w-1 shrink-0 rounded-full" style={{ backgroundColor: color || '#94a3b8' }} aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className="truncate text-sm font-bold text-slate-900">{title}</span>
            {when ? <span className="shrink-0 text-xs font-semibold tabular-nums text-slate-400">{when}</span> : null}
          </span>
          {subtitle ? <span className="mt-0.5 block truncate text-xs text-slate-500">{subtitle}</span> : null}
          {meta ? <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">{meta}</span> : null}
        </span>
        {trailing ? null : (
          <svg className="h-4 w-4 shrink-0 self-center text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        )}
      </button>
      {trailing ? <span className="flex w-14 shrink-0 items-center justify-center border-l border-slate-100">{trailing}</span> : null}
    </li>
  )
}

/** A white card holding a list of report rows, with a title line and an optional footer. */
export function ReportListCard({
  title,
  aside,
  footer,
  children,
  labelledBy,
}: {
  title: ReactNode
  aside?: ReactNode
  footer?: ReactNode
  children: ReactNode
  labelledBy: string
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" aria-labelledby={labelledBy}>
      <div className="flex items-baseline justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <h2 id={labelledBy} className="text-sm font-black text-slate-900">
          {title}
        </h2>
        {aside ? <div className="shrink-0 text-xs">{aside}</div> : null}
      </div>
      {children}
      {footer}
    </section>
  )
}

/** Header of a details sheet: title, a line under it, the type tag and a close button. */
export function SheetHeader({ title, subtitle, type, onClose }: { title: string; subtitle?: ReactNode; type?: string; onClose: () => void }) {
  return (
    <>
      <div className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-slate-200" aria-hidden="true" />
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 pb-3 pt-2">
        <div className="min-w-0 space-y-1">
          <h2 className="truncate text-lg font-black tracking-tight text-slate-900">{title}</h2>
          {subtitle ? <p className="text-xs font-medium text-slate-500">{subtitle}</p> : null}
          {type ? <TypeTag type={type} /> : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="-mr-2 rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </>
  )
}

/** Small label above a value in a details sheet. */
export const DETAIL_LABEL_CLASS = 'block text-xs font-semibold text-slate-500'
