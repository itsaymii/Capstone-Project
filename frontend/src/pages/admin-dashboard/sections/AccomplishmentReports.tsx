import { useEffect, useMemo, useState } from 'react'
import { getAccomplishmentReports } from '../../../services/incidents'
import {
  INCIDENT_CATEGORIES,
  getIncidentCategoryKey,
  getIncidentCategoryMeta,
} from '../../../data/incidentCategories'

// Admin view of the accomplishment reports responders compile from their approved incident reports.

type Victim = {
  id?: string
  name?: string
  age?: string | number
  gender?: string
  address?: string
  condition?: string
}

type IncludedReport = {
  id?: string
  reportCode?: string
  incidentCode?: string
  incidentType?: string
  responderTeam?: string
  createdBy?: string | null
  location?: string
  barangayName?: string | null
  timeOccurred?: string
  actionTaken?: string
  description?: string
  victimCount?: number
  victims?: Victim[]
  createdAt?: string
}

type AccomplishmentItem = {
  id?: string
  compiledCode?: string
  title?: string
  reports?: IncludedReport[]
  totalReports?: number
  status?: string
  createdAt?: string
  compiledBy?: string | null
  compiledByName?: string | null
}

type TypeCount = { key: string; label: string; color: string; count: number }

type Summary = {
  item: AccomplishmentItem
  code: string
  reports: IncludedReport[]
  teams: string[]
  teamLabel: string
  preparedBy: string
  victims: number
  barangays: string[]
  types: TypeCount[]
  createdAt: Date | null
  searchText: string
}

const NO_TEAM = 'Team not recorded'

function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function toDate(value?: string): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function getVictimCount(report: IncludedReport): number {
  return Math.max(Number(report.victimCount ?? 0) || 0, report.victims?.length ?? 0)
}

function getBarangay(report: IncludedReport): string {
  const name = clean(report.barangayName)
  if (name) return name
  return clean(report.location).split(',').map((part) => part.trim()).find((part) => /barangay|brgy/i.test(part))?.replace(/^(barangay|brgy\.?)\s*/i, '') || ''
}

function summarize(item: AccomplishmentItem): Summary {
  const reports = item.reports ?? []
  const teams = Array.from(new Set(reports.map((report) => clean(report.responderTeam)).filter(Boolean)))
  const compiler = clean(item.compiledByName) || clean(item.compiledBy)
  // Old compilations may have no linked reports; the account that compiled them is then the team.
  const teamLabel = teams.length > 0 ? teams.join(', ') : compiler || NO_TEAM

  const typeCounts = new Map<string, number>()
  reports.forEach((report) => {
    const key = getIncidentCategoryKey({ incidentType: report.incidentType })
    typeCounts.set(key, (typeCounts.get(key) ?? 0) + 1)
  })
  const types = INCIDENT_CATEGORIES.filter((type) => typeCounts.has(type.key)).map((type) => ({
    key: type.key,
    label: type.label,
    color: type.color,
    count: typeCounts.get(type.key) ?? 0,
  }))

  const barangays = Array.from(new Set(reports.map(getBarangay).filter(Boolean))).sort()
  const code = clean(item.compiledCode) || 'Uncoded report'

  return {
    item,
    code,
    reports,
    teams,
    teamLabel,
    preparedBy: compiler,
    victims: reports.reduce((sum, report) => sum + getVictimCount(report), 0),
    barangays,
    types,
    createdAt: toDate(item.createdAt),
    searchText: [code, teamLabel, compiler, item.compiledBy, ...barangays, ...types.map((type) => type.label), ...reports.map((report) => `${report.reportCode} ${report.incidentCode} ${report.location}`)]
      .join(' ')
      .toLowerCase(),
  }
}

function formatDateTime(date: Date | null): string {
  if (!date) return '—'
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function formatLongDate(date: Date | null): string {
  if (!date) return '—'
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
}

function formatTimeOfDay(value?: string): string {
  const match = /^(\d{1,2}):(\d{2})/.exec(value || '')
  if (!match) return '—'
  const hours = Number(match[1])
  return `${hours % 12 || 12}:${match[2]} ${hours < 12 ? 'AM' : 'PM'}`
}

function initials(name: string): string {
  const letters = name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]?.toUpperCase() ?? '')
  return letters.join('') || '?'
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function plural(count: number, one: string, many = `${one}s`): string {
  return `${count.toLocaleString()} ${count === 1 ? one : many}`
}

function typeChipStyle(color: string) {
  return { color, borderColor: `${color}55`, backgroundColor: `${color}14` }
}

