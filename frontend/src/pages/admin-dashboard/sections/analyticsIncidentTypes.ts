// Analytics helpers for incident types and the per-type report details.
//
// Kept apart from AnalyticsSection.tsx so the counting rules can be tested
// without rendering anything.

import {
  formatDetailValue,
  getIncidentTypeConfig,
  type DetailFieldSpec,
  type DetailValue,
  type DetailValues,
  type IncidentTypeConfig,
} from '../../../data/incidentTypeFields'

export type AnalyticsTypeKey =
  | 'rca'
  | 'fire'
  | 'crime'
  | 'medical'
  | 'ambulance'
  | 'standby'
  | 'drowning'
  | 'earthquake'
  | 'other'

export type AnalyticsTypeMeta = {
  key: AnalyticsTypeKey
  label: string
  color: string
}

/** Every type the analytics page can show, in display order. */
export const ANALYTICS_TYPES: AnalyticsTypeMeta[] = [
  { key: 'rca', label: 'Road Crash (RCA)', color: '#3b82f6' },
  { key: 'fire', label: 'Fire', color: '#ef4444' },
  { key: 'medical', label: 'Medical Emergency', color: '#ec4899' },
  { key: 'ambulance', label: 'Ambulance Assistance', color: '#06b6d4' },
  { key: 'crime', label: 'Crime', color: '#8b5cf6' },
  { key: 'standby', label: 'Stand-by Medical', color: '#f59e0b' },
  { key: 'drowning', label: 'Drowning', color: '#0ea5e9' },
  { key: 'earthquake', label: 'Earthquake', color: '#10b981' },
  { key: 'other', label: 'Other', color: '#94a3b8' },
]

const TYPE_BY_KEY = new Map(ANALYTICS_TYPES.map((type) => [type.key, type]))
const TYPE_BY_LABEL = new Map(ANALYTICS_TYPES.map((type) => [type.label, type]))

