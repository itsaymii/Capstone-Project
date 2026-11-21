import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { getIncidentReports, type IncidentReport } from '../../../services/incidents'
import { LUCENA_BARANGAYS, toLucenaBarangay } from '../../../data/barangays'
import { ANALYTICS_TYPES, getIncidentCategoryKey, type AnalyticsTypeKey } from '../../../data/incidentCategories'
import { TEAM_NAMES, toTeamName } from '../../../data/teams'
import { TablePagination } from '../../../components/TablePagination'
import { filterControlClass, filterLabelClass } from './constants'
import { PAGE_SIZE_OPTIONS, clampPage } from '../../../components/pagination'
import { SeverityBadge } from '../../../components/SeverityBadge'
import { IncidentReportDetails } from './IncidentReportDetails'

type ReportStatus = 'pending' | 'approved'
type DateGrouping = 'weekly' | 'monthly' | 'yearly'
type VictimFilter = 'all' | 'with' | 'without'
type SortOrder = 'newest' | 'oldest'

type Filters = {
  search: string
  type: AnalyticsTypeKey | 'all'
  barangay: string
  team: string
  victims: VictimFilter
  from: string
  to: string
}

const EMPTY_FILTERS: Filters = { search: '', type: 'all', barangay: 'all', team: 'all', victims: 'all', from: '', to: '' }


function normalizeStatus(status?: string): ReportStatus {
  const value = String(status || '').trim().toLowerCase()

  if (
    value === 'approved' ||
    value === 'approve' ||
    value === 'verified' ||
    value === 'resolved' ||
    value === 'accepted'
  ) {
    return 'approved'
  }

  return 'pending'
}

function getReportCode(report: IncidentReport): string {
  return report.reportCode || report.report_code || report.incidentCode || report.incident_code || report.id
}

function getIncidentType(report: IncidentReport): string {
  return report.incidentType || report.incident_type || 'Incident Report'
}

function getResponderTeam(report: IncidentReport): string {
  return toTeamName(report.responderTeam || report.responder_team) || 'Responder Team'
}

/** One of the 33 barangays, or the location when it names none. */
function getReportBarangay(report: IncidentReport): string {
  return (
    toLucenaBarangay(report.barangayName) ??
    toLucenaBarangay(report.location) ??
    (report.location || (report as { location_name?: string }).location_name || 'Unknown Barangay')
  )
}

function getVictimCount(report: IncidentReport): number {
  return Number(report.victimCount ?? report.victim_count ?? report.victims?.length ?? 0)
}

function formatDate(value?: string): string {
  if (!value) return '-'

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value

  return parsed.toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function getReportCreatedAt(report: IncidentReport): Date | null {
  const value = report.createdAt || report.created_at
  if (!value) return null

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

/** "2026-10-29" from a date in local time, to compare with the date inputs. */
function toDateInputValue(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function getGroupingLabel(report: IncidentReport, grouping: DateGrouping): string {
  const date = getReportCreatedAt(report)
  if (!date) return 'Unknown date'

  if (grouping === 'weekly') {
    const dayOfWeek = (date.getDay() + 6) % 7 // Monday = 0
    const weekStart = new Date(date)
    weekStart.setDate(date.getDate() - dayOfWeek)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 6)

    return `${weekStart.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })} – ${weekEnd.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}`
  }

  if (grouping === 'monthly') {
    return date.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })
  }

  return date.getFullYear().toString()
}

function getIncidentBadgeClass(report: IncidentReport): string {
  const type = getIncidentType(report).toLowerCase()

  if (type.includes('fire')) return 'bg-orange-50 text-orange-800 border-orange-100'
  if (type.includes('medical') || type.includes('med')) return 'bg-rose-50 text-rose-800 border-rose-100'
  if (type.includes('rtc') || type.includes('accident') || type.includes('vehicle')) return 'bg-amber-50 text-amber-800 border-amber-100'

  return 'bg-slate-50 text-slate-700 border-slate-200'
}

