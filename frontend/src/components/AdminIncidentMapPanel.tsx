import { useEffect, useMemo, useRef, useState } from 'react'
import L, { type LatLngBoundsExpression } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { HazardIncident, HazardType } from '../data/adminOperations'

type IncidentMapFilter = 'all' | HazardType
type ReportableHazardType = Extract<HazardType, 'FR' | 'AC'>
type IncidentSeverity = HazardIncident['severity']

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

const defaultFormState = {
  code: 'FR' as ReportableHazardType,
  title: '',
  location: '',
  responseTeam: '',
  severity: 'Moderate' as IncidentSeverity,
  description: '',
  latitude: '13.934',
  longitude: '121.621',
}

export function AdminIncidentMapPanel({ incidents, selectedType, onSelectType, onCreateIncident }: AdminIncidentMapPanelProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const [formState, setFormState] = useState(defaultFormState)
  const [feedbackMessage, setFeedbackMessage] = useState('')

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

  function handleFieldChange(field: keyof typeof defaultFormState, value: string): void {
    setFormState((current) => ({
      ...current,
      [field]: value,
    }))
    if (feedbackMessage) {
      setFeedbackMessage('')
    }
  }

  function handleSubmit(): void {
    const latitude = Number(formState.latitude)
    const longitude = Number(formState.longitude)

    if (!formState.title.trim() || !formState.location.trim() || !formState.responseTeam.trim() || !formState.description.trim()) {
      setFeedbackMessage('Complete the title, location, response team, and description fields first.')
      return
    }

    if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
      setFeedbackMessage('Latitude and longitude must be valid numbers inside Lucena City.')
      return
    }

    onCreateIncident({
      code: formState.code,
      title: formState.title.trim(),
      location: formState.location.trim(),
      responseTeam: formState.responseTeam.trim(),
      severity: formState.severity,
      description: formState.description.trim(),
      coordinates: [latitude, longitude],
    })

    setFormState(defaultFormState)
    setFeedbackMessage('Incident draft added to the map and reports list.')
  }

  return (
    <section className="px-6 py-8">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,0.9fr)]">
        <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_12px_32px_rgba(15,23,42,0.08)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-[linear-gradient(90deg,#e8f1fd_0%,#f6fbff_100%)] px-5 py-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Dashboard Mapping</p>
              <h2 className="mt-1 text-2xl font-bold text-slate-900">Lucena Incident Map</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] transition ${
                  selectedType === 'all'
                    ? 'border-blue-700 bg-blue-700 text-white'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
                onClick={() => onSelectType('all')}
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
                  onClick={() => onSelectType(typeCode)}
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

          <div className="flex flex-wrap items-center gap-4 border-b border-slate-200 px-5 py-3 text-xs text-slate-600">
            {(Object.keys(hazardTypeMeta) as HazardType[]).map((typeCode) => (
              <div className="flex items-center gap-2" key={typeCode}>
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: hazardTypeMeta[typeCode].color }} />
                <span className="font-semibold text-slate-700">{hazardTypeMeta[typeCode].label}</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{incidentCounts[typeCode]}</span>
              </div>
            ))}
          </div>

          <div className="h-[520px] w-full sm:h-[640px]" ref={mapContainerRef} />
        </div>

        <aside className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.08)]">
          <div className="border-b border-slate-200 pb-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Incident Report Form</p>
            <h2 className="mt-1 text-2xl font-bold text-slate-900">Add Fire or Accident</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Fire and accident reports can be added here beside the live map. Earthquake mapping stays visible in the map filters but is view-only.
            </p>
          </div>

          <div className="mt-5 grid gap-4">
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Incident type
              <select
                className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-700"
                onChange={(event) => handleFieldChange('code', event.target.value as ReportableHazardType)}
                value={formState.code}
              >
                <option value="FR">Fire</option>
                <option value="AC">Accident</option>
              </select>
            </label>

            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Incident title
              <input
                className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-700"
                onChange={(event) => handleFieldChange('title', event.target.value)}
                placeholder="Example: Vehicle Fire - Barangay 6"
                type="text"
                value={formState.title}
              />
            </label>

            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Location
              <input
                className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-700"
                onChange={(event) => handleFieldChange('location', event.target.value)}
                placeholder="Exact place in Lucena City"
                type="text"
                value={formState.location}
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Latitude
                <input
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-700"
                  onChange={(event) => handleFieldChange('latitude', event.target.value)}
                  type="text"
                  value={formState.latitude}
                />
              </label>
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Longitude
                <input
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-700"
                  onChange={(event) => handleFieldChange('longitude', event.target.value)}
                  type="text"
                  value={formState.longitude}
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Severity
                <select
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-700"
                  onChange={(event) => handleFieldChange('severity', event.target.value)}
                  value={formState.severity}
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
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-700"
                  onChange={(event) => handleFieldChange('responseTeam', event.target.value)}
                  placeholder="Assigned unit"
                  type="text"
                  value={formState.responseTeam}
                />
              </label>
            </div>

            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Description
              <textarea
                className="min-h-28 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-700"
                onChange={(event) => handleFieldChange('description', event.target.value)}
                placeholder="Short field description, affected area, and current action taken"
                value={formState.description}
              />
            </label>

            {feedbackMessage ? <p className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-900">{feedbackMessage}</p> : null}

            <button
              className="rounded-xl bg-blue-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-800"
              onClick={handleSubmit}
              type="button"
            >
              Add incident to map
            </button>
          </div>
        </aside>
      </div>
    </section>
  )
}