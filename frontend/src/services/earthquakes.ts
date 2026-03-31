/**
 * Earthquake data service using the USGS FDSN Earthquake Catalog API.
 *
 * PHIVOLCS (Philippine Institute of Volcanology and Seismology) does not
 * expose a public CORS-compatible REST API. The USGS FDSN API is the
 * internationally accepted standard catalog and covers all Philippine
 * seismic events – the same events that PHIVOLCS monitors and bulletins.
 *
 * API docs: https://earthquake.usgs.gov/fdsnws/event/1/
 */

const USGS_FDSN_API = 'https://earthquake.usgs.gov/fdsnws/event/1/query'

export type EarthquakeEvent = {
  id: string
  magnitude: number
  depth: number
  time: string
  rawTimestamp: number
  place: string
  lat: number
  lng: number
}

/** [lat, lng, intensity 0-1] — format expected by leaflet.heat */
export type HeatPoint = [number, number, number]

type USGSFeature = {
  id: string
  properties: {
    mag: number
    time: number
    place: string | null
  }
  geometry: {
    coordinates: [number, number, number] // [longitude, latitude, depth]
  }
}

type USGSResponse = {
  features: USGSFeature[]
}

/**
 * Fetch recent earthquake events from the USGS FDSN catalog.
 * The bounding box covers Quezon Province and immediately surrounding areas
 * (with a buffer) so that earthquakes originating near the province but still
 * capable of impacting it are included.
 *
 * @param days      How many days back to query (default: 1825 — 5 years)
 * @param minMag    Minimum magnitude to include (default: 1.0)
 */
export async function fetchQuezonRegionEarthquakes(
  days = 1825,
  minMag = 1.0,
): Promise<EarthquakeEvent[]> {
  const endTime = new Date().toISOString()
  const startTime = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  const params = new URLSearchParams({
    format: 'geojson',
    starttime: startTime,
    endtime: endTime,
    minlatitude: '13.0',
    maxlatitude: '15.5',
    minlongitude: '120.3',
    maxlongitude: '123.2',
    minmagnitude: String(minMag),
    orderby: 'time',
    limit: '2000',
  })

  const response = await fetch(`${USGS_FDSN_API}?${params}`)
  if (!response.ok) {
    throw new Error(`USGS FDSN API responded with status ${response.status}`)
  }

  const data = (await response.json()) as USGSResponse

  return data.features.map((f) => ({
    id: f.id,
    magnitude: f.properties.mag ?? 0,
    depth: f.geometry.coordinates[2],
    // GeoJSON coordinates are [longitude, latitude, depth]
    lat: f.geometry.coordinates[1],
    lng: f.geometry.coordinates[0],
    rawTimestamp: f.properties.time,
    time: new Date(f.properties.time).toLocaleString('en-PH', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
    place: f.properties.place ?? 'Near Philippines',
  }))
}

/**
 * Convert earthquake events into leaflet.heat heatmap points.
 * Intensity is normalized to [0, 1] relative to the maximum magnitude in
 * the dataset, ensuring the heatmap colour range is always fully utilized.
 *
 * A square-root scale is applied so moderate-magnitude quakes still show
 * visible heat rather than being swamped by the strongest event.
 */
export function toHeatPoints(events: EarthquakeEvent[]): HeatPoint[] {
  if (events.length === 0) return []
  const maxMag = Math.max(...events.map((e) => e.magnitude))
  return events.map((e) => [
    e.lat,
    e.lng,
    Math.min(Math.sqrt(Math.max(e.magnitude, 0) / maxMag), 1),
  ])
}

/** Return how many events fall within or near Lucena City (±0.15° buffer). */
export function countNearLucena(events: EarthquakeEvent[]): number {
  return events.filter(
    (e) => e.lat >= 13.78 && e.lat <= 14.09 && e.lng >= 121.45 && e.lng <= 121.77,
  ).length
}
