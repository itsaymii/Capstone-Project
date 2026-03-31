import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import L, { type LatLngBoundsExpression } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.heat'
import type { HazardIncident, HazardType } from '../data/adminOperations'
import {
  type EarthquakeEvent,
  type HeatPoint,
  fetchQuezonRegionEarthquakes,
  toHeatPoints,
  countNearLucena,
} from '../services/earthquakes'

type IncidentMapFilter = HazardType
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

const philippinesBounds: LatLngBoundsExpression = [
  [4.5, 116.0],
  [21.5, 127.5],
]

/** Lucena City / southern Quezon Province view — tightly focused area for the EQ heatmap. */
const quezonRegionBounds: LatLngBoundsExpression = [
  [13.72, 121.3],
  [14.12, 121.92],
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

function getEarthquakeDescription(event: EarthquakeEvent): string {
  if (event.magnitude >= 5) {
    return `Strong seismic event at ${event.depth.toFixed(1)} km depth. Priority validation recommended.`
  }
  if (event.magnitude >= 4) {
    return `Moderate event at ${event.depth.toFixed(1)} km depth. Field teams advised to verify affected zones.`
  }
  return `Minor-to-light event at ${event.depth.toFixed(1)} km depth. Continue routine monitoring.`
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
  const [earthquakeEvents, setEarthquakeEvents] = useState<EarthquakeEvent[]>([])
  const [eqHeatPoints, setEqHeatPoints] = useState<HeatPoint[]>([])
  const [eqFetchStatus, setEqFetchStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [showHeatmap, setShowHeatmap] = useState(true)
  const [eqLastRefreshed, setEqLastRefreshed] = useState<Date | null>(null)
  const [eqIsRefreshing, setEqIsRefreshing] = useState(false)

  const loadEarthquakes = useCallback(async (silent = false) => {
    if (silent) {
      setEqIsRefreshing(true)
    } else {
      setEqFetchStatus('loading')
    }
    try {
      const events = await fetchQuezonRegionEarthquakes(1825, 1.0)
      setEarthquakeEvents(events)
      setEqHeatPoints(toHeatPoints(events))
      setEqFetchStatus('idle')
      setEqLastRefreshed(new Date())
    } catch {
      if (!silent) setEqFetchStatus('error')
    } finally {
      setEqIsRefreshing(false)
    }
  }, [])

  useEffect(() => {
    if (selectedType === 'EQ' && earthquakeEvents.length === 0 && eqFetchStatus === 'idle') {
      void loadEarthquakes()
    }
  }, [selectedType, earthquakeEvents.length, eqFetchStatus, loadEarthquakes])

  // Auto-refresh every 5 minutes while the earthquake view is active
  useEffect(() => {
    if (selectedType !== 'EQ') return
    const intervalId = setInterval(() => {
      void loadEarthquakes(true)
    }, 5 * 60 * 1000)
    return () => clearInterval(intervalId)
  }, [selectedType, loadEarthquakes])

  const filteredIncidents = useMemo(
    () => incidents.filter((incident) => incident.code === selectedType),
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

  const earthquakeIncidentCards = useMemo(
    () =>
      [...earthquakeEvents]
        .sort((a, b) => b.rawTimestamp - a.rawTimestamp)
        .slice(0, 20)
        .map((event) => ({
          id: event.id,
          title: `Earthquake Event - ${event.place}`,
          time: event.time,
          location: event.place,
          description: getEarthquakeDescription(event),
        })),
    [earthquakeEvents],
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

    const isEqView = selectedType === 'EQ'

    const map = L.map(mapContainerRef.current, {
      zoomControl: true,
      attributionControl: false,
      maxBounds: philippinesBounds,
      maxBoundsViscosity: 1,
      minZoom: isEqView ? 6 : 10,
      maxZoom: 17,
    })

    map.fitBounds(isEqView ? quezonRegionBounds : lucenaBounds)

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

    if (isEqView) {
      // ── Earthquake heatmap layer ──
      if (showHeatmap && eqHeatPoints.length > 0) {
        L.heatLayer(eqHeatPoints, {
          minOpacity: 0.35,
          radius: 28,
          blur: 22,
          max: 1.0,
          gradient: { 0.2: '#3b82f6', 0.45: '#06b6d4', 0.65: '#22c55e', 0.8: '#facc15', 1.0: '#ef4444' },
        }).addTo(map)
      }

      // Circle markers for M≥3.5 events
      earthquakeEvents
        .filter((e) => e.magnitude >= 3.5)
        .forEach((event) => {
          const radiusPx = Math.max(4, (event.magnitude - 1) * 3)
          L.circleMarker([event.lat, event.lng], {
            radius: radiusPx,
            color: '#ffffff',
            weight: 1,
            fillColor: hazardColors.EQ,
            fillOpacity: 0.85,
          })
            .addTo(map)
            .bindPopup(
              `<strong>M${event.magnitude.toFixed(1)}</strong><br/>${event.place}<br/><small>${event.time} · ${event.depth.toFixed(0)} km deep</small>`,
            )
        })
    } else {
      // ── Standard incident markers ──
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
    }

    window.setTimeout(() => {
      map.invalidateSize()
    }, 0)

    mapInstanceRef.current = map

    return () => {
      map.remove()
      mapInstanceRef.current = null
    }
  }, [filteredIncidents, selectedType, eqHeatPoints, earthquakeEvents, showHeatmap])

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
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                {selectedType === 'EQ' ? 'Seismic Mapping — Quezon Province' : 'Dashboard Mapping'}
              </p>
              <h2 className="mt-1 text-xl font-bold text-slate-900 sm:text-2xl">Lucena Incident Map</h2>
            </div>
            <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap">
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
              {selectedType === 'EQ' ? (
                <button
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] transition ${
                    showHeatmap
                      ? 'border-emerald-500 bg-emerald-500 text-white'
                      : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                  onClick={() => setShowHeatmap((v) => !v)}
                  type="button"
                >
                  {showHeatmap ? 'Heatmap ON' : 'Heatmap OFF'}
                </button>
              ) : null}
            </div>
          </div>

          {selectedType === 'EQ' ? (
            <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-[11px] sm:px-5">
              <span className="font-semibold uppercase tracking-[0.12em] text-slate-500">Heatmap gradient</span>
              <div className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#3b82f6]" />
                <span className="text-slate-600">Low activity</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#22c55e]" />
                <span className="text-slate-600">Moderate</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#facc15]" />
                <span className="text-slate-600">High</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#ef4444]" />
                <span className="text-slate-600">Critical zone</span>
              </div>
              <div className="ml-auto flex items-center gap-2">
                {eqFetchStatus === 'loading' ? (
                  <span className="animate-pulse font-semibold text-blue-600">Fetching data…</span>
                ) : eqIsRefreshing ? (
                  <span className="animate-pulse font-semibold text-blue-500">Refreshing…</span>
                ) : eqFetchStatus === 'error' ? (
                  <span className="font-semibold text-red-600">Fetch failed</span>
                ) : (
                  <span className="flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-emerald-700">
                    <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                    Live · 5 min
                  </span>
                )}
                {earthquakeEvents.length > 0 && eqFetchStatus !== 'loading' ? (
                  <span className="font-semibold text-slate-600">{earthquakeEvents.length} events</span>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-4 py-3 text-xs text-slate-600 sm:px-5">
              {(Object.keys(hazardTypeMeta) as HazardType[]).map((typeCode) => (
                <div className="flex items-center gap-2" key={typeCode}>
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: hazardTypeMeta[typeCode].color }} />
                  <span className="font-semibold text-slate-700">{hazardTypeMeta[typeCode].label}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{incidentCounts[typeCode]}</span>
                </div>
              ))}
            </div>
          )}

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
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Seismic Data</p>
                {eqFetchStatus === 'error' ? (
                  <button
                    className="rounded-lg border border-red-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-red-800 hover:bg-red-50"
                    onClick={() => void loadEarthquakes()}
                    type="button"
                  >
                    Retry
                  </button>
                ) : null}
              </div>
              <h3 className="mt-1 text-xl font-bold text-slate-900">PHIVOLCS / USGS Earthquakes</h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">
                Quezon Province &mdash; last 5 years · USGS FDSN (same catalog as PHIVOLCS).
                {eqLastRefreshed
                  ? ` Updated ${eqLastRefreshed.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}.`
                  : ''}{' '}
                Auto-refreshes every 5 min.
              </p>

              {eqFetchStatus === 'loading' ? (
                <div className="mt-4 flex items-center gap-3">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
                  <span className="text-sm text-slate-600">Fetching seismic data…</span>
                </div>
              ) : eqFetchStatus === 'error' ? (
                <p className="mt-3 text-sm font-semibold text-red-700">Failed to load seismic data. Check connection.</p>
              ) : earthquakeEvents.length > 0 ? (
                <>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5">
                      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-700">Total events</p>
                      <p className="mt-0.5 text-xl font-black text-emerald-900">{earthquakeEvents.length}</p>
                    </div>
                    <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5">
                      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-red-700">Near Lucena</p>
                      <p className="mt-0.5 text-xl font-black text-red-900">{countNearLucena(earthquakeEvents)}</p>
                    </div>
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
                      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-amber-700">Strongest (M)</p>
                      <p className="mt-0.5 text-xl font-black text-amber-900">
                        {Math.max(...earthquakeEvents.map((e) => e.magnitude)).toFixed(1)}
                      </p>
                    </div>
                    <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5">
                      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-blue-700">Significant (≥3.5)</p>
                      <p className="mt-0.5 text-xl font-black text-blue-900">
                        {earthquakeEvents.filter((e) => e.magnitude >= 3.5).length}
                      </p>
                    </div>
                  </div>

                  <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Most Recent Events</p>
                  <div className="mt-2 max-h-[260px] space-y-2 overflow-y-auto">
                    {earthquakeIncidentCards.map((incident) => (
                      <article className="rounded-xl border border-slate-200 bg-white p-3" key={incident.id}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="inline-flex rounded-md bg-emerald-400 px-1.5 py-0.5 text-[10px] font-black text-slate-900">
                                EQ
                              </span>
                              <p className="truncate text-sm font-semibold text-slate-900">{incident.title}</p>
                            </div>
                            <p className="mt-1 pl-7 text-xs text-slate-500">{incident.time}</p>
                            <p className="mt-1 pl-7 text-xs text-slate-500">{incident.location}</p>
                          </div>
                        </div>
                        <p className="mt-2 pl-7 text-xs text-slate-600">{incident.description}</p>
                      </article>
                    ))}
                  </div>
                </>
              ) : null}
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