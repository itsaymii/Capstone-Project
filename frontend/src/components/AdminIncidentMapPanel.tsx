import { useEffect, useMemo, useRef, useState } from 'react'
import L, { type LatLngBoundsExpression } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { HazardIncident, HazardType } from '../data/adminOperations'

type IncidentMapFilter = 'all' | HazardType
type ReportableHazardType = Extract<HazardType, 'FR' | 'AC'>
type IncidentSeverity = HazardIncident['severity']

type AccidentVictimEntry = {
  id: string
  name: string
  age: string
  address: string
  condition: string
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
  accidentType: string
  address: string
  actionTaken: string
  severity: IncidentSeverity
  latitude: string
  longitude: string
  victims: AccidentVictimEntry[]
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
const accidentTypeOptions = [
  'Road Crash Accident',
  'Fire Incident',
  'Crime Against Person/Property',
  'Medical Emergency',
  'Ambulance Assistance',
  'Stand-by Medical Team',
  'Drowning',
]

function createVictimEntry(): AccidentVictimEntry {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: '',
    age: '',
    address: '',
    condition: '',
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
    accidentType: 'Road Crash Accident',
    address: '',
    actionTaken: '',
    severity: 'Moderate',
    latitude: '13.934',
    longitude: '121.621',
    victims: [createVictimEntry()],
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

  function handleAccidentFieldChange(field: Exclude<keyof AccidentFormState, 'code' | 'victims'>, value: string): void {
    setAccidentFormState((current) => ({
      ...current,
      [field]: value,
    }))
    if (accidentFeedbackMessage) {
      setAccidentFeedbackMessage('')
    }
  }

  function handleVictimFieldChange(entryId: string, field: keyof Omit<AccidentVictimEntry, 'id'>, value: string): void {
    setAccidentFormState((current) => ({
      ...current,
      victims: current.victims.map((entry) =>
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
      victims: [...current.victims, createVictimEntry()],
    }))
    if (accidentFeedbackMessage) {
      setAccidentFeedbackMessage('')
    }
  }

  function handleRemoveActivityLog(entryId: string): void {
    setAccidentFormState((current) => {
      if (current.victims.length === 1) {
        return current
      }

      return {
        ...current,
        victims: current.victims.filter((entry) => entry.id !== entryId),
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

    if (!accidentFormState.accidentType.trim() || !accidentFormState.address.trim() || !accidentFormState.actionTaken.trim()) {
      setAccidentFeedbackMessage('Complete the type of accident, address, and A/T fields first.')
      return
    }

    const populatedVictims = accidentFormState.victims.filter(
      (victim) => victim.name.trim() && victim.age.trim() && victim.address.trim() && victim.condition.trim(),
    )

    if (populatedVictims.length === 0) {
      setAccidentFeedbackMessage('Add at least one victim with complete name, age, address, and condition details.')
      return
    }

    const victimSummary = populatedVictims
      .map((victim, index) => {
        return `Victim ${index + 1}: ${victim.name.trim()}, Age ${victim.age.trim()}, Address ${victim.address.trim()}, Condition ${victim.condition.trim()}.`
      })
      .join(' ')

    onCreateIncident({
      code: 'AC',
      title: `${accidentFormState.accidentType} - ${accidentFormState.address.trim()}`,
      location: accidentFormState.address.trim(),
      responseTeam: 'Accident Response Team',
      severity: accidentFormState.severity,
      description: `Type of Accident: ${accidentFormState.accidentType}. Address: ${accidentFormState.address.trim()}. ${victimSummary} A/T: ${accidentFormState.actionTaken.trim()}.`,
      coordinates: [latitude, longitude],
    })

    setAccidentFormState(createDefaultAccidentFormState())
    setAccidentFeedbackMessage('Accident report added to the map and reports list.')
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
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Initial Reports</p>
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
            <div className="mt-5 grid gap-5 overflow-x-hidden pb-3 md:h-[calc(100%-7.5rem)] md:overflow-y-auto md:pr-2 md:pb-6">
              {activeReportForm === 'FR' ? (
                <section className="grid gap-5 overflow-x-hidden">
                  <div className="rounded-2xl border border-orange-200 bg-[linear-gradient(135deg,#fff1ea_0%,#ffffff_60%)] p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-orange-700">Fire Report</p>
                    <h3 className="mt-1 text-lg font-bold text-slate-900">Incident Details</h3>
                    <p className="mt-1 text-xs text-slate-600">Complete the fire incident information and submit it to the live map.</p>

                    <label className="mt-4 grid gap-2 text-sm font-medium text-slate-700">
                      Incident title
                      <input
                        className="w-full min-w-0 rounded-xl border border-orange-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                        onChange={(event) => handleFireFieldChange('title', event.target.value)}
                        placeholder="Example: Vehicle Fire - Barangay 6"
                        type="text"
                        value={fireFormState.title}
                      />
                    </label>

                    <label className="mt-4 grid gap-2 text-sm font-medium text-slate-700">
                      Location
                      <input
                        className="w-full min-w-0 rounded-xl border border-orange-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                        onChange={(event) => handleFireFieldChange('location', event.target.value)}
                        placeholder="Exact place in Lucena City"
                        type="text"
                        value={fireFormState.location}
                      />
                    </label>

                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <label className="grid gap-2 text-sm font-medium text-slate-700">
                        Severity
                        <select
                          className="w-full min-w-0 rounded-xl border border-orange-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
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
                          className="w-full min-w-0 rounded-xl border border-orange-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                          onChange={(event) => handleFireFieldChange('responseTeam', event.target.value)}
                          placeholder="Assigned fire unit"
                          type="text"
                          value={fireFormState.responseTeam}
                        />
                      </label>
                    </div>

                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <label className="grid gap-2 text-sm font-medium text-slate-700">
                        Latitude
                        <input
                          className="w-full min-w-0 rounded-xl border border-orange-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                          onChange={(event) => handleFireFieldChange('latitude', event.target.value)}
                          type="text"
                          value={fireFormState.latitude}
                        />
                      </label>
                      <label className="grid gap-2 text-sm font-medium text-slate-700">
                        Longitude
                        <input
                          className="w-full min-w-0 rounded-xl border border-orange-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                          onChange={(event) => handleFireFieldChange('longitude', event.target.value)}
                          type="text"
                          value={fireFormState.longitude}
                        />
                      </label>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <label className="grid gap-2 text-sm font-medium text-slate-700">
                      Description
                      <textarea
                        className="min-h-28 w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                        onChange={(event) => handleFireFieldChange('description', event.target.value)}
                        placeholder="Short fire incident description, affected area, and current action taken"
                        value={fireFormState.description}
                      />
                    </label>
                  </div>

                  {fireFeedbackMessage ? <p className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm font-medium text-orange-900">{fireFeedbackMessage}</p> : null}

                  <button
                    className="mt-1 rounded-xl bg-[linear-gradient(90deg,#ea580c_0%,#fb923c_100%)] px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_22px_rgba(234,88,12,0.28)] transition hover:brightness-105 mb-1"
                    onClick={handleFireSubmit}
                    type="button"
                  >
                    Submit fire report to map
                  </button>
                </section>
              ) : (
                <section className="grid gap-5 overflow-x-hidden">
                  <div className="rounded-2xl border border-amber-200 bg-[linear-gradient(135deg,#fff8e7_0%,#ffffff_60%)] p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700">Accident Report</p>
                    <h3 className="mt-1 text-lg font-bold text-slate-900">Incident Details</h3>
                    <p className="mt-1 text-xs text-slate-600">Fill out the core incident information before adding victim details.</p>

                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <label className="grid gap-2 text-sm font-medium text-slate-700">
                        Type of Accident
                        <select
                          className="w-full min-w-0 rounded-xl border border-amber-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                          onChange={(event) => handleAccidentFieldChange('accidentType', event.target.value)}
                          value={accidentFormState.accidentType}
                        >
                          {accidentTypeOptions.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="grid gap-2 text-sm font-medium text-slate-700">
                        Severity
                        <select
                          className="w-full min-w-0 rounded-xl border border-amber-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
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

                    <label className="mt-4 grid gap-2 text-sm font-medium text-slate-700">
                      Address
                      <input
                        className="w-full min-w-0 rounded-xl border border-amber-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                        onChange={(event) => handleAccidentFieldChange('address', event.target.value)}
                        placeholder="Example: Near Rotonda, Isabang, Lucena City"
                        type="text"
                        value={accidentFormState.address}
                      />
                    </label>

                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <label className="grid gap-2 text-sm font-medium text-slate-700">
                        Latitude
                        <input
                          className="w-full min-w-0 rounded-xl border border-amber-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                          onChange={(event) => handleAccidentFieldChange('latitude', event.target.value)}
                          type="text"
                          value={accidentFormState.latitude}
                        />
                      </label>
                      <label className="grid gap-2 text-sm font-medium text-slate-700">
                        Longitude
                        <input
                          className="w-full min-w-0 rounded-xl border border-amber-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                          onChange={(event) => handleAccidentFieldChange('longitude', event.target.value)}
                          type="text"
                          value={accidentFormState.longitude}
                        />
                      </label>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Victim Information</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">Victims</p>
                        <p className="text-xs text-slate-600">Add victim details with name, age, address, and condition.</p>
                      </div>
                      <button
                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-amber-300 hover:bg-amber-50 sm:self-auto"
                        onClick={handleAddActivityLog}
                        type="button"
                      >
                        + Add victim
                      </button>
                    </div>

                    <div className="mt-4 grid gap-3">
                      {accidentFormState.victims.map((entry, index) => (
                        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-[0_6px_18px_rgba(15,23,42,0.05)]" key={entry.id}>
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-sm font-semibold text-slate-800">Victim {index + 1}</p>
                            <button
                              className="text-left text-xs font-semibold text-rose-700 transition hover:text-rose-800 disabled:text-slate-300 sm:text-right"
                              disabled={accidentFormState.victims.length === 1}
                              onClick={() => handleRemoveActivityLog(entry.id)}
                              type="button"
                            >
                              Remove
                            </button>
                          </div>

                          <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            <label className="grid gap-2 text-sm font-medium text-slate-700">
                              Name
                              <input
                                className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                                onChange={(event) => handleVictimFieldChange(entry.id, 'name', event.target.value)}
                                placeholder="Full name"
                                type="text"
                                value={entry.name}
                              />
                            </label>
                            <label className="grid gap-2 text-sm font-medium text-slate-700">
                              Age
                              <input
                                className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                                onChange={(event) => handleVictimFieldChange(entry.id, 'age', event.target.value)}
                                placeholder="Age"
                                type="text"
                                value={entry.age}
                              />
                            </label>
                          </div>

                          <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            <label className="grid gap-2 text-sm font-medium text-slate-700">
                              Address
                              <input
                                className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                                onChange={(event) => handleVictimFieldChange(entry.id, 'address', event.target.value)}
                                placeholder="Victim address"
                                type="text"
                                value={entry.address}
                              />
                            </label>
                            <label className="grid gap-2 text-sm font-medium text-slate-700">
                              Condition
                              <input
                                className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                                onChange={(event) => handleVictimFieldChange(entry.id, 'condition', event.target.value)}
                                placeholder="Example: Stable, Critical, Minor injury"
                                type="text"
                                value={entry.condition}
                              />
                            </label>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <label className="grid gap-2 text-sm font-medium text-slate-700">
                      A/T (Action Taken)
                      <textarea
                        className="min-h-24 w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                        onChange={(event) => handleAccidentFieldChange('actionTaken', event.target.value)}
                        placeholder="Describe the action taken for this accident response"
                        value={accidentFormState.actionTaken}
                      />
                    </label>
                  </div>

                  {accidentFeedbackMessage ? <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">{accidentFeedbackMessage}</p> : null}

                  <button
                    className="mt-1 rounded-xl bg-[linear-gradient(90deg,#f59e0b_0%,#fbbf24_100%)] px-4 py-3 text-sm font-semibold text-slate-950 shadow-[0_10px_22px_rgba(245,158,11,0.28)] transition hover:brightness-105 mb-1"
                    onClick={handleAccidentSubmit}
                    type="button"
                  >
                    Submit accident report to map
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