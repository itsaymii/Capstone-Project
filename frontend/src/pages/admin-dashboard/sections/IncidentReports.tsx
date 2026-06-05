import { useEffect, useMemo, useState } from 'react'
import { getIncidentReports, type IncidentReport } from '../../../services/incidents'

type ReportStatus = 'pending' | 'approved'
type DateGrouping = 'weekly' | 'monthly' | 'yearly'
type TeamFilter = 'Alpha' | 'Charlie' | 'Bravo'

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
  return report.responderTeam || report.responder_team || 'Responder Team'
}

function getReportBarangay(report: IncidentReport): string {
  return (
    report.location ||
    (report as any).location_name ||
    (report as any).barangay ||
    'Unknown Barangay'
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
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [dateGrouping, setDateGrouping] = useState<DateGrouping>('weekly')
  const [teamFilter, setTeamFilter] = useState<TeamFilter>('Alpha')

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

  const filteredReports = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()

    if (!query) return reports

    return reports.filter((report) =>
      [
        getReportCode(report),
        getIncidentType(report),
        report.location,
        report.description,
        report.actionTaken,
        report.action_taken,
        getResponderTeam(report),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    )
  }, [reports, searchQuery])

  const sortedFilteredReports = useMemo(() => {
    return [...filteredReports]
      .filter((report) => getResponderTeam(report) === teamFilter)
      .sort((left, right) => compareResponderTeams(getResponderTeam(left), getResponderTeam(right)))
  }, [filteredReports, teamFilter])

  const toggleSelect = (reportId: string) => {
    setSelectedIds((prev) =>
      prev.includes(reportId) ? prev.filter((id) => id !== reportId) : [...prev, reportId],
    )
  }

  const toggleSelectAll = () => {
    const allReportIds = sortedFilteredReports.map((r) => getReportCode(r))

    if (allReportIds.every((id) => selectedIds.includes(id))) {
      setSelectedIds((prev) => prev.filter((id) => !allReportIds.includes(id)))
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...allReportIds])))
    }
  }

  const handlePrintReports = () => {
    if (selectedIds.length === 0) {
      alert('Please select at least one incident report to print.')
      return
    }

    const selectedReports = sortedFilteredReports.filter((r) => selectedIds.includes(getReportCode(r)))
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

    const sortedBarangays = Object.keys(printRows).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
    const grandTotal = sortedBarangays.reduce((sum, barangay) => {
      return sum + printTypes.reduce((rowSum, type) => rowSum + (printRows[barangay][type] || 0), 0)
    }, 0)

    let htmlContent = `
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
              <div class="value">${teamFilter}</div>
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
        <div className="flex flex-col gap-5 border-b border-slate-200 pb-5 lg:flex-row lg:items-center lg:justify-between">
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

          <div className="flex flex-col gap-4 lg:flex-1 lg:px-6">
            <div className="mx-auto w-full max-w-lg rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 lg:px-5">
              <input
                className="min-w-0 w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search approved incidents..."
                type="text"
                value={searchQuery}
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            <label className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs uppercase tracking-[0.14em] text-slate-500">
              <span>Group by</span>
              <select
                className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-sky-400"
                onChange={(event) => setDateGrouping(event.target.value as DateGrouping)}
                value={dateGrouping}
              >
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </label>
            <label className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs uppercase tracking-[0.14em] text-slate-500">
              <span>Team</span>
              <select
                className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-sky-400"
                onChange={(event) => setTeamFilter(event.target.value as TeamFilter)}
                value={teamFilter}
              >
                <option value="Alpha">Alpha</option>
                <option value="Charlie">Charlie</option>
                <option value="Bravo">Bravo</option>
              </select>
            </label>
          </div>

          {selectedIds.length > 0 ? (
              <button
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-blue-700 active:scale-95 whitespace-nowrap"
                onClick={handlePrintReports}
                type="button"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4H9a2 2 0 00-2 2v2a2 2 0 002 2h6a2 2 0 002-2v-2a2 2 0 00-2-2zm-4-6h.01M12 8v4m0 0v4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Print ({selectedIds.length})
              </button>
            ) : null}
          </div>
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
              {reports.filter((item) => getIncidentType(item).toLowerCase().includes('fire')).length}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Search Result
            </p>
            <p className="mt-2 text-3xl font-black text-slate-900">{sortedFilteredReports.length}</p>
          </div>
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left">
              <thead className="bg-slate-50">
                <tr>
                  <th className="w-12 px-4 py-3">
                    <input
                      checked={
                        sortedFilteredReports.length > 0 &&
                        sortedFilteredReports.every((r) => selectedIds.includes(getReportCode(r)))
                      }
                      className="h-4 w-4 rounded accent-blue-600 transition"
                      onChange={toggleSelectAll}
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
                    Date
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 bg-white">
                {isLoading ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-sm text-slate-500" colSpan={8}>
                      Loading approved incidents...
                    </td>
                  </tr>
                ) : sortedFilteredReports.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-sm text-slate-500" colSpan={8}>
                      No approved incidents found.
                    </td>
                  </tr>
                ) : (
                  sortedFilteredReports.map((report) => {
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
                        <td className="px-4 py-4 text-sm text-slate-600">
                          {formatDate(report.createdAt || report.created_at)}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
    </section>
  )
}