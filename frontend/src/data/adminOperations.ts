export type HazardType = 'EQ' | 'FR' | 'AC'
export type IncidentStatus = 'active' | 'pending' | 'resolved'

export type HazardIncident = {
  id: string
  title: string
  code: HazardType
  status: IncidentStatus
  severity: 'Low' | 'Moderate' | 'High' | 'Critical'
  location: string
  time: string
  responseTeam: string
  description: string
  coordinates: [number, number]
}

export type SimulationModule = {
  id: string
  title: string
  tag: string
  trainees: number
  completionRate: number
  duration: string
  description: string
}

export const hazardIncidents: HazardIncident[] = [
  {
    id: 'eq-east-zone',
    title: 'Minor Earthquake - East Zone',
    code: 'EQ',
    status: 'resolved',
    severity: 'Low',
    location: 'East Zone, Lucena City',
    time: '10:00 PM',
    responseTeam: 'Seismic Assessment Unit',
    description: 'Mild aftershock recorded. Monitoring continued with no major structural damage reported.',
    coordinates: [13.947, 121.632],
  },
  {
    id: 'fire-commercial',
    title: 'Building Fire - Commercial District',
    code: 'FR',
    status: 'active',
    severity: 'High',
    location: 'Commercial District, Lucena City',
    time: '7:15 AM',
    responseTeam: 'BFP Lucena Station 1',
    description: 'Suppression operations remain ongoing while surrounding establishments are under temporary evacuation.',
    coordinates: [13.934, 121.621],
  },
  {
    id: 'acc-highway',
    title: 'Multi-vehicle Accident - Highway',
    code: 'AC',
    status: 'pending',
    severity: 'Moderate',
    location: 'Pan-Philippine Highway, Lucena City',
    time: '9:00 AM',
    responseTeam: 'Traffic and Rescue Coordination',
    description: 'Medical triage and traffic clearing are waiting for additional field confirmation.',
    coordinates: [13.926, 121.609],
  },
  {
    id: 'fire-barangay-10',
    title: 'Structural Fire - Barangay 10',
    code: 'FR',
    status: 'active',
    severity: 'High',
    location: 'Barangay 10, Lucena City',
    time: '5:30 AM',
    responseTeam: 'BFP Lucena Rapid Unit',
    description: 'Fire suppression teams are containing flames while nearby households remain under perimeter control.',
    coordinates: [13.941, 121.614],
  },
  {
    id: 'acc-diversion',
    title: 'Road Collision - Diversion Road',
    code: 'AC',
    status: 'pending',
    severity: 'Moderate',
    location: 'Diversion Road, Lucena City',
    time: '8:40 AM',
    responseTeam: 'PNP Traffic Unit',
    description: 'Tow support has been requested and rerouting advisories remain active.',
    coordinates: [13.918, 121.626],
  },
  {
    id: 'fire-industrial',
    title: 'Warehouse Fire - Industrial Zone',
    code: 'FR',
    status: 'active',
    severity: 'Critical',
    location: 'Industrial Zone, Lucena City',
    time: '2:20 AM',
    responseTeam: 'Joint Fire Response Taskforce',
    description: 'Large structure fire with dense smoke plume. Multi-unit suppression and evacuation remain in progress.',
    coordinates: [13.929, 121.642],
  },
]

export const simulationModules: SimulationModule[] = [
  {
    id: 'earthquake',
    title: 'Earthquake Response Course',
    tag: 'Seismic Training',
    trainees: 831,
    completionRate: 78,
    duration: '35 min',
    description: 'Covers quake alerts, safe cover actions, evacuation, and post-event reporting drills.',
  },
  {
    id: 'fire',
    title: 'Fire Emergency Course',
    tag: 'Fire Suppression',
    trainees: 924,
    completionRate: 84,
    duration: '40 min',
    description: 'Focuses on extinguisher use, evacuation paths, suppression support, and command escalation.',
  },
  {
    id: 'accident',
    title: 'Road Accident Course',
    tag: 'Traffic Triage',
    trainees: 676,
    completionRate: 81,
    duration: '30 min',
    description: 'Trains field responders on scene control, casualty triage, and rapid coordination steps.',
  },
]

export const hazardMeta: Record<HazardType, { label: string; accent: string; surface: string }> = {
  EQ: { label: 'Earthquake', accent: 'text-emerald-100', surface: 'bg-emerald-400/12 border-emerald-300/22' },
  FR: { label: 'Fire', accent: 'text-orange-100', surface: 'bg-orange-400/12 border-orange-300/22' },
  AC: { label: 'Accident', accent: 'text-amber-100', surface: 'bg-amber-400/12 border-amber-300/22' },
}

export const incidentStatusClasses: Record<IncidentStatus, string> = {
  active: 'border-red-300/22 bg-red-400/12 text-red-100',
  pending: 'border-amber-300/22 bg-amber-400/12 text-amber-100',
  resolved: 'border-emerald-300/22 bg-emerald-400/12 text-emerald-100',
}