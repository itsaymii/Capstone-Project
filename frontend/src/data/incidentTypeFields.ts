// Fields that belong to each incident type on a responder report.
//
// Mirrors backend/incidents/incident_types.py (the backend checks everything again).
// When you add, remove, or rename a field there, change it here too.

export type DetailFieldKind = 'choice' | 'multi_choice' | 'int' | 'decimal' | 'text' | 'bool' | 'time'

export type DetailValue = string | number | boolean | string[]

export type DetailValues = Record<string, DetailValue>

export type DetailFieldSpec = {
  name: string
  label: string
  kind: DetailFieldKind
  required: boolean
  choices: { value: string; label: string }[]
  min: number
  max: number | null
}

export type IncidentTypeConfig = {
  /** The value saved as the report's incident type, e.g. "Fire Incident". */
  incidentType: string
  key: string
  label: string
  victims: {
    allowed: boolean
    /** Plural label for the victim step, e.g. "Patients"; null when victims are not allowed. */
    label: string | null
    min: number
    max: number | null
  }
  fields: DetailFieldSpec[]
  victimFields: DetailFieldSpec[]
}

export const INCIDENT_TYPE_CONFIGS: IncidentTypeConfig[] = [
  {
    incidentType: 'RCA',
    key: 'rca',
    label: 'Road Crash (RCA)',
    victims: { allowed: true, label: 'Persons involved', min: 0, max: null },
    fields: [
      { name: 'vehicles_involved', label: 'Number of vehicles involved', kind: 'int', required: true, min: 1, max: null, choices: [] },
      { name: 'vehicle_types', label: 'Vehicle types', kind: 'multi_choice', required: true, min: 0, max: null, choices: [
        { value: 'motorcycle', label: 'Motorcycle' },
        { value: 'tricycle', label: 'Tricycle' },
        { value: 'jeepney', label: 'Jeepney' },
        { value: 'car', label: 'Car' },
        { value: 'van_suv', label: 'Van / SUV' },
        { value: 'truck', label: 'Truck' },
        { value: 'bus', label: 'Bus' },
        { value: 'bicycle', label: 'Bicycle' },
        { value: 'e_bike', label: 'E-bike' },
        { value: 'other', label: 'Other' },
      ] },
      { name: 'collision_type', label: 'Type of collision', kind: 'choice', required: true, min: 0, max: null, choices: [
        { value: 'head_on', label: 'Head-on' },
        { value: 'rear_end', label: 'Rear-end' },
        { value: 'side_swipe', label: 'Side-swipe' },
        { value: 'self_accident', label: 'Self-accident' },
        { value: 'hit_pedestrian', label: 'Hit a pedestrian' },
        { value: 'rollover', label: 'Rollover' },
        { value: 'other', label: 'Other' },
      ] },
      { name: 'suspected_cause', label: 'Suspected cause', kind: 'choice', required: false, min: 0, max: null, choices: [
        { value: 'overspeeding', label: 'Overspeeding' },
        { value: 'drunk_driving', label: 'Drunk driving' },
        { value: 'brake_failure', label: 'Brake / mechanical failure' },
        { value: 'reckless_overtaking', label: 'Reckless overtaking' },
        { value: 'road_condition', label: 'Road condition' },
        { value: 'unknown', label: 'Unknown' },
        { value: 'other', label: 'Other' },
      ] },
      { name: 'road_condition', label: 'Road condition', kind: 'choice', required: false, min: 0, max: null, choices: [
        { value: 'dry', label: 'Dry' },
        { value: 'wet', label: 'Wet / slippery' },
        { value: 'dark', label: 'Dark / poorly lit' },
        { value: 'under_construction', label: 'Under construction' },
        { value: 'damaged', label: 'Damaged / potholes' },
      ] },
      { name: 'fatalities', label: 'Fatalities', kind: 'int', required: false, min: 0, max: null, choices: [] },
      { name: 'traffic_blocked', label: 'Traffic blocked', kind: 'bool', required: false, min: 0, max: null, choices: [] },
      { name: 'police_notified', label: 'PNP notified', kind: 'bool', required: false, min: 0, max: null, choices: [] },
      { name: 'police_blotter_no', label: 'Police blotter no.', kind: 'text', required: false, min: 0, max: null, choices: [] },
    ],
    victimFields: [
      { name: 'person_role', label: 'Role', kind: 'choice', required: true, min: 0, max: null, choices: [
        { value: 'driver', label: 'Driver' },
        { value: 'passenger', label: 'Passenger' },
        { value: 'pedestrian', label: 'Pedestrian' },
      ] },
      { name: 'protective_gear', label: 'Helmet / seatbelt', kind: 'choice', required: false, min: 0, max: null, choices: [
        { value: 'helmet', label: 'Wearing helmet' },
        { value: 'seatbelt', label: 'Wearing seatbelt' },
        { value: 'none', label: 'None' },
        { value: 'not_applicable', label: 'Not applicable' },
      ] },
    ],
  },
  {
    incidentType: 'Fire Incident',
    key: 'fire',
    label: 'Fire Incident',
    victims: { allowed: true, label: 'Casualties', min: 0, max: null },
    fields: [
      { name: 'structure_type', label: 'What burned', kind: 'choice', required: true, min: 0, max: null, choices: [
        { value: 'residential', label: 'Residential' },
        { value: 'commercial', label: 'Commercial' },
        { value: 'industrial', label: 'Industrial' },
        { value: 'vehicle', label: 'Vehicle' },
        { value: 'grass_vegetation', label: 'Grass / vegetation' },
        { value: 'other', label: 'Other' },
      ] },
      { name: 'alarm_level', label: 'Highest alarm level', kind: 'choice', required: true, min: 0, max: null, choices: [
        { value: 'first', label: '1st alarm' },
        { value: 'second', label: '2nd alarm' },
        { value: 'third', label: '3rd alarm' },
        { value: 'fourth', label: '4th alarm' },
        { value: 'fifth', label: '5th alarm' },
        { value: 'task_force_alpha', label: 'Task Force Alpha' },
        { value: 'task_force_bravo', label: 'Task Force Bravo' },
        { value: 'under_control', label: 'Fire under control' },
        { value: 'fire_out', label: 'Fire out' },
      ] },
      { name: 'suspected_cause', label: 'Suspected cause', kind: 'choice', required: false, min: 0, max: null, choices: [
        { value: 'electrical', label: 'Electrical' },
        { value: 'lpg', label: 'LPG / gas leak' },
        { value: 'cooking', label: 'Cooking' },
        { value: 'candle', label: 'Candle / open flame' },
        { value: 'smoking', label: 'Cigarette' },
        { value: 'arson', label: 'Arson' },
        { value: 'unknown', label: 'Unknown' },
      ] },
      { name: 'structures_affected', label: 'Structures affected', kind: 'int', required: false, min: 0, max: null, choices: [] },
      { name: 'families_affected', label: 'Families affected / displaced', kind: 'int', required: false, min: 0, max: null, choices: [] },
      { name: 'fatalities', label: 'Fatalities', kind: 'int', required: false, min: 0, max: null, choices: [] },
      { name: 'bfp_present', label: 'BFP on scene', kind: 'bool', required: false, min: 0, max: null, choices: [] },
      { name: 'fire_out_time', label: 'Time declared fire out', kind: 'time', required: false, min: 0, max: null, choices: [] },
    ],
    victimFields: [
      { name: 'injury_type', label: 'Injury', kind: 'choice', required: false, min: 0, max: null, choices: [
        { value: 'burns', label: 'Burns' },
        { value: 'smoke_inhalation', label: 'Smoke inhalation' },
        { value: 'other', label: 'Other' },
      ] },
    ],
  },
  {
    incidentType: 'Crime Against Person/Property',
    key: 'crime',
    label: 'Crime Against Person/Property',
    victims: { allowed: true, label: 'Victims', min: 0, max: null },
    fields: [
      { name: 'suspects', label: 'Number of suspects', kind: 'int', required: false, min: 0, max: null, choices: [] },
      { name: 'suspect_status', label: 'Suspect status', kind: 'choice', required: false, min: 0, max: null, choices: [
        { value: 'at_large', label: 'At large' },
        { value: 'apprehended', label: 'Apprehended' },
        { value: 'unknown', label: 'Unknown' },
      ] },
      { name: 'pnp_coordinated', label: 'Coordinated with PNP', kind: 'bool', required: false, min: 0, max: null, choices: [] },
      { name: 'police_blotter_no', label: 'Police blotter no.', kind: 'text', required: false, min: 0, max: null, choices: [] },
    ],
    victimFields: [],
  },
  {
    incidentType: 'Medical Emergency',
    key: 'medical',
    label: 'Medical Emergency',
    victims: { allowed: true, label: 'Patients', min: 1, max: null },
    fields: [
      { name: 'chief_complaint', label: 'Chief complaint', kind: 'choice', required: true, min: 0, max: null, choices: [
        { value: 'chest_pain', label: 'Chest pain' },
        { value: 'difficulty_breathing', label: 'Difficulty breathing' },
        { value: 'stroke_symptoms', label: 'Stroke symptoms' },
        { value: 'seizure', label: 'Seizure' },
        { value: 'injury', label: 'Injury / wound' },
        { value: 'fainting', label: 'Fainting' },
        { value: 'fever', label: 'High fever' },
        { value: 'other', label: 'Other' },
      ] },
      { name: 'consciousness', label: 'Level of consciousness (AVPU)', kind: 'choice', required: true, min: 0, max: null, choices: [
        { value: 'alert', label: 'Alert' },
        { value: 'voice', label: 'Responds to voice' },
        { value: 'pain', label: 'Responds to pain' },
        { value: 'unresponsive', label: 'Unresponsive' },
      ] },
      { name: 'transported', label: 'Transported to hospital', kind: 'bool', required: false, min: 0, max: null, choices: [] },
      { name: 'hospital', label: 'Hospital', kind: 'text', required: false, min: 0, max: null, choices: [] },
    ],
    victimFields: [
      { name: 'blood_pressure', label: 'Blood pressure (e.g. 120/80)', kind: 'text', required: false, min: 0, max: null, choices: [] },
      { name: 'pulse_rate', label: 'Pulse (bpm)', kind: 'int', required: false, min: 0, max: 300, choices: [] },
      { name: 'respiratory_rate', label: 'Respiratory rate (/min)', kind: 'int', required: false, min: 0, max: 100, choices: [] },
      { name: 'oxygen_saturation', label: 'SpO2 (%)', kind: 'int', required: false, min: 0, max: 100, choices: [] },
      { name: 'temperature', label: 'Temperature (°C)', kind: 'decimal', required: false, min: 0, max: 45, choices: [] },
    ],
  },
  {
    incidentType: 'Ambulance Assistance',
    key: 'ambulance',
    label: 'Ambulance Assistance',
    victims: { allowed: true, label: 'Patient', min: 1, max: 1 },
    fields: [
      { name: 'pickup_location', label: 'Pick-up location', kind: 'text', required: true, min: 0, max: null, choices: [] },
      { name: 'destination_hospital', label: 'Destination hospital', kind: 'text', required: true, min: 0, max: null, choices: [] },
      { name: 'transport_reason', label: 'Reason for transport', kind: 'choice', required: true, min: 0, max: null, choices: [
        { value: 'referral', label: 'Referral' },
        { value: 'dialysis', label: 'Dialysis' },
        { value: 'discharge', label: 'Discharge / going home' },
        { value: 'transfer', label: 'Hospital transfer' },
        { value: 'check_up', label: 'Check-up' },
        { value: 'other', label: 'Other' },
      ] },
      { name: 'ambulance_unit', label: 'Ambulance unit / plate no.', kind: 'text', required: false, min: 0, max: null, choices: [] },
      { name: 'departure_time', label: 'Departure time', kind: 'time', required: false, min: 0, max: null, choices: [] },
      { name: 'arrival_time', label: 'Arrival time', kind: 'time', required: false, min: 0, max: null, choices: [] },
      { name: 'condition_on_arrival', label: 'Patient condition on arrival', kind: 'choice', required: false, min: 0, max: null, choices: [
        { value: 'stable', label: 'Stable' },
        { value: 'improved', label: 'Improved' },
        { value: 'deteriorated', label: 'Deteriorated' },
        { value: 'deceased', label: 'Deceased' },
      ] },
    ],
    victimFields: [],
  },
  {
    incidentType: 'Stand-by Medical Team',
    key: 'standby',
    label: 'Stand-by Medical Team',
    victims: { allowed: false, label: null, min: 0, max: 0 },
    fields: [
      { name: 'event_name', label: 'Event name', kind: 'text', required: true, min: 0, max: null, choices: [] },
      { name: 'venue', label: 'Venue', kind: 'text', required: true, min: 0, max: null, choices: [] },
      { name: 'organizer', label: 'Organizer', kind: 'text', required: false, min: 0, max: null, choices: [] },
      { name: 'duty_start', label: 'Duty start', kind: 'time', required: false, min: 0, max: null, choices: [] },
      { name: 'duty_end', label: 'Duty end', kind: 'time', required: false, min: 0, max: null, choices: [] },
      { name: 'crowd_estimate', label: 'Estimated crowd size', kind: 'int', required: false, min: 0, max: null, choices: [] },
      { name: 'team_members', label: 'Team members deployed', kind: 'int', required: false, min: 0, max: null, choices: [] },
      { name: 'persons_assisted', label: 'Persons assisted', kind: 'int', required: true, min: 0, max: null, choices: [] },
      { name: 'cases_handled', label: 'Cases handled', kind: 'multi_choice', required: false, min: 0, max: null, choices: [
        { value: 'minor_injury', label: 'Minor injury' },
        { value: 'heat_exhaustion', label: 'Heat exhaustion' },
        { value: 'dizziness', label: 'Dizziness' },
        { value: 'fainting', label: 'Fainting' },
        { value: 'hypertension', label: 'High blood pressure' },
        { value: 'other', label: 'Other' },
      ] },
    ],
    victimFields: [],
  },
  {
    incidentType: 'Drowning',
    key: 'drowning',
    label: 'Drowning',
    victims: { allowed: true, label: 'Victims', min: 0, max: null },
    fields: [
      { name: 'water_body', label: 'Where', kind: 'choice', required: true, min: 0, max: null, choices: [
        { value: 'sea', label: 'Sea / beach' },
        { value: 'river', label: 'River' },
        { value: 'creek', label: 'Creek' },
        { value: 'pool', label: 'Swimming pool' },
        { value: 'flood', label: 'Floodwater' },
        { value: 'other', label: 'Other' },
      ] },
      { name: 'activity', label: 'Activity at the time', kind: 'choice', required: false, min: 0, max: null, choices: [
        { value: 'swimming', label: 'Swimming' },
        { value: 'fishing', label: 'Fishing' },
        { value: 'fell', label: 'Fell into the water' },
        { value: 'swept_by_flood', label: 'Swept by flood' },
        { value: 'other', label: 'Other' },
      ] },
      { name: 'rescued_alive', label: 'Rescued alive', kind: 'int', required: false, min: 0, max: null, choices: [] },
      { name: 'revived_cpr', label: 'Revived with CPR', kind: 'int', required: false, min: 0, max: null, choices: [] },
      { name: 'fatalities', label: 'Fatalities', kind: 'int', required: false, min: 0, max: null, choices: [] },
      { name: 'missing', label: 'Still missing', kind: 'int', required: false, min: 0, max: null, choices: [] },
      { name: 'search_ongoing', label: 'Search and retrieval ongoing', kind: 'bool', required: false, min: 0, max: null, choices: [] },
      { name: 'coast_guard_involved', label: 'Coast Guard involved', kind: 'bool', required: false, min: 0, max: null, choices: [] },
    ],
    victimFields: [],
  },
]

