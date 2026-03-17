import { useEffect, useMemo, useRef, useState } from 'react'
import L, { type LatLngBoundsExpression } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { HazardIncident, HazardType } from '../data/adminOperations'

type IncidentMapFilter = 'all' | HazardType
type ReportableHazardType = Extract<HazardType, 'FR' | 'AC'>
type IncidentSeverity = HazardIncident['severity']
type RespondedToOption =
  | 'RCA'
  | 'Fire Incident'
  | 'Crime Against Person/Property'
  | 'Medical Emergency'
  | 'Ambulance Assistance'
  | 'Stand-By Medical Team'
  | 'Drowning'

type ActivityLogEntry = {
  id: string
  time: string
  activity: string
  remarks: string
}

type FireFormState = {
  title: string
  location: string
  responseTeam: string
  severity: IncidentSeverity
  description: string
  latitude: string
  longitude: string
}

type AccidentFormState = {
  team: string
  reportDate: string
  shiftTime: string
  dutyFor: string
  respondedTo: RespondedToOption
  location: string
  severity: IncidentSeverity
  latitude: string
  longitude: string
  activityLogs: ActivityLogEntry[]
}

type NewIncidentInput = {
  code: ReportableHazardType
  title: string
  location: string
  responseTeam: string
  severity: IncidentSeverity
  description: string
  coordinates: [number, number]
}

type AdminIncidentMapPanelProps = {
  incidents: HazardIncident[]
  selectedType: IncidentMapFilter
  onSelectType: (filter: IncidentMapFilter) => void
  onCreateIncident: (incident: NewIncidentInput) => void
}

const lucenaBounds: LatLngBoundsExpression = [
  [13.89, 121.57],
  [13.98, 121.69],
]

const hazardColors: Record<HazardType, string> = {
  EQ: '#4ade80',
  FR: '#fb923c',
  AC: '#facc15',
}

const hazardTypeMeta: Record<HazardType, { label: string; color: string }> = {
  EQ: { label: 'Earthquake', color: hazardColors.EQ },
  FR: { label: 'Fire', color: hazardColors.FR },
  AC: { label: 'Accident', color: hazardColors.AC },
}

const severityOptions: IncidentSeverity[] = ['Low', 'Moderate', 'High', 'Critical']
const respondedToOptions: RespondedToOption[] = [
  'RCA',
  'Fire Incident',
  'Crime Against Person/Property',
  'Medical Emergency',
  'Ambulance Assistance',
  'Stand-By Medical Team',
  'Drowning',
]

function createActivityLogEntry(): ActivityLogEntry {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    time: '',
    activity: '',
    remarks: '',
  }
}

const defaultFireFormState: FireFormState = {
  title: '',
  location: '',
  responseTeam: '',
  severity: 'Moderate',
  description: '',
  latitude: '13.934',
  longitude: '121.621',
}

function createDefaultAccidentFormState(): AccidentFormState {
  return {
    team: 'BRAVO',
    reportDate: new Date().toISOString().slice(0, 10),
    shiftTime: '08:00H - 08:00H',
    dutyFor: '',
    respondedTo: 'RCA',
    location: '',
    severity: 'Moderate',
    latitude: '13.934',
    longitude: '121.621',
    activityLogs: [createActivityLogEntry()],
  }
}

