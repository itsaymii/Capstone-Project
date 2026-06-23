import { useEffect, useMemo, useState } from 'react'
import { getAccomplishmentReports } from '../../../services/incidents'

type IncidentReport = {
  id?: string
  reportCode?: string
  report_code?: string
  incidentCode?: string
  incident_code?: string
  incidentReferenceCode?: string
  incident_reference_code_readonly?: string
  incidentType?: string
  incident_type?: string
  responderTeam?: string
  responder_team?: string
  responder_username?: string
  responder?: string
  location?: string
  description?: string
  actionTaken?: string
  action_taken?: string
  report_text?: string
  status_update?: string
  victimCount?: number
  victim_count?: number
  victims?: {
    id?: string
    name?: string
    age?: string
    gender?: string
    address?: string
    condition?: string
  }[]
  createdAt?: string
  created_at?: string
  report_time?: string
}

type AccomplishmentItem = {
  id?: string
  compiledCode?: string
  title?: string
  reports?: IncidentReport[]
  totalReports?: number
  status?: string
  createdAt?: string
  created_at?: string
}

function getReportCode(item: AccomplishmentItem): string {
  return item.reportCode || item.report_code || item.id || 'N/A'
}

function getIncidentCode(item: AccomplishmentItem): string {
  return (
    item.incidentCode ||
    item.incident_code ||
    item.incidentReferenceCode ||
    item.incident_reference_code_readonly ||
    'N/A'
  )
}

function getIncidentType(item: AccomplishmentItem): string {
  return item.incidentType || item.incident_type || 'Incident'
}

function getResponderTeam(item: IncidentReport): string {
  return item.responderTeam || item.responder_team || item.responder_username || item.responder || '-'
}

function getActionTaken(item: IncidentReport): string {
  return item.actionTaken || item.action_taken || item.report_text || item.description || 'No action details provided.'
}

function getVictimCount(item: IncidentReport): number {
  return Number(item.victimCount ?? item.victim_count ?? item.victims?.length ?? 0)
}

function getAccomplishmentResponderTeam(item: AccomplishmentItem): string {
  if (!item.reports || item.reports.length === 0) return '-'

  const teams = Array.from(
    new Set(item.reports.map((report) => getResponderTeam(report)).filter((team) => team && team !== '-')),
  )

  if (teams.length === 0) return '-'
  if (teams.length === 1) return teams[0]
  return teams.join(', ')
}

function getAccomplishmentVictimCount(item: AccomplishmentItem): number {
  if (!item.reports || item.reports.length === 0) return 0
  return item.reports.reduce((sum, report) => sum + getVictimCount(report), 0)
}

function getAccomplishmentActionTaken(item: AccomplishmentItem): string {
  if (!item.reports || item.reports.length === 0) return 'No action details provided.'

  const actions = item.reports
    .map((report) => getActionTaken(report))
    .filter((text) => text && text !== 'No action details provided.')

  if (actions.length === 0) return 'No action details provided.'

  return actions.join(' / ')
}

function getAccomplishmentStatus(item: AccomplishmentItem): string {
  return item.status || 'Compiled'
}

function getAccomplishmentCreatedAt(item: AccomplishmentItem): string {
  return item.createdAt || item.created_at || '-'
}

function getAccomplishmentReportDate(item: AccomplishmentItem): string {
  const value = getAccomplishmentCreatedAt(item)
  if (!value || value === '-') return '-'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).toUpperCase()
}

function getAccomplishmentReportTime(item: AccomplishmentItem): string {
  const value = getAccomplishmentCreatedAt(item)
  if (!value || value === '-') return '-'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'

  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  return `${hours}00H - ${hours}00H`
}

