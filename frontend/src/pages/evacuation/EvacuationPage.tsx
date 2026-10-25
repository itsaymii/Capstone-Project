import { useEffect, useMemo, useState } from 'react'
import { CircleMarker, MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'
import { icon } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { getEvacuationCenters, getNearbyEvacuationCenters } from '../../services/api'
import type { EvacuationCenter, EvacuationCenterStatus, EvacuationCenterWithDistance } from '../../types/api'
import {
  EVACUATION_STATUS_BADGE_CLASSES,
  EVACUATION_STATUS_LABELS,
  NEARBY_CENTER_COUNT,
  describeOccupancy,
  isAcceptingEvacuees,
  rankNearbyCenters,
} from '../../data/evacuation'
import { NavigationBar } from '../../components/NavigationBar'
import { Link } from 'react-router-dom'
import { AUTH_CHANGED_EVENT, isAuthenticated } from '../../services/auth'

const lucenaCenter: [number, number] = [13.94, 121.62]
const lucenaBounds: [[number, number], [number, number]] = [
  [13.88, 121.54],
  [14.0, 121.7],
]

const createHouseIcon = (color: string) =>
  icon({
    iconUrl: `data:image/svg+xml,${encodeURIComponent(
      `<svg width="34" height="34" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 3.5 4 9.5v10.5h5v-6h6v6h5V9.5L12 3.5Z" fill="${color}"/><path d="M8 14.5h8v5H8v-5Z" fill="#ffffff" opacity="0.9"/><path d="M9.5 13.5h5v-3h-5v3Z" fill="#ffffff" opacity="0.8"/><path d="M12 7l4 3.3H8L12 7Z" fill="#ffffff" opacity="0.6"/></svg>`,
    )}`,
    iconSize: [34, 34],
    iconAnchor: [17, 34],
    popupAnchor: [0, -30],
  })

// Marker colour follows the status so residents can spot centers that are not accepting people.
const statusMarkerIcons: Record<EvacuationCenterStatus, ReturnType<typeof icon>> = {
  available: createHouseIcon('#1d4ed8'),
  full: createHouseIcon('#d97706'),
  maintenance: createHouseIcon('#ea580c'),
  closed: createHouseIcon('#e11d48'),
}

type LocationState = 'idle' | 'locating' | 'ready' | 'denied' | 'unsupported'

type NearbyState = {
  results: EvacuationCenterWithDistance[]
  notAcceptingNearby: EvacuationCenterWithDistance[]
}

function directionsUrl(center: EvacuationCenter): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${center.latitude},${center.longitude}`
}

/** Moves the map to the selected center. */
function FlyToCenter({ target }: { target: [number, number] | null }) {
  const map = useMap()

  useEffect(() => {
    if (target) map.flyTo(target, Math.max(map.getZoom(), 15), { duration: 0.6 })
  }, [map, target])

  return null
}