function buildPrintHtml(summary: Summary): string {
  const respondedTo = INCIDENT_CATEGORIES.filter((type) => type.key !== 'earthquake' && type.key !== 'other')
  const covered = new Set(summary.types.map((type) => type.key))

  const rows = summary.reports.length
    ? summary.reports
        .map((report) => {
          const date = toDate(report.createdAt)
          const victims = report.victims ?? []
          const victimLines = victims.length
            ? `<div><b>Victims:</b><ol>${victims
                .map((victim) => {
                  const details = [victim.gender, victim.age ? `${victim.age} y/o` : '', victim.condition, victim.address].filter(Boolean).join(', ')
                  return `<li>${escapeHtml(victim.name || 'Unidentified')}${details ? ` — ${escapeHtml(details)}` : ''}</li>`
                })
                .join('')}</ol></div>`
            : getVictimCount(report) > 0
              ? `<div><b>Victims:</b> ${getVictimCount(report)}</div>`
              : ''
          return `<tr>
            <td>${escapeHtml(formatTimeOfDay(report.timeOccurred))}<div class="muted">${escapeHtml(date ? date.toLocaleDateString() : '')}</div></td>
            <td>
              <b>${escapeHtml(getIncidentCategoryMeta(getIncidentCategoryKey({ incidentType: report.incidentType })).label)}</b>
              <div><b>Location:</b> ${escapeHtml(report.location || '—')}</div>
              <div><b>A/T:</b> ${escapeHtml(report.actionTaken || report.description || '—')}</div>
              ${victimLines}
            </td>
            <td>${escapeHtml(report.reportCode || '')}<div class="muted">${escapeHtml(report.incidentCode || '')}</div></td>
          </tr>`
        })
        .join('')
    : '<tr><td colspan="3">No incident reports are linked to this accomplishment report.</td></tr>'

  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(summary.code)}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 28px; color: #0f172a; }
    .top { text-align: center; margin-bottom: 18px; }
    .top p { margin: 2px 0; font-size: 12px; }
    h1 { font-size: 18px; margin: 10px 0 0; letter-spacing: .08em; }
    .meta { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px 24px; font-size: 12px; margin: 16px 0; }
    .meta b { display: inline-block; min-width: 120px; }
    .box { border: 1px solid #94a3b8; padding: 10px 12px; margin-bottom: 14px; }
    .label { font-size: 11px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; margin: 0 0 6px; }
    .checks { display: flex; flex-wrap: wrap; gap: 6px 16px; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border: 1px solid #334155; padding: 8px; vertical-align: top; text-align: left; }
    th { background: #f1f5f9; text-transform: uppercase; font-size: 11px; letter-spacing: .08em; }
    ol { margin: 4px 0 0 18px; padding: 0; }
    .muted { color: #64748b; font-size: 11px; margin-top: 2px; }
    .sign { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; margin-top: 40px; font-size: 12px; }
    .line { border-top: 1px solid #0f172a; padding-top: 4px; margin-top: 36px; text-align: center; }
  </style></head><body>
  <div class="top">
    <p>Republic of the Philippines</p>
    <p><b>City Disaster Risk Reduction and Management Office</b></p>
    <p>Lucena City</p>
    <h1>ACCOMPLISHMENT REPORT</h1>
  </div>
  <div class="meta">
    <div><b>Report No.:</b> ${escapeHtml(summary.code)}</div>
    <div><b>Date compiled:</b> ${escapeHtml(formatLongDate(summary.createdAt))}</div>
    <div><b>Responding team:</b> ${escapeHtml(summary.teamLabel)}</div>
    <div><b>Incidents covered:</b> ${summary.reports.length}</div>
    <div><b>Total victims:</b> ${summary.victims}</div>
    <div><b>Barangays:</b> ${escapeHtml(summary.barangays.join(', ') || '—')}</div>
  </div>
  <div class="box">
    <p class="label">Responded to</p>
    <div class="checks">${respondedTo
      .map((type) => `<span>${covered.has(type.key) ? '&#9745;' : '&#9744;'} ${escapeHtml(type.label)}</span>`)
      .join('')}</div>
  </div>
  <table>
    <thead><tr><th style="width:16%">Time</th><th>Activity</th><th style="width:18%">Remarks</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="sign">
    <div>Prepared by:<div class="line">${escapeHtml(summary.teamLabel)}</div></div>
    <div>Noted by:<div class="line">CDRRMO Officer</div></div>
  </div>
  </body></html>`
}

function printAccomplishmentReport(summary: Summary): void {
  const printWindow = window.open('', '_blank')
  if (!printWindow) return
  printWindow.document.write(buildPrintHtml(summary))
  printWindow.document.close()
  printWindow.focus()
  printWindow.print()
}

function StatTile({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500 sm:text-xs sm:tracking-[0.16em]">{label}</p>
      <p className="mt-2 text-3xl font-black text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{helper}</p>
    </div>
  )
}

function IncludedReportsTable({ reports }: { reports: IncludedReport[] }) {
  return (
    <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
      <table className="min-w-[720px] w-full text-left text-sm">
        <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
          <tr>
            <th className="px-4 py-3">Report</th>
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3">Time</th>
            <th className="px-4 py-3">Location</th>
            <th className="px-4 py-3 text-right">Victims</th>
            <th className="px-4 py-3">Action taken</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {reports.map((report, index) => {
            const meta = getIncidentCategoryMeta(getIncidentCategoryKey({ incidentType: report.incidentType }))
            return (
              <tr key={report.id || report.reportCode || index} className="align-top">
                <td className="px-4 py-3">
                  <p className="font-mono text-xs font-bold text-slate-900">{report.reportCode || '—'}</p>
                  <p className="font-mono text-[11px] text-slate-400">{report.incidentCode}</p>
                </td>
                <td className="px-4 py-3">
                  <span style={typeChipStyle(meta.color)} className="inline-flex rounded-md border px-2 py-0.5 text-[11px] font-bold">
                    {meta.key === 'other' && report.incidentType ? report.incidentType : meta.label}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                  {formatTimeOfDay(report.timeOccurred)}
                  <p className="text-[11px] text-slate-400">{toDate(report.createdAt)?.toLocaleDateString() ?? ''}</p>
                </td>
                <td className="px-4 py-3 text-slate-600">{report.location || '—'}</td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-900">{getVictimCount(report)}</td>
                <td className="max-w-xs px-4 py-3 text-slate-600">{report.actionTaken || report.description || '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function AccomplishmentCard({ summary }: { summary: Summary }) {
  const [isOpen, setIsOpen] = useState(false)
  const hasReports = summary.reports.length > 0
  const teamIsFallback = summary.teams.length === 0

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_10px_24px_rgba(15,23,42,0.06)]" data-testid="accomplishment-card">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-sm font-black text-white" aria-hidden="true">
            {initials(summary.teamLabel === NO_TEAM ? '' : summary.teamLabel)}
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-blue-700">Responding Team</p>
            <h3 className="break-words text-lg font-bold leading-snug text-slate-900" data-testid="card-team">
              {summary.teamLabel}
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              {summary.preparedBy ? <>Compiled by {summary.item.compiledBy ? `@${summary.item.compiledBy}` : summary.preparedBy}</> : 'Compiler not recorded'}
              {teamIsFallback && summary.preparedBy ? ' · team taken from the compiling account' : ''}
            </p>
          </div>
        </div>

        <div className="shrink-0 text-left sm:text-right">
          <p className="font-mono text-sm font-bold text-slate-900">{summary.code}</p>
          <p className="mt-0.5 text-xs text-slate-500">{formatDateTime(summary.createdAt)}</p>
          <span className="mt-2 inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 ring-1 ring-emerald-100">
            {summary.item.status || 'Compiled'}
          </span>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-slate-50 px-3 py-2.5">
          <dt className="text-[11px] font-semibold text-slate-500">Incidents</dt>
          <dd className="text-xl font-black tabular-nums text-slate-900">{summary.reports.length}</dd>
        </div>
        <div className="rounded-xl bg-slate-50 px-3 py-2.5">
          <dt className="text-[11px] font-semibold text-slate-500">Victims</dt>
          <dd className="text-xl font-black tabular-nums text-slate-900">{summary.victims}</dd>
        </div>
        <div className="rounded-xl bg-slate-50 px-3 py-2.5">
          <dt className="text-[11px] font-semibold text-slate-500">Barangays</dt>
          <dd className="text-xl font-black tabular-nums text-slate-900">{summary.barangays.length}</dd>
        </div>
      </dl>

      {summary.types.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {summary.types.map((type) => (
            <span key={type.key} style={typeChipStyle(type.color)} className="inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-bold">
              {type.label}
              <span className="tabular-nums opacity-80">×{type.count}</span>
            </span>
          ))}
        </div>
      )}

      {summary.barangays.length > 0 && (
        <p className="mt-3 text-xs text-slate-500">
          <span className="font-semibold text-slate-600">Barangays: </span>
          {summary.barangays.join(', ')}
        </p>
      )}

      {!hasReports && (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          No incident reports are linked to this accomplishment report. It was likely compiled before the compile fix, so the responder should compile those reports again.
        </p>
      )}

      {isOpen && hasReports && <IncludedReportsTable reports={summary.reports} />}

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
        {hasReports && (
          <button
            type="button"
            onClick={() => setIsOpen((open) => !open)}
            aria-expanded={isOpen}
            className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
          >
            {isOpen ? 'Hide incident reports' : `View ${plural(summary.reports.length, 'incident report')}`}
          </button>
        )}
        <button
          type="button"
          onClick={() => printAccomplishmentReport(summary)}
          className="rounded-xl bg-blue-600 px-3.5 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700"
        >
          Print Report
        </button>
      </div>
    </article>
  )
}

export function AccomplishmentReports() {
  const [reports, setReports] = useState<AccomplishmentItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [teamFilter, setTeamFilter] = useState('all')
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let isMounted = true
    setIsLoading(true)
    setLoadError('')
    getAccomplishmentReports()
      .then((data) => {
        if (isMounted) setReports(Array.isArray(data) ? data : [])
      })
      .catch((error) => {
        console.error('[AccomplishmentReports] Failed to load reports:', error)
        if (isMounted) setLoadError('Could not load accomplishment reports. Check the server connection and try again.')
      })
      .finally(() => {
        if (isMounted) setIsLoading(false)
      })
    return () => {
      isMounted = false
    }
  }, [reloadKey])

  const summaries = useMemo(() => reports.map(summarize), [reports])

  const teamOptions = useMemo(
    () => Array.from(new Set(summaries.flatMap((summary) => (summary.teams.length ? summary.teams : [summary.teamLabel])))).sort(),
    [summaries],
  )

  const visible = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return summaries
      .filter((summary) => teamFilter === 'all' || summary.teams.includes(teamFilter) || summary.teamLabel === teamFilter)
      .filter((summary) => !query || summary.searchText.includes(query))
      .sort((a, b) => {
        const difference = (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0)
        return sortOrder === 'newest' ? -difference : difference
      })
  }, [summaries, searchQuery, teamFilter, sortOrder])

  const totals = useMemo(
    () => ({
      incidents: visible.reduce((sum, summary) => sum + summary.reports.length, 0),
      victims: visible.reduce((sum, summary) => sum + summary.victims, 0),
      teams: new Set(visible.flatMap((summary) => (summary.teams.length ? summary.teams : [summary.teamLabel]))).size,
    }),
    [visible],
  )

  const isFiltered = Boolean(searchQuery.trim()) || teamFilter !== 'all'

  return (
    <section className="px-4 pb-10 pt-2 sm:px-6">
      <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_38px_rgba(15,23,42,0.08)]">
        <div className="border-b border-slate-200 pb-5">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">Responder Submission</p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">Accomplishment Reports</h2>
          <p className="mt-1 text-sm text-slate-500">
            Reports compiled by responding teams from their approved incident reports.
          </p>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatTile label="Accomplishment reports" value={visible.length.toLocaleString()} helper={isFiltered ? `of ${summaries.length} in total` : 'compiled by teams'} />
          <StatTile label="Incidents covered" value={totals.incidents.toLocaleString()} helper="approved incident reports" />
          <StatTile label="Victims assisted" value={totals.victims.toLocaleString()} helper="across the included incidents" />
          <StatTile label="Responding teams" value={totals.teams.toLocaleString()} helper="with at least one report" />
        </div>

        <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center">
          <label className="flex flex-1 items-center rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5">
            <span className="sr-only">Search</span>
            <input
              className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search report no., team, barangay, incident type…"
              type="search"
              value={searchQuery}
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <span className="shrink-0 font-semibold">Team</span>
            <select
              value={teamFilter}
              onChange={(event) => setTeamFilter(event.target.value)}
              className="w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 outline-none md:w-56"
              data-testid="team-filter"
            >
              <option value="all">All teams</option>
              {teamOptions.map((team) => (
                <option key={team} value={team}>{team}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <span className="shrink-0 font-semibold">Sort</span>
            <select
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value as 'newest' | 'oldest')}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 outline-none md:w-36"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </label>
        </div>

        <div className="mt-5 grid gap-4">
          {isLoading ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
              Loading accomplishment reports…
            </div>
          ) : loadError ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-6 text-center text-sm text-red-700">
              <p>{loadError}</p>
              <button
                type="button"
                onClick={() => setReloadKey((key) => key + 1)}
                className="mt-3 rounded-xl bg-white px-3.5 py-2 text-sm font-bold text-red-700 ring-1 ring-red-200 hover:bg-red-100"
              >
                Try again
              </button>
            </div>
          ) : visible.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
              {isFiltered ? 'No accomplishment reports match your search or team filter.' : 'No accomplishment reports yet. They appear here once a responding team compiles its approved reports.'}
            </div>
          ) : (
            visible.map((summary, index) => <AccomplishmentCard key={summary.item.id || summary.code || index} summary={summary} />)
          )}
        </div>
      </div>
    </section>
  )
}
