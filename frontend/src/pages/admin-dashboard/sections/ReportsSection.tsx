import { useMemo, useState } from 'react'
import { TablePagination } from '../../../components/TablePagination'
import { PAGE_SIZE_OPTIONS, clampPage } from '../../../components/pagination'
import { jsPDF } from 'jspdf'
import type { HazardIncident } from '../../../data/adminOperations'
import type { EarthquakeEvent } from '../../../services/earthquakes'
import { glassPanelClass, glassPanelSoftClass } from './constants'
import { distanceKm } from '../../../data/evacuation'

type ReportHazardFilter = 'all' | 'FR' | 'EQ' | 'AC'

// Approved only by default, so unverified reports are not printed as official ones.
type ReportStatusFilter = 'approved' | 'pending' | 'all'

// The earthquake feed covers the whole Philippines. The report only keeps earthquakes that can be
// felt in Lucena: within this distance of the city center and at least this magnitude.
const LUCENA_CENTER = { lat: 13.9414, lng: 121.6236 }
const REPORT_EARTHQUAKE_RADIUS_KM = 100
const REPORT_EARTHQUAKE_MIN_MAGNITUDE = 3

type PdfAction = 'save' | 'print'

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
  severity: string
  victims: string
  incidentStatus: string
  sentVia: string
  status: string
  hazardCode: 'FR' | 'EQ' | 'AC'
  // 'feed' for earthquakes: they come from USGS and are never reviewed by an admin.
  approval: 'approved' | 'pending' | 'feed'
  locationKey: string
  dateValue: string
}

type ResponderReport = {
  id: string
  reportCode?: string
  incidentCode?: string
  incidentType?: string
  responderTeam?: string
  location?: string
  actionTaken?: string
  createdAt?: string
  status?: string
}

type ReportsSectionProps = {
  reports: HazardIncident[]
  responderReports: ResponderReport[]
  earthquakeEvents: EarthquakeEvent[]
  earthquakeFeedStatus: 'loading' | 'ready' | 'error'
  earthquakeLastUpdated: Date | null
  searchQuery: string
}

const hazardTypeLabels: Record<'FR' | 'EQ' | 'AC', string> = {
  FR: 'Fire',
  EQ: 'Earthquake',
  AC: 'Accident',
}

function getSentViaLabel(createdByRole: string): string {
  switch (createdByRole.toLowerCase()) {
    case 'admin':
      return 'Admin'
    case 'staff':
      return 'Staff'
    case 'anonymous':
      return 'Public'
    default:
      return 'Responder'
  }
}

/** Approved once an admin approved the report (or the incident is verified or later); otherwise pending. */
function getApproval(rawStatus: string): 'approved' | 'pending' {
  const status = rawStatus.trim().toLowerCase()
  return ['approved', 'approve', 'verified', 'accepted', 'ongoing', 'on-going', 'contained', 'resolved'].includes(status)
    ? 'approved'
    : 'pending'
}

function toTitleCase(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function pickText(record: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = record[key]
    if (value !== undefined && value !== null && String(value).trim() !== '') return String(value).trim()
  }
  return ''
}

function isValidDate(value: string): boolean {
  return value !== '' && !Number.isNaN(new Date(value).getTime())
}