function getAccomplishmentChecklist(item: AccomplishmentItem): Record<string, boolean> {
  const types = new Set(
    item.reports?.map((report) => getIncidentType(report).toLowerCase()) || [],
  )

  return {
    'RCA': [...types].some((text) => text.includes('rca')),
    'Fire Incident': [...types].some((text) => text.includes('fire')),
    'Crime Against Person/Property': [...types].some((text) => text.includes('crime')),
    'Medical Emergency': [...types].some((text) => text.includes('medical') || text.includes('ambulance')),
    'Ambulance Assistance': [...types].some((text) => text.includes('ambulance') || text.includes('assistance')),
    'Stand-by Medical Team': [...types].some((text) => text.includes('stand') || text.includes('medical team')),
    'Drowning': [...types].some((text) => text.includes('drowning')),
  }
}

function getIncidentVictimDetails(report: IncidentReport): string {
  const victims = report.victims || []
  if (victims.length === 0) {
    return '<div>No victims reported.</div>'
  }

  return victims
    .map((victim, index) => {
      const name = victim.name || 'Unknown'
      const gender = victim.gender ? ` ${victim.gender}` : ''
      const age = victim.age ? `, ${victim.age}` : ''
      const condition = victim.condition ? `, ${victim.condition}` : ''
      const address = victim.address ? ` (${victim.address})` : ''
      return `<div style="margin-bottom: 4px;">${index + 1}. ${name}${gender}${age}${condition}${address}</div>`
    })
    .join('')
}

function getAccomplishmentVictimDetails(item: AccomplishmentItem): string {
  if (!item.reports || item.reports.length === 0) return '<div>No victims reported.</div>'

  return item.reports
    .map((report) => {
      const incidentIdentifier =
        report.incidentCode || report.incident_code || report.incidentReferenceCode || report.incident_reference_code_readonly || report.id || 'Unknown'
      return `
        <div style="margin-bottom: 12px;">
          <div style="font-weight: 700; font-size: 12px; margin-bottom: 4px;">Incident ${incidentIdentifier}</div>
          ${getIncidentVictimDetails(report)}
        </div>
      `
    })
    .join('')
}

function getActivityRows(item: AccomplishmentItem): string {
  if (!item.reports || item.reports.length === 0) {
    return `
      <tr>
        <td colspan="3" style="padding: 10px; border: 1px solid #cbd5e1;">No report details available.</td>
      </tr>
    `
  }

  return item.reports
    .map((report) => {
      const time = report.timeOccurred || report.time_occurred || getAccomplishmentCreatedAt(item)
      const activityLines = []

      if (report.incidentType || report.incident_type) {
        activityLines.push(`<strong>${getIncidentType(report)}</strong>`)
      }
      if (report.location) {
        activityLines.push(`<div><strong>Location:</strong> ${report.location}</div>`)
      }
      const action = getActionTaken(report)
      if (action) {
        activityLines.push(`<div><strong>A/T:</strong> ${action}</div>`)
      }
      if (report.victims && report.victims.length > 0) {
        activityLines.push(`<div><strong>Victims:</strong> ${report.victims.length}</div>`)
      }
      if (report.report_code || report.incident_code) {
        activityLines.push(`<div><strong>Report:</strong> ${getReportCode(report as any)}</div>`)
      }

      return `
        <tr>
          <td style="padding: 10px; border: 1px solid #cbd5e1; vertical-align: top; width: 18%;">${time}</td>
          <td style="padding: 10px; border: 1px solid #cbd5e1; vertical-align: top; width: 64%;">${activityLines.join('')}</td>
          <td style="padding: 10px; border: 1px solid #cbd5e1; vertical-align: top; width: 18%;"></td>
        </tr>
      `
    })
    .join('')
}