const RESPONDER_TEAM_ORDER = ['Alpha', 'Charlie', 'Bravo']

function compareResponderTeams(left: string, right: string): number {
  const normalizedLeft = left.trim().toLowerCase()
  const normalizedRight = right.trim().toLowerCase()

  const leftIndex = RESPONDER_TEAM_ORDER.findIndex((team) => team.toLowerCase() === normalizedLeft)
  const rightIndex = RESPONDER_TEAM_ORDER.findIndex((team) => team.toLowerCase() === normalizedRight)

  const leftRank = leftIndex === -1 ? RESPONDER_TEAM_ORDER.length : leftIndex
  const rightRank = rightIndex === -1 ? RESPONDER_TEAM_ORDER.length : rightIndex

  return leftRank - rightRank || normalizedLeft.localeCompare(normalizedRight, undefined, { sensitivity: 'base' })
}

export function IncidentReports() {
  const [reports, setReports] = useState<IncidentReport[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [detailsReport, setDetailsReport] = useState<IncidentReport | null>(null)
  const closeDetails = useCallback(() => setDetailsReport(null), [])
  const [dateGrouping, setDateGrouping] = useState<DateGrouping>('weekly')
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0])

  // Any filter change starts again at page 1.
  function updateFilter<Key extends keyof Filters>(key: Key, value: Filters[Key]): void {
    setFilters((current) => ({ ...current, [key]: value }))
    setPage(1)
  }

  function clearFilters(): void {
    setFilters(EMPTY_FILTERS)
    setPage(1)
  }

  useEffect(() => {
    let isMounted = true

    async function loadApprovedReports() {
      try {
        setIsLoading(true)
        const data = await getIncidentReports()

        if (isMounted) {
          setReports(
            Array.isArray(data)
              ? data.filter((item) => normalizeStatus(item.status) === 'approved')
              : [],
          )
        }
      } catch (error) {
        console.error('[IncidentReports] Failed to load approved reports:', error)

        if (isMounted) {
          setReports([])
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void loadApprovedReports()

    return () => {
      isMounted = false
    }
  }, [])

  // Incident types in the same order and with the same names as the other admin pages.
  const typeOptions = useMemo(() => {
    const present = new Set(reports.map((report) => getIncidentCategoryKey(report)))
    return ANALYTICS_TYPES.filter((type) => type.key !== 'earthquake' && (type.key !== 'other' || present.has('other')))
  }, [reports])

  // Reports are filed only by responders, each under their account's team.
  const teamOptions = TEAM_NAMES

  const filteredReports = useMemo(() => {
    const query = filters.search.trim().toLowerCase()

    const matches = reports.filter((report) => {
      if (filters.type !== 'all' && getIncidentCategoryKey(report) !== filters.type) return false
      if (filters.barangay !== 'all' && getReportBarangay(report) !== filters.barangay) return false
      if (filters.team !== 'all' && getResponderTeam(report) !== filters.team) return false

      const victims = getVictimCount(report)
      if (filters.victims === 'with' && victims === 0) return false
      if (filters.victims === 'without' && victims > 0) return false

      if (filters.from || filters.to) {
        const date = getReportCreatedAt(report)
        if (!date) return false
        const day = toDateInputValue(date)
        if (filters.from && day < filters.from) return false
        if (filters.to && day > filters.to) return false
      }

      if (!query) return true
      return [
        getReportCode(report),
        getIncidentType(report),
        report.location,
        getReportBarangay(report),
        report.description,
        report.actionTaken,
        report.action_taken,
        getResponderTeam(report),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    })

    const direction = sortOrder === 'newest' ? -1 : 1
    return matches.sort((left, right) => {
      const leftDate = getReportCreatedAt(left)?.getTime() ?? 0
      const rightDate = getReportCreatedAt(right)?.getTime() ?? 0
      return (leftDate - rightDate) * direction
    })
  }, [reports, filters, sortOrder])

  const currentPage = clampPage(page, filteredReports.length, pageSize)
  const pageStart = (currentPage - 1) * pageSize
  const pageReports = useMemo(
    () => filteredReports.slice(pageStart, pageStart + pageSize),
    [filteredReports, pageStart, pageSize],
  )

  // Date groups on this page; the count is for all matching reports in that period.
  const groupedReports = useMemo(() => {
    const totals = new Map<string, number>()
    filteredReports.forEach((report) => {
      const label = getGroupingLabel(report, dateGrouping)
      totals.set(label, (totals.get(label) || 0) + 1)
    })

    const groups = new Map<string, IncidentReport[]>()
    pageReports.forEach((report) => {
      const label = getGroupingLabel(report, dateGrouping)
      groups.set(label, [...(groups.get(label) || []), report])
    })

    return Array.from(groups.entries()).map(([group, items]) => ({ group, items, total: totals.get(group) || items.length }))
  }, [filteredReports, pageReports, dateGrouping])

  const activeFilterCount = (Object.keys(EMPTY_FILTERS) as Array<keyof Filters>).filter(
    (key) => filters[key] !== EMPTY_FILTERS[key],
  ).length

  const pageIds = pageReports.map((report) => getReportCode(report))
  const isPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id))

  const toggleSelect = (reportId: string) => {
    setSelectedIds((prev) =>
      prev.includes(reportId) ? prev.filter((id) => id !== reportId) : [...prev, reportId],
    )
  }

  // The header checkbox selects the reports on this page.
  const toggleSelectPage = () => {
    if (isPageSelected) {
      setSelectedIds((prev) => prev.filter((id) => !pageIds.includes(id)))
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...pageIds])))
    }
  }

  const selectAllMatching = () => {
    setSelectedIds((prev) => Array.from(new Set([...prev, ...filteredReports.map((report) => getReportCode(report))])))
  }

  const handlePrintReports = () => {
    if (selectedIds.length === 0) {
      alert('Please select at least one incident report to print.')
      return
    }

    // Selected reports from every page, not only the one on screen.
    const selectedReports = reports.filter((r) => selectedIds.includes(getReportCode(r)))
    const sortedSelectedReports = [...selectedReports].sort((left, right) =>
      compareResponderTeams(getResponderTeam(left), getResponderTeam(right)),
    )

    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      alert('Could not open print window. Please disable popup blockers.')
      return
    }

    const currentDate = new Date()
    const dateStr = currentDate.toLocaleDateString('en-PH', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
    })
    const timeStr = currentDate.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true })

    const printTypes = Array.from(new Set(sortedSelectedReports.map((report) => getIncidentType(report))))
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))

    const printRows = sortedSelectedReports.reduce<Record<string, Record<string, number>>>((acc, report) => {
      const barangay = getReportBarangay(report)
      const type = getIncidentType(report)
      acc[barangay] = acc[barangay] || {}
      acc[barangay][type] = (acc[barangay][type] || 0) + 1
      return acc
    }, {})

    const sortedBarangays = Object.keys(printRows).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
    const grandTotal = sortedBarangays.reduce((sum, barangay) => {
      return sum + printTypes.reduce((rowSum, type) => rowSum + (printRows[barangay][type] || 0), 0)
    }, 0)

    const htmlContent = `
      <html>
        <head>
          <title>Summary of Incidents per Barangay</title>
          <style>
            body {
              font-family: 'Arial', sans-serif;
              margin: 20px;
              background: white;
              color: #000;
            }
            .page-header {
              display: grid;
              grid-template-columns: 1fr 1fr 1fr;
              gap: 10px;
              margin-bottom: 20px;
            }
            .page-header .block {
              border: 1px solid #000;
              padding: 10px 12px;
              min-height: 70px;
              display: flex;
              flex-direction: column;
              justify-content: center;
            }
            .page-header .label {
              font-size: 11px;
              letter-spacing: 0.12em;
              text-transform: uppercase;
              font-weight: 700;
              margin-bottom: 6px;
            }
            .page-header .value {
              font-size: 16px;
              font-weight: 700;
            }
            .title-row {
              text-align: center;
              margin-bottom: 10px;
            }
            .title-row .title {
              font-size: 18px;
              font-weight: 700;
              letter-spacing: 0.1em;
              margin-bottom: 8px;
            }
            .title-row .subtitle {
              font-size: 12px;
              letter-spacing: 0.08em;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 10px;
              font-size: 11px;
            }
            th, td {
              border: 1px solid #000;
              padding: 6px 8px;
              text-align: center;
              vertical-align: middle;
            }
            th {
              background: #e2e2e2;
              font-weight: 700;
              writing-mode: vertical-rl;
              transform: rotate(180deg);
              white-space: nowrap;
              padding: 10px 6px;
              height: 140px;
            }
            td.barangay-name {
              text-align: left;
              font-weight: 700;
            }
            .total-cell {
              font-weight: 700;
            }
            .grand-total {
              background: #f0f0f0;
              font-weight: 700;
            }
            @media print {
              body { margin: 10px; }
              th { font-size: 10px; }
              table { page-break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          <div class="title-row">
            <div class="title">SUMMARY OF INCIDENTS PER BARANGAY</div>
          </div>
          <div class="page-header">
            <div class="block">
              <div class="label">Team</div>
              <div class="value">${filters.team === 'all' ? 'All Teams' : filters.team}</div>
            </div>
            <div class="block">
              <div class="label">Date</div>
              <div class="value">${dateStr}</div>
            </div>
            <div class="block">
              <div class="label">Time</div>
              <div class="value">${timeStr}</div>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th style="writing-mode: horizontal-tb; transform: none;">Barangay</th>
                ${printTypes.map((type) => `<th>${type}</th>`).join('')}
                <th style="writing-mode: horizontal-tb; transform: none;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${sortedBarangays
                .map((barangay) => {
                  const rowTotal = printTypes.reduce((rowSum, type) => rowSum + (printRows[barangay][type] || 0), 0)
                  return `
                    <tr>
                      <td class="barangay-name">${barangay}</td>
                      ${printTypes
                        .map((type) => `<td>${printRows[barangay][type] || ''}</td>`)
                        .join('')}
                      <td class="total-cell">${rowTotal || ''}</td>
                    </tr>
                  `
                })
                .join('')}
              <tr class="grand-total">
                <td>Grand Total</td>
                ${printTypes.map((type) => {
                  const subtotal = sortedBarangays.reduce((sum, barangay) => sum + (printRows[barangay][type] || 0), 0)
                  return `<td>${subtotal || ''}</td>`
                }).join('')}
                <td class="total-cell">${grandTotal || ''}</td>
              </tr>
            </tbody>
          </table>
        </body>
      </html>
    `

    printWindow.document.write(htmlContent)
    printWindow.document.close()
    setTimeout(() => {
      printWindow.print()
    }, 500)
  }

  return (
    <section className="px-4 pb-10 pt-2 sm:px-6">
      <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_38px_rgba(15,23,42,0.08)]">
        <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-xl">
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-gray-500">
              Approved Incidents
            </p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
              Incident Reports
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Only approved reports from the map review panel are displayed here.
            </p>
          </div>

          {selectedIds.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-slate-600">{selectedIds.length} selected</span>
              <button
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                onClick={() => setSelectedIds([])}
                type="button"
              >
                Clear selection
              </button>
              <button
                className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-blue-700 active:scale-95"
                onClick={handlePrintReports}
                type="button"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4H9a2 2 0 00-2 2v2a2 2 0 002 2h6a2 2 0 002-2v-2a2 2 0 00-2-2zm-4-6h.01M12 8v4m0 0v4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Print ({selectedIds.length})
              </button>
            </div>
          ) : null}
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Approved Reports
            </p>
            <p className="mt-2 text-3xl font-black text-blue-800">{reports.length}</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              With Victims
            </p>
            <p className="mt-2 text-3xl font-black text-red-700">
              {reports.filter((item) => getVictimCount(item) > 0).length}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Fire
            </p>
            <p className="mt-2 text-3xl font-black text-orange-700">
              {reports.filter((item) => getIncidentCategoryKey(item) === 'fire').length}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Matching Filters
            </p>
            <p className="mt-2 text-3xl font-black text-slate-900">{filteredReports.length}</p>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <label className="block flex-1">
              <span className={filterLabelClass}>Search</span>
              <input
                className={`${filterControlClass} placeholder:font-normal placeholder:text-slate-400`}
                onChange={(event) => updateFilter('search', event.target.value)}
                placeholder="Search report code, type, location, team..."
                type="search"
                value={filters.search}
              />
            </label>
            <label className="block md:w-44">
              <span className={filterLabelClass}>Sort</span>
              <select className={filterControlClass} onChange={(event) => { setSortOrder(event.target.value as SortOrder); setPage(1) }} value={sortOrder}>
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
              </select>
            </label>
            <label className="block md:w-44">
              <span className={filterLabelClass}>Group by</span>
              <select className={filterControlClass} onChange={(event) => setDateGrouping(event.target.value as DateGrouping)} value={dateGrouping}>
                <option value="weekly">Week</option>
                <option value="monthly">Month</option>
                <option value="yearly">Year</option>
              </select>
            </label>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <label className="block">
              <span className={filterLabelClass}>Incident type</span>
              <select className={filterControlClass} onChange={(event) => updateFilter('type', event.target.value as Filters['type'])} value={filters.type}>
                <option value="all">All types</option>
                {typeOptions.map((type) => (
                  <option key={type.key} value={type.key}>{type.label}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={filterLabelClass}>Barangay</span>
              <select className={filterControlClass} onChange={(event) => updateFilter('barangay', event.target.value)} value={filters.barangay}>
                <option value="all">All barangays</option>
                {LUCENA_BARANGAYS.map((barangay) => (
                  <option key={barangay} value={barangay}>{barangay}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={filterLabelClass}>Team</span>
              <select className={filterControlClass} onChange={(event) => updateFilter('team', event.target.value)} value={filters.team}>
                <option value="all">All teams</option>
                {teamOptions.map((team) => (
                  <option key={team} value={team}>{team}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={filterLabelClass}>Victims</span>
              <select className={filterControlClass} onChange={(event) => updateFilter('victims', event.target.value as VictimFilter)} value={filters.victims}>
                <option value="all">All reports</option>
                <option value="with">With victims</option>
                <option value="without">No victims</option>
              </select>
            </label>
            <label className="block">
              <span className={filterLabelClass}>From</span>
              <input
                className={filterControlClass}
                max={filters.to || undefined}
                onChange={(event) => updateFilter('from', event.target.value)}
                type="date"
                value={filters.from}
              />
            </label>
            <label className="block">
              <span className={filterLabelClass}>To</span>
              <input
                className={filterControlClass}
                min={filters.from || undefined}
                onChange={(event) => updateFilter('to', event.target.value)}
                type="date"
                value={filters.to}
              />
            </label>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
            <p className="text-slate-500">
              {activeFilterCount > 0
                ? `${filteredReports.length} of ${reports.length} reports match ${activeFilterCount} filter${activeFilterCount === 1 ? '' : 's'}.`
                : `Showing all ${reports.length} approved reports.`}
            </p>
            {activeFilterCount > 0 ? (
              <button
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
                onClick={clearFilters}
                type="button"
              >
                Clear filters
              </button>
            ) : null}
          </div>
        </div>

        {isPageSelected && selectedIds.length < filteredReports.length ? (
          <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-2.5 text-sm text-blue-800">
            All {pageIds.length} reports on this page are selected.{' '}
            <button className="font-bold underline" onClick={selectAllMatching} type="button">
              Select all {filteredReports.length} matching reports
            </button>
          </div>
        ) : null}

        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left">
              <thead className="bg-slate-50">
                <tr>
                  <th className="w-12 px-4 py-3">
                    <input
                      aria-label="Select the reports on this page"
                      checked={isPageSelected}
                      className="h-4 w-4 rounded accent-blue-600 transition"
                      onChange={toggleSelectPage}
                      type="checkbox"
                    />
                  </th>
                  <th className="px-4 py-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                    Report Code
                  </th>
                  <th className="px-4 py-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                    Incident Type
                  </th>
                  <th className="px-4 py-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                    Location
                  </th>
                  <th className="px-4 py-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                    Team
                  </th>
                  <th className="px-4 py-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                    Victims
                  </th>
                  <th className="px-4 py-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                    Status
                  </th>
                  <th className="px-4 py-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                    Severity
                  </th>
                  <th className="px-4 py-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                    Date
                  </th>
                  <th className="px-4 py-3">
                    <span className="sr-only">Details</span>
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 bg-white">
                {isLoading ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-sm text-slate-500" colSpan={10}>
                      Loading approved incidents...
                    </td>
                  </tr>
                ) : filteredReports.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-sm text-slate-500" colSpan={10}>
                      {activeFilterCount > 0 ? 'No approved incidents match these filters.' : 'No approved incidents found.'}
                    </td>
                  </tr>
                ) : (
                  groupedReports.map(({ group, items, total }) => (
                    <Fragment key={group}>
                      <tr className="bg-slate-100">
                        <td className="px-4 py-3 text-sm font-semibold uppercase tracking-[0.12em] text-slate-700" colSpan={10}>
                          {group} ({total})
                        </td>
                      </tr>
                      {items.map((report) => {
                        const reportCode = getReportCode(report)
                        const isSelected = selectedIds.includes(reportCode)

                        return (
                          <tr
                            className={`transition ${isSelected ? 'bg-blue-50' : 'hover:bg-slate-50/90'}`}
                            key={reportCode}
                          >
                            <td className="px-4 py-4">
                              <input
                                checked={isSelected}
                                className="h-4 w-4 rounded accent-blue-600 transition"
                                onChange={() => toggleSelect(reportCode)}
                                onClick={(e) => e.stopPropagation()}
                                type="checkbox"
                              />
                            </td>
                            <td className="px-4 py-4 text-sm font-black text-blue-800">
                              {reportCode}
                            </td>
                            <td className="px-4 py-4 text-sm text-slate-800">
                              <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${getIncidentBadgeClass(report)}`}>
                                {getIncidentType(report)}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-sm text-slate-600">
                              {report.location || '-'}
                            </td>
                            <td className="px-4 py-4 text-sm text-slate-600">
                              {getResponderTeam(report)}
                            </td>
                            <td className="px-4 py-4 text-sm text-slate-600">
                              {getVictimCount(report)}
                            </td>
                            <td className="px-4 py-4">
                              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                                Approved
                              </span>
                            </td>
                            <td className="px-4 py-4">
                              <SeverityBadge level={report.severityLevel} />
                            </td>
                            <td className="px-4 py-4 text-sm text-slate-600">
                              {formatDate(report.createdAt || report.created_at)}
                            </td>
                            <td className="px-4 py-4 text-right">
                              <button
                                type="button"
                                onClick={() => setDetailsReport(report)}
                                aria-label={`View details of ${reportCode}`}
                                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-blue-700 transition hover:border-blue-300 hover:bg-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                              >
                                View
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <TablePagination
            label="Incident report pages"
            onPageChange={setPage}
            onPageSizeChange={(size) => { setPageSize(size); setPage(1) }}
            page={currentPage}
            pageSize={pageSize}
            totalItems={filteredReports.length}
          />
        </div>
      </div>

      {detailsReport ? <IncidentReportDetails report={detailsReport} onClose={closeDetails} /> : null}
    </section>
  )
}
