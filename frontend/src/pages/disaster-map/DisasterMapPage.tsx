import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as L from 'leaflet'
import type { LatLngBoundsExpression } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.heat'
import { AdminSidebar } from '../../components/AdminSidebar'
import { NavigationBar } from '../../components/NavigationBar'
import { useNavigate } from 'react-router-dom'
import { isAuthenticated } from '../../services/auth'
import { getIncidentReports } from '../../services/incidents'
import {
  type EarthquakeEvent,
  type FaultLineFeatureCollection,
  type HeatPoint,
  fetchQuezonFaultLines,
  fetchQuezonRegionEarthquakes,
  toHeatPoints,
} from '../../services/earthquakes'

const lucenaBounds: LatLngBoundsExpression = [
  [13.895, 121.575],
  [13.975, 121.665],
]

const philippinesBounds: LatLngBoundsExpression = [
  [4.5, 116.0],
  [21.5, 127.5],
]

const quezonRegionBounds: LatLngBoundsExpression = [
  [13.72, 121.3],
  [14.12, 121.92],
]

const lucenaCityCenter: [number, number] = [13.94, 121.62]
const nearestFaultLinesLimit = 5

const hazardColors = {
  EQ: '#4ade80',
  FR: '#fb923c',
  AC: '#facc15',
}

type IncidentItem = {
  id?: string
  title: string
  time: string
  status: 'active' | 'resolved' | 'pending' | 'approved'
  color: string
  code: 'EQ' | 'FR' | 'AC'
  location: string
  severity: 'Low' | 'Moderate' | 'High' | 'Critical'
  responseTeam: string
  description: string
  coordinates: [number, number]
  magnitude?: number
}

const mockIncidents: IncidentItem[] = []

type IncidentTypeFilter = 'EQ' | 'FR' | 'AC'

const incidentTypeMeta: Record<IncidentTypeFilter, { label: string; color: string }> = {
  EQ: { label: 'Earthquake', color: hazardColors.EQ },
  FR: { label: 'Fire', color: hazardColors.FR },
  AC: { label: 'Accident', color: hazardColors.AC },
}

const statusClassByType: Record<string, string> = {
  active: 'border border-red-200 bg-red-50 text-red-800',
  resolved: 'border border-emerald-200 bg-emerald-50 text-emerald-800',
  pending: 'border border-amber-200 bg-amber-50 text-amber-800',
  approved: 'border border-emerald-200 bg-emerald-50 text-emerald-800',
}

function getEarthquakeSeverity(magnitude: number): IncidentItem['severity'] {
  if (magnitude >= 5) return 'Critical'
  if (magnitude >= 4) return 'High'
  if (magnitude >= 3) return 'Moderate'
  return 'Low'
}

function getEarthquakeDescription(event: EarthquakeEvent): string {
  if (event.magnitude >= 5) {
    return `Strong seismic event detected near ${event.place}. Depth ${event.depth.toFixed(
      1,
    )} km. Immediate structural assessment recommended.`
  }

  if (event.magnitude >= 4) {
    return `Moderate earthquake recorded near ${event.place}. Depth ${event.depth.toFixed(
      1,
    )} km with potential light shaking.`
  }

  return `Minor-to-light seismic activity near ${event.place}. Depth ${event.depth.toFixed(
    1,
  )} km. Monitoring remains active.`
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
        ((targetPoint.x - startPoint.x) * deltaX + (targetPoint.y - startPoint.y) * deltaY) /
          segmentLengthSquared,
      ),
    )

    const projectedPointX = startPoint.x + projectionRatio * deltaX
    const projectedPointY = startPoint.y + projectionRatio * deltaY

    return Math.hypot(targetPoint.x - projectedPointX, targetPoint.y - projectedPointY)
  }

  const inspectLine = (coordinates: number[][]) => {
    for (let index = 0; index < coordinates.length - 1; index += 1) {
      nearestDistance = Math.min(
        nearestDistance,
        getPointDistanceToSegment(coordinates[index], coordinates[index + 1]),
      )
    }
  }

  if (geometry.type === 'LineString') inspectLine(geometry.coordinates)
  if (geometry.type === 'MultiLineString') geometry.coordinates.forEach((segment) => inspectLine(segment))

  return nearestDistance
}

