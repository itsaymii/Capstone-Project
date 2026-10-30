import { useMemo, useState } from 'react'
import { TablePagination } from '../../../components/TablePagination'
import { PAGE_SIZE_OPTIONS, clampPage } from '../../../components/pagination'
import { jsPDF } from 'jspdf'
import type { HazardIncident } from '../../../data/adminOperations'
import type { EarthquakeEvent } from '../../../services/earthquakes'
import { glassPanelClass, glassPanelSoftClass } from './constants'
import { LUCENA_BARANGAYS, toLucenaBarangay } from '../../../data/barangays'
import { distanceKm } from '../../../data/evacuation'
import { TEAM_NAMES } from '../../../data/teams'
import { getCurrentUserProfile } from '../../../services/auth'
import { ANALYTICS_TYPES, getIncidentCategoryKey, getIncidentCategoryLabel, type AnalyticsTypeKey } from '../../../data/incidentCategories'
import { formatDetailValue, getIncidentTypeConfig, type DetailValues } from '../../../data/incidentTypeFields'

// One of the incident types used on every admin page (incidentCategories.ts), or all.
type ReportTypeFilter = 'all' | AnalyticsTypeKey

// Approved only by default, so unverified reports are not printed as official ones.
type ReportStatusFilter = 'approved' | 'pending' | 'all'

// The earthquake feed covers the whole Philippines. The report only keeps earthquakes that can be
// felt in Lucena: within this distance of the city center and at least this magnitude.
const LUCENA_CENTER = { lat: 13.9414, lng: 121.6236 }

// Printed at the top of every exported report.
const OFFICE_NAME = 'Lucena City Disaster Risk Reduction and Management Office'
const REPORT_EARTHQUAKE_RADIUS_KM = 100
const REPORT_EARTHQUAKE_MIN_MAGNITUDE = 3

type PdfAction = 'save' | 'print'

type ReportTableColumn<T> = {
  key: keyof T
  label: string
  align?: 'left' | 'center' | 'right'
  // Share of the page width in the PDF table (default 1).
  pdfWeight?: number
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
  typeKey: AnalyticsTypeKey
  // 'feed' for earthquakes: they come from USGS and are never reviewed by an admin.
  approval: 'approved' | 'pending' | 'feed'
  // One of the 33 barangays, or '' when the location names none (earthquakes, old records).
  barangay: string
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
  // The search box in the dashboard header; it also narrows this page.
  searchQuery: string
  onClearSearch?: () => void
}

// The detail that best answers "what caused it / what was it" for each incident type.
const CAUSE_FIELDS = ['suspected_cause', 'crime_type', 'chief_complaint', 'transport_reason', 'activity', 'event_name']

/**
 * The cause from the report's type-specific details, e.g. "Electrical" for a fire.
 * The free-text description is not used: it can name victims and is too long for a table.
 */
function getReportCause(incidentType: string, details: unknown): string {
  const config = getIncidentTypeConfig(incidentType)
  if (!config || !details || typeof details !== 'object') return 'Not stated'

  const values = details as DetailValues
  for (const name of CAUSE_FIELDS) {
    const spec = config.fields.find((field) => field.name === name)
    if (!spec) continue
    const text = formatDetailValue(spec, values[name])
    if (text !== '-') return name === 'event_name' ? `Stand-by: ${text}` : text
  }
  return 'Not stated'
}