export function AdminIncidentMapPanel({ incidents, selectedType, onSelectType, onCreateIncident }: AdminIncidentMapPanelProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const [fireFormState, setFireFormState] = useState<FireFormState>(defaultFireFormState)
  const [accidentFormState, setAccidentFormState] = useState<AccidentFormState>(createDefaultAccidentFormState)
  const [fireFeedbackMessage, setFireFeedbackMessage] = useState('')
  const [accidentFeedbackMessage, setAccidentFeedbackMessage] = useState('')
  const [activeReportForm, setActiveReportForm] = useState<ReportableHazardType>('FR')

  const filteredIncidents = useMemo(
    () => (selectedType === 'all' ? incidents : incidents.filter((incident) => incident.code === selectedType)),
    [incidents, selectedType],
  )

  const incidentCounts = useMemo(
    () => ({
      EQ: incidents.filter((incident) => incident.code === 'EQ').length,
      FR: incidents.filter((incident) => incident.code === 'FR').length,
      AC: incidents.filter((incident) => incident.code === 'AC').length,
    }),
    [incidents],
  )

  useEffect(() => {
    if (!mapContainerRef.current) {
      return
    }

    const existingLeafletId = (mapContainerRef.current as { _leaflet_id?: number })._leaflet_id
    if (existingLeafletId) {
      ;(mapContainerRef.current as { _leaflet_id?: number })._leaflet_id = undefined
    }

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove()
      mapInstanceRef.current = null
    }

    const map = L.map(mapContainerRef.current, {
      zoomControl: true,
      attributionControl: false,
      maxBounds: lucenaBounds,
      maxBoundsViscosity: 1,
      minZoom: 12,
      maxZoom: 17,
    })

    map.fitBounds(lucenaBounds)

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO',
    }).addTo(map)

    L.rectangle(lucenaBounds, {
      color: '#4f81bd',
      weight: 2,
      fillColor: '#2f5f93',
      fillOpacity: 0.06,
      dashArray: '6 5',
    }).addTo(map)

    filteredIncidents.forEach((incident) => {
      L.circleMarker(incident.coordinates, {
        radius: 14,
        stroke: false,
        fillColor: hazardColors[incident.code],
        fillOpacity: 0.24,
        interactive: false,
      }).addTo(map)

      if (incident.status === 'active') {
        L.circleMarker(incident.coordinates, {
          radius: 10,
          color: hazardColors[incident.code],
          weight: 2,
          fillColor: hazardColors[incident.code],
          fillOpacity: 0.18,
          interactive: false,
          className: 'hazard-marker-pulse',
        }).addTo(map)
      }

      L.circleMarker(incident.coordinates, {
        radius: 7,
        color: '#ffffff',
        weight: 1.5,
        fillColor: hazardColors[incident.code],
        fillOpacity: 0.98,
      })
        .addTo(map)
        .bindPopup(`<strong>${incident.title}</strong><br/>${incident.location}<br/>${incident.time}`)
    })

    window.setTimeout(() => {
      map.invalidateSize()
    }, 0)

    mapInstanceRef.current = map

    return () => {
      map.remove()
      mapInstanceRef.current = null
    }
  }, [filteredIncidents])

  useEffect(() => {
    if (selectedType === 'FR' || selectedType === 'AC') {
      setActiveReportForm(selectedType)
    }
  }, [selectedType])

  function handleMapTypeSelect(filter: IncidentMapFilter): void {
    if (filter === 'FR' || filter === 'AC') {
      setActiveReportForm(filter)
    }

    onSelectType(filter)
  }

  function handleFireFieldChange(field: Exclude<keyof FireFormState, 'code'>, value: string): void {
    setFireFormState((current) => ({
      ...current,
      [field]: value,
    }))
    if (fireFeedbackMessage) {
      setFireFeedbackMessage('')
    }
  }

  function handleAccidentFieldChange(field: Exclude<keyof AccidentFormState, 'code' | 'activityLogs'>, value: string): void {
    setAccidentFormState((current) => ({
      ...current,
      [field]: value,
    }))
    if (accidentFeedbackMessage) {
      setAccidentFeedbackMessage('')
    }
  }

  function handleActivityLogChange(entryId: string, field: keyof Omit<ActivityLogEntry, 'id'>, value: string): void {
    setAccidentFormState((current) => ({
      ...current,
      activityLogs: current.activityLogs.map((entry) =>
        entry.id === entryId
          ? {
              ...entry,
              [field]: value,
            }
          : entry,
      ),
    }))
    if (accidentFeedbackMessage) {
      setAccidentFeedbackMessage('')
    }
  }

  function handleAddActivityLog(): void {
    setAccidentFormState((current) => ({
      ...current,
      activityLogs: [...current.activityLogs, createActivityLogEntry()],
    }))
    if (accidentFeedbackMessage) {
      setAccidentFeedbackMessage('')
    }
  }

  function handleRemoveActivityLog(entryId: string): void {
    setAccidentFormState((current) => {
      if (current.activityLogs.length === 1) {
        return current
      }

      return {
        ...current,
        activityLogs: current.activityLogs.filter((entry) => entry.id !== entryId),
      }
    })
    if (accidentFeedbackMessage) {
      setAccidentFeedbackMessage('')
    }
  }

  function handleFireSubmit(): void {
    const latitude = Number(fireFormState.latitude)
    const longitude = Number(fireFormState.longitude)

    if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
      setFireFeedbackMessage('Latitude and longitude must be valid numbers inside Lucena City.')
      return
    }

    if (!fireFormState.title.trim() || !fireFormState.location.trim() || !fireFormState.responseTeam.trim() || !fireFormState.description.trim()) {
      setFireFeedbackMessage('Complete the fire title, location, response team, and description fields first.')
      return
    }

    onCreateIncident({
      code: 'FR',
      title: fireFormState.title.trim(),
      location: fireFormState.location.trim(),
      responseTeam: fireFormState.responseTeam.trim(),
      severity: fireFormState.severity,
      description: fireFormState.description.trim(),
      coordinates: [latitude, longitude],
    })

    setFireFormState(defaultFireFormState)
    setFireFeedbackMessage('Fire accomplishment report added to the map and reports list.')
  }

  function handleAccidentSubmit(): void {
    const latitude = Number(accidentFormState.latitude)
    const longitude = Number(accidentFormState.longitude)

    if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
      setAccidentFeedbackMessage('Latitude and longitude must be valid numbers inside Lucena City.')
      return
    }

    const populatedActivityLogs = accidentFormState.activityLogs.filter((entry) => entry.time.trim() && entry.activity.trim())

    if (!accidentFormState.team.trim() || !accidentFormState.reportDate || !accidentFormState.shiftTime.trim() || !accidentFormState.dutyFor.trim() || !accidentFormState.location.trim()) {
      setAccidentFeedbackMessage('Complete the accident report header, location, and duty personnel fields first.')
      return
    }

    if (populatedActivityLogs.length === 0) {
      setAccidentFeedbackMessage('Add at least one accident activity log with time and activity details.')
      return
    }

    const activitySummary = populatedActivityLogs
      .map((entry) => {
        const remarks = entry.remarks.trim() ? ` Remarks: ${entry.remarks.trim()}.` : ''
        return `${entry.time.trim()} - ${entry.activity.trim()}.${remarks}`
      })
      .join(' ')

    onCreateIncident({
      code: 'AC',
      title: `${accidentFormState.respondedTo} - ${accidentFormState.location.trim()}`,
      location: accidentFormState.location.trim(),
      responseTeam: accidentFormState.team.trim(),
      severity: accidentFormState.severity,
      description: `Accomplishment report dated ${accidentFormState.reportDate} (${accidentFormState.shiftTime.trim()}) for ${accidentFormState.dutyFor.trim()}. Responded to: ${accidentFormState.respondedTo}. ${activitySummary}`,
      coordinates: [latitude, longitude],
    })

    setAccidentFormState(createDefaultAccidentFormState())
    setAccidentFeedbackMessage('Accident accomplishment report added to the map and reports list.')
  }

  return (
    <section className="px-4 py-5 sm:px-6 sm:py-8">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(320px,0.9fr)] xl:items-start">
        <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_12px_32px_rgba(15,23,42,0.08)] md:flex md:h-[calc(100vh-13rem)] md:flex-col">
          <div className="flex flex-col gap-4 border-b border-slate-200 bg-[linear-gradient(90deg,#e8f1fd_0%,#f6fbff_100%)] px-4 py-4 sm:px-5 sm:py-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Dashboard Mapping</p>
              <h2 className="mt-1 text-xl font-bold text-slate-900 sm:text-2xl">Lucena Incident Map</h2>
            </div>
            <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap">
              <button
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] transition ${
                  selectedType === 'all'
                    ? 'border-blue-700 bg-blue-700 text-white'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
                onClick={() => handleMapTypeSelect('all')}
                type="button"
              >
                All
              </button>
              {(Object.keys(hazardTypeMeta) as HazardType[]).map((typeCode) => (
                <button
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] transition ${
                    selectedType === typeCode ? 'text-slate-950' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                  key={typeCode}
                  onClick={() => handleMapTypeSelect(typeCode)}
                  style={{
                    backgroundColor: selectedType === typeCode ? hazardTypeMeta[typeCode].color : undefined,
                    borderColor: selectedType === typeCode ? hazardTypeMeta[typeCode].color : undefined,
                  }}
                  type="button"
                >
                  {hazardTypeMeta[typeCode].label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-4 py-3 text-xs text-slate-600 sm:px-5">
            {(Object.keys(hazardTypeMeta) as HazardType[]).map((typeCode) => (
              <div className="flex items-center gap-2" key={typeCode}>
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: hazardTypeMeta[typeCode].color }} />
                <span className="font-semibold text-slate-700">{hazardTypeMeta[typeCode].label}</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{incidentCounts[typeCode]}</span>
              </div>
            ))}
          </div>

          <div className="h-[520px] w-full sm:h-[640px] md:h-auto md:flex-1" ref={mapContainerRef} />
        </div>

        <aside className="overflow-x-hidden rounded-[28px] border border-slate-200 bg-white p-4 shadow-[0_12px_32px_rgba(15,23,42,0.08)] sm:p-5 md:h-[calc(100vh-13rem)] md:overflow-hidden">
          <div className="border-b border-slate-200 pb-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Accomplishment Reports</p>
            <h2 className="mt-1 text-xl font-bold text-slate-900 sm:text-2xl">{activeReportForm === 'FR' ? 'Fire Report Form' : 'Accident Report Form'}</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Click Fire or Accident in the map filters and the matching accomplishment report form will appear here.
            </p>
          </div>

          {selectedType === 'EQ' ? (
            <div className="mt-5 rounded-[24px] border border-emerald-200 bg-[linear-gradient(180deg,#ecfdf5_0%,#ffffff_100%)] p-4 sm:p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Earthquake Mapping</p>
              <h3 className="mt-1 text-xl font-bold text-slate-900">View-only map layer</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Earthquake incidents are view-only. Select Fire or Accident from the map filter to open the corresponding accomplishment report form on this panel.
              </p>
            </div>
          ) : null}

          {selectedType === 'all' ? (
            <div className="mt-5 rounded-[24px] border border-slate-200 bg-slate-50 p-4 sm:p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Form Selection</p>
              <h3 className="mt-1 text-xl font-bold text-slate-900">No report form selected</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Select Fire or Accident from the mapping filters to open the matching accomplishment report form.
              </p>
            </div>
          ) : null}

          {selectedType === 'FR' || selectedType === 'AC' ? (
            <div className="mt-5 grid gap-5 overflow-x-hidden md:h-[calc(100%-7.5rem)] md:overflow-y-auto md:pr-1">
              {activeReportForm === 'FR' ? (
                <section className="grid gap-4 overflow-x-hidden">
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Incident title
                <input
                  className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-700"
                  onChange={(event) => handleFireFieldChange('title', event.target.value)}
                  placeholder="Example: Vehicle Fire - Barangay 6"
                  type="text"
                  value={fireFormState.title}
                />
              </label>

              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Location
                <input
                  className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-700"
                  onChange={(event) => handleFireFieldChange('location', event.target.value)}
                  placeholder="Exact place in Lucena City"
                  type="text"
                  value={fireFormState.location}
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-medium text-slate-700">
                  Severity
                  <select
                    className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-700"
                    onChange={(event) => handleFireFieldChange('severity', event.target.value)}
                    value={fireFormState.severity}
                  >
                    {severityOptions.map((severity) => (
                      <option key={severity} value={severity}>
                        {severity}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-medium text-slate-700">
                  Response team
                  <input
                    className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-700"
                    onChange={(event) => handleFireFieldChange('responseTeam', event.target.value)}
                    placeholder="Assigned fire unit"
                    type="text"
                    value={fireFormState.responseTeam}
                  />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-medium text-slate-700">
                  Latitude
                  <input
                    className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-700"
                    onChange={(event) => handleFireFieldChange('latitude', event.target.value)}
                    type="text"
                    value={fireFormState.latitude}
                  />
                </label>
                <label className="grid gap-2 text-sm font-medium text-slate-700">
                  Longitude
                  <input
                    className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-700"
                    onChange={(event) => handleFireFieldChange('longitude', event.target.value)}
                    type="text"
                    value={fireFormState.longitude}
                  />
                </label>
              </div>

              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Description
                <textarea
                  className="min-h-28 w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-700"
                  onChange={(event) => handleFireFieldChange('description', event.target.value)}
                  placeholder="Short fire incident description, affected area, and current action taken"
                  value={fireFormState.description}
                />
              </label>

              {fireFeedbackMessage ? <p className="rounded-2xl border border-orange-200 bg-white px-4 py-3 text-sm font-medium text-orange-900">{fireFeedbackMessage}</p> : null}

              <button
                className="rounded-xl bg-orange-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-orange-700"
                onClick={handleFireSubmit}
                type="button"
              >
                Add fire report to map
              </button>
                </section>
              ) : (
                <section className="grid gap-4 overflow-x-hidden">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-medium text-slate-700">
                  Team
                  <input
                    className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-700"
                    onChange={(event) => handleAccidentFieldChange('team', event.target.value)}
                    placeholder="Example: BRAVO"
                    type="text"
                    value={accidentFormState.team}
                  />
                </label>
                <label className="grid gap-2 text-sm font-medium text-slate-700">
                  Date
                  <input
                    className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-700"
                    onChange={(event) => handleAccidentFieldChange('reportDate', event.target.value)}
                    type="date"
                    value={accidentFormState.reportDate}
                  />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-medium text-slate-700">
                  Time
                  <input
                    className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-700"
                    onChange={(event) => handleAccidentFieldChange('shiftTime', event.target.value)}
                    placeholder="Example: 08:00H - 08:00H"
                    type="text"
                    value={accidentFormState.shiftTime}
                  />
                </label>
                <label className="grid gap-2 text-sm font-medium text-slate-700">
                  For
                  <input
                    className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-700"
                    onChange={(event) => handleAccidentFieldChange('dutyFor', event.target.value)}
                    placeholder="Personnel name"
                    type="text"
                    value={accidentFormState.dutyFor}
                  />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-medium text-slate-700">
                  Responded To
                  <select
                    className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-700"
                    onChange={(event) => handleAccidentFieldChange('respondedTo', event.target.value)}
                    value={accidentFormState.respondedTo}
                  >
                    {respondedToOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-medium text-slate-700">
                  Severity
                  <select
                    className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-700"
                    onChange={(event) => handleAccidentFieldChange('severity', event.target.value)}
                    value={accidentFormState.severity}
                  >
                    {severityOptions.map((severity) => (
                      <option key={severity} value={severity}>
                        {severity}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Incident location
                <input
                  className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-700"
                  onChange={(event) => handleAccidentFieldChange('location', event.target.value)}
                  placeholder="Example: Near Rotonda, Isabang, Lucena City"
                  type="text"
                  value={accidentFormState.location}
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-medium text-slate-700">
                  Latitude
                  <input
                    className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-700"
                    onChange={(event) => handleAccidentFieldChange('latitude', event.target.value)}
                    type="text"
                    value={accidentFormState.latitude}
                  />
                </label>
                <label className="grid gap-2 text-sm font-medium text-slate-700">
                  Longitude
                  <input
                    className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-700"
                    onChange={(event) => handleAccidentFieldChange('longitude', event.target.value)}
                    type="text"
                    value={accidentFormState.longitude}
                  />
                </label>
              </div>

              <div className="grid gap-3 border-t border-slate-200 pt-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Activity Log</p>
                    <p className="text-xs text-slate-500">Fill in the Time, Activity, and Remarks rows based on the accomplishment report.</p>
                  </div>
                  <button
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 sm:self-auto"
                    onClick={handleAddActivityLog}
                    type="button"
                  >
                    Add row
                  </button>
                </div>

                <div className="grid gap-3">
                  {accidentFormState.activityLogs.map((entry, index) => (
                    <div className="grid gap-3 border-t border-slate-200 pt-3 first:border-t-0 first:pt-0" key={entry.id}>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm font-semibold text-slate-800">Entry {index + 1}</p>
                        <button
                          className="text-left text-xs font-semibold text-rose-700 disabled:text-slate-300 sm:text-right"
                          disabled={accidentFormState.activityLogs.length === 1}
                          onClick={() => handleRemoveActivityLog(entry.id)}
                          type="button"
                        >
                          Remove
                        </button>
                      </div>

                      <div className="mt-3 grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)]">
                        <label className="grid gap-2 text-sm font-medium text-slate-700">
                          Time
                          <input
                            className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-700"
                            onChange={(event) => handleActivityLogChange(entry.id, 'time', event.target.value)}
                            placeholder="Example: 0925H"
                            type="text"
                            value={entry.time}
                          />
                        </label>
                        <label className="grid gap-2 text-sm font-medium text-slate-700">
                          Remarks
                          <input
                            className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-700"
                            onChange={(event) => handleActivityLogChange(entry.id, 'remarks', event.target.value)}
                            placeholder="Optional remarks"
                            type="text"
                            value={entry.remarks}
                          />
                        </label>
                      </div>

                      <label className="mt-3 grid gap-2 text-sm font-medium text-slate-700">
                        Activity
                        <textarea
                          className="min-h-28 w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-700"
                          onChange={(event) => handleActivityLogChange(entry.id, 'activity', event.target.value)}
                          placeholder="Example: Ambulance assistance, victim details, first aid, and transport notes"
                          value={entry.activity}
                        />
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {accidentFeedbackMessage ? <p className="rounded-2xl border border-amber-200 bg-white px-4 py-3 text-sm font-medium text-amber-900">{accidentFeedbackMessage}</p> : null}

              <button
                className="rounded-xl bg-amber-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-400"
                onClick={handleAccidentSubmit}
                type="button"
              >
                Add accident report to map
              </button>
                </section>
              )}
            </div>
          ) : null}
        </aside>
      </div>
    </section>
  )
}