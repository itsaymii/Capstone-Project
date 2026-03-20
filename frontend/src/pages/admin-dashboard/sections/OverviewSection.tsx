import type { HazardIncident } from '../../../data/adminOperations'
import { glassPanelClass } from './constants'

type MetricCard = {
  label: string
  value: number | string
  comparison: string
  delta: string
  accent: string
  valueClass: string
}

type OverviewSectionProps = {
  overviewMetricCards: MetricCard[]
  latestFireIncidents: HazardIncident[]
}

const currentYear = new Date().getFullYear()

const seasonalFireTrend = [
  { label: 'Jan', value: 4 },
  { label: 'Feb', value: 5 },
  { label: 'Mar', value: 7 },
  { label: 'Apr', value: 9 },
  { label: 'May', value: 11 },
  { label: 'Jun', value: 8 },
  { label: 'Jul', value: 6 },
  { label: 'Aug', value: 5 },
  { label: 'Sep', value: 6 },
  { label: 'Oct', value: 8 },
  { label: 'Nov', value: 10 },
  { label: 'Dec', value: 7 },
]
const seasonalFireMax = Math.max(...seasonalFireTrend.map((item) => item.value), 1)
const seasonalFirePoints = seasonalFireTrend
  .map((item, index) => {
    const x = (index / Math.max(seasonalFireTrend.length - 1, 1)) * 100
    const y = 92 - (item.value / seasonalFireMax) * 70
    return `${x},${y}`
  })
  .join(' ')

const earthquakeMagnitudeData = [
  { range: '2.0-2.9', value: 5 },
  { range: '3.0-3.9', value: 7 },
  { range: '4.0-4.9', value: 4 },
  { range: '5.0-5.9', value: 2 },
  { range: '6.0+', value: 1 },
]
const earthquakeMagnitudeMax = Math.max(...earthquakeMagnitudeData.map((item) => item.value), 1)

const barangayHeatmap = [
  { name: 'Barangay 10', fireRisk: 51, earthquakeRisk: 41, totalRisk: 92 },
  { name: 'Ibabang Dupay', fireRisk: 48, earthquakeRisk: 37, totalRisk: 85 },
  { name: 'Gulang-Gulang', fireRisk: 43, earthquakeRisk: 35, totalRisk: 78 },
  { name: 'Cotta', fireRisk: 39, earthquakeRisk: 31, totalRisk: 70 },
  { name: 'Dalahican', fireRisk: 34, earthquakeRisk: 30, totalRisk: 64 },
  { name: 'Bocohan', fireRisk: 31, earthquakeRisk: 27, totalRisk: 58 },
]

const incidentCauseData = [
  { label: 'Electrical', value: 42, color: '#ef4444' },
  { label: 'Accidental', value: 31, color: '#f59e0b' },
  { label: 'Natural', value: 18, color: '#10b981' },
  { label: 'Other', value: 9, color: '#3b82f6' },
]
const incidentCauseTotal = Math.max(incidentCauseData.reduce((total, item) => total + item.value, 0), 1)
const incidentCauseGradient = incidentCauseData
  .reduce(
    (segments, item) => {
      const start = segments.current
      const slice = (item.value / incidentCauseTotal) * 100
      segments.values.push(`${item.color} ${start}% ${start + slice}%`)
      segments.current += slice
      return segments
    },
    { current: 0, values: [] as string[] },
  )
  .values.join(', ')

const populationExposureData = [
  { name: 'Gulang-Gulang', density: 62, exposure: 28 },
  { name: 'Ibabang Dupay', density: 55, exposure: 30 },
  { name: 'Barangay 10', density: 49, exposure: 36 },
  { name: 'Cotta', density: 46, exposure: 24 },
]
const populationExposureMax = Math.max(...populationExposureData.map((item) => item.density + item.exposure), 1)

