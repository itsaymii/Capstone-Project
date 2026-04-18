import { useMemo, useState } from 'react'
import type { HazardIncident } from '../../../data/adminOperations'
import type { EarthquakeEvent } from '../../../services/earthquakes'
import { glassPanelClass, glassPanelSoftClass } from './constants'

type ReportHazardFilter = 'all' | 'FR' | 'EQ' | 'AC'

type ReportTableColumn<T> = {
  key: keyof T
  label: string
  align?: 'left' | 'center' | 'right'
}

type UnifiedHazardReportRow = {
  reportId: string
  reportType: string
  location: string
  dateTime: string
  responseTeam: string
  magnitude: string
  cause: string
  impactLevel: string
  riskLevel: string
  alertLevel: string
  sentVia: string
  status: string
  hazardCode: 'FR' | 'EQ' | 'AC'
  locationKey: string
  dateValue: string
}

type ReportsSectionProps = {
  reports: HazardIncident[]
  earthquakeEvents: EarthquakeEvent[]
  earthquakeFeedStatus: 'loading' | 'ready' | 'error'
  earthquakeLastUpdated: Date | null
  searchQuery: string
}

function getEarthquakeSeverity(magnitude: number): HazardIncident['severity'] {
  if (magnitude >= 5) return 'Critical'
  if (magnitude >= 4) return 'High'
  if (magnitude >= 3) return 'Moderate'
  return 'Low'
}

function getImpactLevelFromSeverity(severity: HazardIncident['severity']): string {
  switch (severity) {
    case 'Critical':
      return 'Severe'
    case 'High':
      return 'Significant'
    case 'Moderate':
      return 'Localized'
    default:
      return 'Minimal'
  }
}

function getRiskLevelFromSeverity(severity: HazardIncident['severity']): string {
  switch (severity) {
    case 'Critical':
      return 'Critical'
    case 'High':
      return 'High'
    case 'Moderate':
      return 'Medium'
    default:
      return 'Low'
  }
}

function getAlertLevelFromSeverity(severity: HazardIncident['severity']): string {
  switch (severity) {
    case 'Critical':
      return 'Emergency'
    case 'High':
      return 'Warning'
    case 'Moderate':
      return 'Watch'
    default:
      return 'Advisory'
  }
}

function getEarthquakeStatus(event: EarthquakeEvent): string {
  const hoursSinceEvent = (Date.now() - event.rawTimestamp) / (1000 * 60 * 60)

  if (event.magnitude >= 4.5 || hoursSinceEvent <= 24) {
    return 'Active monitoring'
  }

  if (event.magnitude >= 3.5 || hoursSinceEvent <= 72) {
    return 'Field review'
  }

  return 'Logged'
}