const TEXT_MAX_LENGTH = 200

export function getIncidentTypeConfig(incidentType: string): IncidentTypeConfig | null {
  const wanted = incidentType.trim().toLowerCase()
  return INCIDENT_TYPE_CONFIGS.find((config) => config.incidentType.toLowerCase() === wanted) ?? null
}

function isEmpty(value: DetailValue | undefined): boolean {
  return value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)
}

/** Error message for one value, or null when it is fine. Same rules as the backend. */
export function validateDetailValue(spec: DetailFieldSpec, value: DetailValue | undefined): string | null {
  if (isEmpty(value)) return spec.required ? `${spec.label} is required.` : null

  switch (spec.kind) {
    case 'text':
      return String(value).trim().length > TEXT_MAX_LENGTH
        ? `${spec.label} must be ${TEXT_MAX_LENGTH} characters or fewer.`
        : null
    case 'int':
    case 'decimal': {
      const number = Number(value)
      if (!Number.isFinite(number)) return `${spec.label} must be a number.`
      if (spec.kind === 'int' && !Number.isInteger(number)) return `${spec.label} must be a whole number.`
      if (number < spec.min) return `${spec.label} must be at least ${spec.min}.`
      if (spec.max !== null && number > spec.max) return `${spec.label} must be at most ${spec.max}.`
      return null
    }
    case 'choice':
      return spec.choices.some((choice) => choice.value === value) ? null : `Choose a valid ${spec.label.toLowerCase()}.`
    case 'multi_choice':
      return Array.isArray(value) && value.every((item) => spec.choices.some((choice) => choice.value === item))
        ? null
        : `Choose valid ${spec.label.toLowerCase()}.`
    case 'time':
      return /^([01]?\d|2[0-3]):[0-5]\d$/.test(String(value)) ? null : `${spec.label} must be a time like 14:30.`
    default:
      return null
  }
}

