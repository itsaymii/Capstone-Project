export type HazardType = 'EQ' | 'FR' | 'AC'
export type IncidentStatus = 'active' | 'pending' | 'approved' | 'resolved'

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

export const hazardIncidents: HazardIncident[] = []


export const hazardMeta: Record<HazardType, { label: string; accent: string; surface: string }> = {
  EQ: { label: 'Earthquake', accent: 'text-emerald-100', surface: 'bg-emerald-400/12 border-emerald-300/22' },
  FR: { label: 'Fire', accent: 'text-orange-100', surface: 'bg-orange-400/12 border-orange-300/22' },
  AC: { label: 'Accident', accent: 'text-amber-100', surface: 'bg-amber-400/12 border-amber-300/22' },
}

export const incidentStatusClasses: Record<IncidentStatus, string> = {
  active: 'border-red-300/22 bg-red-400/12 text-red-100',
  pending: 'border-amber-300/22 bg-amber-400/12 text-amber-100',
  approved: 'border-sky-300/22 bg-sky-400/12 text-sky-100',
  resolved: 'border-emerald-300/22 bg-emerald-400/12 text-emerald-100',
}

export type BackendIncidentForAdmin = {
  id: string
  reference_code?: string
  hazard_type: {
    id: string
    name: string
    description: string
  }
  latitude: string | number
  longitude: string | number
  address: string
  incident_datetime: string
  severity_level: 'low' | 'moderate' | 'high' | 'critical'
  status: 'reported' | 'verified' | 'ongoing' | 'contained' | 'resolved' | 'false_alarm'
  description: string
  created_at: string
}

export function mapBackendIncidentToHazardIncident(
  incident: BackendIncidentForAdmin
): HazardIncident {
  const hazardName = incident.hazard_type?.name?.toLowerCase() || ''

  const code: HazardType =
    hazardName.includes('fire')
      ? 'FR'
      : hazardName.includes('vehicular') ||
          hazardName.includes('accident') ||
          hazardName.includes('rca')
        ? 'AC'
        : 'EQ'

  const status: IncidentStatus =
    incident.status === 'resolved' || incident.status === 'contained'
      ? 'resolved'
      : incident.status === 'reported' || incident.status === 'verified'
        ? 'pending'
        : 'active'

  const severityMap: Record<string, HazardIncident['severity']> = {
    low: 'Low',
    moderate: 'Moderate',
    high: 'High',
    critical: 'Critical',
  }

  const parsedDate = new Date(incident.incident_datetime || incident.created_at)

  return {
    id: incident.id,
    title: `${incident.hazard_type?.name || 'Incident'} - ${incident.reference_code || incident.id.slice(0, 8)}`,
    code,
    status,
    severity: severityMap[incident.severity_level] || 'Low',
    location: incident.address || 'Lucena City',
    time: Number.isNaN(parsedDate.getTime())
      ? 'Unknown time'
      : parsedDate.toLocaleTimeString(undefined, {
          hour: 'numeric',
          minute: '2-digit',
        }),
    responseTeam: 'Responder Team',
    description: incident.description || 'No description provided.',
    coordinates: [
      Number(incident.latitude) || 13.9414,
      Number(incident.longitude) || 121.6236,
    ],
  }
}