const latestSeismicEvents = [
  { title: 'Minor Earthquake - East Zone', magnitude: '4.2', time: '10:00 PM', note: 'Aftershock monitored with no structural collapse.' },
  { title: 'Offshore Seismic Disturbance', magnitude: '3.8', time: '6:40 PM', note: 'No tsunami advisory issued for Lucena coastline.' },
  { title: 'Northern Fault Microtremor', magnitude: '2.9', time: '4:15 AM', note: 'Barangay monitoring remained at advisory level.' },
]

const hazardLevelUpdates = [
  { barangay: 'Barangay 10', status: 'Critical fire watch', note: 'Dense commercial load and recent structural fire activity.' },
  { barangay: 'Ibabang Dupay', status: 'Elevated combined risk', note: 'High exposure from dense housing and road incident corridor.' },
  { barangay: 'Gulang-Gulang', status: 'Seismic watch', note: 'Priority inspections scheduled for vulnerable structures.' },
]

const dashboardStatusClasses = {
  active: 'border-red-700 bg-red-700 text-white',
  pending: 'border-amber-500 bg-amber-500 text-white',
  resolved: 'border-emerald-700 bg-emerald-700 text-white',
} as const

export function OverviewSection({ overviewMetricCards, latestFireIncidents }: OverviewSectionProps) {
  return (
    <>
      <section className="grid grid-cols-1 gap-6 px-6 pt-6 pb-8 md:grid-cols-2 xl:grid-cols-5">
        {overviewMetricCards.map((card) => (
          <div
            key={card.label}
            className={`group relative overflow-hidden rounded-[22px] border border-t-4 border-slate-200/70 bg-white p-6 shadow-[0_2px_8px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.08)] transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_14px_42px_rgba(15,23,42,0.17)] flex flex-col gap-2 ${card.accent}`}
          >
            <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400 transition-colors duration-200 group-hover:text-slate-500">
              {card.label}
            </span>
            <span className={`mt-1 text-4xl font-extrabold leading-none tracking-tight ${card.valueClass}`}>{card.value}</span>
            <p className="text-sm font-medium text-slate-500">{currentYear} total</p>
            <div className="mt-auto border-t border-slate-100 pt-3">
              <p className="text-[11px] text-slate-400">{card.comparison}</p>
              <p className="mt-1 text-xs font-semibold text-slate-600">{card.delta}</p>
            </div>
          </div>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-6 px-6 pb-8 xl:grid-cols-2">
        <div className={`${glassPanelClass} p-6`}>
          <div className="mb-5 flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Data Analytics</p>
              <div className="mt-1 text-xl font-semibold text-slate-900">Trend Line Chart</div>
            </div>
            <p className="text-xs text-slate-500">Seasonal fire spikes by month</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-[linear-gradient(180deg,#ffffff,#f8fafc)] p-4">
            <svg className="h-60 w-full" preserveAspectRatio="none" viewBox="0 0 100 100">
              {[20, 40, 60, 80].map((y) => (
                <line key={y} stroke="#e2e8f0" strokeDasharray="2 3" strokeWidth="0.6" x1="0" x2="100" y1={y} y2={y} />
              ))}
              <polyline fill="none" points={seasonalFirePoints} stroke="#dc2626" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.6" />
              {seasonalFireTrend.map((item, index) => {
                const x = (index / Math.max(seasonalFireTrend.length - 1, 1)) * 100
                const y = 92 - (item.value / seasonalFireMax) * 70
                return <circle key={item.label} cx={x} cy={y} fill="#dc2626" r="1.8" />
              })}
            </svg>

            <div className="mt-3 grid grid-cols-6 gap-2 text-center text-[11px] font-semibold text-slate-500">
              {seasonalFireTrend.map((item) => (
                <div key={item.label}>
                  <p>{item.label}</p>
                  <p className="mt-1 text-slate-700">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className={`${glassPanelClass} p-6`}>
          <div className="mb-5 flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Data Analytics</p>
              <div className="mt-1 text-xl font-semibold text-slate-900">Bar Chart</div>
            </div>
            <p className="text-xs text-slate-500">Earthquake frequency by magnitude range</p>
          </div>

          <div className="flex min-h-[285px] items-end gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-5">
            {earthquakeMagnitudeData.map((item) => (
              <div className="group flex flex-1 flex-col items-center gap-3 transition-transform duration-200 hover:-translate-y-0.5" key={item.range}>
                <span className="text-xs font-semibold text-slate-600 transition-colors duration-200 group-hover:text-teal-700">{item.value}</span>
                <div className="flex h-52 w-full items-end rounded-[18px] bg-white p-2 shadow-[inset_0_0_0_1px_rgba(226,232,240,0.9)] transition-shadow duration-200 group-hover:shadow-[inset_0_0_0_1px_rgba(20,184,166,0.35),0_4px_12px_rgba(15,23,42,0.08)]">
                  <div
                    className="w-full rounded-[12px] bg-[linear-gradient(180deg,#0f766e,#2dd4bf)] transition-all duration-500"
                    style={{ height: `${Math.max((item.value / earthquakeMagnitudeMax) * 100, 14)}%` }}
                  />
                </div>
                <span className="text-center text-[11px] font-semibold text-slate-500">{item.range}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 px-6 pb-8 xl:grid-cols-[1.2fr_0.9fr_1.1fr]">
        <div className={`${glassPanelClass} p-6`}>
          <div className="mb-5 flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Data Analytics</p>
              <div className="mt-1 text-xl font-semibold text-slate-900">Heatmap Snapshot</div>
            </div>
            <p className="text-xs text-slate-500">Barangays with highest combined risk</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {barangayHeatmap.map((item) => (
              <div
                className="rounded-2xl border p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(220,38,38,0.16)]"
                key={item.name}
                style={{
                  borderColor: `rgba(220, 38, 38, ${Math.max(item.totalRisk / 120, 0.22)})`,
                  backgroundColor: `rgba(248, 113, 113, ${Math.max(item.totalRisk / 220, 0.12)})`,
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                  <span className="rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-bold text-slate-900">{item.totalRisk}</span>
                </div>
                <div className="mt-4 space-y-2 text-xs text-slate-700">
                  <div className="flex items-center justify-between gap-3">
                    <span>Fire risk</span>
                    <span className="font-semibold">{item.fireRisk}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/80">
                    <div className="h-full rounded-full bg-red-500" style={{ width: `${item.fireRisk}%` }} />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>Earthquake risk</span>
                    <span className="font-semibold">{item.earthquakeRisk}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/80">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${item.earthquakeRisk}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={`${glassPanelClass} p-6`}>
          <div className="mb-5 flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Data Analytics</p>
              <div className="mt-1 text-xl font-semibold text-slate-900">Pie Chart</div>
            </div>
            <p className="text-xs text-slate-500">Fire incident causes</p>
          </div>

          <div className="flex flex-col items-center gap-6">
            <div className="relative flex h-48 w-48 items-center justify-center rounded-full" style={{ background: `conic-gradient(${incidentCauseGradient})` }}>
              <div className="flex h-28 w-28 items-center justify-center rounded-full border border-slate-200 bg-white text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Total</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">{incidentCauseTotal}</p>
                </div>
              </div>
            </div>

            <div className="grid w-full gap-3">
              {incidentCauseData.map((item) => (
                <div className="flex items-center justify-between gap-3 text-sm" key={item.label}>
                  <div className="flex items-center gap-3">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-slate-700">{item.label}</span>
                  </div>
                  <span className="font-semibold text-slate-900">{item.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className={`${glassPanelClass} p-6`}>
          <div className="mb-5 flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Data Analytics</p>
              <div className="mt-1 text-xl font-semibold text-slate-900">Stacked Chart</div>
            </div>
            <p className="text-xs text-slate-500">Population density vs hazard exposure</p>
          </div>

          <div className="flex min-h-[285px] items-end gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-5">
            {populationExposureData.map((item) => {
              const densityHeight = (item.density / populationExposureMax) * 100
              const exposureHeight = (item.exposure / populationExposureMax) * 100

              return (
                <div className="group flex flex-1 flex-col items-center gap-3 transition-transform duration-200 hover:-translate-y-0.5" key={item.name}>
                  <div className="flex h-56 w-full items-end rounded-[18px] bg-white p-2 shadow-[inset_0_0_0_1px_rgba(226,232,240,0.9)] transition-shadow duration-200 group-hover:shadow-[inset_0_0_0_1px_rgba(99,102,241,0.25),0_4px_12px_rgba(15,23,42,0.08)]">
                    <div className="flex w-full flex-col justify-end overflow-hidden rounded-[12px]">
                      <div className="bg-[linear-gradient(180deg,#38bdf8,#2563eb)]" style={{ height: `${Math.max(exposureHeight, 10)}%` }} />
                      <div className="bg-[linear-gradient(180deg,#f59e0b,#f97316)]" style={{ height: `${Math.max(densityHeight, 12)}%` }} />
                    </div>
                  </div>
                  <div className="text-center text-[11px] text-slate-500">
                    <p className="font-semibold text-slate-700">{item.name}</p>
                    <p>Density {item.density}</p>
                    <p>Exposure {item.exposure}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 px-6 pb-10 xl:grid-cols-3">
        <div className={`${glassPanelClass} p-6`}>
          <div className="mb-5 flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Recent Activity Feed</p>
              <div className="mt-1 text-xl font-semibold text-slate-900">Latest recorded fire incidents</div>
            </div>
          </div>

          <div className="space-y-3">
            {latestFireIncidents.map((incident) => (
              <article className="group rounded-2xl border border-slate-200/60 bg-white p-4 shadow-[0_1px_4px_rgba(15,23,42,0.04),0_4px_16px_rgba(15,23,42,0.06)] transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300/70 hover:shadow-[0_6px_22px_rgba(15,23,42,0.12)]" key={incident.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{incident.title}</p>
                    <p className="mt-1 text-xs text-slate-500">{incident.location} | {incident.time}</p>
                  </div>
                  <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase ${dashboardStatusClasses[incident.status]}`}>
                    {incident.status}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">{incident.description}</p>
              </article>
            ))}
          </div>
        </div>

        <div className={`${glassPanelClass} p-6`}>
          <div className="mb-5 flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Recent Activity Feed</p>
              <div className="mt-1 text-xl font-semibold text-slate-900">Latest seismic events</div>
            </div>
          </div>

          <div className="space-y-3">
            {latestSeismicEvents.map((event) => (
              <article className="group rounded-2xl border border-slate-200/60 bg-white p-4 shadow-[0_1px_4px_rgba(15,23,42,0.04),0_4px_16px_rgba(15,23,42,0.06)] transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300/70 hover:shadow-[0_6px_22px_rgba(15,23,42,0.12)]" key={`${event.title}-${event.time}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{event.title}</p>
                    <p className="mt-1 text-xs text-slate-500">Magnitude {event.magnitude} | {event.time}</p>
                  </div>
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase text-emerald-700">
                    Seismic
                  </span>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">{event.note}</p>
              </article>
            ))}
          </div>
        </div>

        <div className={`${glassPanelClass} p-6`}>
          <div className="mb-5 flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Recent Activity Feed</p>
              <div className="mt-1 text-xl font-semibold text-slate-900">Barangay hazard level updates</div>
            </div>
          </div>

          <div className="space-y-3">
            {hazardLevelUpdates.map((update) => (
              <article className="group rounded-2xl border border-slate-200/60 bg-white p-4 shadow-[0_1px_4px_rgba(15,23,42,0.04),0_4px_16px_rgba(15,23,42,0.06)] transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300/70 hover:shadow-[0_6px_22px_rgba(15,23,42,0.12)]" key={update.barangay}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{update.barangay}</p>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{update.status}</p>
                  </div>
                  <span className="rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-[10px] font-bold uppercase text-orange-700">
                    Update
                  </span>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">{update.note}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
