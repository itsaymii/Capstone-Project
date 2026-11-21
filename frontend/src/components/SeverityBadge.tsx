// Severity as the backend scored it: Low (0–25), Moderate (26–50), High (51–75), Critical (76–100).
// The browser only shows the label it gets; it never works out a score itself.

export type SeverityLevel = 'low' | 'moderate' | 'high' | 'critical'

const SEVERITY_STYLES: Record<SeverityLevel, { label: string; className: string; dot: string }> = {
  low: { label: 'Low', className: 'border-emerald-200 bg-emerald-50 text-emerald-800', dot: 'bg-emerald-500' },
  moderate: { label: 'Moderate', className: 'border-amber-200 bg-amber-50 text-amber-800', dot: 'bg-amber-500' },
  high: { label: 'High', className: 'border-orange-200 bg-orange-50 text-orange-800', dot: 'bg-orange-500' },
  critical: { label: 'Critical', className: 'border-red-200 bg-red-50 text-red-800', dot: 'bg-red-600' },
}

export function toSeverityLevel(value?: string | null): SeverityLevel | null {
  const level = String(value || '').trim().toLowerCase()
  return level in SEVERITY_STYLES ? (level as SeverityLevel) : null
}

type SeverityBadgeProps = {
  level?: string | null
  /** Shown when there is no severity yet, e.g. "Not scored". */
  emptyLabel?: string
}

/** Color plus the word, so the meaning does not depend on color alone. */
export function SeverityBadge({ level, emptyLabel = 'Not scored' }: SeverityBadgeProps) {
  const known = toSeverityLevel(level)
  if (!known) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-semibold text-slate-500">
        {emptyLabel}
      </span>
    )
  }
  const style = SEVERITY_STYLES[known]
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-bold ${style.className}`}>
      <span className={`h-2 w-2 shrink-0 rounded-full ${style.dot}`} aria-hidden="true" />
      {style.label}
      <span className="sr-only"> severity</span>
    </span>
  )
}
