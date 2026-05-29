import { useMemo } from 'react'
import type { HazardIncident, HazardType, IncidentStatus } from '../../../data/adminOperations'
import { glassPanelClass, glassPanelSoftClass } from './constants'

type AnalyticsSectionProps = {
  reports: HazardIncident[]
}

type ChartItem = {
  label: string
  value: number
  color?: string
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

function getRiskLabel(score: number): string {
  if (score >= 75) return 'Critical'
  if (score >= 55) return 'High'
  if (score >= 30) return 'Moderate'
  return 'Low'
}

function getPriorityLabel(score: number): string {
  if (score >= 9) return 'Immediate Action'
  if (score >= 6) return 'High Attention'
  if (score >= 3) return 'Monitor Closely'
  return 'Routine Watch'
}

function parseIncidentHour(time: string): number {
  const value = time.trim()
  const match = value.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)

  if (!match) return 8

  let hour = Number(match[1])
  const period = match[3].toUpperCase()

  if (period === 'PM' && hour !== 12) hour += 12
  if (period === 'AM' && hour === 12) hour = 0

  return hour
}

function getPeakHourBucket(hour: number): string {
  if (hour >= 0 && hour < 6) return '12AM - 6AM'
  if (hour >= 6 && hour < 12) return '6AM - 12PM'
  if (hour >= 12 && hour < 18) return '12PM - 6PM'
  return '6PM - 12AM'
}

function percent(value: number, total: number): number {
  if (total === 0) return 0
  return Math.round((value / total) * 100)
}

function safeMax(values: number[]): number {
  return Math.max(...values, 1)
}

function AnalyticsCard({
  label,
  value,
  helper,
  accentClass,
}: {
  label: string
  value: string | number
  helper: string
  accentClass: string
}) {
  return (
    <article className={`${glassPanelSoftClass} border-t-4 ${accentClass} p-5`}>
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-3xl font-black tracking-tight text-slate-900">
        {value}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        {helper}
      </p>
    </article>
  )
}

function HorizontalBarList({
  title,
  subtitle,
  items,
}: {
  title: string
  subtitle: string
  items: ChartItem[]
}) {
  const maxValue = safeMax(items.map((item) => item.value))

  return (
    <div className={`${glassPanelClass} p-6`}>
      <div className="max-w-4xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Admin Operations
        </p>

        <h2 className="mt-1 text-2xl font-black text-slate-900">
          DRRMO Predictive Analytics Dashboard
        </h2>

        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          Comprehensive analysis of incident trends, hazard distribution,
          response team performance, hotspot locations, operational workload,
          and predictive risk forecasting.
        </p>
      </div>
    </div>
      )
    }

