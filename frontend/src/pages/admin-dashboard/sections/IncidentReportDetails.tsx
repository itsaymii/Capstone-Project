// Everything a responder filed on one report, for the admin: the type's details with readable labels,
// each person's fields, counts that follow directly from those rows, and the severity the backend set.
import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { SeverityBadge } from '../../../components/SeverityBadge'
import {
  formatDetailValue,
  getIncidentTypeConfig,
  type DetailFieldSpec,
  type DetailValue,
  type DetailValues,
  type IncidentTypeConfig,
} from '../../../data/incidentTypeFields'
import type { IncidentReport, IncidentReportVictim } from '../../../services/incidents'

type IncidentReportDetailsProps = {
  report: IncidentReport
  onClose: () => void
}

function hasValue(value: DetailValue | undefined | null): boolean {
  return value !== undefined && value !== null && value !== '' && !(Array.isArray(value) && value.length === 0)
}

/** Label / value pairs for the fields that have a value; empty fields are left out, 0 is kept. */
function filledFields(specs: DetailFieldSpec[], values: DetailValues | undefined): [string, string][] {
  if (!values) return []
  return specs.filter((spec) => hasValue(values[spec.name])).map((spec) => [spec.label, formatDetailValue(spec, values[spec.name])])
}

function numberOf(values: DetailValues | undefined, name: string): number | null {
  const value = values?.[name]
  if (!hasValue(value)) return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

type Count = { label: string; value: number | null; note?: string }

/**
 * Counts that follow directly from what was filed (a field, or the rows of people), never a score.
 * A missing field stays "Not recorded" instead of turning into 0.
 */
function countsFor(config: IncidentTypeConfig, details: DetailValues | undefined, victims: IncidentReportVictim[]): Count[] {
  const outcomes = (value: string) => victims.filter((victim) => victim.details?.outcome === value).length
  const people = victims.length

  switch (config.key) {
    case 'crime': {
      const recorded = victims.some((victim) => hasValue(victim.details?.outcome))
      return [
        { label: 'Deceased', value: recorded ? outcomes('deceased') : null },
        { label: 'Injured', value: recorded ? outcomes('injured') : null },
        { label: 'Not injured', value: recorded ? outcomes('not_injured') : null },
        { label: 'Total victims', value: people },
      ]
    }
    case 'fire': {
      const deaths = numberOf(details, 'fatalities')
      return [
        { label: 'Deaths', value: deaths },
        { label: 'Injured', value: people, note: 'People listed as casualties' },
        { label: 'Total casualties', value: deaths === null ? null : deaths + people, note: 'Deaths plus injured' },
      ]
    }
    case 'rca': {
      const graded = victims.filter((victim) => hasValue(victim.details?.injury_severity))
      return [
        { label: 'Fatalities', value: numberOf(details, 'fatalities') },
        { label: 'Vehicles', value: numberOf(details, 'vehicles_involved') },
        { label: 'Persons involved', value: people },
        {
          label: 'Injured',
          value: graded.length ? graded.filter((victim) => victim.details?.injury_severity !== 'none').length : null,
          note: 'Minor or severe injury',
        },
      ]
    }
    case 'drowning': {
      const rescued = numberOf(details, 'rescued_alive')
      const revived = numberOf(details, 'revived_cpr')
      return [
        {
          label: 'Survivors',
          value: rescued === null || revived === null ? null : rescued + revived,
          note: 'Rescued alive plus revived with CPR',
        },
        { label: 'Fatalities', value: numberOf(details, 'fatalities') },
        { label: 'Still missing', value: numberOf(details, 'missing') },
      ]
    }
    case 'standby':
      return [{ label: 'Persons assisted', value: numberOf(details, 'persons_assisted') }]
    case 'medical':
    case 'ambulance':
      return [{ label: 'Patients', value: people }]
    default:
      return []
  }
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2.5">
      <h3 className="text-sm font-black text-slate-900">{title}</h3>
      {children}
    </section>
  )
}

