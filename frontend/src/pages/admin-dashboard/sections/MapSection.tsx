import { AdminIncidentMapPanel } from '../../../components/AdminIncidentMapPanel'
import type { HazardIncident, HazardType } from '../../../data/adminOperations'

type MapFilter = HazardType

type NewIncidentInput = {
  code: Extract<HazardType, 'FR' | 'AC'>
  title: string
  location: string
  responseTeam: string
  severity: HazardIncident['severity']
  description: string
  coordinates: [number, number]
}

type MapSectionProps = {
  incidents: HazardIncident[]
  mapFilter: MapFilter
  onSelectType: (filter: MapFilter) => void
  onCreateIncident: (incident: NewIncidentInput) => void
  onIncidentReportApproved?: () => void
}

export function MapSection({
  incidents,
  mapFilter,
  onSelectType,
  onCreateIncident,
  onIncidentReportApproved,
}: MapSectionProps) {
  return (
    <AdminIncidentMapPanel
      incidents={incidents}
      onCreateIncident={onCreateIncident}
      onIncidentReportApproved={onIncidentReportApproved}
      onSelectType={onSelectType}
      selectedType={mapFilter}
    />
  )
}