function escapeHtmlCell(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function parseClockTimeLabel(label: string): { hours: number; minutes: number } {
  const match = label.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (!match) {
    return { hours: 8, minutes: 0 }
  }

  let hours = Number(match[1])
  const minutes = Number(match[2])
  const meridiem = match[3].toUpperCase()

  if (meridiem === 'PM' && hours !== 12) {
    hours += 12
  }

  if (meridiem === 'AM' && hours === 12) {
    hours = 0
  }

  return { hours, minutes }
}

function buildIncidentDateValue(timeLabel: string, dayOffset: number): string {
  const { hours, minutes } = parseClockTimeLabel(timeLabel)
  const year = new Date().getFullYear()
  const date = new Date(year, 2, 17 - dayOffset, hours, minutes, 0, 0)
  return date.toISOString()
}

function formatReportDateTime(value: string): string {
  const parsedDate = new Date(value)
  if (Number.isNaN(parsedDate.getTime())) {
    return value
  }

  return parsedDate.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

const unifiedHazardReportColumns: ReportTableColumn<UnifiedHazardReportRow>[] = [
  { key: 'reportId', label: 'Report ID' },
  { key: 'reportType', label: 'Type' },
  { key: 'location', label: 'Location / Barangay' },
  { key: 'dateTime', label: 'Date and Time' },
  { key: 'responseTeam', label: 'Response Team' },
  { key: 'magnitude', label: 'Magnitude' },
  { key: 'cause', label: 'Cause' },
  { key: 'impactLevel', label: 'Impact Level' },
  { key: 'riskLevel', label: 'Risk Level' },
  { key: 'alertLevel', label: 'Alert Level' },
  { key: 'sentVia', label: 'Sent Via' },
  { key: 'status', label: 'Status' },
]

export function ReportsSection({
  reports,
  earthquakeEvents,
  earthquakeFeedStatus,
  earthquakeLastUpdated,
  searchQuery,
}: ReportsSectionProps) {
  const [reportStartDate, setReportStartDate] = useState('')
  const [reportEndDate, setReportEndDate] = useState('')
  const [reportHazardFilter, setReportHazardFilter] = useState<ReportHazardFilter>('all')
  const [reportLocationFilter, setReportLocationFilter] = useState('')

  const normalizedDashboardSearchQuery = searchQuery.trim().toLowerCase()
  const normalizedReportLocationFilter = reportLocationFilter.trim().toLowerCase()
  const isDateFilterActive = Boolean(reportStartDate || reportEndDate)

  const localHazardReportRows = useMemo<UnifiedHazardReportRow[]>(() => {
    const fireCauseLookup: Record<string, string> = {
      'fire-commercial': 'Electrical overload',
      'fire-barangay-10': 'Unattended cooking flame',
      'fire-industrial': 'Chemical ignition in storage area',
    }
    const accidentCauseLookup: Record<string, string> = {
      'acc-highway': 'Multi-vehicle collision',
      'acc-diversion': 'Road collision during peak traffic',
    }

    return reports.filter((incident) => incident.code !== 'EQ').map((incident, index) => {
      const hazardCode: 'FR' | 'EQ' | 'AC' = incident.code
      const dateValue = buildIncidentDateValue(incident.time, index)
      const riskLevel =
        incident.severity === 'Low'
          ? 'Low'
          : incident.severity === 'Moderate'
            ? 'Medium'
            : incident.severity === 'High'
              ? 'High'
              : 'Critical'
      const impactLevel =
        incident.severity === 'Low'
          ? 'Minimal'
          : incident.severity === 'Moderate'
            ? 'Localized'
            : incident.severity === 'High'
              ? 'Significant'
              : 'Severe'
      const alertLevel =
        incident.severity === 'Low'
          ? 'Advisory'
          : incident.severity === 'Moderate'
            ? 'Watch'
            : incident.severity === 'High'
              ? 'Warning'
              : 'Emergency'

      return {
        reportId: `RPT-${String(index + 1).padStart(3, '0')}`,
        reportType: incident.code === 'FR' ? 'Fire' : incident.code === 'EQ' ? 'Earthquake' : 'Accident',
        location: incident.location,
        dateTime: formatReportDateTime(dateValue),
        responseTeam: incident.responseTeam,
        magnitude: '-',
        cause:
          incident.code === 'FR'
            ? fireCauseLookup[incident.id] ?? 'Under investigation'
            : incident.code === 'AC'
              ? accidentCauseLookup[incident.id] ?? 'Traffic investigation ongoing'
              : '-',
        impactLevel,
        riskLevel,
        alertLevel,
        sentVia: index % 2 === 0 ? 'SMS' : 'Email',
        status: incident.status,
        hazardCode,
        locationKey: incident.location,
        dateValue,
      }
    })
  }, [reports])

  const earthquakeReportRows = useMemo<UnifiedHazardReportRow[]>(() => {
    return [...earthquakeEvents]
      .sort((left, right) => right.rawTimestamp - left.rawTimestamp)
      .map((event, index) => {
        const severity = getEarthquakeSeverity(event.magnitude)
        const dateValue = new Date(event.rawTimestamp).toISOString()

        return {
          reportId: `EQ-${String(index + 1).padStart(3, '0')}`,
          reportType: 'Earthquake',
          location: event.place,
          dateTime: formatReportDateTime(dateValue),
          responseTeam: 'Seismic Assessment Unit',
          magnitude: event.magnitude.toFixed(1),
          cause: 'Tectonic movement detected by USGS feed',
          impactLevel: getImpactLevelFromSeverity(severity),
          riskLevel: getRiskLevelFromSeverity(severity),
          alertLevel: getAlertLevelFromSeverity(severity),
          sentVia: 'USGS API',
          status: getEarthquakeStatus(event),
          hazardCode: 'EQ',
          locationKey: event.place,
          dateValue,
        }
      })
  }, [earthquakeEvents])

  const unifiedHazardReportRows = useMemo(
    () => [...earthquakeReportRows, ...localHazardReportRows],
    [earthquakeReportRows, localHazardReportRows],
  )

  function matchesReportDateRange(dateValue?: string): boolean {
    if (!dateValue) return true
    const parsedDate = new Date(dateValue)
    if (Number.isNaN(parsedDate.getTime())) return true
    if (reportStartDate) {
      const startDate = new Date(`${reportStartDate}T00:00:00`)
      if (parsedDate < startDate) return false
    }
    if (reportEndDate) {
      const endDate = new Date(`${reportEndDate}T23:59:59.999`)
      if (parsedDate > endDate) return false
    }
    return true
  }

  function matchesReportHazard(hazardCode?: 'FR' | 'EQ' | 'AC'): boolean {
    if (!hazardCode || reportHazardFilter === 'all') return true
    return reportHazardFilter === hazardCode
  }

  function matchesReportLocation(locationValue?: string): boolean {
    if (!normalizedReportLocationFilter) return true
    return (locationValue || '').toLowerCase().includes(normalizedReportLocationFilter)
  }

  function matchesDashboardSearch(row: UnifiedHazardReportRow): boolean {
    if (!normalizedDashboardSearchQuery) return true

    return [
      row.reportId,
      row.reportType,
      row.location,
      row.dateTime,
      row.responseTeam,
      row.magnitude,
      row.cause,
      row.impactLevel,
      row.riskLevel,
      row.alertLevel,
      row.sentVia,
      row.status,
    ].some((value) => value.toLowerCase().includes(normalizedDashboardSearchQuery))
  }

  const filteredUnifiedHazardReportRows = useMemo(
    () =>
      unifiedHazardReportRows.filter(
        (row) =>
          matchesReportHazard(row.hazardCode) &&
          matchesReportLocation(row.locationKey) &&
          matchesDashboardSearch(row) &&
          matchesReportDateRange(row.dateValue),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      unifiedHazardReportRows,
      reportHazardFilter,
      normalizedReportLocationFilter,
      normalizedDashboardSearchQuery,
      reportStartDate,
      reportEndDate,
    ],
  )

  const visibleReportLabel = `${filteredUnifiedHazardReportRows.length} of ${unifiedHazardReportRows.length} records visible`

  function resetReportFilters(): void {
    setReportStartDate('')
    setReportEndDate('')
    setReportHazardFilter('all')
    setReportLocationFilter('')
  }

  function downloadReportTableAsCsv<T extends Record<string, string | number>>(
    fileName: string,
    columns: ReportTableColumn<T>[],
    rows: T[],
  ): void {
    const escapeCsvValue = (value: string) => {
      if (/[",\n]/.test(value)) {
        return `"${value.replace(/"/g, '""')}"`
      }
      return value
    }

    const headerRow = columns.map((column) => escapeCsvValue(String(column.label))).join(',')
    const bodyRows = rows.map((row) =>
      columns.map((column) => escapeCsvValue(String(row[column.key] ?? ''))).join(','),
    )

    const csvContent = [headerRow, ...bodyRows].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const downloadUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = downloadUrl
    link.download = `${fileName}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(downloadUrl)
  }

  function printReportTable<T extends Record<string, string | number>>(
    title: string,
    description: string,
    columns: ReportTableColumn<T>[],
    rows: T[],
  ): void {
    const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=1200,height=900')
    if (!printWindow) return

    const headerCells = columns.map((column) => `<th>${escapeHtmlCell(String(column.label))}</th>`).join('')
    const bodyRows = rows
      .map(
        (row) =>
          `<tr>${columns.map((column) => `<td>${escapeHtmlCell(String(row[column.key] ?? ''))}</td>`).join('')}</tr>`,
      )
      .join('')

    printWindow.document.write(`
      <html>
        <head>
          <title>${escapeHtmlCell(title)}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 24px; color: #0f172a; }
            h1 { font-size: 22px; margin-bottom: 4px; }
            p { margin: 0 0 16px; color: #475569; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { border: 1px solid #cbd5e1; padding: 10px 12px; text-align: left; vertical-align: top; }
            th { background: #e2e8f0; text-transform: uppercase; font-size: 11px; letter-spacing: 0.08em; }
            tr:nth-child(even) td { background: #f8fafc; }
          </style>
        </head>
        <body>
          <h1>${escapeHtmlCell(title)}</h1>
          <p>${escapeHtmlCell(description)}</p>
          <table>
            <thead><tr>${headerCells}</tr></thead>
            <tbody>${bodyRows || '<tr><td colspan="99">No rows available for the selected filters.</td></tr>'}</tbody>
          </table>
        </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.focus()
    printWindow.print()
  }

  function renderReportTable<T extends Record<string, string | number>>(options: {
    title: string
    description: string
    columns: ReportTableColumn<T>[]
    rows: T[]
    emptyMessage: string
    exportFileName: string
    rowKey: (row: T, index: number) => string
  }) {
    const { title, description, columns, rows, emptyMessage, exportFileName, rowKey } = options

    return (
      <article className={`${glassPanelSoftClass} overflow-hidden p-0`}>
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 bg-[linear-gradient(180deg,#f8fafc_0%,#ffffff_100%)] px-5 py-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
            <p className="mt-1 text-sm text-slate-600">{description}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-700 transition hover:bg-slate-50"
              onClick={() => printReportTable(title, description, columns, rows)}
              type="button"
            >
              Print / Save PDF
            </button>
            <button
              className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700 transition hover:bg-emerald-100"
              onClick={() => downloadReportTableAsCsv(exportFileName, columns, rows)}
              type="button"
            >
              Export Excel CSV
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50/90">
              <tr>
                {columns.map((column) => (
                  <th
                    className={`px-4 py-3.5 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 ${
                      column.align === 'right' ? 'text-right' : column.align === 'center' ? 'text-center' : 'text-left'
                    }`}
                    key={String(column.key)}
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {rows.length > 0 ? (
                rows.map((row, index) => (
                  <tr className="transition hover:bg-slate-50/80" key={rowKey(row, index)}>
                    {columns.map((column) => (
                      <td
                        className={`px-4 py-4 align-top text-slate-700 ${
                          column.align === 'right' ? 'text-right' : column.align === 'center' ? 'text-center' : 'text-left'
                        }`}
                        key={String(column.key)}
                      >
                        {String(row[column.key] ?? '-')}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-4 py-6 text-center text-sm text-slate-500" colSpan={columns.length}>
                    {emptyMessage}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>
    )
  }

  return (
    <section className="px-6 py-8">
      <div className="grid gap-6">
        <div className={`${glassPanelClass} p-6`}>
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Reports Desk</p>
              <h2 className="mt-1 text-2xl font-bold text-slate-900">Unified Hazard Report Table</h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
                Fire and accident records remain local for now, while earthquake rows pull live Quezon-region events from the available USGS API.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-medium">
                <span
                  className={`rounded-full px-3 py-1 ${
                    earthquakeFeedStatus === 'loading'
                      ? 'bg-amber-100 text-amber-700'
                      : earthquakeFeedStatus === 'error'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-emerald-100 text-emerald-700'
                  }`}
                >
                  {earthquakeFeedStatus === 'loading'
                    ? 'Loading earthquake feed'
                    : earthquakeFeedStatus === 'error'
                      ? 'Earthquake feed unavailable'
                      : `${earthquakeEvents.length} live earthquake rows loaded`}
                </span>
                {earthquakeLastUpdated ? (
                  <span className="text-slate-500">
                    Updated {earthquakeLastUpdated.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                ) : null}
                <span className="text-slate-500">Default view shows all records. Date filters only narrow the list after you pick a start or end date.</span>
              </div>
            </div>
            <button
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              onClick={resetReportFilters}
              type="button"
            >
              Clear filters
            </button>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Start date (optional)
              <input
                className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-700"
                onChange={(event) => setReportStartDate(event.target.value)}
                type="date"
                value={reportStartDate}
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              End date (optional)
              <input
                className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-700"
                onChange={(event) => setReportEndDate(event.target.value)}
                type="date"
                value={reportEndDate}
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Type
              <select
                className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-700"
                onChange={(event) => setReportHazardFilter(event.target.value as ReportHazardFilter)}
                value={reportHazardFilter}
              >
                <option value="all">All types</option>
                <option value="FR">Fire</option>
                <option value="EQ">Earthquake</option>
                <option value="AC">Accident</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Location / Barangay
              <input
                className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-700"
                onChange={(event) => setReportLocationFilter(event.target.value)}
                placeholder="Filter by location"
                type="text"
                value={reportLocationFilter}
              />
            </label>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <span className="font-semibold text-slate-800">{visibleReportLabel}</span>
            <span>
              {isDateFilterActive
                ? 'Date filter is active. Clear the date fields to show the full dataset again.'
                : 'No date filter applied. All available records are currently displayed.'}
            </span>
          </div>
        </div>

        {renderReportTable({
          title: 'Hazard Incident Master Table',
          description: 'Combined admin report table for earthquake, fire, and accident records with print and export support.',
          columns: unifiedHazardReportColumns,
          rows: filteredUnifiedHazardReportRows,
          emptyMessage: 'No hazard report rows match the current filters.',
          exportFileName: 'hazard-incident-master-report',
          rowKey: (row) => row.reportId,
        })}
      </div>
    </section>
  )
}
