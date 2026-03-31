import type { HazardIncident, HazardType, IncidentStatus } from '../../../data/adminOperations'
import { glassPanelClass, glassPanelSoftClass } from './constants'

type AnalyticsSectionProps = {
  reports: HazardIncident[]
}

const hazardColors: Record<HazardType, string> = {
  EQ: '#10b981',
  FR: '#ef4444',
  AC: '#3b82f6',
}

const hazardLabels: Record<HazardType, string> = {
  EQ: 'Earthquake',
  FR: 'Fire',
  AC: 'Accident',
}

const statusLabels: Record<IncidentStatus, string> = {
  active: 'Active',
  pending: 'Pending',
  resolved: 'Resolved',
}

function getSeverityWeight(severity: HazardIncident['severity']): number {
  switch (severity) {
    case 'Critical':
      return 4
    case 'High':
      return 3
    case 'Moderate':
      return 2
    case 'Low':
      return 1
    default:
      return 0
  }
}

function getPriorityLabel(score: number): string {
  if (score >= 8) return 'Immediate review'
  if (score >= 5) return 'High attention'
  if (score >= 3) return 'Monitor closely'
  return 'Routine watch'
}

export function AnalyticsSection({ reports }: AnalyticsSectionProps) {
  const totalIncidents = reports.length
  const activeCount = reports.filter((report) => report.status === 'active').length
  const pendingCount = reports.filter((report) => report.status === 'pending').length
  const resolvedCount = reports.filter((report) => report.status === 'resolved').length
  const criticalHighCount = reports.filter(
    (report) => report.severity === 'Critical' || report.severity === 'High',
  ).length
  const resolutionRate = totalIncidents > 0 ? Math.round((resolvedCount / totalIncidents) * 100) : 0
  const activeResponseRate = totalIncidents > 0 ? Math.round((activeCount / totalIncidents) * 100) : 0
  const averageSeverity =
    totalIncidents > 0
      ? (reports.reduce((total, report) => total + getSeverityWeight(report.severity), 0) / totalIncidents).toFixed(1)
      : '0.0'

  const hazardDistribution = (['FR', 'EQ', 'AC'] as HazardType[]).map((code) => ({
    code,
    label: hazardLabels[code],
    value: reports.filter((report) => report.code === code).length,
    color: hazardColors[code],
  }))
  const hazardDistributionMax = Math.max(...hazardDistribution.map((item) => item.value), 1)

  const severityDistribution = ['Low', 'Moderate', 'High', 'Critical'].map((severity) => ({
    severity,
    value: reports.filter((report) => report.severity === severity).length,
  }))
  const severityDistributionMax = Math.max(...severityDistribution.map((item) => item.value), 1)

  const statusBreakdown = (['active', 'pending', 'resolved'] as IncidentStatus[]).map((status) => ({
    status,
    value: reports.filter((report) => report.status === status).length,
  }))

  const teamLoad = [...new Map(
    reports.map((report) => [report.responseTeam, { team: report.responseTeam, incidents: 0, active: 0 }]),
  ).values()]
    .map((team) => {
      const teamReports = reports.filter((report) => report.responseTeam === team.team)
      return {
        team: team.team,
        incidents: teamReports.length,
        active: teamReports.filter((report) => report.status === 'active').length,
      }
    })
    .sort((left, right) => right.incidents - left.incidents)
    .slice(0, 5)

  const locationWatchlist = [...new Map(
    reports.map((report) => [report.location, { location: report.location, score: 0, incidents: 0 }]),
  ).values()]
    .map((location) => {
      const locationReports = reports.filter((report) => report.location === location.location)
      const score = locationReports.reduce((total, report) => {
        const severityScore = getSeverityWeight(report.severity)
        const statusBonus = report.status === 'active' ? 2 : report.status === 'pending' ? 1 : 0
        return total + severityScore + statusBonus
      }, 0)

      return {
        location: location.location,
        incidents: locationReports.length,
        score,
        priority: getPriorityLabel(score),
      }
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, 5)

  const insightNotes = [
    `${activeCount} of ${totalIncidents} incidents currently need active field response.`,
    criticalHighCount > 0
      ? `${criticalHighCount} incidents are tagged high or critical severity and should stay in the top review queue.`
      : 'No high or critical incidents are currently recorded.',
    pendingCount > 0
      ? `${pendingCount} incidents are still pending verification and may affect response prioritization.`
      : 'No incidents are waiting for verification right now.',
  ]

  return (
    <section className="px-6 py-8">
      <div className="flex flex-col gap-6">
        <div className={`${glassPanelClass} p-6`}>
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Admin Operations</p>
            <h2 className="mt-1 text-2xl font-bold text-slate-900">Predictive Analytics</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              This page should show what needs attention next: current hazard mix, severity pressure, response-team workload,
              and the locations most likely to need follow-up. The numbers below are based on the incident records already in the dashboard.
            </p>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <article className={`${glassPanelSoftClass} p-5`}>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Incident Volume</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">{totalIncidents}</p>
              <p className="mt-2 text-sm text-slate-600">Current total incident records in the admin workspace.</p>
            </article>
            <article className={`${glassPanelSoftClass} p-5`}>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Active Response Rate</p>
              <p className="mt-2 text-3xl font-bold text-orange-700">{activeResponseRate}%</p>
              <p className="mt-2 text-sm text-slate-600">Share of incidents still under active field response.</p>
            </article>
            <article className={`${glassPanelSoftClass} p-5`}>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Resolution Rate</p>
              <p className="mt-2 text-3xl font-bold text-emerald-700">{resolutionRate}%</p>
              <p className="mt-2 text-sm text-slate-600">Resolved incidents compared with total recorded incidents.</p>
            </article>
            <article className={`${glassPanelSoftClass} p-5`}>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Average Severity</p>
              <p className="mt-2 text-3xl font-bold text-blue-700">{averageSeverity}</p>
              <p className="mt-2 text-sm text-slate-600">Weighted severity across all current incident records.</p>
            </article>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className={`${glassPanelClass} p-6`}>
            <div className="mb-5 flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Hazard Mix</p>
                <div className="mt-1 text-xl font-semibold text-slate-900">Incident distribution by type</div>
              </div>
              <p className="text-xs text-slate-500">Fire, earthquake, and accident records</p>
            </div>

            <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-5">
              {hazardDistribution.map((item) => (
                <div key={item.code}>
                  <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                    <span className="font-semibold text-slate-700">{item.label}</span>
                    <span className="font-bold text-slate-900">{item.value}</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-white">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{ backgroundColor: item.color, width: `${(item.value / hazardDistributionMax) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={`${glassPanelClass} p-6`}>
            <div className="mb-5 flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Status Snapshot</p>
                <div className="mt-1 text-xl font-semibold text-slate-900">Current response state</div>
              </div>
              <p className="text-xs text-slate-500">Active, pending, and resolved breakdown</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {statusBreakdown.map((item) => (
                <article className={`${glassPanelSoftClass} p-4`} key={item.status}>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{statusLabels[item.status]}</p>
                  <p className="mt-2 text-3xl font-bold text-slate-900">{item.value}</p>
                </article>
              ))}
            </div>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Severity distribution</p>
              <div className="mt-4 flex min-h-[180px] items-end gap-3">
                {severityDistribution.map((item) => (
                  <div className="flex flex-1 flex-col items-center gap-2" key={item.severity}>
                    <span className="text-xs font-semibold text-slate-600">{item.value}</span>
                    <div className="flex h-32 w-full items-end rounded-2xl bg-white p-2">
                      <div
                        className="w-full rounded-xl bg-[linear-gradient(180deg,#0f766e,#14b8a6)]"
                        style={{ height: `${Math.max((item.value / severityDistributionMax) * 100, item.value > 0 ? 14 : 0)}%` }}
                      />
                    </div>
                    <span className="text-[11px] font-semibold text-slate-500">{item.severity}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <div className={`${glassPanelClass} p-6`}>
            <div className="mb-5 flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Team Workload</p>
                <div className="mt-1 text-xl font-semibold text-slate-900">Response teams with highest load</div>
              </div>
            </div>

            <div className="space-y-3">
              {teamLoad.map((team) => (
                <article className={`${glassPanelSoftClass} p-4`} key={team.team}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{team.team}</p>
                      <p className="mt-1 text-xs text-slate-500">{team.active} active incidents currently assigned</p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                      {team.incidents} total
                    </span>
                  </div>
                </article>
              ))}
              {teamLoad.length === 0 ? <p className="text-sm text-slate-500">No team workload data yet.</p> : null}
            </div>
          </div>

          <div className={`${glassPanelClass} p-6`}>
            <div className="mb-5 flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Location Watchlist</p>
                <div className="mt-1 text-xl font-semibold text-slate-900">Places needing follow-up</div>
              </div>
            </div>

            <div className="space-y-3">
              {locationWatchlist.map((item) => (
                <article className={`${glassPanelSoftClass} p-4`} key={item.location}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{item.location}</p>
                      <p className="mt-1 text-xs text-slate-500">{item.incidents} related incidents recorded</p>
                    </div>
                    <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-bold text-orange-700">
                      {item.priority}
                    </span>
                  </div>
                </article>
              ))}
              {locationWatchlist.length === 0 ? <p className="text-sm text-slate-500">No priority locations identified yet.</p> : null}
            </div>
          </div>
        </div>

        <div className={`${glassPanelClass} p-6`}>
          <div className="mb-5 flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Recommended Content</p>
              <div className="mt-1 text-xl font-semibold text-slate-900">What belongs on this analytics page</div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {insightNotes.map((note) => (
              <article className={`${glassPanelSoftClass} p-5`} key={note}>
                <p className="text-sm leading-relaxed text-slate-700">{note}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}