/** First problem in a set of values, or null when everything is valid. */
export function validateDetailValues(specs: DetailFieldSpec[], values: DetailValues, prefix = ''): string | null {
  for (const spec of specs) {
    const error = validateDetailValue(spec, values[spec.name])
    if (error) return `${prefix}${error}`
  }
  return null
}

/** Keep only this type's fields, drop empty values, and convert numbers, ready to send to the API. */
export function cleanDetailValues(specs: DetailFieldSpec[], values: DetailValues): DetailValues {
  const cleaned: DetailValues = {}
  for (const spec of specs) {
    const value = values[spec.name]
    if (isEmpty(value)) continue
    cleaned[spec.name] = spec.kind === 'int' || spec.kind === 'decimal' ? Number(value) : value
  }
  return cleaned
}

/** Human-readable value for showing saved details, e.g. "Motorcycle, Jeepney" or "Yes". */
export function formatDetailValue(spec: DetailFieldSpec, value: DetailValue | undefined): string {
  if (isEmpty(value)) return '-'
  if (spec.kind === 'bool') return value ? 'Yes' : 'No'
  const labelOf = (item: string) => spec.choices.find((choice) => choice.value === item)?.label ?? item
  if (spec.kind === 'choice') return labelOf(String(value))
  if (spec.kind === 'multi_choice' && Array.isArray(value)) return value.map(labelOf).join(', ')
  if (spec.kind === 'decimal' && spec.name.includes('damage')) return `PHP ${Number(value).toLocaleString('en-PH')}`
  return String(value)
}