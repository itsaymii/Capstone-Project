import { useEffect, useRef, useState } from 'react'
import L, { type LatLngBoundsExpression } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { NavigationBar } from '../../components/NavigationBar'
import { useNavigate } from 'react-router-dom'
import { isAuthenticated } from '../../services/auth'

const lucenaBounds: LatLngBoundsExpression = [
  [13.89, 121.57],
  [13.98, 121.69],
]

const incidents = [
  {
    title: 'Minor Earthquake - East Zone',
    time: '10:00 PM',
    status: 'resolved',
    color: '#22c55e',
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
    color: '#ef4444',
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
    color: '#f59e0b',
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
    color: '#22c55e',
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
    color: '#ef4444',
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
    color: '#f59e0b',
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
    color: '#22c55e',
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
    color: '#ef4444',
    code: 'FR',
    location: 'Industrial Zone, Lucena City',
    severity: 'Critical',
    responseTeam: 'Joint Fire Response Taskforce',
    description: 'Large structure fire with dense smoke plume. Multi-unit suppression and evacuation ongoing.',
    coordinates: [13.929, 121.642] as [number, number],
  },
]

type IncidentItem = (typeof incidents)[number]

const statusClassByType: Record<string, string> = {
  active: 'bg-red-100 text-red-700',
  resolved: 'bg-emerald-100 text-emerald-700',
  pending: 'bg-amber-100 text-amber-700',
}

export function DisasterMapPage() {
  const navigate = useNavigate()
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const [selectedIncident, setSelectedIncident] = useState<IncidentItem | null>(null)

  function handleIncidentClick(incident: IncidentItem) {
    if (!isAuthenticated()) {
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

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO',
    }).addTo(map)

    L.rectangle(lucenaBounds, {
      color: '#60a5fa',
      weight: 2,
      fillColor: '#1d4ed8',
      fillOpacity: 0.06,
      dashArray: '6 5',
    }).addTo(map)

    incidents.forEach((incident) => {
      L.circleMarker(incident.coordinates, {
        radius: 7,
        color: '#ffffff',
        weight: 1,
        fillColor: incident.color,
        fillOpacity: 0.95,
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
  }, [])

  return (
    <main className="min-h-screen bg-[#f7f9fc] text-slate-800">
      <NavigationBar variant="hero" />

      <div className="w-full px-0 py-0">
        <section className="border-b border-slate-200 bg-[radial-gradient(circle_at_top,#ffffff_0%,#f4f8ff_56%,#e9f1fb_100%)] px-6 py-12 sm:px-10 sm:py-14">
          <div className="mx-auto w-full max-w-7xl">
            <p className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-4 py-1 text-xs font-bold uppercase tracking-[0.2em] text-sky-700">
              Live Monitoring
            </p>
            <h1 className="mt-4 text-4xl font-black tracking-tight text-slate-900 sm:text-5xl">Disaster Map Command View</h1>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600 sm:text-lg">
              Real-time incident mapping for Lucena with consolidated status updates and rapid-response visibility.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-2.5 text-sm">
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700">
                Active Feed
              </span>
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700">
                Lucena Bounds Locked
              </span>
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700">
                {incidents.length} Reported Incidents
              </span>
            </div>
          </div>
        </section>

        <section className="w-full border-y border-slate-200 bg-[#f7f9fc] p-4 sm:p-5">
          <div className="grid w-full gap-4 xl:grid-cols-[minmax(0,2.3fr)_minmax(380px,1fr)]">
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.1)]">
              <div className="h-[520px] w-full sm:h-[640px]" ref={mapContainerRef} />
            </div>

            <aside className="h-full rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_18px_40px_rgba(15,23,42,0.1)] sm:p-5">
              <div className="border-b border-slate-200 pb-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-slate-900">Incidents</h2>
                  <span className="rounded-full bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white">{incidents.length}</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">Live updates from mapped response zones</p>
              </div>

              <div className="mt-4 space-y-3">
                {incidents.map((incident) => (
                  <button
                    className="group w-full rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50/80 p-3 text-left transition duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_10px_18px_rgba(15,23,42,0.09)]"
                    key={incident.title}
                    onClick={() => handleIncidentClick(incident)}
                    type="button"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black text-white"
                            style={{ backgroundColor: incident.color }}
                          >
                            {incident.code}
                          </span>
                          <p className="truncate text-sm font-semibold text-slate-900">{incident.title}</p>
                        </div>
                        <p className="mt-1 pl-7 text-xs text-slate-500">{incident.time}</p>
                      </div>

                      <span
                        className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${statusClassByType[incident.status]}`}
                      >
                        {incident.status}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
              <p className="mt-4 text-xs text-slate-500">
                Click an incident to view full details. Login is required before details are shown.
              </p>
            </aside>
          </div>
        </section>
      </div>

      {selectedIncident ? (
        <div className="fixed inset-0 z-[1300] bg-slate-900/45 p-4 backdrop-blur-[1px] sm:p-8" onClick={() => setSelectedIncident(null)}>
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
  )
}