function FieldList({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-4 gap-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4 sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="text-xs font-semibold text-slate-500">{label}</dt>
          <dd className="mt-0.5 break-words text-sm font-semibold text-slate-900">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

function formatDateTime(value?: string): string {
  const date = new Date(value || '')
  return Number.isNaN(date.getTime())
    ? '-'
    : date.toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export function IncidentReportDetails({ report, onClose }: IncidentReportDetailsProps) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const type = report.incidentType || report.incident_type || ''
  const config = getIncidentTypeConfig(type)
  const details = report.details
  const victims = report.victims ?? []
  const code = report.reportCode || report.report_code || report.id

  // Focus the close button on open, close on Escape, and give focus back to the row afterwards.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      previous?.focus?.()
    }
  }, [onClose])

  const detailRows = config ? filledFields(config.fields, details) : []
  const hasNewDetails = detailRows.length > 0
  const counts = config ? countsFor(config, details, victims) : []
  const victimLabel = config?.victims.label || 'People involved'

  return (
    <div className="fixed inset-0 z-[60] flex justify-end" role="presentation">
      <button type="button" className="absolute inset-0 cursor-default bg-slate-900/40" aria-label="Close report details" tabIndex={-1} onClick={onClose} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-details-title"
        className="relative flex h-full w-full max-w-xl flex-col bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0 space-y-1.5">
            <p className="text-xs font-semibold text-slate-500">{config?.label || type || 'Incident report'}</p>
            <h2 id="report-details-title" className="truncate text-xl font-black tracking-tight text-slate-900">
              {code}
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <SeverityBadge level={report.severityLevel} emptyLabel="Severity not set" />
              <span className="text-xs text-slate-500">Filed {formatDateTime(report.createdAt || report.created_at)}</span>
            </div>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
          <Section title="Report">
            <FieldList
              rows={[
                ['Incident code', report.incidentCode || report.incident_code || '-'],
                ['Time it happened', report.timeOccurred || report.time_occurred || '-'],
                ['Location', report.location || '-'],
                ['Responding team', report.responderTeam || report.responder_team || '-'],
              ]}
            />
            {!report.severityLevel ? (
              <p className="text-xs text-slate-500">
                Severity is set by the system when an admin approves a report. This one has no linked incident, so it was not scored.
              </p>
            ) : null}
          </Section>

          {counts.length > 0 ? (
            <Section title="Counts">
              <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {counts.map((count) => (
                  <div key={count.label} className="rounded-xl border border-slate-200 bg-white p-3">
                    <dt className="text-xs font-semibold text-slate-500">{count.label}</dt>
                    <dd className="mt-1 text-lg font-black tabular-nums text-slate-900">
                      {count.value === null ? <span className="text-sm font-semibold text-slate-400">Not recorded</span> : count.value}
                    </dd>
                    {count.note ? <p className="mt-0.5 text-[11px] leading-snug text-slate-400">{count.note}</p> : null}
                  </div>
                ))}
              </dl>
            </Section>
          ) : null}

          <Section title={config ? `${config.label} details` : 'Details'}>
            {!config ? (
              <p className="text-sm text-slate-500">This incident type has no extra fields.</p>
            ) : hasNewDetails ? (
              <FieldList rows={detailRows} />
            ) : (
              <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
                No details were recorded. This report was filed before these fields were added, so its counts are unknown, not zero.
              </p>
            )}
          </Section>

          {config?.victims.allowed !== false ? (
            <Section title={`${victimLabel} (${victims.length})`}>
              {report.personalDataHidden ? (
                <p className="text-sm text-slate-500">Personal details are hidden for this report.</p>
              ) : victims.length === 0 ? (
                <p className="text-sm text-slate-500">No one was listed on this report.</p>
              ) : (
                <ol className="space-y-3">
                  {victims.map((victim, index) => {
                    const personal: [string, string][] = [
                      ['Age', victim.age],
                      ['Sex', victim.gender === 'M' ? 'Male' : victim.gender === 'F' ? 'Female' : ''],
                      ['Address', victim.address],
                      ['Condition', victim.condition],
                    ].filter(([, value]) => value) as [string, string][]
                    const typed = config ? filledFields(config.victimFields, victim.details) : []
                    return (
                      <li key={victim.id || index} className="rounded-xl border border-slate-200 p-4">
                        <p className="text-sm font-bold text-slate-900">
                          {victim.name || `Person ${index + 1}`}
                          <span className="ml-2 text-xs font-semibold text-slate-400">#{index + 1}</span>
                        </p>
                        {typed.length > 0 ? (
                          <dl className="mt-2 flex flex-wrap gap-2">
                            {typed.map(([label, value]) => (
                              <div key={label} className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs">
                                <dt className="inline font-semibold text-blue-900/70">{label}: </dt>
                                <dd className="inline font-bold text-blue-900">{value}</dd>
                              </div>
                            ))}
                          </dl>
                        ) : config && config.victimFields.length > 0 ? (
                          <p className="mt-2 text-xs text-slate-500">No {config.victimFields.map((spec) => spec.label.toLowerCase()).join(' or ')} recorded.</p>
                        ) : null}
                        {personal.length > 0 ? (
                          <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
                            {personal.map(([label, value]) => (
                              <div key={label} className="min-w-0">
                                <dt className="text-xs font-semibold text-slate-500">{label}</dt>
                                <dd className="break-words text-slate-800">{value}</dd>
                              </div>
                            ))}
                          </dl>
                        ) : null}
                      </li>
                    )
                  })}
                </ol>
              )}
            </Section>
          ) : null}

          {report.description ? (
            <Section title="Description">
              <p className="whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-sm leading-relaxed text-slate-700">{report.description}</p>
            </Section>
          ) : null}

          {report.actionTaken || report.action_taken ? (
            <Section title="Action taken">
              <p className="whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-sm leading-relaxed text-slate-700">
                {report.actionTaken || report.action_taken}
              </p>
            </Section>
          ) : null}
        </div>
      </aside>
    </div>
  )
}
