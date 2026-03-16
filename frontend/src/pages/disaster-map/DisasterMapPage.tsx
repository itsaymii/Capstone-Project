import { useEffect, useRef, useState } from 'react'
import L, { type LatLngBoundsExpression } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { AdminSidebar } from '../../components/AdminSidebar'
import { NavigationBar } from '../../components/NavigationBar'
import { useNavigate } from 'react-router-dom'
import { isAuthenticated } from '../../services/auth'

const lucenaBounds: LatLngBoundsExpression = [
  [13.89, 121.57],
  [13.98, 121.69],
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
type IncidentTypeFilter = 'all' | 'EQ' | 'FR' | 'AC'

const incidentTypeMeta: Record<Exclude<IncidentTypeFilter, 'all'>, { label: string; color: string }> = {
  EQ: { label: 'Earthquake', color: hazardColors.EQ },
  FR: { label: 'Fire', color: hazardColors.FR },
  AC: { label: 'Accident', color: hazardColors.AC },
}

const statusClassByType: Record<string, string> = {
  active: 'border border-red-200 bg-red-50 text-red-800',
  resolved: 'border border-emerald-200 bg-emerald-50 text-emerald-800',
  pending: 'border border-amber-200 bg-amber-50 text-amber-800',
}

export function DisasterMapPage({ variant = 'public' }: { variant?: 'public' | 'admin' }) {
  const navigate = useNavigate()
  const isAdminVariant = variant === 'admin'
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const [selectedIncident, setSelectedIncident] = useState<IncidentItem | null>(null)
  const [selectedType, setSelectedType] = useState<IncidentTypeFilter>('all')
  const activeCount = incidents.filter((incident) => incident.status === 'active').length
  const pendingCount = incidents.filter((incident) => incident.status === 'pending').length
  const resolvedCount = incidents.filter((incident) => incident.status === 'resolved').length
  const filteredIncidents = selectedType === 'all' ? incidents : incidents.filter((incident) => incident.code === selectedType)

  function handleIncidentClick(incident: IncidentItem) {
    if (!isAdminVariant && !isAuthenticated()) {
      navigate('/login')
      return
    }
    setSelectedIncident(incident)
  }

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
      // Draw a soft halo first so each hazard point feels easier to spot.
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

    window.setTimeout(() => {
      map.invalidateSize()
    }, 0)

    mapInstanceRef.current = map

    return () => {
      map.remove()
      mapInstanceRef.current = null
    }
  }, [filteredIncidents])

  return (
    <div className={isAdminVariant ? 'min-h-screen bg-[#181c23] text-slate-100 md:flex' : 'min-h-screen bg-[#f1f5f9] text-slate-800'}>
      {isAdminVariant ? <AdminSidebar activeKey="gisMapping" /> : null}

      <main className={isAdminVariant ? 'flex-1' : ''}>
        {isAdminVariant ? (
          <div className="border-b border-slate-800 bg-[#181c23]">
            <div className="mx-auto w-full max-w-7xl px-6 py-5 sm:px-10">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Admin Operations</p>
              <h1 className="mt-1 text-2xl font-black text-white">Disaster Map Console</h1>
            </div>
          </div>
        ) : (
          <NavigationBar variant="hero" />
        )}

      <div className="w-full px-0 py-0">
        <section className={`${isAdminVariant ? 'border-b border-slate-800 bg-[#1d2230]' : 'border-b border-slate-300 bg-[#f7fafd]'} px-6 py-10 sm:px-10 sm:py-12`}>
          <div className="mx-auto w-full max-w-7xl">
            <p className={`inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.15em] ${isAdminVariant ? 'border border-blue-500/30 bg-blue-500/10 text-blue-200' : 'border border-[#234d77]/25 bg-[#234d77]/10 text-[#234d77]'}`}>
              {isAdminVariant ? 'Hazard Mapping Control' : 'Lucena City DRRMO Monitoring Desk'}
            </p>
            <h1 className={`mt-3 text-3xl font-black tracking-tight sm:text-4xl ${isAdminVariant ? 'text-white' : 'text-slate-900'}`}>Disaster Incident Map</h1>
            <p className={`mt-2 max-w-3xl text-sm leading-relaxed sm:text-base ${isAdminVariant ? 'text-slate-300' : 'text-slate-600'}`}>
              {isAdminVariant
                ? 'Admin-side incident mapping for validation, field review, and operational hazard monitoring within Lucena City.'
                : 'Official incident mapping interface for situational awareness, response tracking, and incident verification within Lucena City.'}
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className={`rounded-2xl px-4 py-3 ${isAdminVariant ? 'border border-slate-700 bg-[#232837]' : 'border border-slate-300 bg-white'}`}>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Total Reports</p>
                <p className={`mt-1 text-2xl font-black ${isAdminVariant ? 'text-white' : 'text-slate-900'}`}>{incidents.length}</p>
              </div>
              <div className={`rounded-2xl px-4 py-3 ${isAdminVariant ? 'border border-red-500/30 bg-red-500/10' : 'border border-[#f3c7c7] bg-[#fff5f5]'}`}>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#9f2f2f]">Active</p>
                <p className="mt-1 text-2xl font-black text-[#8f2424]">{activeCount}</p>
              </div>
              <div className={`rounded-2xl px-4 py-3 ${isAdminVariant ? 'border border-amber-500/30 bg-amber-500/10' : 'border border-[#efd8b0] bg-[#fff8ed]'}`}>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#946121]">Pending</p>
                <p className="mt-1 text-2xl font-black text-[#7f5015]">{pendingCount}</p>
              </div>
              <div className={`rounded-2xl px-4 py-3 ${isAdminVariant ? 'border border-emerald-500/30 bg-emerald-500/10' : 'border border-[#bfe3ca] bg-[#effaf3]'}`}>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#2b6a47]">Resolved</p>
                <p className="mt-1 text-2xl font-black text-[#245a3b]">{resolvedCount}</p>
              </div>
            </div>
          </div>
        </section>

        <section className={`w-full px-4 py-4 sm:px-5 ${isAdminVariant ? 'border-b border-slate-800 bg-[#181c23]' : 'border-b border-slate-300 bg-[#f1f5f9]'}`}>
          <div className={`mx-auto flex w-full max-w-7xl flex-wrap items-center gap-2 rounded-2xl p-3 sm:p-4 ${isAdminVariant ? 'border border-slate-700 bg-[#232837]' : 'border border-slate-300 bg-white'}`}>
            <p className="mr-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-600">Incident Type Mapping</p>
            <button
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                selectedType === 'all'
                  ? 'border-[#8bb5de] bg-[#e8f2fc] text-[#245785]'
                  : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400'
              }`}
              onClick={() => setSelectedType('all')}
              type="button"
            >
              All
            </button>

            {(Object.keys(incidentTypeMeta) as Array<Exclude<IncidentTypeFilter, 'all'>>).map((typeCode) => (
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

        <section className={`w-full p-4 sm:p-5 ${isAdminVariant ? 'bg-[#181c23]' : 'bg-[#f1f5f9]'}`}>
          <div className="grid w-full gap-4 xl:grid-cols-[minmax(0,2.3fr)_minmax(380px,1fr)]">
            <div className={`overflow-hidden rounded-3xl shadow-[0_14px_30px_rgba(15,23,42,0.12)] ${isAdminVariant ? 'border border-slate-700 bg-[#232837]' : 'border border-slate-200 bg-white'}`}>
              <div className={`flex items-center justify-between px-4 py-3 ${isAdminVariant ? 'border-b border-slate-700 bg-[#1d2230]' : 'border-b border-slate-200 bg-[linear-gradient(90deg,#e8f1fd_0%,#f6fbff_100%)]'}`}>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#1e4f86]">Operational Map View</p>
                <p className="text-xs font-semibold text-slate-600">Lucena City Boundary</p>
              </div>

              <div className="flex flex-wrap items-center gap-4 border-b border-slate-200 px-4 py-2 text-xs text-slate-600">
                {(Object.keys(incidentTypeMeta) as Array<Exclude<IncidentTypeFilter, 'all'>>).map((typeCode) => (
                  <div className="flex items-center gap-1.5" key={typeCode}>
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full shadow-[0_0_8px_rgba(148,163,184,0.5)]"
                      style={{ backgroundColor: incidentTypeMeta[typeCode].color }}
                    />
                    <span className="font-semibold text-slate-700">{incidentTypeMeta[typeCode].label}</span>
                  </div>
                ))}
              </div>

              <div className="h-[520px] w-full sm:h-[640px]" ref={mapContainerRef} />
            </div>

            <aside className={`h-full max-h-[688px] rounded-3xl p-4 shadow-[0_14px_30px_rgba(15,23,42,0.12)] sm:p-5 ${isAdminVariant ? 'border border-slate-700 bg-[#232837]' : 'border border-slate-200 bg-white'}`}>
              <div className={`pb-3 ${isAdminVariant ? 'border-b border-slate-700' : 'border-b border-slate-200'}`}>
                <div className="flex items-center justify-between">
                  <h2 className={`text-xl font-bold ${isAdminVariant ? 'text-white' : 'text-slate-900'}`}>Incident Log</h2>
                  <span className="rounded-full bg-[#e8f2fc] px-2.5 py-1 text-xs font-semibold text-[#245785]">{filteredIncidents.length}</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">Validated updates from mapped response zones</p>
              </div>

              <div className="mt-4 max-h-[500px] space-y-3 overflow-y-auto pr-1">
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