function getLucenaFallbackCoordinates(location: string): [number, number] {
  const text = location.toLowerCase()

  if (text.includes('barangay 10')) return [13.941, 121.614]
  if (text.includes('diversion')) return [13.918, 121.626]
  if (text.includes('highway')) return [13.926, 121.609]
  if (text.includes('commercial')) return [13.934, 121.621]
  if (text.includes('industrial')) return [13.929, 121.642]
  if (text.includes('east')) return [13.947, 121.632]
  if (text.includes('north')) return [13.963, 121.618]

  return [13.9414, 121.6236]
}

function mapIncidentReportToMapIncident(report: any): IncidentItem {
  const incidentType = String(report.incidentType || report.incident_type || report.type || '').toLowerCase()
  const location = report.location || report.address || 'Lucena City'
  const fallbackCoordinates = getLucenaFallbackCoordinates(location)

  let code: IncidentItem['code'] = 'AC'
  let color = hazardColors.AC

  if (incidentType.includes('fire')) {
    code = 'FR'
    color = hazardColors.FR
  } else if (incidentType.includes('earthquake')) {
    code = 'EQ'
    color = hazardColors.EQ
  } else {
    code = 'AC'
    color = hazardColors.AC
  }

  const lat = Number(report.latitude || report.lat || report.coordinates?.[0])
  const lng = Number(report.longitude || report.lng || report.coordinates?.[1])

  const coordinates: [number, number] =
    Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : fallbackCoordinates

  const victimCount = Number(report.victimCount || report.victim_count || 0)

  const rawStatus = String(report.status || '').toLowerCase()
  const status: IncidentItem['status'] = rawStatus === 'approved' ? 'approved' : 'pending'

  return {
    id: report.id,
    title: `${report.incidentType || report.incident_type || 'Incident Report'} - ${
      report.reportCode || report.report_code || report.incidentCode || report.incident_code || report.id || ''
    }`,
    time:
      report.timeOccurred ||
      report.time_occurred ||
      (report.createdAt || report.created_at
        ? new Date(report.createdAt || report.created_at).toLocaleTimeString(undefined, {
            hour: 'numeric',
            minute: '2-digit',
          })
        : 'Unknown time'),
    status,
    color,
    code,
    location,
    severity: victimCount >= 5 ? 'Critical' : victimCount >= 3 ? 'High' : victimCount >= 1 ? 'Moderate' : 'Low',
    responseTeam: report.responderTeam || report.responder_team || 'Responder Team',
    description: report.description || report.actionTaken || report.action_taken || 'No description provided.',
    coordinates,
  }
}