// createdByRole from the backend: 'admin', 'staff' (responder accounts), 'responder' or 'anonymous'.
function getSentViaLabel(createdByRole: string): string {
  switch (createdByRole.toLowerCase()) {
    case 'admin':
      return 'Admin'
    case 'anonymous':
      // No account is linked to the report (older data): nobody can say who sent it.
      return 'Unknown'
    default:
      // Responder accounts have the staff role; the system calls them responders everywhere.
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
  { key: 'reportId', label: 'Report ID', pdfWeight: 1.2 },
  { key: 'reportType', label: 'Type', pdfWeight: 1.4 },
  { key: 'location', label: 'Location / Barangay', pdfWeight: 2 },
  { key: 'dateTime', label: 'Date and Time', pdfWeight: 1.3 },
  { key: 'responseTeam', label: 'Response Team' },
  { key: 'magnitude', label: 'Magnitude' },
  { key: 'cause', label: 'Cause', pdfWeight: 1.3 },
  { key: 'severity', label: 'Severity' },
  { key: 'victims', label: 'Victims', align: 'center', pdfWeight: 0.7 },
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
  onClearSearch,
}: ReportsSectionProps) {
  const [reportStartDate, setReportStartDate] = useState('')
  const [reportEndDate, setReportEndDate] = useState('')
  const [reportTypeFilter, setReportTypeFilter] = useState<ReportTypeFilter>('all')
  const [reportBarangayFilter, setReportBarangayFilter] = useState('all')
  const [reportTeamFilter, setReportTeamFilter] = useState('all')
  const [reportSortOrder, setReportSortOrder] = useState<'newest' | 'oldest'>('newest')
  const [reportStatusFilter, setReportStatusFilter] = useState<ReportStatusFilter>('approved')

  const normalizedDashboardSearchQuery = searchQuery.trim().toLowerCase()

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
        // Same type names as the Incidents and Analytics pages.
        reportType: getIncidentCategoryLabel(record),
        location: incident.location || '-',
        dateTime: formatReportDateTime(dateValue),
        responseTeam: incident.responseTeam || '-',
        magnitude: '-',
        cause: getReportCause(incidentType, record.details),
        // Severity of the linked incident, or the backend's rule while there is none (see the dashboard).
        severity: incident.severity || '-',
        victims: victims || (isResponderReport ? '0' : '-'),
        incidentStatus: toTitleCase(incidentStatus) || '-',
        sentVia: isResponderReport ? getSentViaLabel(pickText(record, 'createdByRole')) : 'Admin',
        status: toTitleCase(rawStatus) || '-',
        typeKey: getIncidentCategoryKey(record),
        approval: getApproval(rawStatus),
        barangay: toLucenaBarangay(pickText(record, 'barangayName')) ?? toLucenaBarangay(incident.location) ?? '',
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
          cause: '-',
          severity: '-',
          victims: '-',
          incidentStatus: '-',
          sentVia: 'USGS API',
          status: 'USGS record',
          typeKey: 'earthquake',
          approval: 'feed',
          barangay: '',
          dateValue,
        }
      })
  }, [nearbyEarthquakes])

  // Newest or oldest first across all sources; rows without a valid date always go last.
  const unifiedHazardReportRows = useMemo(
    () =>
      [...earthquakeReportRows, ...incidentReportRows].sort((left, right) => {
        const leftValid = isValidDate(left.dateValue)
        const rightValid = isValidDate(right.dateValue)
        if (leftValid !== rightValid) return leftValid ? -1 : 1
        if (!leftValid) return 0
        const difference = new Date(left.dateValue).getTime() - new Date(right.dateValue).getTime()
        return reportSortOrder === 'newest' ? -difference : difference
      }),
    [earthquakeReportRows, incidentReportRows, reportSortOrder],
  )

  // Alpha, Bravo, Charlie, then any other team found in the reports.
  const teamOptions = useMemo(() => {
    const others = Array.from(new Set(incidentReportRows.map((row) => row.responseTeam)))
      .filter((team) => team && team !== '-' && !(TEAM_NAMES as readonly string[]).includes(team))
      .sort((a, b) => a.localeCompare(b))
    return [...TEAM_NAMES, ...others]
  }, [incidentReportRows])

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

  function matchesReportType(typeKey: AnalyticsTypeKey): boolean {
    return reportTypeFilter === 'all' || reportTypeFilter === typeKey
  }

  function matchesReportStatus(approval: UnifiedHazardReportRow['approval']): boolean {
    if (reportStatusFilter === 'all') return true
    if (reportStatusFilter === 'pending') return approval === 'pending'
    return approval !== 'pending'
  }

  // Earthquakes have no team, so they only show with "All teams".
  function matchesReportTeam(team: string): boolean {
    return reportTeamFilter === 'all' || reportTeamFilter === team
  }

  function matchesReportBarangay(barangay: string): boolean {
    return reportBarangayFilter === 'all' || reportBarangayFilter === barangay
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
          matchesReportType(row.typeKey) &&
          matchesReportStatus(row.approval) &&
          matchesReportBarangay(row.barangay) &&
          matchesReportTeam(row.responseTeam) &&
          matchesDashboardSearch(row) &&
          matchesReportDateRange(row.dateValue),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      unifiedHazardReportRows,
      reportTypeFilter,
      reportStatusFilter,
      reportBarangayFilter,
      reportTeamFilter,
      normalizedDashboardSearchQuery,
      reportStartDate,
      reportEndDate,
    ],
  )

  // The table shows one page at a time; Save PDF, Print and CSV still use every matching row.
  // A change to any filter (or the dashboard search) starts again at page 1.
  const filterKey = [
    reportTypeFilter,
    reportStatusFilter,
    reportBarangayFilter,
    reportTeamFilter,
    reportSortOrder,
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
    setReportTypeFilter('all')
    setReportStatusFilter('approved')
    setReportBarangayFilter('all')
    setReportTeamFilter('all')
    setReportSortOrder('newest')
  }

  // Every incident type, plus "Other" only when some old record matches none of them.
  const typeOptions = ANALYTICS_TYPES.filter(
    (type) => type.key !== 'other' || incidentReportRows.some((row) => row.typeKey === 'other'),
  )

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

  /** The filters behind an export, so a printed report says what it covers. */
  function getFilterSummary(): Array<[string, string]> {
    const formatDay = (value: string) =>
      value ? new Date(`${value}T00:00:00`).toLocaleDateString('en-PH', { dateStyle: 'medium' }) : ''
    const dateRange =
      reportStartDate || reportEndDate
        ? `${formatDay(reportStartDate) || 'Any date'} to ${formatDay(reportEndDate) || 'Any date'}`
        : 'All dates'
    const statusLabels: Record<ReportStatusFilter, string> = {
      approved: 'Approved only',
      pending: 'Pending review',
      all: 'All reports',
    }
    const summary: Array<[string, string]> = [
      ['Date', dateRange],
      ['Type', reportTypeFilter === 'all' ? 'All types' : typeOptions.find((type) => type.key === reportTypeFilter)?.label ?? reportTypeFilter],
      ['Status', statusLabels[reportStatusFilter]],
      ['Barangay', reportBarangayFilter === 'all' ? 'All barangays' : reportBarangayFilter],
      ['Team', reportTeamFilter === 'all' ? 'All teams' : reportTeamFilter],
      ['Sort', reportSortOrder === 'newest' ? 'Newest first' : 'Oldest first'],
    ]
    if (searchQuery.trim()) summary.push(['Search', `"${searchQuery.trim()}"`])
    return summary
  }

  function getPreparedBy(): string {
    return getCurrentUserProfile()?.fullName?.trim() || 'Administrator'
  }

  /**
   * A landscape A4 PDF with the rows as a real table: wrapped cells, the header repeated on
   * every page, and "Page X of Y". Drawn with jsPDF only (no table plugin).
   */
  function buildReportPdf<T extends Record<string, string | number>>(
    title: string,
    description: string,
    columns: ReportTableColumn<T>[],
    rows: T[],
  ) {
    const document = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' })
    const pageWidth = document.internal.pageSize.getWidth()
    const pageHeight = document.internal.pageSize.getHeight()
    const margin = 10
    const bottom = pageHeight - 12
    const fontSize = 7
    const lineHeight = 3.1
    const padding = 1.5
    let cursorY = 14

    const totalWeight = columns.reduce((sum, column) => sum + (column.pdfWeight ?? 1), 0)
    const widths = columns.map((column) => ((column.pdfWeight ?? 1) / totalWeight) * (pageWidth - margin * 2))

    const wrap = (text: string, width: number): string[] => document.splitTextToSize(text, width - padding * 2) as string[]

    const drawRow = (cells: string[], header: boolean): void => {
      document.setFont('helvetica', header ? 'bold' : 'normal')
      document.setFontSize(fontSize)
      const lines = cells.map((cell, index) => wrap(cell, widths[index]))
      const height = Math.max(...lines.map((cellLines) => cellLines.length)) * lineHeight + padding * 2

      let x = margin
      lines.forEach((cellLines, index) => {
        if (header) {
          document.setFillColor(226, 232, 240)
          document.rect(x, cursorY, widths[index], height, 'FD')
        } else {
          document.rect(x, cursorY, widths[index], height)
        }
        const align = columns[index].align === 'center' ? 'center' : 'left'
        const textX = align === 'center' ? x + widths[index] / 2 : x + padding
        document.text(cellLines, textX, cursorY + padding + lineHeight * 0.75, { align })
        x += widths[index]
      })
      cursorY += height
    }

    const headerCells = columns.map((column) => column.label)
    const startTablePage = (): void => {
      document.setDrawColor(148, 163, 184)
      document.setLineWidth(0.1)
      drawRow(headerCells, true)
    }

    const generatedAt = new Date().toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })

    document.setFont('helvetica', 'bold')
    document.setFontSize(9)
    document.setTextColor(11, 42, 87)
    document.text(OFFICE_NAME.toUpperCase(), margin, cursorY)
    document.setTextColor(0, 0, 0)
    cursorY += 6
    document.setFontSize(14)
    document.text(title, margin, cursorY)
    cursorY += 6
    document.setFont('helvetica', 'normal')
    document.setFontSize(9)
    const descriptionLines = document.splitTextToSize(description, pageWidth - margin * 2) as string[]
    document.text(descriptionLines, margin, cursorY)
    cursorY += descriptionLines.length * 4 + 1
    document.setFontSize(8)
    document.text(`Generated: ${generatedAt}  |  ${rows.length.toLocaleString()} report${rows.length === 1 ? '' : 's'}`, margin, cursorY)
    cursorY += 4
    const filterLines = document.splitTextToSize(
      `Filters: ${getFilterSummary().map(([label, value]) => `${label}: ${value}`).join('  |  ')}`,
      pageWidth - margin * 2,
    ) as string[]
    document.text(filterLines, margin, cursorY)
    cursorY += filterLines.length * 3.6 + 2

    if (rows.length === 0) {
      document.setFontSize(10)
      document.text('No report rows match the current filters.', margin, cursorY + 4)
    } else {
      startTablePage()
      rows.forEach((row) => {
        const cells = columns.map((column) => String(row[column.key] ?? '-'))
        document.setFont('helvetica', 'normal')
        document.setFontSize(fontSize)
        const height =
          Math.max(...cells.map((cell, index) => wrap(cell, widths[index]).length)) * lineHeight + padding * 2
        if (cursorY + height > bottom) {
          document.addPage()
          cursorY = 12
          startTablePage()
        }
        drawRow(cells, false)
      })
    }

    // Signature block: who prepared the report and space for the approving officer.
    if (cursorY + 28 > bottom) {
      document.addPage()
      cursorY = 16
    }
    cursorY += 14
    document.setFont('helvetica', 'normal')
    document.setFontSize(8)
    document.setDrawColor(0, 0, 0)
    const signatureWidth = 80
    const rightX = pageWidth - margin - signatureWidth
    document.text('Prepared by:', margin, cursorY - 9)
    document.text('Noted by:', rightX, cursorY - 9)
    document.line(margin, cursorY, margin + signatureWidth, cursorY)
    document.line(rightX, cursorY, rightX + signatureWidth, cursorY)
    document.setFont('helvetica', 'bold')
    document.text(getPreparedBy(), margin, cursorY + 4)
    document.setFont('helvetica', 'normal')
    document.text('Signature over printed name', rightX, cursorY + 4)
    document.text('Head, Lucena City DRRMO', rightX, cursorY + 8)

    const pageCount = document.getNumberOfPages()
    for (let page = 1; page <= pageCount; page += 1) {
      document.setPage(page)
      document.setFont('helvetica', 'normal')
      document.setFontSize(7)
      document.setTextColor(100, 116, 139)
      document.text(`Page ${page} of ${pageCount}`, pageWidth - margin, pageHeight - 6, { align: 'right' })
      document.text(title, margin, pageHeight - 6)
      document.setTextColor(0, 0, 0)
    }

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
              padding: 5px 6px;
              text-align: left;
              vertical-align: top;
              font-size: 9px;
              /* Wrap between words; only split a word that cannot fit on a line at all. */
              word-break: normal;
              overflow-wrap: break-word;
              hyphens: none;
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
            .office {
              margin: 0 0 6px;
              font-size: 12px;
              font-weight: 700;
              letter-spacing: 0.08em;
              text-transform: uppercase;
              color: #0b2a57;
            }
            .filters {
              margin-top: 6px;
              font-size: 11px;
              color: #374151;
            }
            .signatures {
              display: flex;
              justify-content: space-between;
              gap: 40px;
              margin-top: 48px;
              font-size: 12px;
              page-break-inside: avoid;
            }
            .signature {
              width: 280px;
            }
            .signature .line {
              margin-top: 36px;
              border-top: 1px solid #111;
              padding-top: 4px;
            }
            @media print {
              body {
                margin: 0;
              }
              .no-print {
                display: none;
              }
              thead {
                display: table-header-group;
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
            <p class="office">${escapeHtmlCell(OFFICE_NAME)}</p>
            <h1>${escapeHtmlCell(title)}</h1>
            <p>${escapeHtmlCell(description)}</p>
            <p class="summary">Generated: ${escapeHtmlCell(
              new Date().toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' }),
            )}  |  ${rows.length.toLocaleString()} report${rows.length === 1 ? '' : 's'}</p>
            <p class="filters">Filters: ${getFilterSummary()
              .map(([label, value]) => `<strong>${escapeHtmlCell(label)}:</strong> ${escapeHtmlCell(value)}`)
              .join(' &nbsp;|&nbsp; ')}</p>
          </div>

          <table>
            <thead>
              <tr>${headerCells}</tr>
            </thead>
            <tbody>${bodyRows}</tbody>
          </table>

          <div class="signatures">
            <div class="signature">
              Prepared by:
              <div class="line"><strong>${escapeHtmlCell(getPreparedBy())}</strong></div>
            </div>
            <div class="signature">
              Noted by:
              <div class="line">Signature over printed name<br />Head, Lucena City DRRMO</div>
            </div>
          </div>

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

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4 [&>label]:min-w-0">
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Start date (optional)
              <input
                className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-700"
                onChange={(event) => setReportStartDate(event.target.value)}
                type="date"
                value={reportStartDate}
              />
            </label>

            <label className="grid gap-2 text-sm font-medium text-slate-700">
              End date (optional)
              <input
                className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-700"
                onChange={(event) => setReportEndDate(event.target.value)}
                type="date"
                value={reportEndDate}
              />
            </label>

            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Type
              <select
                className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-700"
                onChange={(event) => setReportTypeFilter(event.target.value as ReportTypeFilter)}
                value={reportTypeFilter}
              >
                <option value="all">All types</option>
                {typeOptions.map((type) => (
                  <option key={type.key} value={type.key}>{type.label}</option>
                ))}
              </select>
            </label>

            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Status
              <select
                className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-700"
                onChange={(event) => setReportStatusFilter(event.target.value as ReportStatusFilter)}
                value={reportStatusFilter}
              >
                <option value="approved">Approved only</option>
                <option value="pending">Pending review</option>
                <option value="all">All reports</option>
              </select>
            </label>

            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Barangay
              <select
                className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-700"
                onChange={(event) => setReportBarangayFilter(event.target.value)}
                value={reportBarangayFilter}
              >
                <option value="all">All barangays</option>
                {LUCENA_BARANGAYS.map((barangay) => (
                  <option key={barangay} value={barangay}>{barangay}</option>
                ))}
              </select>
            </label>

            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Team
              <select
                className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-700"
                onChange={(event) => setReportTeamFilter(event.target.value)}
                value={reportTeamFilter}
              >
                <option value="all">All teams</option>
                {teamOptions.map((team) => (
                  <option key={team} value={team}>{team}</option>
                ))}
              </select>
            </label>

            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Sort
              <select
                className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-700"
                onChange={(event) => setReportSortOrder(event.target.value as 'newest' | 'oldest')}
                value={reportSortOrder}
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
              </select>
            </label>
          </div>

          {searchQuery.trim() ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
              <p>
                Also filtered by the search <strong>&ldquo;{searchQuery.trim()}&rdquo;</strong> in the top bar. The table and
                the PDF, Print and CSV only include matching reports.
              </p>
              {onClearSearch ? (
                <button
                  className="rounded-lg border border-blue-300 bg-white px-3 py-1 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
                  onClick={onClearSearch}
                  type="button"
                >
                  Clear search
                </button>
              ) : null}
            </div>
          ) : null}

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