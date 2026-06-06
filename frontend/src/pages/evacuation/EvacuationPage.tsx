import { useEffect, useMemo, useState } from 'react'
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'
import { icon } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { getEvacuationCenters } from '../../services/api'
import type { EvacuationCenter } from '../../types/api'
import { NavigationBar } from '../../components/NavigationBar'
import { Link } from 'react-router-dom'

const lucenaCenter: [number, number] = [13.94, 121.62]
const lucenaBounds = [
  [13.88, 121.54],
  [14.0, 121.7],
] as const

const evacuationIcon = icon({
  iconUrl: `data:image/svg+xml,${encodeURIComponent(
    `<svg width="32" height="40" viewBox="0 0 24 36" xmlns="http://www.w3.org/2000/svg"><path d="M12 0C7.59 0 4 3.59 4 8c0 5.66 8 16 8 16s8-10.34 8-16c0-4.41-3.59-8-8-8Zm0 11.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Z" fill="#1d4ed8"/><path d="M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" fill="#ffffff" opacity="0.9"/></svg>`,
  )}`,
  iconSize: [32, 40],
  iconAnchor: [16, 40],
  popupAnchor: [0, -32],
})

export function EvacuationPage() {
  const [centers, setCenters] = useState<EvacuationCenter[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

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

  const centerCount = centers.length
  const summaryText = useMemo(() => {
    if (loading) return 'Loading evacuation locations...'
    if (error) return error
    if (centerCount === 0) return 'No evacuation centers are available yet. Check back later or explore the disaster map for alerts.'
    return `Showing ${centerCount} evacuation center${centerCount === 1 ? '' : 's'} across Lucena City.`
  }, [centerCount, error, loading])

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

            <div className="space-y-4 p-6 sm:p-8">
              <div className="rounded-[1.75rem] border border-slate-200 bg-slate-50 px-5 py-4 text-sm leading-relaxed text-slate-700">
                {summaryText}
              </div>

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
          </section>
        </div>
      </main>
    </div>
  )
}