function escapeHtmlCell(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatReportDateTime(value: string): string {
  if (!value) return '-'
  const parsedDate = new Date(value)
  if (Number.isNaN(parsedDate.getTime())) return value

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
  { key: 'severity', label: 'Severity' },
  { key: 'victims', label: 'Victims', align: 'center' },
  { key: 'incidentStatus', label: 'Incident Status' },
  { key: 'sentVia', label: 'Sent Via' },
  { key: 'status', label: 'Report Status' },
]

export function ReportsSection({
  reports,
  responderReports,
  earthquakeEvents,
  earthquakeFeedStatus,
  earthquakeLastUpdated,
  searchQuery,
}: ReportsSectionProps) {
  const [reportStartDate, setReportStartDate] = useState('')
  const [reportEndDate, setReportEndDate] = useState('')
  const [reportHazardFilter, setReportHazardFilter] = useState<ReportHazardFilter>('all')
  const [reportLocationFilter, setReportLocationFilter] = useState('')
  const [reportStatusFilter, setReportStatusFilter] = useState<ReportStatusFilter>('approved')

  const normalizedDashboardSearchQuery = searchQuery.trim().toLowerCase()
  const normalizedReportLocationFilter = reportLocationFilter.trim().toLowerCase()

  // `reports` is already the single, de-duplicated source from the dashboard:
  // responder-submitted IncidentReports when there are any, otherwise admin Incidents.
  // Do NOT also add `responderReports` here, or every responder report shows up twice.
  const incidentReportRows = useMemo<UnifiedHazardReportRow[]>(() => {
    return reports.map((incident) => {
      const record = incident as HazardIncident & Record<string, unknown>
      const isResponderReport = pickText(record, 'reportCode', 'incidentType') !== ''

      const reportId =
        pickText(record, 'reportCode', 'incidentCode', 'referenceCode', 'reference_code') || incident.id
      const dateValue = pickText(record, 'createdAt', 'reportedAt', 'created_at')

      const incidentType = pickText(record, 'incidentType')
      const rawStatus = pickText(record, 'reportStatus') || incident.status
      // Status of the incident created on approval (e.g. On-going, Resolved); none while pending.
      const incidentStatus = isResponderReport ? pickText(record, 'linkedIncidentStatus') : incident.status
      const victims = pickText(record, 'victimCount', 'victim_count')

      return {
        reportId,
        reportType: incidentType || pickText(record, 'hazardTypeName') || hazardTypeLabels[incident.code],
        location: incident.location || '-',
        dateTime: formatReportDateTime(dateValue),
        responseTeam: incident.responseTeam || '-',
        magnitude: '-',
        cause: (incident.description && incident.description !== '-' ? incident.description : '') || 'Under investigation',
        // Severity of the linked incident, or the backend's rule while there is none (see the dashboard).
        severity: incident.severity || '-',
        victims: victims || (isResponderReport ? '0' : '-'),
        incidentStatus: toTitleCase(incidentStatus) || '-',
        sentVia: isResponderReport ? getSentViaLabel(pickText(record, 'createdByRole')) : 'Admin',
        status: toTitleCase(rawStatus) || '-',
        hazardCode: incident.code,
        approval: getApproval(rawStatus),
        locationKey: incident.location || '',
        dateValue,
      }
    })
  }, [reports])

  // Earthquakes near Lucena, each with its distance from the city.
  const nearbyEarthquakes = useMemo(
    () =>
      earthquakeEvents
        .filter((event) => Number.isFinite(event.lat) && Number.isFinite(event.lng))
        .map((event) => ({ event, km: distanceKm(LUCENA_CENTER.lat, LUCENA_CENTER.lng, event.lat, event.lng) }))
        .filter(({ event, km }) => km <= REPORT_EARTHQUAKE_RADIUS_KM && event.magnitude >= REPORT_EARTHQUAKE_MIN_MAGNITUDE),
    [earthquakeEvents],
  )

  const earthquakeReportRows = useMemo<UnifiedHazardReportRow[]>(() => {
    return [...nearbyEarthquakes]
      .sort((left, right) => right.event.rawTimestamp - left.event.rawTimestamp)
      .map(({ event, km }) => {
        const dateValue = new Date(event.rawTimestamp).toISOString()

        return {
          // USGS event ID: stays the same across reloads, so it can be traced back to the source.
          reportId: `EQ-${event.id}`,
          reportType: 'Earthquake',
          location: `${event.place} (${Math.round(km)} km from Lucena)`,
          dateTime: formatReportDateTime(dateValue),
          // No DRRMO team or assessment is attached to a feed record: only the measured values.
          responseTeam: '-',
          magnitude: event.magnitude.toFixed(1),
          cause: 'Tectonic movement detected by USGS feed',
          severity: '-',
          victims: '-',
          incidentStatus: '-',
          sentVia: 'USGS API',
          status: 'USGS record',
          hazardCode: 'EQ',
          approval: 'feed',
          locationKey: event.place,
          dateValue,
        }
      })
  }, [nearbyEarthquakes])

  // Newest first across all sources; rows without a valid date go last.
  const unifiedHazardReportRows = useMemo(
    () =>
      [...earthquakeReportRows, ...incidentReportRows].sort((left, right) => {
        const leftTime = isValidDate(left.dateValue) ? new Date(left.dateValue).getTime() : -Infinity
        const rightTime = isValidDate(right.dateValue) ? new Date(right.dateValue).getTime() : -Infinity
        return rightTime - leftTime
      }),
    [earthquakeReportRows, incidentReportRows],
  )

  function matchesReportDateRange(dateValue?: string): boolean {
    if (!reportStartDate && !reportEndDate) return true

    // When a date range is set, rows with no real date cannot be shown as "within" it.
    if (!dateValue || !isValidDate(dateValue)) return false

    const parsedDate = new Date(dateValue)

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

  function matchesReportStatus(approval: UnifiedHazardReportRow['approval']): boolean {
    if (reportStatusFilter === 'all') return true
    if (reportStatusFilter === 'pending') return approval === 'pending'
    return approval !== 'pending'
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
      row.severity,
      row.incidentStatus,
      row.sentVia,
      row.status,
    ].some((value) => value.toLowerCase().includes(normalizedDashboardSearchQuery))
  }

  const filteredUnifiedHazardReportRows = useMemo(
    () =>
      unifiedHazardReportRows.filter(
        (row) =>
          matchesReportHazard(row.hazardCode) &&
          matchesReportStatus(row.approval) &&
          matchesReportLocation(row.locationKey) &&
          matchesDashboardSearch(row) &&
          matchesReportDateRange(row.dateValue),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      unifiedHazardReportRows,
      reportHazardFilter,
      reportStatusFilter,
      normalizedReportLocationFilter,
      normalizedDashboardSearchQuery,
      reportStartDate,
      reportEndDate,
    ],
  )

  // The table shows one page at a time; Save PDF, Print and CSV still use every matching row.
  // A change to any filter (or the dashboard search) starts again at page 1.
  const filterKey = [
    reportHazardFilter,
    reportStatusFilter,
    normalizedReportLocationFilter,
    normalizedDashboardSearchQuery,
    reportStartDate,
    reportEndDate,
  ].join('|')
  const [pageState, setPageState] = useState({ filterKey, page: 1 })
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0])
  const currentPage = clampPage(
    pageState.filterKey === filterKey ? pageState.page : 1,
    filteredUnifiedHazardReportRows.length,
    pageSize,
  )
  const pageRows = useMemo(
    () => filteredUnifiedHazardReportRows.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [filteredUnifiedHazardReportRows, currentPage, pageSize],
  )

  function goToPage(page: number): void {
    setPageState({ filterKey, page })
  }

  function resetReportFilters(): void {
    setReportStartDate('')
    setReportEndDate('')
    setReportHazardFilter('all')
    setReportStatusFilter('approved')
    setReportLocationFilter('')
  }

  // Shown under the filters so it is clear pending reports exist but are left out.
  const hiddenPendingCount =
    reportStatusFilter === 'approved' ? incidentReportRows.filter((row) => row.approval === 'pending').length : 0

  function downloadReportTableAsCsv<T extends Record<string, string | number>>(
    fileName: string,
    columns: ReportTableColumn<T>[],
    rows: T[],
  ): void {
    const escapeCsvValue = (value: string) => {
      if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
      return value
    }

    const headerRow = columns.map((column) => escapeCsvValue(String(column.label))).join(',')
    const bodyRows = rows.map((row) =>
      columns.map((column) => escapeCsvValue(String(row[column.key] ?? ''))).join(','),
    )

    // The BOM (﻿) makes Excel read the file as UTF-8, so letters like "ñ" are not garbled.
    const csvContent = '﻿' + [headerRow, ...bodyRows].join('\r\n')
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

  function sanitizeFilenamePart(value: string): string {
    return value.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'hazard-report'
  }

  function buildReportPdf<T extends Record<string, string | number>>(
    title: string,
    description: string,
    columns: ReportTableColumn<T>[],
    rows: T[],
  ) {
    const document = new jsPDF({ unit: 'mm', format: 'a4' })
    const pageWidth = document.internal.pageSize.getWidth()
    const pageHeight = document.internal.pageSize.getHeight()
    const margin = 14
    const maxLineWidth = pageWidth - margin * 2
    let cursorY = 18

    const ensureSpace = (height: number): void => {
      if (cursorY + height > pageHeight - 18) {
        document.addPage()
        cursorY = 18
      }
    }

    const drawText = (text: string, fontSize: number, style: 'normal' | 'bold' = 'normal') => {
      document.setFont('helvetica', style)
      document.setFontSize(fontSize)
      const lines = document.splitTextToSize(text, maxLineWidth)
      const lineHeight = fontSize * 0.42 + 1.4
      ensureSpace(lines.length * lineHeight + 2)
      document.text(lines, margin, cursorY)
      cursorY += lines.length * lineHeight + 2
    }

    const generatedAt = new Date().toLocaleString('en-PH', {
      dateStyle: 'medium',
      timeStyle: 'short',
    })

    drawText(title, 16, 'bold')
    drawText(description, 10)
    drawText(`Generated: ${generatedAt}`, 8)
    cursorY += 4

    if (rows.length === 0) {
      drawText('No report rows match the current filters.', 10)
      return document
    }

    rows.forEach((row, index) => {
      ensureSpace(32)
      drawText(`${index + 1}. ${String(row[columns[0].key] ?? '')}`, 11, 'bold')
      columns.slice(1).forEach((column) => {
        const value = String(row[column.key] ?? '-')
        drawText(`${column.label}: ${value}`, 9)
      })
      cursorY += 4
    })

    return document
  }

  function handlePdfAction<T extends Record<string, string | number>>(
    action: PdfAction,
    title: string,
    description: string,
    columns: ReportTableColumn<T>[],
    rows: T[],
  ) {
    const document = buildReportPdf(title, description, columns, rows)
    const filename = `${sanitizeFilenamePart(title)}-${new Date().toISOString().slice(0, 10)}.pdf`

    if (action === 'save') {
      document.save(filename)
      return
    }

    document.autoPrint()
    const blobUrl = document.output('bloburl')
    const printWindow = window.open(blobUrl, '_blank', 'noopener,noreferrer')

    if (!printWindow) {
      document.save(filename)
      return
    }

    setTimeout(() => {
      URL.revokeObjectURL(blobUrl.toString())
    }, 60_000)
  }

  function buildPrintHtml<T extends Record<string, string | number>>(
    title: string,
    description: string,
    columns: ReportTableColumn<T>[],
    rows: T[],
  ): string {
    const headerCells = columns
      .map((column) => `<th>${escapeHtmlCell(column.label)}</th>`)
      .join('')

    const bodyRows = rows
      .map((row) => {
        const cells = columns
          .map((column) => `<td>${escapeHtmlCell(String(row[column.key] ?? '-'))}</td>`)
          .join('')
        return `<tr>${cells}</tr>`
      })
      .join('')

    return `
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${escapeHtmlCell(title)}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 14mm;
              color: #111;
              background: #fff;
            }
            @page {
              size: landscape;
              margin: 14mm;
            }
            .report-header {
              margin-bottom: 18px;
            }
            .report-header h1 {
              margin: 0 0 8px;
              font-size: 22px;
            }
            .report-header p {
              margin: 0;
              font-size: 13px;
              color: #4b5563;
              line-height: 1.6;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              page-break-inside: auto;
              margin-top: 18px;
            }
            thead tr {
              page-break-inside: avoid;
              page-break-after: auto;
            }
            th,
            td {
              border: 1px solid #374151;
              padding: 8px 10px;
              text-align: left;
              vertical-align: top;
              font-size: 11px;
              word-break: break-word;
              white-space: pre-wrap;
            }
            th {
              background: #e5e7eb;
              font-weight: 700;
            }
            tbody tr:nth-child(even) {
              background: #f9fafb;
            }
            .summary {
              margin-top: 12px;
              font-size: 12px;
              color: #1f2937;
            }
            @media print {
              body {
                margin: 0;
              }
              .no-print {
                display: none;
              }
              table {
                page-break-inside: avoid;
              }
              tr {
                page-break-inside: avoid;
                page-break-after: auto;
              }
            }
          </style>
        </head>
        <body>
          <div class="report-header">
            <h1>${escapeHtmlCell(title)}</h1>
            <p>${escapeHtmlCell(description)}</p>
            <p class="summary">Generated: ${escapeHtmlCell(
              new Date().toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' }),
            )}</p>
          </div>

          <table>
            <thead>
              <tr>${headerCells}</tr>
            </thead>
            <tbody>${bodyRows}</tbody>
          </table>

          <script>
            window.onload = () => {
              window.focus();
              window.print();
            }
          </script>
        </body>
      </html>
    `
  }

  function openPrintWindow<T extends Record<string, string | number>>(
    title: string,
    description: string,
    columns: ReportTableColumn<T>[],
    rows: T[],
  ) {
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      alert('Unable to open print window. Please disable your popup blocker and try again.')
      return
    }

    const html = buildPrintHtml(title, description, columns, rows)
    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.focus()
  }

  function renderReportTable<T extends Record<string, string | number>>(options: {
    title: string
    description: string
    columns: ReportTableColumn<T>[]
    rows: T[]
    pageRows: T[]
    emptyMessage: string
    exportFileName: string
    rowKey: (row: T, index: number) => string
  }) {
    // rows: every matching row, for Save PDF, Print and CSV. pageRows: the rows on the current page.
    const { title, description, columns, rows, pageRows, emptyMessage, exportFileName, rowKey } = options

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
              onClick={() => handlePdfAction('save', title, description, columns, rows)}
              type="button"
            >
              Save PDF
            </button>

            <button
              className="rounded-xl border border-sky-300 bg-sky-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-sky-700 transition hover:bg-sky-100"
              onClick={() => openPrintWindow(title, description, columns, rows)}
              type="button"
            >
              Print Table
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
                      column.align === 'right'
                        ? 'text-right'
                        : column.align === 'center'
                          ? 'text-center'
                          : 'text-left'
                    }`}
                    key={String(column.key)}
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200 bg-white">
              {pageRows.length > 0 ? (
                pageRows.map((row, index) => (
                  <tr className="transition hover:bg-slate-50/80" key={rowKey(row, index)}>
                    {columns.map((column) => (
                      <td
                        className={`px-4 py-4 align-top text-slate-700 ${
                          column.align === 'right'
                            ? 'text-right'
                            : column.align === 'center'
                              ? 'text-center'
                              : 'text-left'
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

        <TablePagination
          label={`${title} pages`}
          onPageChange={goToPage}
          onPageSizeChange={(size) => {
            setPageSize(size)
            goToPage(1)
          }}
          page={currentPage}
          pageSize={pageSize}
          totalItems={rows.length}
        />
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
                Fire, accident, earthquake, and responder-submitted reports are combined in one admin report table.
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
                      : `${nearbyEarthquakes.length} earthquakes within ${REPORT_EARTHQUAKE_RADIUS_KM} km of Lucena (M${REPORT_EARTHQUAKE_MIN_MAGNITUDE}+)`}
                </span>

                <span className="rounded-full bg-blue-100 px-3 py-1 text-blue-700">
                  {responderReports.length} responder report rows loaded
                </span>

                {earthquakeLastUpdated ? (
                  <span className="text-slate-500">
                    Updated {earthquakeLastUpdated.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                ) : null}
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

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
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
                <option value="AC">Accident / Other</option>
              </select>
            </label>

            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Status
              <select
                className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-700"
                onChange={(event) => setReportStatusFilter(event.target.value as ReportStatusFilter)}
                value={reportStatusFilter}
              >
                <option value="approved">Approved only</option>
                <option value="pending">Pending review</option>
                <option value="all">All reports</option>
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

          {hiddenPendingCount > 0 ? (
            <p className="mt-3 text-xs text-slate-500">
              {hiddenPendingCount} report{hiddenPendingCount === 1 ? ' is' : 's are'} still waiting for approval and{' '}
              {hiddenPendingCount === 1 ? 'is' : 'are'} not included. Choose Status: Pending review or All reports to see{' '}
              {hiddenPendingCount === 1 ? 'it' : 'them'}.
            </p>
          ) : null}
        </div>

        {renderReportTable({
          title: 'Hazard Incident Master Table',
          description: 'Combined admin report table for earthquake, fire, accident, and responder-submitted records with print and export support.',
          columns: unifiedHazardReportColumns,
          rows: filteredUnifiedHazardReportRows,
          pageRows,
          emptyMessage: 'No hazard report rows match the current filters.',
          exportFileName: 'hazard-incident-master-report',
          rowKey: (row, index) => `${row.reportId}-${(currentPage - 1) * pageSize + index}`,
        })}
      </div>
    </section>
  )
}