function OccupancyDetails({ center }: { center: EvacuationCenter }) {
  const occupancy = describeOccupancy(center)

  return (
    <div>
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-semibold text-slate-700">{occupancy.label}</span>
        {occupancy.slotsLabel ? <span className="font-medium text-slate-500">{occupancy.slotsLabel}</span> : null}
      </div>
      {occupancy.percent !== null ? (
        <div
          className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200"
          role="progressbar"
          aria-label={`${center.name} occupancy`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={occupancy.percent}
        >
          <div className={`h-full rounded-full ${occupancy.barClass}`} style={{ width: `${occupancy.percent}%` }} />
        </div>
      ) : null}
    </div>
  )
}

function StatusBadge({ status }: { status: EvacuationCenterStatus }) {
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] ${EVACUATION_STATUS_BADGE_CLASSES[status]}`}
    >
      {EVACUATION_STATUS_LABELS[status]}
    </span>
  )
}

export function EvacuationPage() {
  const [centers, setCenters] = useState<EvacuationCenter[]>([])
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null)
  const [locationState, setLocationState] = useState<LocationState>('idle')
  const [nearby, setNearby] = useState<NearbyState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [flyTarget, setFlyTarget] = useState<[number, number] | null>(null)
  const [authenticated, setAuthenticated] = useState(() => isAuthenticated())

  // Recommendations are only for logged-in users. Logged-out visitors see the map only.
  const locateNearestCenters = () => {
    if (!isAuthenticated()) return

    if (!navigator.geolocation) {
      setLocationState('unsupported')
      return
    }

    setLocationState('locating')
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        if (!isAuthenticated()) return
        setUserLocation({ latitude: coords.latitude, longitude: coords.longitude })
        setLocationState('ready')
      },
      () => {
        if (isAuthenticated()) setLocationState('denied')
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    )
  }

  // Follow log in / log out (also from another tab) and clear everything on log out.
  useEffect(() => {
    const syncAuthentication = () => {
      const nextAuthenticated = isAuthenticated()
      setAuthenticated(nextAuthenticated)

      if (!nextAuthenticated) {
        setUserLocation(null)
        setNearby(null)
        setLocationState('idle')
        setFlyTarget(null)
      }
    }

    window.addEventListener(AUTH_CHANGED_EVENT, syncAuthentication)
    window.addEventListener('storage', syncAuthentication)

    return () => {
      window.removeEventListener(AUTH_CHANGED_EVENT, syncAuthentication)
      window.removeEventListener('storage', syncAuthentication)
    }
  }, [])

  // Ask for the location only once the user is logged in.
  useEffect(() => {
    if (!authenticated) return
    const locationRequestId = window.setTimeout(locateNearestCenters, 0)
    return () => window.clearTimeout(locationRequestId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticated])

  useEffect(() => {
    let active = true

    void getEvacuationCenters()
      .then((data) => {
        if (active) setCenters(data)
      })
      .catch(() => {
        if (active) setError('Unable to load evacuation centers at this time. Please try again later.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  // Ask the backend for the nearest centers; if it cannot be reached, work it out in the browser.
  useEffect(() => {
    if (!authenticated || !userLocation) return
    let active = true

    void getNearbyEvacuationCenters(userLocation.latitude, userLocation.longitude, NEARBY_CENTER_COUNT)
      .then((data) => {
        if (active) setNearby({ results: data.results, notAcceptingNearby: data.not_accepting_nearby })
      })
      .catch(() => {
        if (!active || centers.length === 0) return
        const fallback = rankNearbyCenters(centers, userLocation.latitude, userLocation.longitude, NEARBY_CENTER_COUNT)
        setNearby({ results: fallback.results, notAcceptingNearby: fallback.notAcceptingNearby })
      })

    return () => {
      active = false
    }
  }, [authenticated, userLocation, centers])

  const centerCount = centers.length
  const acceptingCount = useMemo(() => centers.filter((center) => isAcceptingEvacuees(center)).length, [centers])

  const summaryText = useMemo(() => {
    if (loading) return 'Loading evacuation locations...'
    if (error) return error
    if (centerCount === 0) return 'No evacuation centers are available yet. Check back later or explore the disaster map for alerts.'
    return `Showing ${centerCount} evacuation center${centerCount === 1 ? '' : 's'} across Lucena City. ${acceptingCount} currently accepting evacuees.`
  }, [acceptingCount, centerCount, error, loading])

  const locationMessage: Record<LocationState, string | null> = {
    idle: null,
    locating: 'Finding evacuation centers near you...',
    ready: null,
    denied: 'Location access was not allowed. Tap the button below and allow location to see the centers nearest you.',
    unsupported: 'This browser cannot share your location. You can still browse all centers on the map.',
  }

  const showCenterOnMap = (center: EvacuationCenter) => setFlyTarget([center.latitude, center.longitude])

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.12)_0%,_rgba(248,250,252,1)_45%)] text-slate-900">
      <NavigationBar />

      <main className="px-6 pb-16 pt-6 sm:px-10 sm:pb-20 sm:pt-8">
        <div className="mx-auto w-full max-w-7xl">
          <div className="mb-6 flex flex-wrap items-center gap-3 text-sm sm:mb-8">
            <Link
              className="inline-flex items-center rounded-full border border-slate-300/90 bg-white/90 px-4 py-2 text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-100"
              to="/landing"
            >
              Back to Home
            </Link>
            <Link
              className="inline-flex items-center rounded-full border border-slate-300/90 bg-white/90 px-4 py-2 text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-100"
              to="/disaster-map"
            >
              View Disaster Map
            </Link>
          </div>

          <section className="overflow-hidden rounded-[2rem] border border-slate-200/90 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
            <div className="border-b border-slate-200/80 bg-slate-50 px-6 py-6 sm:px-8 sm:py-7">
              <div className="max-w-3xl">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Evacuation</p>
                <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">Lucena City Evacuation Centers</h1>
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
                  {authenticated
                    ? `See the ${NEARBY_CENTER_COUNT} evacuation centers nearest you, how full they are, and whether they are accepting evacuees. Tap any marker for details and directions.`
                    : 'Browse evacuation centers across Lucena City. Tap any marker for details and directions.'}
                </p>
              </div>
            </div>

            <div className="p-6 sm:p-8">
              <div className="rounded-[1.75rem] border border-slate-200 bg-slate-50 px-5 py-4 text-sm leading-relaxed text-slate-700">
                {summaryText}
              </div>
            </div>

            <div
              className={`grid gap-4 px-6 pb-6 sm:px-8 sm:pb-8 ${authenticated ? 'lg:grid-cols-[1fr_380px] lg:items-start' : ''}`}
            >
              <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
                <MapContainer
                  center={lucenaCenter}
                  zoom={13}
                  scrollWheelZoom
                  maxBounds={lucenaBounds}
                  maxBoundsViscosity={1.0}
                  minZoom={12}
                  className="h-[420px] w-full sm:h-[680px]"
                >
                  <TileLayer
                    attribution='&copy; <a href="https://osm.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <FlyToCenter target={flyTarget} />

                  {authenticated && userLocation ? (
                    <CircleMarker
                      center={[userLocation.latitude, userLocation.longitude]}
                      radius={9}
                      pathOptions={{ color: '#ffffff', weight: 3, fillColor: '#2563eb', fillOpacity: 1 }}
                    >
                      <Popup>Your approximate location</Popup>
                    </CircleMarker>
                  ) : null}

                  {centers.map((center) => (
                    <Marker key={center.id} position={[center.latitude, center.longitude]} icon={statusMarkerIcons[center.status]}>
                      <Popup minWidth={220}>
                        <div className="min-w-[200px] space-y-2 text-sm text-slate-800">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-base font-semibold leading-snug text-slate-900">{center.name}</p>
                            <StatusBadge status={center.status} />
                          </div>
                          <p className="text-xs">{center.address}</p>
                          <OccupancyDetails center={center} />
                          {center.barangay?.name ? (
                            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{center.barangay.name}</p>
                          ) : null}
                          <a className="text-xs font-semibold text-blue-700" href={directionsUrl(center)} rel="noreferrer" target="_blank">
                            Get directions
                          </a>
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                </MapContainer>
              </div>

              {authenticated ? (
              <aside className="lg:sticky lg:top-6" aria-label="Recommended evacuation centers">
                <div className="flex flex-col overflow-hidden rounded-[2rem] border border-blue-200 bg-white shadow-sm lg:h-[680px]">
                  <div className="shrink-0 border-b border-blue-100 bg-blue-50 px-5 py-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">Recommended near you</p>
                        <p className="mt-1 text-xs text-slate-600">
                          The {NEARBY_CENTER_COUNT} closest centers accepting evacuees, based on your approximate location
                        </p>
                      </div>
                      {nearby && nearby.results.length > 0 ? (
                        <span className="shrink-0 rounded-full bg-blue-700 px-2.5 py-1 text-xs font-bold text-white">
                          {nearby.results.length}
                        </span>
                      ) : null}
                    </div>
                    {locationMessage[locationState] ? (
                      <p className="mt-2 text-xs text-slate-500" role="status">{locationMessage[locationState]}</p>
                    ) : null}
                  </div>

                  <div className="flex-1 overflow-y-auto px-5 py-4">
                    {nearby && nearby.results.length > 0 ? (
                      <>
                        <ol className="space-y-3" aria-label="Nearest evacuation centers">
                          {nearby.results.map((center, index) => {
                            const accepting = isAcceptingEvacuees(center)

                            return (
                              <li
                                key={center.id}
                                className={`rounded-2xl border px-4 py-3 transition ${
                                  accepting
                                    ? 'border-slate-200 bg-slate-50 hover:border-blue-300 hover:bg-blue-50/70'
                                    : 'border-slate-200 bg-slate-100/70 opacity-80'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-start gap-2">
                                    <span
                                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${
                                        accepting ? 'bg-blue-700' : 'bg-slate-400'
                                      }`}
                                    >
                                      {index + 1}
                                    </span>
                                    <h2 className="text-sm font-bold leading-snug text-slate-900">{center.name}</h2>
                                  </div>
                                  <StatusBadge status={center.status} />
                                </div>
                                <p className="mt-1 pl-7 text-xs text-slate-600">{center.address}</p>
                                <p className="mt-1 pl-7 text-xs font-semibold text-blue-800">{center.distance_km.toFixed(2)} km away</p>
                                <div className="mt-2 pl-7">
                                  <OccupancyDetails center={center} />
                                </div>
                                {center.status === 'full' ? (
                                  <p className="mt-2 pl-7 text-[11px] font-semibold text-rose-700">Full: not accepting evacuees right now.</p>
                                ) : null}
                                <div className="mt-2 flex gap-3 pl-7 text-xs font-semibold">
                                  <button type="button" className="text-blue-700 hover:text-blue-900" onClick={() => showCenterOnMap(center)}>
                                    Show on map
                                  </button>
                                  <a className="text-blue-700 hover:text-blue-900" href={directionsUrl(center)} rel="noreferrer" target="_blank">
                                    Get directions
                                  </a>
                                </div>
                              </li>
                            )
                          })}
                        </ol>

                        {nearby.notAcceptingNearby.length > 0 ? (
                          <div className="mt-5">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                              Closer, but not accepting evacuees
                            </p>
                            <ul className="mt-2 space-y-2" aria-label="Nearby centers not accepting evacuees">
                              {nearby.notAcceptingNearby.map((center) => (
                                <li key={center.id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                                  <div className="min-w-0">
                                    <p className="truncate text-xs font-semibold text-slate-700">{center.name}</p>
                                    <p className="text-[11px] text-slate-500">
                                      {center.distance_km.toFixed(2)} km · {describeOccupancy(center).label}
                                    </p>
                                  </div>
                                  <StatusBadge status={center.status} />
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                      </>
                    ) : locationState === 'ready' && !loading && centerCount === 0 ? (
                      <p className="py-8 text-center text-sm text-slate-600">No evacuation centers have been added yet.</p>
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center gap-2 px-2 py-8 text-center">
                        <p className="text-sm text-slate-700">
                          {locationState === 'locating'
                            ? 'Looking for centers near you...'
                            : 'Allow approximate location access to see the evacuation centers nearest you.'}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="shrink-0 border-t border-blue-100 bg-blue-50 px-5 py-4">
                    <button
                      type="button"
                      onClick={locateNearestCenters}
                      disabled={locationState === 'locating'}
                      className="w-full rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {locationState === 'locating'
                        ? 'Finding your location...'
                        : userLocation
                          ? 'Update my location'
                          : 'Use my approximate location'}
                    </button>
                  </div>
                </div>
              </aside>
              ) : null}
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}