function formatDate(value?: string): string {
  if (!value) return '-'

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value

  return parsed.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function getStatusBadgeStyle(status?: string): string {
  const value = String(status || '').trim().toLowerCase()

  if (value.includes('compiled') || value.includes('approved')) {
    return 'bg-emerald-50 text-emerald-700 ring-emerald-100'
  }

  if (value.includes('pending')) {
    return 'bg-amber-50 text-amber-700 ring-amber-100'
  }

  return 'bg-slate-50 text-slate-600 ring-slate-100'
}

export function AccomplishmentReports() {
  const [reports, setReports] = useState<AccomplishmentItem[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    async function loadAccomplishmentReports() {
      try {
        setIsLoading(true)
        const data = await getAccomplishmentReports()

        if (isMounted) {
          setReports(Array.isArray(data) ? data : [])
        }
      } catch (error) {
        console.error('[AccomplishmentReports] Failed to load reports:', error)

        if (isMounted) {
          setReports([])
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void loadAccomplishmentReports()

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
        getIncidentCode(report),
        getIncidentType(report),
        getAccomplishmentResponderTeam(report),
        report.location,
        report.status,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    )
  }, [reports, searchQuery])

  const handlePrintAccomplishmentReport = (report: AccomplishmentItem) => {
    const incidentRows = report.reports?.map((item) => {
      return `
        <tr>
          <td>${item.reportCode || item.report_code || item.id || 'N/A'}</td>
          <td>${item.incidentCode || item.incident_code || item.incidentReferenceCode || item.incident_reference_code_readonly || 'N/A'}</td>
          <td>${getIncidentType(item)}</td>
          <td>${getResponderTeam(item)}</td>
          <td>${item.location || 'N/A'}</td>
          <td>${getVictimCount(item)}</td>
          <td>${item.actionTaken || item.action_taken || item.report_text || item.description || 'None'}</td>
        </tr>
      `
    }).join('')

    const checklist = getAccomplishmentChecklist(report)
    const activityRows = getActivityRows(report)
    const victimDetailsHtml = getAccomplishmentVictimDetails(report)

    const html = `
      <html>
        <head>
          <title>${report.compiledCode || report.id || 'Accomplishment Report'}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 24px; }
            .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
            .report-title { font-size: 20px; font-weight: 700; margin: 0; }
            .meta { font-size: 12px; color: #475569; margin-top: 8px; }
            .grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; margin-bottom: 24px; }
            .box { border: 1px solid #cbd5e1; padding: 12px; border-radius: 10px; background: #f8fafc; }
            .checkbox-row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
            .checkbox { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; }
            .checkbox input { width: 14px; height: 14px; }
            .victim-details { font-size: 12px; line-height: 1.5; margin-top: 8px; }
            .victim-details div { margin-bottom: 4px; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; }
            th, td { border: 1px solid #1f2937; padding: 10px; font-size: 12px; }
            th { background: #f3f4f6; text-transform: uppercase; letter-spacing: 0.08em; }
            .section-title { font-size: 12px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; margin: 0 0 8px 0; }
            .footer { margin-top: 24px; display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
            .signature-box { border-top: 1px solid #1f2937; padding-top: 16px; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <p class="report-title">Accomplishment Report</p>
              <p class="meta">${report.compiledCode || report.id || ''}</p>
            </div>
            <div>
              <p class="meta">Date: ${getAccomplishmentReportDate(report)}</p>
              <p class="meta">Time: ${getAccomplishmentReportTime(report)}</p>
            </div>
          </div>

          <div class="grid">
            <div class="box">
              <p class="section-title">Team</p>
              <p>${getAccomplishmentResponderTeam(report)}</p>
            </div>
            <div class="box">
              <p class="section-title">Total Victims</p>
              <p>${getAccomplishmentVictimCount(report)}</p>
            </div>
            <div class="box">
              <p class="section-title">Action Taken</p>
              <p>${getAccomplishmentActionTaken(report)}</p>
            </div>
          </div>

          <div class="box">
            <p class="section-title">Responded To</p>
            <div class="checkbox-row">
              <label class="checkbox"><input type="checkbox" ${checklist['RCA'] ? 'checked' : ''} disabled> RCA</label>
              <label class="checkbox"><input type="checkbox" ${checklist['Fire Incident'] ? 'checked' : ''} disabled> Fire Incident</label>
              <label class="checkbox"><input type="checkbox" ${checklist['Crime Against Person/Property'] ? 'checked' : ''} disabled> Crime Against Person/Property</label>
              <label class="checkbox"><input type="checkbox" ${checklist['Medical Emergency'] ? 'checked' : ''} disabled> Medical Emergency</label>
              <label class="checkbox"><input type="checkbox" ${checklist['Ambulance Assistance'] ? 'checked' : ''} disabled> Ambulance Assistance</label>
              <label class="checkbox"><input type="checkbox" ${checklist['Stand-by Medical Team'] ? 'checked' : ''} disabled> Stand-by Medical Team</label>
              <label class="checkbox"><input type="checkbox" ${checklist['Drowning'] ? 'checked' : ''} disabled> Drowning</label>
            </div>
          </div>

          <div class="box">
            <p class="section-title">Victim Details</p>
            <div class="victim-details">
              ${victimDetailsHtml}
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 18%;">Time</th>
                <th style="width: 64%;">Activity</th>
                <th style="width: 18%;">Remarks</th>
              </tr>
            </thead>
            <tbody>
              ${activityRows}
            </tbody>
          </table>

          <div class="footer">
            <div class="signature-box">
              <p><strong>Endorsed by Team:</strong></p>
              <p>________________________</p>
            </div>
            <div class="signature-box">
              <p><strong>Received by Team:</strong></p>
              <p>________________________</p>
            </div>
          </div>
        </body>
      </html>
    `

    const printWindow = window.open('', '_blank')
    if (!printWindow) return
    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.focus()
    printWindow.print()
  }

  return (
    <section className="px-4 pb-10 pt-2 sm:px-6">
      <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_38px_rgba(15,23,42,0.08)]">
        <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">
              Responder Submission
            </p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
              Accomplishment Reports
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Submitted responder accomplishment reports are displayed here for admin review.
            </p>
          </div>

          <div className="flex w-full max-w-md items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <input
              className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search accomplishment reports..."
              type="text"
              value={searchQuery}
            />
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Total Reports
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
              Completed
            </p>
            <p className="mt-2 text-3xl font-black text-emerald-700">
              {
                reports.filter((item) =>
                  String(item.status_update || '').toLowerCase().includes('complete'),
                ).length
              }
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Search Result
            </p>
            <p className="mt-2 text-3xl font-black text-slate-900">{filteredReports.length}</p>
          </div>
        </div>

        <div className="mt-6 grid gap-4">
          {isLoading ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
              Loading accomplishment reports...
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
              No accomplishment reports found.
            </div>
          ) : (
            filteredReports.map((report) => (
              <article
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_10px_24px_rgba(15,23,42,0.06)] transition hover:border-blue-200 hover:shadow-[0_16px_30px_rgba(15,23,42,0.09)]"
                key={getReportCode(report)}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-800">
                        {getReportCode(report)}
                      </span>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                        Incident: {getIncidentCode(report)}
                      </span>
                    </div>

                    <h3 className="mt-3 text-lg font-bold text-slate-900">
                      {getIncidentType(report)}
                    </h3>

                    <p className="mt-1 text-sm text-slate-500">
                      {report.location || 'No location provided'}
                    </p>
                  </div>

                  <div className="text-left lg:text-right">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                      Submitted
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-700">
                      {formatDate(report.createdAt || report.created_at || report.report_time)}
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                      Responder Team
                    </p>
                    <p className="mt-2 text-sm font-semibold text-slate-800">
                      {getAccomplishmentResponderTeam(report)}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                      Total Victims
                    </p>
                    <p className="mt-2 text-3xl font-black text-red-700">
                      {getAccomplishmentVictimCount(report)}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                      Status
                    </p>
                    <span className={`mt-2 inline-flex rounded-full border px-3 py-1 text-xs font-bold ${getStatusBadgeStyle(report.status)}`}>
                      {getAccomplishmentStatus(report)}
                    </span>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                      Action Taken
                    </p>
                    <p className="text-xs text-slate-400">Summary</p>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-700">
                    {getActionTaken(report)}
                  </p>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button
                    className="rounded-2xl bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700"
                    onClick={() => handlePrintAccomplishmentReport(report)}
                    type="button"
                  >
                    Print Report
                  </button>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                    Total Reports: {report.totalReports ?? 0}
                  </span>
                </div>
              </article>
            ))
          )}
        </div>
      </div>
    </section>
  )
}