import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import L, { type LatLngBoundsExpression } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.heat'
import { AdminSidebar } from '../../components/AdminSidebar'
import { NavigationBar } from '../../components/NavigationBar'
import { useNavigate } from 'react-router-dom'
import { isAuthenticated } from '../../services/auth'
import {
  type EarthquakeEvent,
  type HeatPoint,
  fetchQuezonRegionEarthquakes,
  toHeatPoints,
} from '../../services/earthquakes'

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

const hazardColors = {
  EQ: '#4ade80',
  FR: '#fb923c',
  AC: '#facc15',
} as const

const incidents = [
  {
    title: 'Minor Earthquake - East Zone',
    time: '10:00 PM',
    status: 'resolved',
    color: hazardColors.EQ,
    code: 'EQ',
    location: 'East Zone, Lucena City',
    severity: 'Low',
    responseTeam: 'Seismic Assessment Unit',
    description: 'Mild aftershock recorded. No structural damages reported after initial checks.',
    coordinates: [13.947, 121.632] as [number, number],
  },
  {
    title: 'Building Fire - Commercial District',
    time: '7:15 AM',
    status: 'active',
    color: hazardColors.FR,
    code: 'FR',
    location: 'Commercial District, Lucena City',
    severity: 'High',
    responseTeam: 'BFP Lucena Station 1',
    description: 'Active fire response ongoing. Adjacent establishments advised to evacuate temporarily.',
    coordinates: [13.934, 121.621] as [number, number],
  },
  {
    title: 'Multi-vehicle Accident - Highway',
    time: '9:00 AM',
    status: 'pending',
    color: hazardColors.AC,
    code: 'AC',
    location: 'Pan-Philippine Highway, Lucena City',
    severity: 'Moderate',
    responseTeam: 'Traffic and Rescue Coordination',
    description: 'Lane obstruction in place. Clearing and medical triage underway for involved motorists.',
    coordinates: [13.926, 121.609] as [number, number],
  },
  {
    title: 'Aftershock - East Zone',
    time: '1:00 AM',
    status: 'resolved',
    color: hazardColors.EQ,
    code: 'EQ',
    location: 'East Zone, Lucena City',
    severity: 'Low',
    responseTeam: 'Seismic Assessment Unit',
    description: 'Follow-up tremor concluded. Monitoring remains active with no reported casualties.',
    coordinates: [13.952, 121.639] as [number, number],
  },
  {
    title: 'Structural Fire - Barangay 10',
    time: '5:30 AM',
    status: 'active',
    color: hazardColors.FR,
    code: 'FR',
    location: 'Barangay 10, Lucena City',
    severity: 'High',
    responseTeam: 'BFP Lucena Rapid Unit',
    description: 'Fire suppression in progress. Perimeter control established to protect nearby residences.',
    coordinates: [13.941, 121.614] as [number, number],
  },
  {
    title: 'Road Collision - Diversion Road',
    time: '8:40 AM',
    status: 'pending',
    color: hazardColors.AC,
    code: 'AC',
    location: 'Diversion Road, Lucena City',
    severity: 'Moderate',
    responseTeam: 'PNP Traffic Unit',
    description: 'Two-vehicle collision reported. Tow support requested and traffic rerouting initiated.',
    coordinates: [13.918, 121.626] as [number, number],
  },
  {
    title: 'Seismic Tremor - North Sector',
    time: '11:45 PM',
    status: 'resolved',
    color: hazardColors.EQ,
    code: 'EQ',
    location: 'North Sector, Lucena City',
    severity: 'Low',
    responseTeam: 'City Geohazard Desk',
    description: 'Short tremor detected by local sensors. Advisory issued, no emergency escalation needed.',
    coordinates: [13.963, 121.618] as [number, number],
  },
  {
    title: 'Warehouse Fire - Industrial Zone',
    time: '2:20 AM',
    status: 'active',
    color: hazardColors.FR,
    code: 'FR',
    location: 'Industrial Zone, Lucena City',
    severity: 'Critical',
    responseTeam: 'Joint Fire Response Taskforce',
    description: 'Large structure fire with dense smoke plume. Multi-unit suppression and evacuation ongoing.',
    coordinates: [13.929, 121.642] as [number, number],
  },
]