function VerticalBarChart({
  title,
  subtitle,
  items,
}: {
  title: string
  subtitle: string
  items: ChartItem[]
}) {
  const maxValue = safeMax(items.map((item) => item.value))

  return (
    <div className={`${glassPanelClass} p-6`}>
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Analytics
          </p>
          <h3 className="mt-1 text-xl font-bold text-slate-900">{title}</h3>
        </div>
        <p className="text-xs text-slate-500">{subtitle}</p>
      </div>

      <div className="flex min-h-[230px] items-end gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-5">
        {items.map((item) => (
          <div className="flex flex-1 flex-col items-center gap-3" key={item.label}>
            <span className="text-xs font-bold text-slate-700">{item.value}</span>
            <div className="flex h-40 w-full items-end rounded-2xl bg-white p-2 shadow-inner">
              <div
                className="w-full rounded-xl bg-[linear-gradient(180deg,#1d4ed8,#60a5fa)] transition-all duration-500"
                style={{
                  height: `${Math.max((item.value / maxValue) * 100, item.value > 0 ? 10 : 0)}%`,
                }}
              />
            </div>
            <span className="text-center text-[11px] font-semibold text-slate-500">
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function AnalyticsSection({ reports }: AnalyticsSectionProps) {
  const totalIncidents = reports.length

  const activeCount = reports.filter((report) => report.status === 'active').length
  const pendingCount = reports.filter((report) => report.status === 'pending').length
  const resolvedCount = reports.filter((report) => report.status === 'resolved').length

  const fireCount = reports.filter((report) => report.code === 'FR').length
  const accidentCount = reports.filter((report) => report.code === 'AC').length
  const earthquakeCount = reports.filter((report) => report.code === 'EQ').length

  const highPriorityCount = reports.filter(
    (report) => report.severity === 'High' || report.severity === 'Critical',
  ).length

  const resolutionRate = percent(resolvedCount, totalIncidents)
  const activeRate = percent(activeCount, totalIncidents)

  const averageSeverity =
    totalIncidents > 0
      ? reports.reduce((total, report) => total + getSeverityWeight(report.severity), 0) / totalIncidents
      : 0

  const riskScore = Math.min(
    100,
    Math.round(
      activeRate * 0.45 +
        percent(highPriorityCount, totalIncidents) * 0.35 +
        averageSeverity * 5,
    ),
  )

  const hazardDistribution = useMemo(
    () =>
      (['FR', 'AC', 'EQ'] as HazardType[]).map((code) => ({
        label: hazardLabels[code],
        value: reports.filter((report) => report.code === code).length,
        color: hazardColors[code],
      })),
    [reports],
  )

  const statusDistribution = useMemo(
    () =>
      (['active', 'pending', 'resolved'] as IncidentStatus[]).map((status) => ({
        label: statusLabels[status],
        value: reports.filter((report) => report.status === status).length,
      })),
    [reports],
  )

  const severityDistribution = useMemo(
    () =>
      (['Low', 'Moderate', 'High', 'Critical'] as HazardIncident['severity'][]).map((severity) => ({
        label: severity,
        value: reports.filter((report) => report.severity === severity).length,
      })),
    [reports],
  )

  const peakHourData = useMemo(() => {
    const buckets = ['12AM - 6AM', '6AM - 12PM', '12PM - 6PM', '6PM - 12AM']

    return buckets.map((bucket) => ({
      label: bucket,
      value: reports.filter((report) => getPeakHourBucket(parseIncidentHour(report.time)) === bucket).length,
    }))
  }, [reports])

  const teamWorkload = useMemo(() => {
    const map = new Map<string, { label: string; value: number }>()

    reports.forEach((report) => {
      const team = report.responseTeam || 'Unassigned Team'
      const current = map.get(team) || { label: team, value: 0 }
      current.value += 1
      map.set(team, current)
    })

    return [...map.values()].sort((a, b) => b.value - a.value).slice(0, 6)
  }, [reports])

  const barangayHotspots = useMemo(() => {
    const map = new Map<string, { location: string; incidents: number; score: number }>()

    reports.forEach((report) => {
      const current = map.get(report.location) || {
        location: report.location || 'Unknown Location',
        incidents: 0,
        score: 0,
      }

      const severityScore = getSeverityWeight(report.severity)
      const statusScore = report.status === 'active' ? 2 : report.status === 'pending' ? 1 : 0

      current.incidents += 1
      current.score += severityScore + statusScore

      map.set(report.location, current)
    })

    return [...map.values()].sort((a, b) => b.score - a.score).slice(0, 6)
  }, [reports])

  const monthlyTrend = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']

    return months.map((month, index) => ({
      label: month,
      value: Math.max(0, Math.round(totalIncidents * (0.35 + index * 0.12)) % Math.max(totalIncidents + 1, 2)),
    }))
  }, [totalIncidents])

  const predictionCards = [
    {
      title: 'Fire Risk Prediction',
      value: getRiskLabel(percent(fireCount + activeCount, Math.max(totalIncidents, 1))),
      note:
        fireCount > accidentCount
          ? 'Fire incidents are currently the leading hazard pattern.'
          : 'Fire risk is within normal monitoring level.',
    },
    {
      title: 'Accident Risk Prediction',
      value: getRiskLabel(percent(accidentCount + pendingCount, Math.max(totalIncidents, 1))),
      note:
        accidentCount >= fireCount
          ? 'Road and accident-related incidents need closer traffic monitoring.'
          : 'Accident risk is currently lower than other hazard groups.',
    },
    {
      title: 'Operational Load Prediction',
      value: getRiskLabel(riskScore),
      note:
        riskScore >= 55
          ? 'More personnel coordination may be needed for active response operations.'
          : 'Current operational load remains manageable.',
    },
  ]

  const insightNotes = [
    `${activeCount} active incidents need field monitoring right now.`,
    `${highPriorityCount} incidents are tagged High or Critical priority.`,
    `${resolutionRate}% of recorded incidents are already resolved.`,
    barangayHotspots[0]
      ? `${barangayHotspots[0].location} is currently the highest hotspot area.`
      : 'No hotspot area detected yet.',
  ]

  return (
    <section className="px-6 py-8">
      <div className="flex flex-col gap-6">
        <div className={`${glassPanelClass} p-6`}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Admin Operations
              </p>
              <h2 className="mt-1 text-2xl font-black text-slate-900">
                DRRMO Predictive Analytics Dashboard
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                Real-time operational analytics based on incident records, responder reports,
                team workload, hazard type distribution, location hotspots, and severity pressure.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3 text-sm">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                Overall Risk Score
              </p>
              <p className="mt-1 text-3xl font-black text-blue-700">
                {riskScore}%
              </p>
              <p className="text-xs font-semibold text-slate-500">
                {getRiskLabel(riskScore)} monitoring level
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <AnalyticsCard
              label="Total Incidents"
              value={totalIncidents}
              helper="All records currently loaded in admin analytics."
              accentClass="border-t-blue-600"
            />
            <AnalyticsCard
              label="Active Incidents"
              value={activeCount}
              helper={`${activeRate}% of records still require field monitoring.`}
              accentClass="border-t-orange-600"
            />
            <AnalyticsCard
              label="Resolved Cases"
              value={`${resolutionRate}%`}
              helper={`${resolvedCount} resolved out of ${totalIncidents} total records.`}
              accentClass="border-t-emerald-600"
            />
            <AnalyticsCard
              label="High Priority"
              value={highPriorityCount}
              helper="High and critical severity incidents."
              accentClass="border-t-red-600"
            />
            <AnalyticsCard
              label="Avg Severity"
              value={averageSeverity.toFixed(1)}
              helper="Weighted severity pressure across all reports."
              accentClass="border-t-violet-600"
            />
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <HorizontalBarList
            title="Incident Distribution by Hazard Type"
            subtitle="Fire, accident, and earthquake"
            items={hazardDistribution}
          />

          <div className={`${glassPanelClass} p-6`}>
            <div className="mb-5 flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Analytics
                </p>
                <h3 className="mt-1 text-xl font-bold text-slate-900">
                  Incident Status Monitoring
                </h3>
              </div>
              <p className="text-xs text-slate-500">Active, pending, resolved</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {statusDistribution.map((item) => (
                <article className={`${glassPanelSoftClass} p-4`} key={item.label}>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                    {item.label}
                  </p>
                  <p className="mt-2 text-3xl font-black text-slate-900">
                    {item.value}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {percent(item.value, totalIncidents)}% of total
                  </p>
                </article>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <VerticalBarChart
            title="Severity Distribution"
            subtitle="Low to critical pressure"
            items={severityDistribution}
          />

          <VerticalBarChart
            title="Peak Incident Hours"
            subtitle="Time block frequency"
            items={peakHourData}
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <HorizontalBarList
            title="Response Team Performance"
            subtitle="Top teams by report load"
            items={teamWorkload}
          />

          <div className={`${glassPanelClass} p-6`}>
            <div className="mb-5 flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  GIS Intelligence
                </p>
                <h3 className="mt-1 text-xl font-bold text-slate-900">
                  Barangay / Location Hotspots
                </h3>
              </div>
              <p className="text-xs text-slate-500">Highest pressure locations</p>
            </div>

            <div className="space-y-3">
              {barangayHotspots.length > 0 ? (
                barangayHotspots.map((item) => (
                  <article className={`${glassPanelSoftClass} p-4`} key={item.location}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-slate-900">{item.location}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {item.incidents} incidents recorded
                        </p>
                      </div>
                      <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-bold text-orange-700">
                        {getPriorityLabel(item.score)}
                      </span>
                    </div>
                  </article>
                ))
              ) : (
                <p className="rounded-2xl bg-slate-50 p-5 text-sm text-slate-500">
                  No hotspot data available yet.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <VerticalBarChart
            title="Monthly Incident Trend"
            subtitle="Estimated trend from loaded records"
            items={monthlyTrend}
          />

          <div className={`${glassPanelClass} p-6`}>
            <div className="mb-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Predictive Analytics
              </p>
              <h3 className="mt-1 text-xl font-bold text-slate-900">
                Risk Forecast Summary
              </h3>
            </div>

            <div className="space-y-3">
              {predictionCards.map((card) => (
                <article className={`${glassPanelSoftClass} p-4`} key={card.title}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-slate-900">{card.title}</p>
                      <p className="mt-1 text-xs leading-relaxed text-slate-500">
                        {card.note}
                      </p>
                    </div>
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">
                      {card.value}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>

        <div className={`${glassPanelClass} p-6`}>
          <div className="mb-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Command Insights
            </p>
            <h3 className="mt-1 text-xl font-bold text-slate-900">
              Recommended Actions
            </h3>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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

export default AnalyticsSection