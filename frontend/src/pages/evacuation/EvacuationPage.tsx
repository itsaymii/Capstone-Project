import { useEffect, useMemo, useState } from 'react'
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'
import { icon } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { getEvacuationCenters } from '../../services/api'
import type { EvacuationCenter } from '../../types/api'
import { NavigationBar } from '../../components/NavigationBar'
import { Link } from 'react-router-dom'
import { AUTH_CHANGED_EVENT, isAuthenticated } from '../../services/auth'

const lucenaCenter: [number, number] = [13.94, 121.62]
const lucenaBounds: [[number, number], [number, number]] = [
  [13.88, 121.54],
  [14.0, 121.7],
]

const MAX_RECOMMENDATIONS = 5

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const earthRadiusKm = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return earthRadiusKm * 2 * Math.asin(Math.sqrt(a))
}

const evacuationIcon = icon({
  iconUrl: `data:image/svg+xml,${encodeURIComponent(
    `<svg width="34" height="34" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 3.5 4 9.5v10.5h5v-6h6v6h5V9.5L12 3.5Z" fill="#1d4ed8"/><path d="M8 14.5h8v5H8v-5Z" fill="#ffffff" opacity="0.9"/><path d="M9.5 13.5h5v-3h-5v3Z" fill="#ffffff" opacity="0.8"/><path d="M12 7l4 3.3H8L12 7Z" fill="#ffffff" opacity="0.6"/></svg>`,
  )}`,
  iconSize: [34, 34],
  iconAnchor: [17, 34],
  popupAnchor: [0, -30],
})

const statusBadgeClass = (status: EvacuationCenter['status']): string => {
  if (status === 'available') return 'bg-emerald-100 text-emerald-800'
  if (status === 'full') return 'bg-amber-100 text-amber-800'
  if (status === 'maintenance') return 'bg-orange-100 text-orange-800'
  return 'bg-rose-100 text-rose-800'
}

const statusLabel = (status: EvacuationCenter['status']): string =>
  status === 'maintenance' ? 'Under Maintenance' : status.charAt(0).toUpperCase() + status.slice(1)

export function EvacuationPage() {
  const [centers, setCenters] = useState<EvacuationCenter[]>([])
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [locationMessage, setLocationMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [authenticated, setAuthenticated] = useState(() => isAuthenticated())

  const locateNearestCenter = () => {
    if (!isAuthenticated()) return

    if (!navigator.geolocation) {
      setLocationMessage('Location is not available in this browser. You can still browse all centers below.')
      return
    }

    setLocationMessage('Finding evacuation centers near you...')
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        if (!isAuthenticated()) return
        setUserLocation({ latitude: coords.latitude, longitude: coords.longitude })
        setLocationMessage(null)
      },
      () => {
        if (!isAuthenticated()) return
        setLocationMessage('Location access was not granted. You can still browse all centers below.')
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    )
  }

  useEffect(() => {
    let active = true

    void getEvacuationCenters()
      .then((data) => {
        if (!active) return
        setCenters(Array.isArray(data) ? data : [])
      })
      .catch(() => {
        if (!active) return
        setError('Unable to load evacuation centers at this time. Please try again later.')
      })
      .finally(() => {
        if (!active) return
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    const syncAuthentication = () => {
      const nextAuthenticated = isAuthenticated()
      setAuthenticated(nextAuthenticated)

      if (!nextAuthenticated) {
        setUserLocation(null)
        setLocationMessage(null)
      }
    }

    window.addEventListener(AUTH_CHANGED_EVENT, syncAuthentication)
    window.addEventListener('storage', syncAuthentication)

    return () => {
      window.removeEventListener(AUTH_CHANGED_EVENT, syncAuthentication)
      window.removeEventListener('storage', syncAuthentication)
    }
  }, [])

  useEffect(() => {
    if (!authenticated) return

    const locationRequestId = window.setTimeout(locateNearestCenter, 0)

    return () => window.clearTimeout(locationRequestId)
  }, [authenticated])

  const centerCount = centers.length
  const summaryText = useMemo(() => {
    if (loading) return 'Loading evacuation locations...'
    if (error) return error
    if (centerCount === 0) return 'No evacuation centers are available yet. Check back later or explore the disaster map for alerts.'
    return `Showing ${centerCount} evacuation center${centerCount === 1 ? '' : 's'} across Lucena City.`
  }, [centerCount, error, loading])

  const recommendedCenters = useMemo(() => {
    if (!authenticated || !userLocation || centers.length === 0) return []

    return centers
      .map((center) => ({
        center,
        distanceKm: distanceKm(userLocation.latitude, userLocation.longitude, center.latitude, center.longitude),
      }))
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, MAX_RECOMMENDATIONS)
  }, [authenticated, centers, userLocation])

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
                  Browse evacuation routes and safe shelter points across the city. Tap any marker for details and directions.
                </p>
              </div>
            </div>

            <div className="p-6 sm:p-8">
              <div className="rounded-[1.75rem] border border-slate-200 bg-slate-50 px-5 py-4 text-sm leading-relaxed text-slate-700">
                {summaryText}
              </div>
            </div>

            <div className="grid gap-4 px-6 pb-6 sm:px-8 sm:pb-8 lg:grid-cols-[1fr_360px] lg:items-start">
              <div>
                <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
                  <MapContainer
                    center={lucenaCenter}
                    zoom={13}
                    scrollWheelZoom
                    maxBounds={lucenaBounds}
                    maxBoundsViscosity={1.0}
                    minZoom={12}
                    className="h-[680px] w-full"
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://osm.org/copyright">OpenStreetMap</a> contributors'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />

                    {centers.map((center) => (
                      <Marker
                        key={center.id}
                        position={[center.latitude, center.longitude]}
                        icon={evacuationIcon}
                      >
                        <Popup>
                          <div className="space-y-2 text-sm text-slate-800">
                            <p className="text-base font-semibold text-slate-900">{center.name}</p>
                            <p>{center.address}</p>
                            <p className="font-medium">{center.current_occupancy} / {center.capacity} occupied</p>
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
                              {statusLabel(center.status)}
                            </p>
                            {center.barangay?.name ? (
                              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{center.barangay.name}</p>
                            ) : null}
                          </div>
                        </Popup>
                      </Marker>
                    ))}
                  </MapContainer>
                </div>
              </div>

              <aside className="lg:sticky lg:top-6">
                <div className="flex h-[680px] flex-col overflow-hidden rounded-[2rem] border border-blue-200 bg-white shadow-sm">
                  <div className="shrink-0 border-b border-blue-100 bg-blue-50 px-5 py-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">Recommended near you</p>
                        <p className="mt-1 text-xs text-slate-600">Closest centers based on your current location</p>
                      </div>
                      {recommendedCenters.length > 0 ? (
                        <span className="shrink-0 rounded-full bg-blue-700 px-2.5 py-1 text-xs font-bold text-white">
                          {recommendedCenters.length}
                        </span>
                      ) : null}
                    </div>
                    {locationMessage ? <p className="mt-2 text-xs text-slate-500">{locationMessage}</p> : null}
                  </div>

                  <div className="flex-1 overflow-y-auto px-5 py-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {authenticated && recommendedCenters.length > 0 ? (
                      <ul className="space-y-3">
                        {recommendedCenters.map(({ center, distanceKm: distance }, index) => (
                          <li
                            key={center.id}
                            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 transition hover:border-blue-300 hover:bg-blue-50/70"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-start gap-2">
                                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-700 text-[10px] font-bold text-white">
                                  {index + 1}
                                </span>
                                <h2 className="text-sm font-bold leading-snug text-slate-900">{center.name}</h2>
                              </div>
                              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] ${statusBadgeClass(center.status)}`}>
                                {statusLabel(center.status)}
                              </span>
                            </div>
                            <p className="mt-1 pl-7 text-xs text-slate-600">{center.address}</p>
                            <p className="mt-2 pl-7 text-xs font-semibold text-blue-800">
                              {distance.toFixed(2)} km away · {center.current_occupancy} of {center.capacity} occupied
                            </p>
                          </li>
                        ))}
                      </ul>
                    ) : authenticated ? (
                      <div className="flex h-full flex-col items-center justify-center gap-2 px-2 text-center">
                        <p className="text-sm text-slate-700">Allow approximate location access to see the evacuation centers around you.</p>
                      </div>
                    ) : null}
                  </div>

                  <div className="shrink-0 border-t border-blue-100 bg-blue-50 px-5 py-4">
                    <button
                      type="button"
                      onClick={locateNearestCenter}
                      disabled={!authenticated}
                      className="w-full rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-800"
                    >
                      Use my approximate location
                    </button>
                  </div>
                </div>
              </aside>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}