type IncidentItem = (typeof incidents)[number]
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
}

function getEarthquakeSeverity(magnitude: number): IncidentItem['severity'] {
  if (magnitude >= 5) return 'Critical'
  if (magnitude >= 4) return 'High'
  if (magnitude >= 3) return 'Moderate'
  return 'Low'
}

function getEarthquakeDescription(event: EarthquakeEvent): string {
  if (event.magnitude >= 5) {
    return `Strong seismic event detected near ${event.place}. Depth ${event.depth.toFixed(1)} km. Immediate structural assessment recommended.`
  }
  if (event.magnitude >= 4) {
    return `Moderate earthquake recorded near ${event.place}. Depth ${event.depth.toFixed(1)} km with potential light shaking.`
  }
  return `Minor-to-light seismic activity near ${event.place}. Depth ${event.depth.toFixed(1)} km. Monitoring remains active.`
}

export function DisasterMapPage({ variant = 'public' }: { variant?: 'public' | 'admin' }) {
  const navigate = useNavigate()
  const isAdminVariant = variant === 'admin'
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const [selectedIncident, setSelectedIncident] = useState<IncidentItem | null>(null)
  const [selectedType, setSelectedType] = useState<IncidentTypeFilter>('EQ')
  const [earthquakeEvents, setEarthquakeEvents] = useState<EarthquakeEvent[]>([])
  const [eqHeatPoints, setEqHeatPoints] = useState<HeatPoint[]>([])
  const [eqFetchStatus, setEqFetchStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [showHeatmap, setShowHeatmap] = useState(true)
  const [eqLastRefreshed, setEqLastRefreshed] = useState<Date | null>(null)
  const [eqIsRefreshing, setEqIsRefreshing] = useState(false)
  const [eqSearchQuery, setEqSearchQuery] = useState('')
  const filteredIncidents = incidents.filter((incident) => incident.code === selectedType)
  const earthquakeIncidentCards = useMemo(
    () =>
      [...earthquakeEvents]
        .sort((a, b) => b.rawTimestamp - a.rawTimestamp)
        .map((event) => ({
          title: `Earthquake Event - ${event.place}`,
          time: event.time,
          color: hazardColors.EQ,
          code: 'EQ' as const,
          location: event.place,
          severity: getEarthquakeSeverity(event.magnitude),
          responseTeam: 'Seismic Assessment Unit',
          description: getEarthquakeDescription(event),
          coordinates: [event.lat, event.lng] as [number, number],
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

  function handleIncidentClick(incident: IncidentItem) {
    if (!isAdminVariant && !isAuthenticated()) {
      navigate('/login')
      return
    }
    setSelectedIncident(incident)
  }

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

    // Always draw Lucena City reference boundary
    L.rectangle(lucenaBounds, {
      color: '#4f81bd',
      weight: 2,
      fillColor: '#2f5f93',
      fillOpacity: 0.06,
      dashArray: '6 5',
    }).addTo(map)

    if (isEqView) {
      // ── Earthquake heatmap (Quezon / Southern Luzon region) ──
      if (showHeatmap && eqHeatPoints.length > 0) {
        L.heatLayer(eqHeatPoints, {
          minOpacity: 0.35,
          radius: 28,
          blur: 22,
          max: 1.0,
          gradient: { 0.2: '#3b82f6', 0.45: '#06b6d4', 0.65: '#22c55e', 0.8: '#facc15', 1.0: '#ef4444' },
        }).addTo(map)
      }

      // Individual earthquake markers (magnitude ≥ 3.5 shown as circle markers)
      const significantEvents = earthquakeEvents.filter((e) => e.magnitude >= 3.5)
      significantEvents.forEach((event) => {
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
            `<strong>M${event.magnitude.toFixed(1)}</strong><br/>${event.place}<br/><small>${event.time}</small><br/><small>Depth: ${event.depth.toFixed(1)} km</small>`,
          )
      })

      if (eqFetchStatus === 'loading') {
        L.popup({ closeButton: false })
          .setLatLng([14.3, 121.5])
          .setContent('<p style="margin:0;font-size:12px">Loading PHIVOLCS/USGS seismic data…</p>')
          .openOn(map)
      }
    } else {
      // ── Fire / Accident / All incident markers ──
      filteredIncidents.forEach((incident) => {
        L.circleMarker(incident.coordinates, {
          radius: 14,
          stroke: false,
          fillColor: incident.color,
          fillOpacity: 0.24,
          interactive: false,
        }).addTo(map)

        if (incident.status === 'active') {
          L.circleMarker(incident.coordinates, {
            radius: 10,
            color: incident.color,
            weight: 2,
            fillColor: incident.color,
            fillOpacity: 0.18,
            interactive: false,
            className: 'hazard-marker-pulse',
          }).addTo(map)
        }

        L.circleMarker(incident.coordinates, {
          radius: 7,
          color: '#ffffff',
          weight: 1.5,
          fillColor: incident.color,
          fillOpacity: 0.98,
        })
          .addTo(map)
          .bindPopup(`<strong>${incident.title}</strong><br/>${incident.time}`)
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
  }, [filteredIncidents, selectedType, eqHeatPoints, earthquakeEvents, eqFetchStatus, showHeatmap])

  return (
    <div className={isAdminVariant ? 'min-h-screen bg-[radial-gradient(circle_at_top,_#2a3144_0%,_#181c23_48%,_#11161f_100%)] text-slate-100 md:flex' : 'min-h-screen bg-[radial-gradient(circle_at_top,_#e7f1fc_0%,_#f4f8fd_34%,_#eef3f8_100%)] text-slate-800'}>
      {isAdminVariant ? <AdminSidebar activeKey="gisMapping" /> : null}

      <main className={isAdminVariant ? 'flex-1' : ''}>
        {isAdminVariant ? (
          <div className="border-b border-slate-700/70 bg-[#1a2030]/90 backdrop-blur">
            <div className="mx-auto w-full max-w-7xl px-6 py-5 sm:px-10">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-200/70">Admin Operations</p>
              <h1 className="mt-1 text-2xl font-black text-white">Disaster Map Console</h1>
            </div>
          </div>
        ) : (
          <NavigationBar variant="hero" />
        )}

      <div className="w-full px-0 py-0">
        <section className={`${isAdminVariant ? 'border-b border-slate-700/70 bg-[linear-gradient(135deg,#1f2738_0%,#232f45_55%,#1a2130_100%)]' : 'border-b border-slate-200 bg-[linear-gradient(135deg,#eff6ff_0%,#f9fcff_55%,#eef4fb_100%)]'} px-6 py-10 sm:px-10 sm:py-12`}>
          <div className="mx-auto w-full max-w-7xl">
            <p className={`inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.15em] ${isAdminVariant ? 'border border-cyan-300/30 bg-cyan-300/10 text-cyan-100' : 'border border-[#1f4e80]/25 bg-[#1f4e80]/10 text-[#1f4e80]'}`}>
              {isAdminVariant ? 'Hazard Mapping Control' : 'Lucena City DRRMO Monitoring Desk'}
            </p>
            <h1 className={`mt-3 text-3xl font-black tracking-tight sm:text-4xl ${isAdminVariant ? 'text-white' : 'text-slate-900'}`}>Disaster Incident Map</h1>
            <p className={`mt-2 max-w-3xl text-sm leading-relaxed sm:text-base ${isAdminVariant ? 'text-slate-300' : 'text-slate-600'}`}>
              {isAdminVariant
                ? 'Admin-side incident mapping for validation, field review, and operational hazard monitoring within Lucena City.'
                : 'Official incident mapping interface for situational awareness, response tracking, and incident verification within Lucena City.'}
            </p>
          </div>
        </section>

        <section className={`w-full px-4 py-4 sm:px-5 ${isAdminVariant ? 'border-b border-slate-700/70 bg-transparent' : 'border-b border-slate-200 bg-transparent'}`}>
          <div className={`mx-auto flex w-full max-w-7xl flex-wrap items-center gap-2 rounded-2xl p-3 shadow-[0_10px_28px_rgba(15,23,42,0.12)] sm:p-4 ${isAdminVariant ? 'border border-slate-600/70 bg-[#202a3d]/90' : 'border border-slate-200 bg-white/90 backdrop-blur'}`}>
            <p className="mr-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-600">Incident Type Mapping</p>
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
          </div>
        </section>

        <section className={`w-full p-4 sm:p-5 ${isAdminVariant ? 'bg-transparent' : 'bg-transparent'}`}>
          <div className="grid w-full gap-4 xl:grid-cols-[minmax(0,2.3fr)_minmax(380px,1fr)]">
            <div className={`overflow-hidden rounded-3xl shadow-[0_20px_44px_rgba(15,23,42,0.16)] ${isAdminVariant ? 'border border-slate-600/70 bg-[#202a3d]/95' : 'border border-slate-200 bg-white/95 backdrop-blur'}`}>
              <div className={`flex items-center justify-between gap-3 px-4 py-3 ${isAdminVariant ? 'border-b border-slate-600/70 bg-[linear-gradient(90deg,#1f2a3f_0%,#24344e_100%)]' : 'border-b border-slate-200 bg-[linear-gradient(90deg,#e5f0ff_0%,#f4f9ff_100%)]'}`}>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#1e4f86]">Operational Map View</p>
                  {selectedType === 'EQ' ? (
                    <p className="mt-0.5 text-[11px] text-slate-500">Quezon Province seismic view — Lucena City highlighted</p>
                  ) : (
                    <p className="mt-0.5 text-[11px] text-slate-500">Lucena City boundary</p>
                  )}
                </div>
                {selectedType === 'EQ' ? (
                  <button
                    className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold transition ${
                      showHeatmap
                        ? 'border-emerald-400 bg-emerald-50 text-emerald-800'
                        : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                    onClick={() => setShowHeatmap((v) => !v)}
                    type="button"
                  >
                    {showHeatmap ? '🌡 Heatmap ON' : '🌡 Heatmap OFF'}
                  </button>
                ) : null}
              </div>

              {selectedType === 'EQ' ? (
                <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2 text-[11px]">
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
                    <span className="text-slate-600">Critical seismic zone</span>
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
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-4 border-b border-slate-200 px-4 py-2 text-xs text-slate-600">
                  {(Object.keys(incidentTypeMeta) as IncidentTypeFilter[]).map((typeCode) => (
                    <div className="flex items-center gap-1.5" key={typeCode}>
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full shadow-[0_0_8px_rgba(148,163,184,0.5)]"
                        style={{ backgroundColor: incidentTypeMeta[typeCode].color }}
                      />
                      <span className="font-semibold text-slate-700">{incidentTypeMeta[typeCode].label}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="h-[520px] w-full sm:h-[640px]" ref={mapContainerRef} />
            </div>

            <aside className={`h-full max-h-[740px] rounded-3xl p-4 shadow-[0_20px_44px_rgba(15,23,42,0.16)] sm:p-5 ${isAdminVariant ? 'border border-slate-600/70 bg-[#202a3d]/95' : 'border border-slate-200 bg-white/95 backdrop-blur'}`}>
              {selectedType === 'EQ' ? (
                // ── Earthquake sidebar ──
                <div className="flex h-full min-h-0 flex-col">
                  <div className={`pb-3 ${isAdminVariant ? 'border-b border-slate-700' : 'border-b border-slate-200'}`}>
                    <div className="flex items-center justify-between">
                      <h2 className={`text-xl font-bold ${isAdminVariant ? 'text-white' : 'text-slate-900'}`}>Seismic Events</h2>
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                        {eqFetchStatus === 'loading' ? '…' : earthquakeEvents.length}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      USGS / PHIVOLCS · Quezon Province
                      {eqLastRefreshed
                        ? ` · Updated ${eqLastRefreshed.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
                        : ''}
                    </p>
                    <p className="mt-0.5 text-[10px] text-slate-400">Auto-refreshes every 5 minutes</p>
                  </div>

                  <div className="min-h-0 flex-1 pb-3">
                  {eqFetchStatus === 'loading' ? (
                    <div className="mt-6 flex flex-col items-center gap-3 py-6 text-center">
                      <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-400 border-t-transparent" />
                      <p className="text-sm text-slate-500">Fetching seismic data from USGS…</p>
                    </div>
                  ) : eqFetchStatus === 'error' ? (
                    <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-center">
                      <p className="text-sm font-semibold text-red-800">Failed to load seismic data</p>
                      <p className="mt-1 text-xs text-red-700">Check your connection and try again.</p>
                      <button
                        className="mt-3 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-800 hover:bg-red-50"
                        onClick={() => void loadEarthquakes()}
                        type="button"
                      >
                        Retry
                      </button>
                    </div>
                  ) : earthquakeEvents.length === 0 ? (
                    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center">
                      <p className="text-sm font-semibold text-slate-700">No events recorded</p>
                      <p className="mt-1 text-xs text-slate-500">No earthquakes (M≥1.0) in the past 30 days.</p>
                    </div>
                  ) : (
                    <>
                      <div className="mt-3">
                        <label className="sr-only" htmlFor="eq-place-search">
                          Search place with earthquake occurrences
                        </label>
                        <div className="flex items-center gap-2 rounded-xl border border-[#0b2a57]/20 bg-[linear-gradient(135deg,#ffffff_0%,#f5f9ff_100%)] px-3 py-2.5 shadow-[0_10px_20px_rgba(15,23,42,0.08)] transition focus-within:border-[#0b2a57]/45 focus-within:ring-2 focus-within:ring-[#0b2a57]/10">
                          <input
                            className="w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
                            id="eq-place-search"
                            onChange={(event) => setEqSearchQuery(event.target.value)}
                            placeholder="Search place (Lucena, Tayabas, Quezon)"
                            type="text"
                            value={eqSearchQuery}
                          />
                          <span className="rounded-full border border-[#0b2a57]/20 bg-[#0b2a57]/5 px-2 py-1 text-[10px] font-bold text-[#0b2a57]">
                            {filteredEarthquakeIncidentCards.length}/{earthquakeIncidentCards.length}
                          </span>
                        </div>
                      </div>

                      <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.14em] text-[#0b2a57]">Earthquake Occurrences</p>
                      <div
                        className="mt-2 max-h-[500px] space-y-2 overflow-y-auto pb-5 pr-1 [scrollbar-width:thin] [scrollbar-color:#86efac_transparent] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-slate-200/60 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-emerald-300 [&::-webkit-scrollbar-thumb]:border [&::-webkit-scrollbar-thumb]:border-white [&::-webkit-scrollbar-thumb]:hover:bg-emerald-400"
                      >
                        {filteredEarthquakeIncidentCards.length === 0 ? (
                          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center text-xs text-slate-500">
                            No matching place found.
                          </div>
                        ) : filteredEarthquakeIncidentCards.map((incident) => (
                          <article
                            className={`group w-full rounded-xl p-3 transition duration-150 ${isAdminVariant ? 'border border-slate-700 bg-[#1d2230] hover:border-slate-500' : 'border border-slate-200 bg-[#fbfdff] hover:border-slate-300 hover:bg-white'}`}
                            key={`${incident.title}-${incident.time}`}
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
                                  <p className={`truncate text-sm font-semibold ${isAdminVariant ? 'text-white' : 'text-slate-900'}`}>{incident.title}</p>
                                </div>
                                <p className="mt-1 pl-7 text-xs text-slate-500">{incident.time}</p>
                                <p className="mt-1 pl-7 text-xs text-slate-500">{incident.location}</p>
                              </div>
                            </div>
                            <p className="mt-2 pl-7 text-xs text-slate-600">{incident.description}</p>
                            <div className="mt-3 pl-7">
                              <button
                                className="rounded-md border border-[#234d77]/30 bg-white px-2.5 py-1.5 text-xs font-semibold text-[#234d77] transition hover:border-[#234d77]/50 hover:bg-[#edf3fa]"
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

                  <p className="mt-3 border-t border-slate-200/70 pt-3 text-[11px] text-slate-400">
                    Data: USGS FDSN (same events monitored by PHIVOLCS). Auto-refreshes every 5 min.
                  </p>
                </div>
              ) : (
                // ── Standard incident sidebar ──
                <>
                  <div className={`pb-3 ${isAdminVariant ? 'border-b border-slate-700' : 'border-b border-slate-200'}`}>
                    <div className="flex items-center justify-between">
                      <h2 className={`text-xl font-bold ${isAdminVariant ? 'text-white' : 'text-slate-900'}`}>Incident Log</h2>
                      <span className="rounded-full bg-[#e8f2fc] px-2.5 py-1 text-xs font-semibold text-[#245785]">{filteredIncidents.length}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">Validated updates from mapped response zones</p>
                  </div>

                  <div className="mt-4 max-h-[500px] space-y-3 overflow-y-auto pr-1 [scrollbar-width:thin] [scrollbar-color:#93c5fd_transparent] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-slate-200/60 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-blue-300 [&::-webkit-scrollbar-thumb]:border [&::-webkit-scrollbar-thumb]:border-white [&::-webkit-scrollbar-thumb]:hover:bg-blue-400">
                    {filteredIncidents.map((incident) => (
                      <article
                        className={`group w-full rounded-xl p-3 transition duration-150 ${isAdminVariant ? 'border border-slate-700 bg-[#1d2230] hover:border-slate-500' : 'border border-slate-200 bg-[#fbfdff] hover:border-slate-300 hover:bg-white'}`}
                        key={incident.title}
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
                              <p className={`truncate text-sm font-semibold ${isAdminVariant ? 'text-white' : 'text-slate-900'}`}>{incident.title}</p>
                            </div>
                            <p className="mt-1 pl-7 text-xs text-slate-500">{incident.time}</p>
                          </div>

                          <span
                            className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${statusClassByType[incident.status]}`}
                          >
                            {incident.status}
                          </span>
                        </div>

                        <div className="mt-3 pl-7">
                          <button
                            className="rounded-md border border-[#234d77]/30 bg-white px-2.5 py-1.5 text-xs font-semibold text-[#234d77] transition hover:border-[#234d77]/50 hover:bg-[#edf3fa]"
                            onClick={() => handleIncidentClick(incident)}
                            type="button"
                          >
                            View Info
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                  <p className="mt-4 text-xs text-slate-500">
                    {isAdminVariant
                      ? 'Admin console can open and review any mapped incident without redirecting to public screens.'
                      : 'Public incident summaries are visible. Login is required to open full incident information.'}
                  </p>
                </>
              )}
            </aside>
          </div>
        </section>
      </div>

        {selectedIncident ? (
        <div className="fixed inset-0 z-[1300] bg-slate-200/55 p-4 backdrop-blur-[1px] sm:p-8" onClick={() => setSelectedIncident(null)}>
          <div className="mx-auto mt-8 w-full max-w-3xl" onClick={(event) => event.stopPropagation()}>
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_20px_40px_rgba(15,23,42,0.22)] sm:p-6">
              <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.15em] text-slate-500">Incident Details</p>
                  <h3 className="mt-1 text-xl font-black text-slate-900 sm:text-2xl">{selectedIncident.title}</h3>
                </div>
                <button
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                  onClick={() => setSelectedIncident(null)}
                  type="button"
                >
                  Close
                </button>
              </div>

              <p className="mt-4 text-sm leading-relaxed text-slate-600 sm:text-base">{selectedIncident.description}</p>

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
                  <span className="font-semibold text-slate-800">Response Team:</span> {selectedIncident.responseTeam}
                </p>
              </div>
            </section>
          </div>
        </div>
        ) : null}
      </main>
    </div>
  )
}