export function DisasterMapPage({ variant = 'public' }: { variant?: 'public' | 'admin' }) {
  const navigate = useNavigate()
  const isAdminVariant = variant === 'admin'
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)

  const [selectedIncident, setSelectedIncident] = useState<IncidentItem | null>(null)
  const [selectedType, setSelectedType] = useState<IncidentTypeFilter>('FR')
  const [backendIncidents, setBackendIncidents] = useState<IncidentItem[]>([])
  const [earthquakeEvents, setEarthquakeEvents] = useState<EarthquakeEvent[]>([])
  const [faultLines, setFaultLines] = useState<FaultLineFeatureCollection | null>(null)
  const [barangayLayer, setBarangayLayer] = useState<GeoJSON.FeatureCollection<GeoJSON.Geometry, Record<string, unknown>> | null>(null)
  const [eqHeatPoints, setEqHeatPoints] = useState<HeatPoint[]>([])
  const [eqFetchStatus, setEqFetchStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [showHeatmap, setShowHeatmap] = useState(true)
  const [showFaultLines, setShowFaultLines] = useState(true)
  const [eqLastRefreshed, setEqLastRefreshed] = useState<Date | null>(null)
  const [eqSearchQuery, setEqSearchQuery] = useState('')

  const allMappedIncidents = useMemo(
    () => (isAdminVariant ? backendIncidents : [...backendIncidents, ...mockIncidents]),
    [backendIncidents, isAdminVariant],
  )

  const filteredIncidents = useMemo(
    () => allMappedIncidents.filter((incident) => incident.code === selectedType),
    [allMappedIncidents, selectedType],
  )

  const earthquakeIncidentCards = useMemo(
    () =>
      [...earthquakeEvents]
        .sort((a, b) => b.rawTimestamp - a.rawTimestamp)
        .map((event) => ({
          title: `Earthquake Event - ${event.place}`,
          time: event.time,
          status: 'resolved' as const,
          color: hazardColors.EQ,
          code: 'EQ' as const,
          location: event.place,
          severity: getEarthquakeSeverity(event.magnitude),
          responseTeam: 'Seismic Assessment Unit',
          description: getEarthquakeDescription(event),
          coordinates: [event.lat, event.lng] as [number, number],
          magnitude: event.magnitude,
        })),
    [earthquakeEvents],
  )

  const filteredEarthquakeIncidentCards = useMemo(() => {
    const normalizedQuery = eqSearchQuery.trim().toLowerCase()
    if (!normalizedQuery) return earthquakeIncidentCards

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

  function handleIncidentClick(incident: IncidentItem) {
    if (!isAdminVariant && !isAuthenticated()) {
      navigate('/login')
      return
    }

    setSelectedIncident(incident)
  }

  function handleEditReport(id?: string) {
    if (!id) return
    navigate(`/admin/incident-reports/${id}/edit`)
  }

  function handleMarkPending(id?: string) {
    if (!id) return

    setBackendIncidents((items) =>
      items.map((item) => (item.id === id ? { ...item, status: 'pending' } : item)),
    )

    if (selectedIncident?.id === id) {
      setSelectedIncident({ ...selectedIncident, status: 'pending' })
    }
  }

  function handleApprove(id?: string) {
    if (!id) return

    setBackendIncidents((items) =>
      items.map((item) => (item.id === id ? { ...item, status: 'approved' } : item)),
    )

    if (selectedIncident?.id === id) {
      setSelectedIncident({ ...selectedIncident, status: 'approved' })
    }
  }

  const loadIncidentReports = useCallback(async () => {
    try {
      const reports = await getIncidentReports()
      const mappedReports = reports.map(mapIncidentReportToMapIncident)

      setBackendIncidents(mappedReports)
    } catch (error) {
      console.error('[DisasterMapPage] Failed to load incident reports:', error)
      setBackendIncidents([])
    }
  }, [])

  const loadEarthquakes = useCallback(async (silent = false) => {
    if (!silent) {
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
    }
  }, [])

  useEffect(() => {
    void loadIncidentReports()

    const intervalId = window.setInterval(() => {
      void loadIncidentReports()
    }, 30000)

    return () => window.clearInterval(intervalId)
  }, [loadIncidentReports])

  useEffect(() => {
    if (selectedType === 'EQ' && earthquakeEvents.length === 0 && eqFetchStatus === 'idle') {
      void loadEarthquakes()
    }
  }, [selectedType, earthquakeEvents.length, eqFetchStatus, loadEarthquakes])

  useEffect(() => {
    if (selectedType !== 'EQ' || faultLines) return

    let isCancelled = false

    void fetchQuezonFaultLines()
      .then((data) => {
        if (!isCancelled) {
          setFaultLines(data)
        }
      })
      .catch(() => {
        console.error('Failed to load fault lines')
      })

    return () => {
      isCancelled = true
    }
  }, [selectedType, faultLines])

  useEffect(() => {
    void fetch('/lucena_barangays.geojson')
      .then((response) => response.json())
      .then((data) => setBarangayLayer(data))
      .catch(() => {
        console.error('Failed to load Lucena barangay boundaries')
      })
  }, [])

  useEffect(() => {
    if (selectedType !== 'EQ') return

    const intervalId = setInterval(() => {
      void loadEarthquakes(true)
    }, 5 * 60 * 1000)

    return () => clearInterval(intervalId)
  }, [selectedType, loadEarthquakes])

  useEffect(() => {
    if (!mapContainerRef.current) return

    try {
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
        maxBounds: isEqView ? philippinesBounds : lucenaBounds,
        maxBoundsViscosity: 1,
        minZoom: isEqView ? 6 : 12,
        maxZoom: 18,
      })

      if (isEqView) {
        map.fitBounds(quezonRegionBounds)
      } else {
        map.fitBounds(lucenaBounds, { padding: [18, 18] })
      }

      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
      }).addTo(map)

      if (barangayLayer) {
        const barangayPane = map.getPane('barangay-pane') ?? map.createPane('barangay-pane')
        barangayPane.style.zIndex = '330'
        barangayPane.style.pointerEvents = 'auto'

        const barangayBorderColors = [
          '#2563eb',
          '#059669',
          '#d97706',
          '#7c3aed',
          '#dc2626',
          '#0891b2',
          '#9333ea',
          '#16a34a',
          '#db2777',
          '#0f766e',
        ]

        function getBarangayName(feature?: GeoJSON.Feature<GeoJSON.Geometry, Record<string, unknown>>): string {
          return String(
            feature?.properties?.barangay_name ??
              feature?.properties?.brgy_name ??
              feature?.properties?.name ??
              'Unknown Barangay',
          )
        }

        function getBarangayColor(feature?: GeoJSON.Feature<GeoJSON.Geometry, Record<string, unknown>>): string {
          const barangayName = getBarangayName(feature)

          let hash = 0
          for (let index = 0; index < barangayName.length; index += 1) {
            hash = barangayName.charCodeAt(index) + ((hash << 5) - hash)
          }

          return barangayBorderColors[Math.abs(hash) % barangayBorderColors.length]
        }

        const barangayGeoJson = L.geoJSON(barangayLayer, {
          pane: 'barangay-pane',
          interactive: true,
          style: (feature) => ({
            color: getBarangayColor(feature),
            weight: 0.9,
            opacity: 0.76,
            fillColor: getBarangayColor(feature),
            fillOpacity: 0.01,
            lineJoin: 'round',
            lineCap: 'round',
          }),
          onEachFeature: (feature, layer) => {
            const barangayName = getBarangayName(feature)

            layer.bindTooltip(barangayName, {
              sticky: true,
              direction: 'top',
              opacity: 0.95,
              className: 'barangay-hover-tooltip',
            })

            layer.on({
              mouseover: (event) => {
                const target = event.target as L.Path
                target.setStyle({
                  color: getBarangayColor(feature),
                  weight: 2.1,
                  opacity: 1,
                  fillColor: getBarangayColor(feature),
                  fillOpacity: 0.08,
                })
                target.bringToFront()
              },
              mouseout: () => {
                barangayGeoJson.resetStyle(layer)
              },
            })
          },
        })

        barangayGeoJson.addTo(map)
      }

      if (isEqView) {
        if (showHeatmap && eqHeatPoints.length > 0 && typeof L.heatLayer === 'function') {
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
          const faultPane = map.createPane('fault-lines-pane')
          faultPane.style.zIndex = '420'

          L.geoJSON(nonHighlightedFaultLineCollection, {
            pane: 'fault-lines-pane',
            style: {
              color: '#ef4444',
              weight: 2.5,
              opacity: 0.78,
            },
          }).addTo(map)
        }

        if (showFaultLines && highlightedFaultLineCollection) {
          const highlightPane = map.createPane('fault-highlights-pane')
          highlightPane.style.zIndex = '430'

          L.geoJSON(highlightedFaultLineCollection, {
            pane: 'fault-highlights-pane',
            style: {
              color: '#f59e0b',
              weight: 5,
              opacity: 0.98,
            },
          }).addTo(map)
        }

        if (showHeatmap) {
          earthquakeEvents
            .filter((event) => event.magnitude >= 3.5)
            .forEach((event) => {
              L.circleMarker([event.lat, event.lng], {
                radius: Math.max(4, (event.magnitude - 1) * 3),
                color: '#ffffff',
                weight: 1,
                fillColor: hazardColors.EQ,
                fillOpacity: 0.85,
              })
                .addTo(map)
                .bindPopup(
                  `<strong>M${event.magnitude.toFixed(1)}</strong><br/>${event.place}<br/><small>${event.time}</small>`,
                )
            })
        }
      } else {
        filteredIncidents.forEach((incident) => {
          L.circleMarker(incident.coordinates, {
            radius: 16,
            stroke: false,
            fillColor: incident.color,
            fillOpacity: 0.24,
            interactive: false,
          }).addTo(map)

          if (incident.status === 'pending') {
            L.circleMarker(incident.coordinates, {
              radius: 11,
              color: incident.color,
              weight: 2,
              fillColor: incident.color,
              fillOpacity: 0.18,
              interactive: false,
              className: 'hazard-marker-pulse',
            }).addTo(map)
          }

          L.circleMarker(incident.coordinates, {
            radius: 8,
            color: '#ffffff',
            weight: 1.8,
            fillColor: incident.color,
            fillOpacity: 0.98,
          })
            .addTo(map)
            .bindPopup(
              `<strong>${incident.title}</strong><br/>
              <small>${incident.location}</small><br/>
              <small>${incident.time}</small><br/>
              <small>${incident.severity}</small><br/>
              <small>Status: ${incident.status}</small>`,
            )
            .on('click', () => handleIncidentClick(incident))
        })
      }

      window.setTimeout(() => map.invalidateSize(), 0)

      mapInstanceRef.current = map

      return () => {
        map.remove()
        mapInstanceRef.current = null
      }
    } catch (error) {
      console.error('Failed to initialize map:', error)
    }
  }, [
    filteredIncidents,
    selectedType,
    eqHeatPoints,
    earthquakeEvents,
    showHeatmap,
    showFaultLines,
    nonHighlightedFaultLineCollection,
    highlightedFaultLineCollection,
    barangayLayer,
  ])

  return (
    <div
      className={
        isAdminVariant
          ? 'min-h-screen bg-[radial-gradient(circle_at_top,_#2a3144_0%,_#181c23_48%,_#11161f_100%)] text-slate-100 md:flex'
          : 'min-h-screen bg-[radial-gradient(circle_at_top,_#e7f1fc_0%,#f4f8fd_34%,#eef3f8_100%)] text-slate-800'
      }
    >
      {isAdminVariant ? <AdminSidebar activeKey="gisMapping" /> : null}

      <main className={isAdminVariant ? 'flex-1' : ''}>
        {isAdminVariant ? (
          <div className="border-b border-slate-700/70 bg-[#1a2030]/90 backdrop-blur">
            <div className="mx-auto w-full max-w-7xl px-6 py-5 sm:px-10">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-200/70">
                Admin Operations
              </p>
              <h1 className="mt-1 text-2xl font-black text-white">Disaster Map Console</h1>
            </div>
          </div>
        ) : (
          <NavigationBar variant="hero" />
        )}

        <div className="w-full">
          <section
            className={`border-b px-6 py-10 sm:px-10 sm:py-12 ${
              isAdminVariant
                ? 'border-slate-700/70 bg-[linear-gradient(135deg,#1f2738_0%,#232f45_55%,#1a2130_100%)]'
                : 'border-slate-200 bg-[linear-gradient(135deg,#eff6ff_0%,#f9fcff_55%,#eef4fb_100%)]'
            }`}
          >
            <div className="mx-auto w-full max-w-7xl">
              <p
                className={`inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.15em] ${
                  isAdminVariant
                    ? 'border border-cyan-300/30 bg-cyan-300/10 text-cyan-100'
                    : 'border border-[#1f4e80]/25 bg-[#1f4e80]/10 text-[#1f4e80]'
                }`}
              >
                {isAdminVariant ? 'Hazard Mapping Control' : 'Lucena City DRRMO Monitoring Desk'}
              </p>

              <h1
                className={`mt-3 text-3xl font-black tracking-tight sm:text-4xl ${
                  isAdminVariant ? 'text-white' : 'text-slate-900'
                }`}
              >
                Disaster Incident Map
              </h1>

              <p
                className={`mt-2 max-w-3xl text-sm leading-relaxed sm:text-base ${
                  isAdminVariant ? 'text-slate-300' : 'text-slate-600'
                }`}
              >
                Every submitted responder incident report is plotted automatically on the map using its saved location
                coordinates.
              </p>
            </div>
          </section>

          <section className="w-full px-4 py-4 sm:px-5">
            <div
              className={`mx-auto flex w-full max-w-7xl flex-wrap items-center gap-2 rounded-2xl p-3 shadow-[0_10px_28px_rgba(15,23,42,0.12)] sm:p-4 ${
                isAdminVariant
                  ? 'border border-slate-600/70 bg-[#202a3d]/90'
                  : 'border border-slate-200 bg-white/90 backdrop-blur'
              }`}
            >
              <p className={`mr-1 text-xs font-bold uppercase tracking-[0.14em] ${isAdminVariant ? 'text-slate-300' : 'text-slate-600'}`}>
                Incident Type Mapping
              </p>

              {(Object.keys(incidentTypeMeta) as IncidentTypeFilter[]).map((typeCode) => (
                <button
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    selectedType === typeCode
                      ? 'border-slate-300 text-slate-900'
                      : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400'
                  }`}
                  key={typeCode}
                  onClick={() => setSelectedType(typeCode)}
                  style={{
                    backgroundColor: selectedType === typeCode ? incidentTypeMeta[typeCode].color : undefined,
                    borderColor: selectedType === typeCode ? incidentTypeMeta[typeCode].color : undefined,
                  }}
                  type="button"
                >
                  {incidentTypeMeta[typeCode].label}
                </button>
              ))}

              <span className="ml-auto rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                {backendIncidents.length} responder reports loaded
              </span>
            </div>
          </section>

          <section className="w-full p-4 sm:p-5">
            <div className="grid w-full gap-4 xl:grid-cols-[minmax(0,2.3fr)_minmax(380px,1fr)]">
              <div
                className={`overflow-hidden rounded-3xl shadow-[0_20px_44px_rgba(15,23,42,0.16)] ${
                  isAdminVariant
                    ? 'border border-slate-600/70 bg-[#202a3d]/95'
                    : 'border border-slate-200 bg-white/95 backdrop-blur'
                }`}
              >
                <div
                  className={`flex items-center justify-between gap-3 px-4 py-3 ${
                    isAdminVariant
                      ? 'border-b border-slate-600/70 bg-[linear-gradient(90deg,#1f2a3f_0%,#24344e_100%)]'
                      : 'border-b border-slate-200 bg-[linear-gradient(90deg,#e5f0ff_0%,#f4f9ff_100%)]'
                  }`}
                >
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#1e4f86]">
                      Operational Map View
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      {selectedType === 'EQ'
                        ? 'Quezon Province seismic view — Lucena City highlighted'
                        : 'Responder reports are plotted here'}
                    </p>
                  </div>

                  {selectedType === 'EQ' ? (
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <button
                        className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold transition ${
                          showHeatmap
                            ? 'border-emerald-400 bg-emerald-50 text-emerald-800'
                            : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                        onClick={() => setShowHeatmap((value) => !value)}
                        type="button"
                      >
                        {showHeatmap ? 'Heatmap ON' : 'Heatmap OFF'}
                      </button>

                      <button
                        className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold transition ${
                          showFaultLines
                            ? 'border-rose-300 bg-rose-50 text-rose-700'
                            : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                        onClick={() => setShowFaultLines((value) => !value)}
                        type="button"
                      >
                        {showFaultLines ? 'Fault Lines ON' : 'Fault Lines OFF'}
                      </button>
                    </div>
                  ) : null}
                </div>

                <div className="relative overflow-hidden rounded-b-3xl">
                  <div className="h-[520px] w-full sm:h-[640px]" ref={mapContainerRef} />
                </div>
              </div>

              <aside
                className={`h-full max-h-[740px] rounded-3xl p-4 shadow-[0_20px_44px_rgba(15,23,42,0.16)] sm:p-5 ${
                  isAdminVariant
                    ? 'border border-slate-600/70 bg-[#202a3d]/95'
                    : 'border border-slate-200 bg-white/95 backdrop-blur'
                }`}
              >
                {selectedType === 'EQ' ? (
                  <div className="flex h-full min-h-0 flex-col">
                    <div className={`pb-3 ${isAdminVariant ? 'border-b border-slate-700' : 'border-b border-slate-200'}`}>
                      <div className="flex items-center justify-between">
                        <h2 className={`text-xl font-bold ${isAdminVariant ? 'text-white' : 'text-slate-900'}`}>
                          Seismic Events
                        </h2>
                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                          {eqFetchStatus === 'loading' ? '…' : earthquakeEvents.length}
                        </span>
                      </div>

                      <p className="mt-1 text-xs text-slate-500">
                        USGS / PHIVOLCS · Quezon Province
                        {eqLastRefreshed
                          ? ` · Updated ${eqLastRefreshed.toLocaleTimeString('en-PH', {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })}`
                          : ''}
                      </p>
                    </div>

                    <div className="min-h-0 flex-1 pb-3">
                      {eqFetchStatus === 'loading' ? (
                        <div className="mt-6 flex flex-col items-center gap-3 py-6 text-center">
                          <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-400 border-t-transparent" />
                          <p className="text-sm text-slate-500">Fetching seismic data...</p>
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
                          <div className="mt-3">
                            <input
                              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none"
                              onChange={(event) => setEqSearchQuery(event.target.value)}
                              placeholder="Search place"
                              type="text"
                              value={eqSearchQuery}
                            />
                          </div>

                          <div className="mt-3 max-h-[500px] space-y-2 overflow-y-auto pr-1">
                            {filteredEarthquakeIncidentCards.map((incident) => (
                              <article
                                className={`rounded-xl p-3 ${
                              isAdminVariant
                                ? 'border border-slate-700 bg-[#1d2230]'
                                : 'border border-slate-200 bg-[#fbfdff]'
                            }`}
                                key={`${incident.title}-${incident.time}`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <p className={`text-sm font-semibold ${isAdminVariant ? 'text-white' : 'text-slate-900'}`}>
                                      {incident.title}
                                    </p>
                                    <p className="mt-1 text-xs text-slate-500">{incident.time}</p>
                                    <p className="mt-1 text-xs text-slate-500">{incident.location}</p>
                                  </div>
                                  <button
                                    className="rounded-md border border-[#234d77]/30 bg-white px-2.5 py-1.5 text-xs font-semibold text-[#234d77]"
                                    onClick={() => handleIncidentClick(incident)}
                                    type="button"
                                  >
                                    View Info
                                  </button>
                                </div>
                              </article>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className={`pb-3 ${isAdminVariant ? 'border-b border-slate-700' : 'border-b border-slate-200'}`}>
                      <div className="flex items-center justify-between">
                        <h2 className={`text-xl font-bold ${isAdminVariant ? 'text-white' : 'text-slate-900'}`}>
                          Responder Reports Review
                        </h2>
                        <span className="rounded-full bg-[#e8f2fc] px-2.5 py-1 text-xs font-semibold text-[#245785]">
                          {filteredIncidents.length}
                        </span>
                      </div>

                      <p className="mt-1 text-xs text-slate-500">
                        Admin can review, edit, mark pending, or approve responder reports.
                      </p>
                    </div>

                    <div className="mt-4 max-h-[500px] space-y-3 overflow-y-auto pr-1">
                      {filteredIncidents.length > 0 ? (
                        filteredIncidents.map((incident) => (
                          <article
                            className={`rounded-xl p-3 transition ${
                              isAdminVariant
                                ? 'border border-slate-700 bg-[#1d2230] hover:border-slate-500'
                                : 'border border-slate-200 bg-[#fbfdff] hover:border-slate-300 hover:bg-white'
                            }`}
                            key={`${incident.id || incident.title}-${incident.time}`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span
                                    className="inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-black text-slate-900"
                                    style={{ backgroundColor: incident.color, minWidth: '24px' }}
                                  >
                                    {incident.code}
                                  </span>
                                  <p
                                    className={`truncate text-sm font-semibold ${
                                      isAdminVariant ? 'text-white' : 'text-slate-900'
                                    }`}
                                  >
                                    {incident.title}
                                  </p>
                                </div>

                                <p className="mt-1 pl-7 text-xs text-slate-500">{incident.location}</p>
                                <p className="mt-1 pl-7 text-xs text-slate-500">{incident.time}</p>
                                <p className="mt-1 pl-7 text-xs text-slate-500">{incident.responseTeam}</p>
                              </div>

                              <span
                                className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${
                                  statusClassByType[incident.status]
                                }`}
                              >
                                {incident.status}
                              </span>
                            </div>

                            <div className="mt-3 flex flex-wrap gap-2 pl-7">
                              <button
                                className="rounded-md border border-[#234d77]/30 bg-white px-2.5 py-1.5 text-xs font-semibold text-[#234d77]"
                                onClick={() => handleIncidentClick(incident)}
                                type="button"
                              >
                                View Info
                              </button>

                              {isAdminVariant ? (
                                <>
                                  <button
                                    className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                    onClick={() => handleEditReport(incident.id)}
                                    type="button"
                                  >
                                    Edit
                                  </button>

                                  <button
                                    className="rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100"
                                    onClick={() => handleMarkPending(incident.id)}
                                    type="button"
                                  >
                                    Pending
                                  </button>

                                  <button
                                    className="rounded-md border border-emerald-300 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
                                    onClick={() => handleApprove(incident.id)}
                                    type="button"
                                  >
                                    Approved
                                  </button>
                                </>
                              ) : null}
                            </div>
                          </article>
                        ))
                      ) : (
                        <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                          No submitted responder reports for this incident type yet.
                        </p>
                      )}
                    </div>
                  </>
                )}
              </aside>
            </div>
          </section>
        </div>

        {selectedIncident ? (
          <div
            className="fixed inset-0 z-[1300] bg-slate-200/55 p-4 backdrop-blur-[1px] sm:p-8"
            onClick={() => setSelectedIncident(null)}
          >
            <div className="mx-auto mt-8 w-full max-w-3xl" onClick={(event) => event.stopPropagation()}>
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_20px_40px_rgba(15,23,42,0.22)] sm:p-6">
                <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.15em] text-slate-500">
                      Responder Incident Report
                    </p>
                    <h3 className="mt-1 text-xl font-black text-slate-900 sm:text-2xl">
                      {selectedIncident.title}
                    </h3>
                  </div>

                  <button
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                    onClick={() => setSelectedIncident(null)}
                    type="button"
                  >
                    Close
                  </button>
                </div>

                <p className="mt-4 text-sm leading-relaxed text-slate-600 sm:text-base">
                  {selectedIncident.description}
                </p>

                <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                  <p className="text-slate-600">
                    <span className="font-semibold text-slate-800">Location:</span> {selectedIncident.location}
                  </p>
                  <p className="text-slate-600">
                    <span className="font-semibold text-slate-800">Time:</span> {selectedIncident.time}
                  </p>
                  <p className="text-slate-600">
                    <span className="font-semibold text-slate-800">Severity:</span> {selectedIncident.severity}
                  </p>
                  <p className="text-slate-600">
                    <span className="font-semibold text-slate-800">Response Team:</span>{' '}
                    {selectedIncident.responseTeam}
                  </p>
                  <p className="text-slate-600">
                    <span className="font-semibold text-slate-800">Status:</span>{' '}
                    <span
                      className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${
                        statusClassByType[selectedIncident.status]
                      }`}
                    >
                      {selectedIncident.status}
                    </span>
                  </p>
                  <p className="text-slate-600">
                    <span className="font-semibold text-slate-800">Coordinates:</span>{' '}
                    {selectedIncident.coordinates[0].toFixed(5)}, {selectedIncident.coordinates[1].toFixed(5)}
                  </p>
                </div>

                {isAdminVariant && selectedIncident.code !== 'EQ' ? (
                  <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-200 pt-4">
                    <button
                      className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      onClick={() => handleEditReport(selectedIncident.id)}
                      type="button"
                    >
                      Edit Report
                    </button>

                    <button
                      className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100"
                      onClick={() => handleMarkPending(selectedIncident.id)}
                      type="button"
                    >
                      Mark as Pending
                    </button>

                    <button
                      className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
                      onClick={() => handleApprove(selectedIncident.id)}
                      type="button"
                    >
                      Approve Report
                    </button>
                  </div>
                ) : null}
              </section>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  )
}

export default DisasterMapPage