export function getAnalyticsTypeMeta(keyOrLabel: string): AnalyticsTypeMeta {
  return TYPE_BY_KEY.get(keyOrLabel as AnalyticsTypeKey) ?? TYPE_BY_LABEL.get(keyOrLabel) ?? TYPE_BY_KEY.get('other')!
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/** Keyword rules, most specific first (stand-by before medical, and so on). */
function keyFromText(value: string): AnalyticsTypeKey | null {
  const lower = value.toLowerCase()
  if (!lower) return null
  if (lower.includes('stand-by') || lower.includes('standby') || lower.includes('stand by')) return 'standby'
  if (lower.includes('ambulance')) return 'ambulance'
  if (lower.includes('drown')) return 'drowning'
  if (lower.includes('crime') || lower.includes('robbery') || lower.includes('theft')) return 'crime'
  if (lower.includes('earthquake') || lower.includes('lindol')) return 'earthquake'
  if (lower.includes('fire') || lower.includes('sunog')) return 'fire'
  if (
    lower.includes('rca') ||
    lower.includes('road crash') ||
    lower.includes('vehicular') ||
    lower.includes('collision') ||
    lower.includes('traffic') ||
    lower.includes('accident')
  ) {
    return 'rca'
  }
  if (lower.includes('medical') || lower.includes('health')) return 'medical'
  return null
}

/**
 * Which analytics type a record belongs to.
 *
 * Uses the saved incident type first (responder reports), then the backend
 * hazard type name (incident records), and only then the free text, so a
 * medical report whose description mentions "fire" is not counted as a fire.
 */
export function getAnalyticsTypeKey(record: unknown): AnalyticsTypeKey {
  const source = (record ?? {}) as Record<string, any>
  const incidentType = text(source.incidentType) || text(source.incident_type)

  if (incidentType) {
    const config = getIncidentTypeConfig(incidentType)
    if (config) return config.key as AnalyticsTypeKey
    const fromType = keyFromText(incidentType)
    if (fromType) return fromType
  }

  const hazardName = text(source.hazardTypeName) || text(source.hazard_type_name) || text(source.hazard_type?.name)
  const fromHazard = keyFromText(hazardName)
  if (fromHazard) return fromHazard

  const fromCategory = keyFromText([source.type, source.category, source.nature_of_incident].map(text).join(' '))
  if (fromCategory) return fromCategory

  const code = String(source.code || source.hazard_code || '').toUpperCase()
  if (code === 'FR') return 'fire'
  if (code === 'EQ') return 'earthquake'

  const fromText = keyFromText([source.title, source.description].map(text).join(' '))
  return fromText ?? 'other'
}

export function getAnalyticsTypeLabel(record: unknown): string {
  return getAnalyticsTypeMeta(getAnalyticsTypeKey(record)).label
}

/** Config (fields and labels) for a type that has report details, or null. */
export function getConfigForKey(key: AnalyticsTypeKey): IncidentTypeConfig | null {
  const typeNames: Partial<Record<AnalyticsTypeKey, string>> = {
    rca: 'RCA',
    fire: 'Fire Incident',
    crime: 'Crime Against Person/Property',
    medical: 'Medical Emergency',
    ambulance: 'Ambulance Assistance',
    standby: 'Stand-by Medical Team',
    drowning: 'Drowning',
  }
  const name = typeNames[key]
  return name ? getIncidentTypeConfig(name) : null
}

function parseTime(value: unknown): { hours: number; minutes: number } | null {
  const match = /^(\d{1,2}):(\d{2})/.exec(String(value ?? ''))
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null
  return { hours, minutes }
}

/** Minutes between two "HH:MM" times, wrapping past midnight. */
export function minutesBetweenTimes(start: unknown, end: unknown): number | null {
  const from = parseTime(start)
  const to = parseTime(end)
  if (!from || !to) return null
  let minutes = to.hours * 60 + to.minutes - (from.hours * 60 + from.minutes)
  if (minutes < 0) minutes += 24 * 60
  return minutes
}

/**
 * Minutes from when the incident happened (timeOccurred) to when the
 * responder filed the report (createdAt). Both are read in local time.
 * Returns null when either is missing or the gap is over a day.
 */
export function getIncidentToReportMinutes(record: unknown): number | null {
  const source = (record ?? {}) as Record<string, any>
  const occurred = parseTime(source.timeOccurred ?? source.time_occurred)
  const created = new Date(String(source.createdAt ?? source.created_at ?? ''))
  if (!occurred || Number.isNaN(created.getTime())) return null

  const occurredAt = new Date(created)
  occurredAt.setHours(occurred.hours, occurred.minutes, 0, 0)
  if (occurredAt.getTime() > created.getTime()) occurredAt.setDate(occurredAt.getDate() - 1)

  const minutes = Math.round((created.getTime() - occurredAt.getTime()) / 60000)
  return minutes >= 0 && minutes <= 24 * 60 ? minutes : null
}

/** Hour of day (0-23) the incident happened, or null. */
export function getOccurredHour(record: unknown): number | null {
  const source = (record ?? {}) as Record<string, any>
  const occurred = parseTime(source.timeOccurred ?? source.time_occurred)
  if (occurred) return occurred.hours
  const created = new Date(String(source.createdAt ?? source.created_at ?? source.reportedAt ?? ''))
  return Number.isNaN(created.getTime()) ? null : created.getHours()
}

// ---------------------------------------------------------------------------
// Details insights
// ---------------------------------------------------------------------------

export type InsightBar = { label: string; value: number; helper?: string }

export type InsightChart = {
  title: string
  description: string
  items: InsightBar[]
}

export type InsightKpi = { label: string; value: string; helper: string }

export type TypeInsights = {
  key: AnalyticsTypeKey
  label: string
  color: string
  reports: number
  /** Reports of this type that have saved details (older reports may not). */
  withDetails: number
  kpis: InsightKpi[]
  charts: InsightChart[]
}

function detailsOf(record: unknown): DetailValues {
  const details = (record as Record<string, any> | null)?.details
  return details && typeof details === 'object' && !Array.isArray(details) ? (details as DetailValues) : {}
}

function victimsOf(record: unknown): Array<{ details: DetailValues }> {
  const victims = (record as Record<string, any> | null)?.victims
  if (!Array.isArray(victims)) return []
  return victims.map((victim) => ({ details: detailsOf(victim) }))
}

function hasValue(value: DetailValue | undefined): boolean {
  return value !== undefined && value !== null && value !== '' && !(Array.isArray(value) && value.length === 0)
}

function numberOf(value: DetailValue | undefined): number {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function sumField(records: unknown[], name: string): number {
  return records.reduce<number>((total, record) => total + numberOf(detailsOf(record)[name]), 0)
}

function share(part: number, whole: number): string {
  return whole > 0 ? `${Math.round((part / whole) * 100)}%` : '0%'
}

function findSpec(specs: DetailFieldSpec[], name: string): DetailFieldSpec | undefined {
  return specs.find((spec) => spec.name === name)
}

/**
 * Count how often each value of a field appears, using the field's labels.
 * Multi-choice fields count every selected option; text fields are grouped
 * case-insensitively and keep the first spelling seen.
 */
export function countDetailValues(
  values: Array<DetailValue | undefined>,
  spec: DetailFieldSpec,
  limit = 6,
): InsightBar[] {
  const counts = new Map<string, { label: string; value: number }>()
  const add = (key: string, label: string) => {
    const current = counts.get(key)
    if (current) current.value += 1
    else counts.set(key, { label, value: 1 })
  }

  values.forEach((value) => {
    if (!hasValue(value)) return
    if (spec.kind === 'multi_choice' && Array.isArray(value)) {
      value.forEach((item) => add(item, formatDetailValue(spec, [item])))
    } else if (spec.kind === 'text') {
      const label = String(value).trim()
      add(label.toLowerCase(), label)
    } else {
      add(String(value), formatDetailValue(spec, value))
    }
  })

  const total = values.filter(hasValue).length
  return Array.from(counts.values())
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
    .slice(0, limit)
    .map((item) => ({ ...item, helper: `${share(item.value, total)} of ${total} with this field` }))
}

type ChartPlan = { field: string; from: 'report' | 'victim'; title: string; description: string }

const CHART_PLANS: Partial<Record<AnalyticsTypeKey, ChartPlan[]>> = {
  rca: [
    { field: 'vehicle_types', from: 'report', title: 'Vehicles involved', description: 'Each vehicle type selected on a road crash report.' },
    { field: 'collision_type', from: 'report', title: 'Type of collision', description: 'How the road crashes happened.' },
    { field: 'suspected_cause', from: 'report', title: 'Suspected cause', description: 'Leading causes, useful for road safety campaigns.' },
    { field: 'protective_gear', from: 'victim', title: 'Helmet / seatbelt use', description: 'Protective gear worn by the persons involved.' },
  ],
  fire: [
    { field: 'suspected_cause', from: 'report', title: 'Suspected cause', description: 'Leading causes of fire, useful for fire prevention.' },
    { field: 'structure_type', from: 'report', title: 'What burned', description: 'Kind of structure or property affected.' },
    { field: 'alarm_level', from: 'report', title: 'Highest alarm level', description: 'How big the fires became.' },
    { field: 'injury_type', from: 'victim', title: 'Casualty injuries', description: 'Injuries recorded for fire casualties.' },
  ],
  crime: [
    { field: 'crime_type', from: 'report', title: 'Type of crime', description: 'Crimes against person or property responded to.' },
    { field: 'weapon', from: 'report', title: 'Weapon involved', description: 'Weapons recorded on the reports.' },
    { field: 'suspect_status', from: 'report', title: 'Suspect status', description: 'Whether suspects were apprehended.' },
  ],
  medical: [
    { field: 'chief_complaint', from: 'report', title: 'Chief complaint', description: 'Most common medical emergencies.' },
    { field: 'consciousness', from: 'report', title: 'Level of consciousness', description: 'Patient condition on arrival of the team (AVPU).' },
    { field: 'hospital', from: 'report', title: 'Receiving hospitals', description: 'Where patients were brought.' },
  ],
  ambulance: [
    { field: 'transport_reason', from: 'report', title: 'Reason for transport', description: 'Why the ambulance was requested.' },
    { field: 'destination_hospital', from: 'report', title: 'Destination hospitals', description: 'Where patients were transported.' },
    { field: 'condition_on_arrival', from: 'report', title: 'Condition on arrival', description: 'Patient condition when the ambulance arrived.' },
  ],
  standby: [
    { field: 'cases_handled', from: 'report', title: 'Cases handled', description: 'Cases the stand-by team attended to.' },
    { field: 'event_name', from: 'report', title: 'Events covered', description: 'Events with a stand-by medical team.' },
    { field: 'venue', from: 'report', title: 'Venues', description: 'Where the teams were deployed.' },
  ],
  drowning: [
    { field: 'water_body', from: 'report', title: 'Where it happened', description: 'Bodies of water with drowning incidents.' },
    { field: 'activity', from: 'report', title: 'Activity at the time', description: 'What the victims were doing.' },
  ],
}

function buildKpis(key: AnalyticsTypeKey, records: unknown[]): InsightKpi[] {
  const victims = records.flatMap(victimsOf)
  const persons = records.reduce<number>((total, record) => {
    const count = Number((record as Record<string, any>)?.victimCount ?? (record as Record<string, any>)?.victim_count)
    return total + (Number.isFinite(count) ? count : victimsOf(record).length)
  }, 0)

  switch (key) {
    case 'rca': {
      const geared = victims.filter((victim) => ['helmet', 'seatbelt', 'none'].includes(String(victim.details.protective_gear)))
      const protectedCount = geared.filter((victim) => victim.details.protective_gear !== 'none').length
      return [
        { label: 'Persons involved', value: String(persons), helper: 'Drivers, passengers and pedestrians.' },
        { label: 'Vehicles involved', value: String(sumField(records, 'vehicles_involved')), helper: 'Total vehicles across the reports.' },
        { label: 'Fatalities', value: String(sumField(records, 'fatalities')), helper: 'Deaths recorded on road crash reports.' },
        { label: 'Helmet / seatbelt use', value: share(protectedCount, geared.length), helper: `${protectedCount} of ${geared.length} persons where it applies.` },
      ]
    }
    case 'fire': {
      const damage = sumField(records, 'estimated_damage')
      return [
        { label: 'Estimated damage', value: `PHP ${damage.toLocaleString('en-PH')}`, helper: 'Total estimated damage.' },
        { label: 'Families affected', value: String(sumField(records, 'families_affected')), helper: 'Families affected or displaced.' },
        { label: 'Structures affected', value: String(sumField(records, 'structures_affected')), helper: 'Houses and buildings affected.' },
        { label: 'Fatalities', value: String(sumField(records, 'fatalities')), helper: 'Deaths recorded on fire reports.' },
      ]
    }
    case 'crime': {
      const withStatus = records.filter((record) => hasValue(detailsOf(record).suspect_status))
      const apprehended = withStatus.filter((record) => detailsOf(record).suspect_status === 'apprehended').length
      const pnp = records.filter((record) => detailsOf(record).pnp_coordinated === true).length
      return [
        { label: 'Victims', value: String(persons), helper: 'Victims recorded on crime reports.' },
        { label: 'Suspects', value: String(sumField(records, 'suspects')), helper: 'Total suspects reported.' },
        { label: 'Apprehension rate', value: share(apprehended, withStatus.length), helper: `${apprehended} of ${withStatus.length} reports with a suspect status.` },
        { label: 'Coordinated with PNP', value: share(pnp, records.length), helper: `${pnp} of ${records.length} reports.` },
      ]
    }
    case 'medical': {
      const transported = records.filter((record) => detailsOf(record).transported === true).length
      const critical = records.filter((record) => ['pain', 'unresponsive'].includes(String(detailsOf(record).consciousness))).length
      return [
        { label: 'Patients', value: String(persons), helper: 'Patients attended to.' },
        { label: 'Transported', value: share(transported, records.length), helper: `${transported} of ${records.length} cases brought to a hospital.` },
        { label: 'Low consciousness', value: String(critical), helper: 'Responds to pain only, or unresponsive.' },
      ]
    }
    case 'ambulance': {
      const trips = records
        .map((record) => minutesBetweenTimes(detailsOf(record).departure_time, detailsOf(record).arrival_time))
        .filter((minutes): minutes is number => minutes !== null && minutes <= 6 * 60)
      const average = trips.length > 0 ? Math.round(trips.reduce((a, b) => a + b, 0) / trips.length) : 0
      return [
        { label: 'Transports', value: String(records.length), helper: 'Ambulance assistance reports.' },
        { label: 'Average trip time', value: trips.length > 0 ? `${average} min` : '-', helper: `From departure to arrival, ${trips.length} trips with both times.` },
      ]
    }
    case 'standby': {
      const assisted = sumField(records, 'persons_assisted')
      const crowds = records.map((record) => numberOf(detailsOf(record).crowd_estimate)).filter((value) => value > 0)
      const durations = records
        .map((record) => minutesBetweenTimes(detailsOf(record).duty_start, detailsOf(record).duty_end))
        .filter((minutes): minutes is number => minutes !== null)
      const hours = durations.reduce((a, b) => a + b, 0) / 60
      return [
        { label: 'Deployments', value: String(records.length), helper: 'Stand-by medical team reports.' },
        { label: 'Persons assisted', value: String(assisted), helper: 'Total persons the teams attended to.' },
        { label: 'Team members', value: String(sumField(records, 'team_members')), helper: 'Total members deployed.' },
        { label: 'Duty hours', value: hours > 0 ? hours.toFixed(1) : '-', helper: crowds.length > 0 ? `Average crowd of ${Math.round(crowds.reduce((a, b) => a + b, 0) / crowds.length).toLocaleString()}.` : 'Duty start to duty end.' },
      ]
    }
    case 'drowning': {
      const alive = sumField(records, 'rescued_alive') + sumField(records, 'revived_cpr')
      const fatalities = sumField(records, 'fatalities')
      const missing = sumField(records, 'missing')
      const outcomes = alive + fatalities + missing
      return [
        { label: 'Victims', value: String(persons), helper: 'Persons in drowning incidents.' },
        { label: 'Survival rate', value: share(alive, outcomes), helper: `${alive} rescued alive or revived with CPR.` },
        { label: 'Fatalities', value: String(fatalities), helper: 'Deaths recorded on drowning reports.' },
        { label: 'Still missing', value: String(missing), helper: 'Persons not yet found.' },
      ]
    }
    default:
      return []
  }
}

function drowningOutcomeChart(records: unknown[]): InsightChart {
  const items: InsightBar[] = [
    { label: 'Rescued alive', value: sumField(records, 'rescued_alive') },
    { label: 'Revived with CPR', value: sumField(records, 'revived_cpr') },
    { label: 'Fatalities', value: sumField(records, 'fatalities') },
    { label: 'Still missing', value: sumField(records, 'missing') },
  ]
  return { title: 'Victim outcomes', description: 'What happened to the drowning victims.', items }
}

/** Insights for one type, built from the records of that type. */
export function buildTypeInsights(key: AnalyticsTypeKey, records: unknown[]): TypeInsights | null {
  const config = getConfigForKey(key)
  if (!config) return null
  const meta = getAnalyticsTypeMeta(key)
  const withDetails = records.filter((record) => Object.keys(detailsOf(record)).length > 0)

  const charts: InsightChart[] = (CHART_PLANS[key] ?? []).flatMap((plan) => {
    const specs = plan.from === 'report' ? config.fields : config.victimFields
    const spec = findSpec(specs, plan.field)
    if (!spec) return []
    const values =
      plan.from === 'report'
        ? withDetails.map((record) => detailsOf(record)[plan.field])
        : withDetails.flatMap(victimsOf).map((victim) => victim.details[plan.field])
    return [{ title: plan.title, description: plan.description, items: countDetailValues(values, spec) }]
  })
  if (key === 'drowning') charts.push(drowningOutcomeChart(withDetails))

  return {
    key,
    label: meta.label,
    color: meta.color,
    reports: records.length,
    withDetails: withDetails.length,
    kpis: buildKpis(key, withDetails),
    charts,
  }
}

/** Insights for every type that has detail fields and at least one record. */
export function buildAllTypeInsights(records: unknown[]): TypeInsights[] {
  const groups = new Map<AnalyticsTypeKey, unknown[]>()
  records.forEach((record) => {
    const key = getAnalyticsTypeKey(record)
    groups.set(key, [...(groups.get(key) ?? []), record])
  })

  return ANALYTICS_TYPES.flatMap((type) => {
    const group = groups.get(type.key)
    if (!group || group.length === 0) return []
    const insights = buildTypeInsights(type.key, group)
    return insights ? [insights] : []
  })
}

/** Records per time-of-day block (based on the time the incident occurred). */
export function countByTimeOfDay(records: unknown[]): InsightBar[] {
  const blocks = [
    { label: 'Early morning (12AM-6AM)', from: 0, to: 6 },
    { label: 'Morning (6AM-12PM)', from: 6, to: 12 },
    { label: 'Afternoon (12PM-6PM)', from: 12, to: 18 },
    { label: 'Evening (6PM-12AM)', from: 18, to: 24 },
  ]
  const hours = records.map(getOccurredHour).filter((hour): hour is number => hour !== null)
  return blocks.map((block) => {
    const value = hours.filter((hour) => hour >= block.from && hour < block.to).length
    return { label: block.label, value, helper: `${share(value, hours.length)} of incidents` }
  })
}

/** Records per day of the week (based on the report date). */
export function countByWeekday(records: unknown[], getDate: (record: any) => Date): InsightBar[] {
  const names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const counts = names.map(() => 0)
  records.forEach((record) => {
    counts[getDate(record).getDay()] += 1
  })
  return names.map((label, index) => ({ label, value: counts[index], helper: `${share(counts[index], records.length)} of incidents` }))
}