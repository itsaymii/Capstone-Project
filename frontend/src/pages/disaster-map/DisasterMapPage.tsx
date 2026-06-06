import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as L from 'leaflet'
import type { LatLngBoundsExpression } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.heat'

// leaflet.heat does not ship complete TypeScript typings in many Vite projects.
// This small local type keeps the build clean while still using the plugin at runtime.
type LeafletWithHeat = typeof L & {
  heatLayer?: (latlngs: HeatPoint[], options?: L.LayerOptions & Record<string, unknown>) => L.Layer
}

import { AdminSidebar } from '../../components/AdminSidebar'
import { NavigationBar } from '../../components/NavigationBar'
import { useNavigate } from 'react-router-dom'
import { isAuthenticated } from '../../services/auth'
import { getIncidentReports } from '../../services/incidents'
import {
  type EarthquakeEvent,
  type HeatPoint,
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

function getDisplayStatus(status: IncidentItem['status']): string {
  if (status === 'approved' || status === 'resolved') return 'Resolved'
  if (status === 'active') return 'Active'
  return 'Pending'
}

function getStatusStyleKey(status: IncidentItem['status']): string {
  return status === 'approved' ? 'resolved' : status
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
  let status: IncidentItem['status']

  if (rawStatus === 'approved' || rawStatus === 'approve' || rawStatus === 'approved report' || rawStatus === 'resolved') {
    status = 'resolved'
  } else if (rawStatus === 'active' || rawStatus === 'ongoing' || rawStatus === 'on-going') {
    status = 'active'
  } else {
    status = 'pending'
  }

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

function createHeatCloudPoints(points: HeatPoint[]): HeatPoint[] {
  // Creates a smooth heat "cloud" without hiding barangay borders, labels, or markers.
  // Keep the offsets small because Lucena is a compact map area.
  const cloudOffsets: Array<[number, number, number]> = [
    [0, 0, 1],
    [0.0022, 0.0018, 0.72],
    [-0.0022, -0.0018, 0.72],
    [0.0035, -0.0025, 0.55],
    [-0.0035, 0.0025, 0.55],
    [0.005, 0.0035, 0.36],
    [-0.005, -0.0035, 0.36],
  ]

  return points.flatMap(([lat, lng, intensity]) =>
    cloudOffsets.map(([latOffset, lngOffset, multiplier]) => [
      lat + latOffset,
      lng + lngOffset,
      Math.min(1, Math.max(0.08, intensity * multiplier)),
    ] as HeatPoint),
  )
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
  const [barangayLayer, setBarangayLayer] = useState<GeoJSON.FeatureCollection<GeoJSON.Geometry, Record<string, unknown>> | null>(null)
  const [eqHeatPoints, setEqHeatPoints] = useState<HeatPoint[]>([])
  const [eqFetchStatus, setEqFetchStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [showHeatmap, setShowHeatmap] = useState(true)
  const [incidentLayerMode, setIncidentLayerMode] = useState<'markers' | 'heatmap'>('heatmap')
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

  const incidentHeatPoints = useMemo(() => {
    const severityToIntensity = (severity: IncidentItem['severity']): number => {
      switch (severity) {
        case 'Critical':
          return 0.95
        case 'High':
          return 0.75
        case 'Moderate':
          return 0.55
        default:
          return 0.3
      }
    }

    return filteredIncidents.map((incident) => [
      incident.coordinates[0],
      incident.coordinates[1],
      severityToIntensity(incident.severity),
    ]) as HeatPoint[]
  }, [filteredIncidents])

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


  const earthquakeStats = useMemo(() => {
    const total = earthquakeEvents.length
    const significant = earthquakeEvents.filter((event) => event.magnitude >= 4).length
    const strongest = earthquakeEvents.reduce((max, event) => Math.max(max, event.magnitude), 0)
    const averageMagnitude =
      total > 0 ? earthquakeEvents.reduce((sum, event) => sum + event.magnitude, 0) / total : 0
    const recent30Days = earthquakeEvents.filter(
      (event) => event.rawTimestamp >= Date.now() - 30 * 24 * 60 * 60 * 1000,
    ).length

    return {
      total,
      significant,
      strongest: strongest.toFixed(1),
      averageMagnitude: averageMagnitude.toFixed(1),
      recent30Days,
    }
  }, [earthquakeEvents])

  const incidentTypeCounts = useMemo(
    () => ({
      EQ: allMappedIncidents.filter((incident) => incident.code === 'EQ').length,
      FR: allMappedIncidents.filter((incident) => incident.code === 'FR').length,
      AC: allMappedIncidents.filter((incident) => incident.code === 'AC').length,
    }),
    [allMappedIncidents],
  )


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
      items.map((item) => (item.id === id ? { ...item, status: 'resolved' } : item)),
    )

    if (selectedIncident?.id === id) {
      setSelectedIncident({ ...selectedIncident, status: 'resolved' })
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

      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
      }).addTo(map)

      const heatmapPane = map.getPane('heatmap-pane') ?? map.createPane('heatmap-pane')
      heatmapPane.style.zIndex = '350'
      heatmapPane.style.pointerEvents = 'none'

      const barangayPane = map.getPane('barangay-pane') ?? map.createPane('barangay-pane')
      barangayPane.style.zIndex = '590'
      barangayPane.style.pointerEvents = 'auto'

      const incidentMarkerPane = map.getPane('incident-marker-pane') ?? map.createPane('incident-marker-pane')
      incidentMarkerPane.style.zIndex = '670'
      incidentMarkerPane.style.pointerEvents = 'auto'

      const labelsPane = map.getPane('map-labels-pane') ?? map.createPane('map-labels-pane')
      labelsPane.style.zIndex = '650'
      labelsPane.style.pointerEvents = 'none'

      const heatLayerFactory = (L as LeafletWithHeat).heatLayer

      if (barangayLayer) {

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
        if (showHeatmap && eqHeatPoints.length > 0 && typeof heatLayerFactory === 'function') {
          heatLayerFactory(createHeatCloudPoints(eqHeatPoints), {
            pane: 'heatmap-pane',
            minOpacity: 0.22,
            radius: 42,
            blur: 32,
            max: 1.0,
            maxZoom: 16,
            gradient: {
              0.12: '#2563eb',
              0.32: '#22d3ee',
              0.5: '#22c55e',
              0.68: '#facc15',
              0.84: '#f97316',
              1.0: '#dc2626',
            },
          }).addTo(map)
        }

        if (showHeatmap) {
          earthquakeEvents
            .filter((event) => event.magnitude >= 3.5)
            .forEach((event) => {
              L.circleMarker([event.lat, event.lng], {
                pane: 'incident-marker-pane',
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
        if (incidentLayerMode === 'heatmap' && typeof heatLayerFactory === 'function' && incidentHeatPoints.length > 0) {
          heatLayerFactory(createHeatCloudPoints(incidentHeatPoints), {
            pane: 'heatmap-pane',
            minOpacity: 0.22,
            radius: 46,
            blur: 34,
            max: 1.0,
            maxZoom: 17,
            gradient: {
              0.12: '#2563eb',
              0.32: '#22d3ee',
              0.5: '#22c55e',
              0.68: '#facc15',
              0.84: '#f97316',
              1.0: '#dc2626',
            },
          }).addTo(map)
        }

        filteredIncidents.forEach((incident) => {
          L.circleMarker(incident.coordinates, {
            pane: 'incident-marker-pane',
            radius: 16,
            stroke: false,
            fillColor: incident.color,
            fillOpacity: incidentLayerMode === 'heatmap' ? 0.16 : 0.24,
            interactive: false,
          }).addTo(map)

          if (incident.status === 'pending') {
            L.circleMarker(incident.coordinates, {
              pane: 'incident-marker-pane',
              radius: 11,
              color: incident.color,
              weight: 2,
              fillColor: incident.color,
              fillOpacity: incidentLayerMode === 'heatmap' ? 0.12 : 0.18,
              interactive: false,
              className: 'hazard-marker-pulse',
            }).addTo(map)
          }

          L.circleMarker(incident.coordinates, {
            pane: 'incident-marker-pane',
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
            <small>Status: ${getDisplayStatus(incident.status)}</small>`,
            )
            .on('click', () => handleIncidentClick(incident))
        })
      }

      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png', {
        pane: 'map-labels-pane',
        attribution: '&copy; CARTO',
      }).addTo(map)

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
    incidentHeatPoints,
    incidentLayerMode,
    selectedType,
    eqHeatPoints,
    earthquakeEvents,
    showHeatmap,
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

              {(Object.keys(incidentTypeMeta) as IncidentTypeFilter[]).map((typeCode) => {
                const isActive = selectedType === typeCode
                return (
                  <button
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${
                      isActive
                        ? 'border-transparent text-white shadow-[0_10px_20px_rgba(15,23,42,0.12)]'
                        : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50'
                    }`}
                    key={typeCode}
                    onClick={() => setSelectedType(typeCode)}
                    style={
                      isActive
                        ? {
                            backgroundColor: incidentTypeMeta[typeCode].color,
                            boxShadow: `0 12px 24px ${incidentTypeMeta[typeCode].color}30`,
                          }
                        : undefined
                    }
                    type="button"
                  >
                    <span
                      className="inline-flex h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: incidentTypeMeta[typeCode].color }}
                    />
                    <span>{incidentTypeMeta[typeCode].label}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                      {incidentTypeCounts[typeCode]}
                    </span>
                  </button>
                )
              })}

              <span className="ml-auto rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                {backendIncidents.length} responder reports loaded
              </span>
            </div>

            <div
              className={`mx-auto mt-3 flex w-full max-w-7xl flex-wrap items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/90 px-3 py-3 text-sm shadow-sm ${
                isAdminVariant ? 'border-slate-600/80 bg-slate-950/90 text-slate-200' : ''
              }`}
            >
              <span className="text-[10px] font-black uppercase tracking-[0.26em] text-slate-500">
                Layers
              </span>

              <button
                className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
                  (selectedType === 'EQ' ? showHeatmap : incidentLayerMode === 'heatmap')
                    ? 'border-emerald-500 bg-emerald-500 text-white shadow-sm'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
                onClick={() => {
                  if (selectedType === 'EQ') {
                    setShowHeatmap((value) => !value)
                  } else {
                    setIncidentLayerMode((current) => (current === 'heatmap' ? 'markers' : 'heatmap'))
                  }
                }}
                type="button"
              >
                Heatmap
              </button>

              <p className="ml-auto text-xs text-slate-500">
                Toggle the incident overlay for current map type.
              </p>
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
                    </div>
                  ) : null}
                </div>

                <div className="relative overflow-hidden rounded-b-3xl">
                  <div className="pointer-events-none absolute right-4 top-4 z-20 hidden max-w-xs rounded-3xl border border-slate-200/80 bg-white/90 p-4 text-sm text-slate-700 shadow-xl backdrop-blur-md sm:block dark:border-slate-700 dark:bg-slate-950/80 dark:text-slate-100">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                      Map legend
                    </p>
                    <div className="mt-3 space-y-2">
                      {Object.entries(incidentTypeMeta).map(([code, meta]) => (
                        <div key={code} className="flex items-center gap-3">
                          <span
                            className="inline-flex h-3.5 w-3.5 rounded-full"
                            style={{ backgroundColor: meta.color }}
                          />
                          <span>{meta.label}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 rounded-2xl bg-slate-100/90 p-3 text-xs text-slate-500 dark:bg-slate-900/85 dark:text-slate-300">
                      {selectedType === 'EQ'
                        ? 'Earthquake view with live seismic density and monitored seismic events.'
                        : 'Click a marker to preview incident details and open the responder report.'}
                    </div>
                  </div>

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
                  <div className="flex h-full min-h-0 flex-col overflow-hidden">
                    <div
                      className={`relative overflow-hidden rounded-[26px] border p-5 ${
                        isAdminVariant
                          ? 'border-emerald-400/20 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.22)_0%,rgba(30,41,59,0.96)_48%,rgba(15,23,42,0.98)_100%)]'
                          : 'border-emerald-100 bg-[radial-gradient(circle_at_top_left,#dcfce7_0%,#f0fdf4_42%,#ffffff_100%)]'
                      }`}
                    >
                      <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-emerald-400/20 blur-3xl" />
                      <div className="relative z-10 flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-500">
                            Earthquake Monitoring
                          </p>
                          <h2 className={`mt-2 text-2xl font-black ${isAdminVariant ? 'text-white' : 'text-slate-950'}`}>
                            Seismic Events
                          </h2>
                          <p className={`mt-1 text-xs leading-relaxed ${isAdminVariant ? 'text-slate-300' : 'text-slate-600'}`}>
                            Live earthquake feed for Quezon Province with magnitude, depth, place, and event time.
                          </p>
                        </div>

                        <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-700 shadow-sm">
                          {eqFetchStatus === 'loading' ? '...' : earthquakeStats.total}
                        </span>
                      </div>

                      <div className="relative z-10 mt-5 grid grid-cols-3 gap-2">
                        <div className={`rounded-2xl border p-3 ${isAdminVariant ? 'border-white/10 bg-white/8' : 'border-white/70 bg-white/80'}`}>
                          <p className={`text-[10px] font-bold uppercase tracking-[0.12em] ${isAdminVariant ? 'text-slate-400' : 'text-slate-500'}`}>
                            Strongest
                          </p>
                          <p className={`mt-1 text-xl font-black ${isAdminVariant ? 'text-white' : 'text-slate-900'}`}>
                            M{earthquakeStats.strongest}
                          </p>
                        </div>
                        <div className={`rounded-2xl border p-3 ${isAdminVariant ? 'border-white/10 bg-white/8' : 'border-white/70 bg-white/80'}`}>
                          <p className={`text-[10px] font-bold uppercase tracking-[0.12em] ${isAdminVariant ? 'text-slate-400' : 'text-slate-500'}`}>
                            Average
                          </p>
                          <p className={`mt-1 text-xl font-black ${isAdminVariant ? 'text-white' : 'text-slate-900'}`}>
                            M{earthquakeStats.averageMagnitude}
                          </p>
                        </div>
                        <div className={`rounded-2xl border p-3 ${isAdminVariant ? 'border-white/10 bg-white/8' : 'border-white/70 bg-white/80'}`}>
                          <p className={`text-[10px] font-bold uppercase tracking-[0.12em] ${isAdminVariant ? 'text-slate-400' : 'text-slate-500'}`}>
                            M4+
                          </p>
                          <p className={`mt-1 text-xl font-black ${isAdminVariant ? 'text-white' : 'text-slate-900'}`}>
                            {earthquakeStats.significant}
                          </p>
                        </div>
                      </div>

                      <div className="relative z-10 mt-4 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className={`rounded-full px-3 py-1 font-semibold ${isAdminVariant ? 'bg-white/10 text-slate-300' : 'bg-white/80 text-slate-600'}`}>
                          Recent 30 days: {earthquakeStats.recent30Days}
                        </span>
                        <span className={`rounded-full px-3 py-1 font-semibold ${isAdminVariant ? 'bg-white/10 text-slate-300' : 'bg-white/80 text-slate-600'}`}>
                          {eqLastRefreshed
                            ? `Updated ${eqLastRefreshed.toLocaleTimeString('en-PH', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}`
                            : 'Waiting for update'}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 min-h-0 flex-1">
                      {eqFetchStatus === 'loading' ? (
                        <div className={`flex min-h-[320px] flex-col items-center justify-center rounded-[24px] border text-center ${isAdminVariant ? 'border-slate-700 bg-slate-900/40' : 'border-slate-200 bg-slate-50'}`}>
                          <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-400 border-t-transparent" />
                          <p className={`mt-4 text-sm font-semibold ${isAdminVariant ? 'text-slate-200' : 'text-slate-700'}`}>
                            Fetching seismic data...
                          </p>
                          <p className="mt-1 text-xs text-slate-500">Please wait while the live feed loads.</p>
                        </div>
                      ) : eqFetchStatus === 'error' ? (
                        <div className="rounded-[24px] border border-red-200 bg-red-50 p-5 text-center">
                          <p className="text-sm font-bold text-red-800">Failed to load seismic data</p>
                          <p className="mt-1 text-xs text-red-600">Check the earthquake service or try again.</p>
                          <button
                            className="mt-4 rounded-xl border border-red-300 bg-white px-4 py-2 text-xs font-bold text-red-800 transition hover:bg-red-50"
                            onClick={() => void loadEarthquakes()}
                            type="button"
                          >
                            Retry
                          </button>
                        </div>
                      ) : (
                        <div className="flex h-full min-h-0 flex-col">
                          <div className="relative">
                            <input
                              className={`w-full rounded-2xl border px-4 py-3 pl-10 text-sm font-medium outline-none transition ${
                                isAdminVariant
                                  ? 'border-slate-700 bg-slate-950/70 text-white placeholder:text-slate-500 focus:border-emerald-400'
                                  : 'border-slate-200 bg-white text-slate-800 placeholder:text-slate-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100'
                              }`}
                              onChange={(event) => setEqSearchQuery(event.target.value)}
                              placeholder="Search earthquake place or description"
                              type="text"
                              value={eqSearchQuery}
                            />
                            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                              ⌕
                            </span>
                          </div>

                          <div className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                            {filteredEarthquakeIncidentCards.length > 0 ? (
                              filteredEarthquakeIncidentCards.map((incident) => {
                                const magnitudeTone =
                                  (incident.magnitude ?? 0) >= 5
                                    ? 'border-red-200 bg-red-50 text-red-700'
                                    : (incident.magnitude ?? 0) >= 4
                                      ? 'border-orange-200 bg-orange-50 text-orange-700'
                                      : (incident.magnitude ?? 0) >= 3
                                        ? 'border-amber-200 bg-amber-50 text-amber-700'
                                        : 'border-emerald-200 bg-emerald-50 text-emerald-700'

                                return (
                                  <article
                                    className={`group rounded-[22px] border p-4 transition duration-200 hover:-translate-y-0.5 ${
                                      isAdminVariant
                                        ? 'border-slate-700 bg-[#1d2230] hover:border-emerald-400/50 hover:bg-[#222a3b]'
                                        : 'border-slate-200 bg-white hover:border-emerald-200 hover:shadow-[0_14px_28px_rgba(15,23,42,0.08)]'
                                    }`}
                                    key={`${incident.title}-${incident.time}`}
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                          <span className="inline-flex rounded-lg bg-emerald-400 px-2 py-1 text-[10px] font-black text-slate-950">
                                            EQ
                                          </span>
                                          <p className={`truncate text-sm font-bold ${isAdminVariant ? 'text-white' : 'text-slate-900'}`}>
                                            {incident.location}
                                          </p>
                                        </div>

                                        <p className="mt-2 text-xs font-medium text-slate-500">{incident.time}</p>
                                        <p className={`mt-2 line-clamp-2 text-xs leading-relaxed ${isAdminVariant ? 'text-slate-300' : 'text-slate-600'}`}>
                                          {incident.description}
                                        </p>
                                      </div>

                                      <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-black ${magnitudeTone}`}>
                                        M{incident.magnitude?.toFixed(1) ?? '0.0'}
                                      </span>
                                    </div>

                                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/70 pt-3">
                                      <span className="text-[11px] font-semibold text-slate-500">
                                        Depth-aware seismic monitoring
                                      </span>
                                      <button
                                        className="rounded-lg border border-[#234d77]/30 bg-white px-3 py-1.5 text-xs font-bold text-[#234d77] transition hover:bg-blue-50"
                                        onClick={() => handleIncidentClick(incident)}
                                        type="button"
                                      >
                                        View Info
                                      </button>
                                    </div>
                                  </article>
                                )
                              })
                            ) : (
                              <div className={`rounded-[24px] border border-dashed p-6 text-center ${isAdminVariant ? 'border-slate-700 bg-slate-900/40' : 'border-slate-300 bg-slate-50'}`}>
                                <p className={`text-sm font-bold ${isAdminVariant ? 'text-slate-200' : 'text-slate-700'}`}>
                                  No matching seismic event found.
                                </p>
                                <p className="mt-1 text-xs text-slate-500">Try another place or clear the search field.</p>
                              </div>
                            )}
                          </div>
                        </div>
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
                                  statusClassByType[getStatusStyleKey(incident.status)]
                                }`}
                              >
                                {getDisplayStatus(incident.status)}
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
                        statusClassByType[getStatusStyleKey(selectedIncident.status)]
                      }`}
                    >
                      {getDisplayStatus(selectedIncident.status)}
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
