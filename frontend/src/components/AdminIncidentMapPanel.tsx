import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import L, { type LatLngBoundsExpression } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.heat'
import type { HazardIncident, HazardType } from '../data/adminOperations'
import {
  type EarthquakeEvent,
  type FaultLineFeatureCollection,
  type HeatPoint,
  fetchQuezonFaultLines,
  fetchQuezonRegionEarthquakes,
  toHeatPoints,
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

const lucenaCityCenter: [number, number] = [13.94, 121.62]
const nearestFaultLinesLimit = 5

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

function getFaultLineDistanceScore(geometry: GeoJSON.Geometry | null | undefined): number {
  if (!geometry) return Number.POSITIVE_INFINITY

  const targetPoint = L.CRS.EPSG3857.project(L.latLng(lucenaCityCenter[0], lucenaCityCenter[1]))
  let nearestDistance = Number.POSITIVE_INFINITY

  const getPointDistanceToSegment = (startCoordinate: number[], endCoordinate: number[]) => {
    const startPoint = L.CRS.EPSG3857.project(L.latLng(startCoordinate[1], startCoordinate[0]))
    const endPoint = L.CRS.EPSG3857.project(L.latLng(endCoordinate[1], endCoordinate[0]))
    const deltaX = endPoint.x - startPoint.x
    const deltaY = endPoint.y - startPoint.y
    const segmentLengthSquared = deltaX ** 2 + deltaY ** 2

    if (segmentLengthSquared === 0) {
      return Math.hypot(targetPoint.x - startPoint.x, targetPoint.y - startPoint.y)
    }

    const projectionRatio = Math.max(
      0,
      Math.min(
        1,
        ((targetPoint.x - startPoint.x) * deltaX + (targetPoint.y - startPoint.y) * deltaY) / segmentLengthSquared,
      ),
    )

    const projectedPointX = startPoint.x + projectionRatio * deltaX
    const projectedPointY = startPoint.y + projectionRatio * deltaY

    return Math.hypot(targetPoint.x - projectedPointX, targetPoint.y - projectedPointY)
  }

  const inspectLine = (coordinates: number[][]) => {
    if (coordinates.length === 1) {
      const singlePoint = L.CRS.EPSG3857.project(L.latLng(coordinates[0][1], coordinates[0][0]))
      nearestDistance = Math.min(nearestDistance, Math.hypot(targetPoint.x - singlePoint.x, targetPoint.y - singlePoint.y))
      return
    }

    for (let index = 0; index < coordinates.length - 1; index += 1) {
      nearestDistance = Math.min(nearestDistance, getPointDistanceToSegment(coordinates[index], coordinates[index + 1]))
    }
  }

  if (geometry.type === 'LineString') {
    inspectLine(geometry.coordinates)
  }

  if (geometry.type === 'MultiLineString') {
    geometry.coordinates.forEach((segment) => inspectLine(segment))
  }

  return nearestDistance
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
  const [faultLines, setFaultLines] = useState<FaultLineFeatureCollection | null>(null)
  const [barangayLayer, setBarangayLayer] = useState<GeoJSON.FeatureCollection<GeoJSON.Geometry, Record<string, unknown>> | null>(null)
  const [eqHeatPoints, setEqHeatPoints] = useState<HeatPoint[]>([])
  const [eqFetchStatus, setEqFetchStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [faultLineStatus, setFaultLineStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [showHeatmap, setShowHeatmap] = useState(true)
  const [showFaultLines, setShowFaultLines] = useState(true)
  const [eqLastRefreshed, setEqLastRefreshed] = useState<Date | null>(null)
  const [eqIsRefreshing, setEqIsRefreshing] = useState(false)
  const [eqSearchQuery, setEqSearchQuery] = useState('')

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

  useEffect(() => {
    if (selectedType !== 'EQ' || faultLines) return

    let isCancelled = false
    setFaultLineStatus('loading')

    void fetchQuezonFaultLines()
      .then((data) => {
        if (!isCancelled) {
          setFaultLines(data)
          setFaultLineStatus('idle')
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setFaultLineStatus('error')
        }
      })

    return () => {
      isCancelled = true
    }
  }, [selectedType, faultLines])

  // Auto-refresh every 5 minutes while the earthquake view is active
  useEffect(() => {
    if (selectedType !== 'EQ') return
    const intervalId = setInterval(() => {
      void loadEarthquakes(true)
    }, 5 * 60 * 1000)
    return () => clearInterval(intervalId)
  }, [selectedType, loadEarthquakes])

  useEffect(() => {
    void fetch('/lucena_barangays.geojson')
      .then((response) => response.json())
      .then((data) => setBarangayLayer(data))
      .catch(() => {
        console.error('Failed to load Lucena barangay boundaries')
      })
  }, [])

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
        .map((event) => ({
          id: event.id,
          title: `Earthquake Event - ${event.place}`,
          time: event.time,
          location: event.place,
          description: getEarthquakeDescription(event),
          magnitude: event.magnitude,
        })),
    [earthquakeEvents],
  )

  const filteredEarthquakeIncidentCards = useMemo(() => {
    const normalizedQuery = eqSearchQuery.trim().toLowerCase()
    if (!normalizedQuery) {
      return earthquakeIncidentCards.slice(0, 24)
    }

    return earthquakeIncidentCards.filter(
      (incident) =>
        incident.location.toLowerCase().includes(normalizedQuery) ||
        incident.title.toLowerCase().includes(normalizedQuery) ||
        incident.description.toLowerCase().includes(normalizedQuery),
    )
  }, [earthquakeIncidentCards, eqSearchQuery])

  const nearestFaultLineFeatures = useMemo(() => {
    if (!faultLines || !faultLines.features) return []

    return faultLines.features
      .map((feature, index) => ({ feature, index, distanceScore: getFaultLineDistanceScore(feature.geometry) }))
      .filter((item) => Number.isFinite(item.distanceScore))
      .sort((left, right) => left.distanceScore - right.distanceScore)
      .slice(0, nearestFaultLinesLimit)
  }, [faultLines])

  const nearestFaultLineIndexes = useMemo(
    () => new Set(nearestFaultLineFeatures.map((item) => item.index)),
    [nearestFaultLineFeatures],
  )

  const nonHighlightedFaultLineCollection = useMemo(() => {
    if (!faultLines || !faultLines.features) return null

    return {
      ...faultLines,
      features: faultLines.features.filter((_, index) => !nearestFaultLineIndexes.has(index)),
    }
  }, [faultLines, nearestFaultLineIndexes])

  const highlightedFaultLineCollection = useMemo(() => {
    if (!faultLines) return null

    return {
      ...faultLines,
      features: nearestFaultLineFeatures.map((item) => item.feature),
    }
  }, [faultLines, nearestFaultLineFeatures])

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

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO',
    }).addTo(map)

    L.rectangle(lucenaBounds, {
      color: '#0f766e',
      weight: 2,
      fillColor: '#14b8a6',
      fillOpacity: 0.1,
      dashArray: '6 5',
    }).addTo(map)

    if (barangayLayer) {
      const barangayPane = map.getPane('barangay-pane') ?? map.createPane('barangay-pane')
      barangayPane.style.zIndex = '410'
      barangayPane.style.filter = 'drop-shadow(0 0 20px rgba(56,189,248,0.18))'

      L.geoJSON(barangayLayer, {
        pane: 'barangay-pane',
        style: () => ({
          color: '#0f172a',
          weight: 1.2,
          opacity: 0.88,
          fillOpacity: 0,
          dashArray: '5 6',
          lineJoin: 'round',
          lineCap: 'round',
        }),
        onEachFeature: (feature, layer) => {
          if (!feature) return
          const barangayName =
            (feature.properties?.barangay_name as string) ?? (feature.properties?.brgy_name as string) ?? 'Unknown Barangay'

          layer.bindTooltip(`<strong>${barangayName}</strong>`, {
            sticky: true,
            direction: 'auto',
            opacity: 0.98,
            className: 'leaflet-barangay-tooltip',
          })

          layer.on({
            mouseover: () => {
              ;(layer as L.Path).setStyle({
                weight: 3.4,
                color: '#38bdf8',
                fillOpacity: 0,
                opacity: 1,
              })
              ;(layer as L.Path).bringToFront()
            },
            mouseout: () => {
              ;(layer as L.Path).setStyle({
                weight: 1.2,
                color: '#0f172a',
                fillOpacity: 0,
                opacity: 0.88,
              })
            },
          })
        },
      }).addTo(map)
    }

    if (isEqView) {
      // ── Earthquake heatmap layer ──
      if (showHeatmap && eqHeatPoints.length > 0) {
        L.heatLayer(eqHeatPoints, {
          minOpacity: 0.35,
          radius: 28,
          blur: 22,
          max: 1.0,
          gradient: {
            0.14: '#38bdf8',
            0.4: '#22c55e',
            0.6: '#facc15',
            0.8: '#f97316',
            1.0: '#dc2626',
          },
        }).addTo(map)
      }

      if (showFaultLines && nonHighlightedFaultLineCollection) {
        const faultPane = map.getPane('fault-lines-pane') ?? map.createPane('fault-lines-pane')
        faultPane.style.zIndex = '420'

        L.geoJSON(nonHighlightedFaultLineCollection, {
          pane: 'fault-lines-pane',
          style: (feature) => {
            const lineType = feature?.properties?.LINE_TYPE?.toLowerCase() ?? ''
            const traceType = feature?.properties?.TRACE_TYPE?.toLowerCase() ?? ''
            const isApproximate = lineType.includes('approx') || traceType.includes('approx')
            const isConcealed = lineType.includes('concealed') || traceType.includes('concealed')

            return {
              color: isConcealed ? '#7c3aed' : '#ef4444',
              weight: isApproximate ? 2.2 : 2.8,
              opacity: 0.78,
              dashArray: isConcealed ? '4 8' : isApproximate ? '8 6' : undefined,
            }
          },
          onEachFeature: (feature, layer) => {
            const faultName = feature.properties?.FAULT_NAME ?? 'Unnamed fault'
            const segmentName = feature.properties?.SEG_NAME ?? 'Segment not specified'
            const traceType = feature.properties?.TRACE_TYPE ?? 'Trace type not specified'
            const lineType = feature.properties?.LINE_TYPE ?? 'Line type not specified'
            const faultCategory = feature.properties?.FAULT_CAT ?? 'Category not specified'
            const mappedYear = feature.properties?.YR_MAPPED ?? 'N/A'

            layer.bindPopup(
              `<strong>${faultName}</strong><br/>Segment: ${segmentName}<br/>Trace: ${traceType}<br/>Line Type: ${lineType}<br/>Category: ${faultCategory}<br/>Mapped: ${mappedYear}`,
            )
          },
        }).addTo(map)

        const highlightPane = map.getPane('fault-highlights-pane') ?? map.createPane('fault-highlights-pane')
        highlightPane.style.zIndex = '430'

        if (highlightedFaultLineCollection && highlightedFaultLineCollection.features.length > 0) {
          L.geoJSON(highlightedFaultLineCollection, {
            pane: 'fault-highlights-pane',
            style: {
              color: '#f59e0b',
              weight: 5,
              opacity: 0.98,
            },
            onEachFeature: (feature, layer) => {
              const faultName = feature.properties?.FAULT_NAME ?? 'Unnamed fault'
              const segmentName = feature.properties?.SEG_NAME ?? 'Segment not specified'
              const traceType = feature.properties?.TRACE_TYPE ?? 'Trace type not specified'
              const faultCategory = feature.properties?.FAULT_CAT ?? 'Category not specified'

              layer.bindPopup(
                `<strong>${faultName}</strong><br/>Nearest Lucena fault segment: ${segmentName}<br/>Trace: ${traceType}<br/>Category: ${faultCategory}`,
              )
            },
          }).addTo(map)
        }
      }

      if (showHeatmap) {
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
                `<strong>M${event.magnitude.toFixed(1)}</strong><br/>${event.place}<br/><small>${event.time} · ${event.depth.toFixed(1)} km deep</small>`,
              )
          })
      }

      if (eqFetchStatus === 'loading') {
        L.popup({ closeButton: false })
          .setLatLng([14.3, 121.5])
          .setContent('<p style="margin:0;font-size:12px">Loading PHIVOLCS/USGS seismic data…</p>')
          .openOn(map)
      }
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
  }, [filteredIncidents, selectedType, eqHeatPoints, earthquakeEvents, showHeatmap, showFaultLines, eqFetchStatus, nonHighlightedFaultLineCollection, highlightedFaultLineCollection, barangayLayer])

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
          <div className="flex flex-col gap-4 border-b border-slate-200 bg-[linear-gradient(90deg,#e8f1fd_0%,#f6fbff_100%)] px-4 py-4 sm:px-5 sm:py-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                {selectedType === 'EQ' ? 'Seismic Mapping — Quezon Province' : 'Dashboard Mapping'}
              </p>
              <h2 className="mt-1 text-xl font-bold text-slate-900 sm:text-2xl">Lucena Incident Map</h2>
            </div>
            <div className="flex w-full flex-col gap-2 lg:w-auto lg:min-w-[360px] lg:items-end">
              <div className="flex flex-wrap gap-2 lg:justify-end">
                {(Object.keys(hazardTypeMeta) as HazardType[]).map((typeCode) => (
                  <button
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] transition ${
                      selectedType === typeCode ? 'text-slate-950 shadow-[0_8px_18px_rgba(15,23,42,0.12)]' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
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
              {selectedType === 'EQ' ? (
                <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white/75 px-3 py-2 backdrop-blur lg:justify-end">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Layers</span>
                  <button
                    className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition ${
                      showHeatmap
                        ? 'border-emerald-500 bg-emerald-500 text-white'
                        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                    onClick={() => setShowHeatmap((value) => !value)}
                    type="button"
                  >
                    Heatmap
                  </button>
                  <button
                    className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition ${
                      showFaultLines
                        ? 'border-rose-300 bg-rose-50 text-rose-700'
                        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                    onClick={() => setShowFaultLines((value) => !value)}
                    type="button"
                  >
                    Fault Lines
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          {selectedType === 'EQ' && (showHeatmap || showFaultLines || eqFetchStatus !== 'idle' || eqIsRefreshing || faultLineStatus !== 'idle') ? (
            <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-[11px] sm:px-5">
              <span className="font-semibold uppercase tracking-[0.12em] text-slate-500">Legend</span>
              {showHeatmap ? (
                <>
                  <div className="flex items-center gap-1.5">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#38bdf8]" />
                    <span className="text-slate-600">M1.0-M1.9</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#22c55e]" />
                    <span className="text-slate-600">M2.0-M2.9</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#facc15]" />
                    <span className="text-slate-600">M3.0-M3.9</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#f97316]" />
                    <span className="text-slate-600">M4.0-M4.9</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#dc2626]" />
                    <span className="text-slate-600">M5.0+</span>
                  </div>
                </>
              ) : null}
              {showFaultLines ? (
                <>
                  <div className="flex items-center gap-1.5">
                    <span className="inline-block h-[3px] w-8 rounded-full bg-[#ef4444]" />
                    <span className="text-slate-600">Fault trace</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="inline-block h-[3px] w-8 rounded-full bg-[#7c3aed]" style={{ backgroundImage: 'repeating-linear-gradient(90deg,#7c3aed 0 8px, transparent 8px 14px)' }} />
                    <span className="text-slate-600">Concealed fault</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="inline-block h-[4px] w-8 rounded-full bg-[#f59e0b]" />
                    <span className="text-slate-600">Nearest to Lucena</span>
                  </div>
                </>
              ) : null}
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
                {faultLineStatus === 'loading' ? (
                  <span className="font-semibold text-rose-600">Loading faults…</span>
                ) : faultLineStatus === 'error' ? (
                  <span className="font-semibold text-rose-600">Fault lines unavailable</span>
                ) : showFaultLines && faultLines && faultLines.features ? (
                  <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-rose-700">
                    {faultLines.features.length} fault traces
                  </span>
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
          {selectedType === 'FR' || selectedType === 'AC' ? (
            <div className="border-b border-slate-200 pb-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Initial Reports</p>
              <h2 className="mt-1 text-xl font-bold text-slate-900 sm:text-2xl">{activeReportForm === 'FR' ? 'Fire Report Form' : 'Accident Report Form'}</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Click Fire or Accident in the map filters and the matching accomplishment report form will appear here.
              </p>
            </div>
          ) : null}

          {selectedType === 'EQ' ? (
            <div className="rounded-[24px] border border-emerald-200 bg-[linear-gradient(180deg,#ecfdf5_0%,#ffffff_100%)] p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3 border-b border-emerald-100 pb-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Seismic Events</p>
                  <h3 className="mt-1 text-xl font-bold text-slate-900">PHIVOLCS / USGS Earthquakes</h3>
                </div>
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                  {eqFetchStatus === 'loading' ? '…' : earthquakeEvents.length}
                </span>
              </div>

              <p className="mt-3 text-xs leading-relaxed text-slate-600">
                Quezon Province seismic log
                {eqLastRefreshed
                  ? ` · Updated ${eqLastRefreshed.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
                  : ''}
              </p>

              {eqFetchStatus === 'loading' ? (
                <div className="mt-4 flex items-center gap-3">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
                  <span className="text-sm text-slate-600">Fetching seismic data…</span>
                </div>
              ) : eqFetchStatus === 'error' ? (
                <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-center">
                  <p className="text-sm font-semibold text-red-800">Failed to load seismic data</p>
                  <button
                    className="mt-3 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-800 hover:bg-red-50"
                    onClick={() => void loadEarthquakes()}
                    type="button"
                  >
                    Retry
                  </button>
                </div>
              ) : (
                <>
                  <div className="mt-4">
                    <label className="sr-only" htmlFor="admin-eq-search">
                      Search earthquake events
                    </label>
                    <div className="flex items-center gap-2 rounded-xl border border-[#0b6b50]/20 bg-white px-3 py-2.5 shadow-[0_10px_20px_rgba(15,23,42,0.06)] transition focus-within:border-[#0b6b50]/45 focus-within:ring-2 focus-within:ring-[#0b6b50]/10">
                      <input
                        className="w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
                        id="admin-eq-search"
                        onChange={(event) => setEqSearchQuery(event.target.value)}
                        placeholder="Search place or event"
                        type="text"
                        value={eqSearchQuery}
                      />
                      <span className="rounded-full border border-[#0b6b50]/20 bg-[#0b6b50]/5 px-2 py-1 text-[10px] font-bold text-[#0b6b50]">
                        {filteredEarthquakeIncidentCards.length}/{earthquakeIncidentCards.length}
                      </span>
                    </div>
                  </div>

                  <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Recent Events</p>
                  <div className="mt-2 max-h-[420px] space-y-2 overflow-y-auto pr-1">
                    {filteredEarthquakeIncidentCards.length === 0 ? (
                      <div className="rounded-xl border border-slate-200 bg-white p-3 text-center text-xs text-slate-500">
                        No matching earthquake event found.
                      </div>
                    ) : (
                      filteredEarthquakeIncidentCards.map((incident) => (
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
                            <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">
                              M{incident.magnitude.toFixed(1)}
                            </span>
                          </div>
                          <p className="mt-2 pl-7 text-xs text-slate-600">{incident.description}</p>
                        </article>
                      ))
                    )}
                  </div>
                </>
              )}
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