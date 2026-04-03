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
const PHIVOLCS_ACTIVE_FAULTS_API = 'https://services8.arcgis.com/If57gH0ZAbByXwSk/arcgis/rest/services/Active_Faults_(PHIVOLCS)/FeatureServer/0/query'

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

type FaultLineProperties = {
  FAULT_NAME?: string | null
  SEG_NAME?: string | null
  TRACE_TYPE?: string | null
  LINE_TYPE?: string | null
  FAULT_CAT?: string | null
  YR_MAPPED?: number | null
}

export type FaultLineFeatureCollection = GeoJSON.FeatureCollection<GeoJSON.Geometry, FaultLineProperties>

const HEATMAP_MIN_MAGNITUDE = 1
const HEATMAP_MAX_MAGNITUDE = 6

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
 * Intensity is normalized against fixed magnitude bands so the same quake
 * strength always maps to the same heat colour, regardless of other events
 * present in the current dataset.
 */
export function toHeatPoints(events: EarthquakeEvent[]): HeatPoint[] {
  if (events.length === 0) return []
  return events.map((e) => [
    e.lat,
    e.lng,
    Math.min(
      Math.max((Math.max(e.magnitude, HEATMAP_MIN_MAGNITUDE) - HEATMAP_MIN_MAGNITUDE) / (HEATMAP_MAX_MAGNITUDE - HEATMAP_MIN_MAGNITUDE), 0.14),
      1,
    ),
  ])
}

export async function fetchQuezonFaultLines(): Promise<FaultLineFeatureCollection> {
  const params = new URLSearchParams({
    where: '1=1',
    geometry: JSON.stringify({
      xmin: 121.0,
      ymin: 13.4,
      xmax: 122.2,
      ymax: 14.6,
      spatialReference: { wkid: 4326 },
    }),
    geometryType: 'esriGeometryEnvelope',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: 'FAULT_NAME,SEG_NAME,TRACE_TYPE,LINE_TYPE,FAULT_CAT,YR_MAPPED',
    returnGeometry: 'true',
    f: 'geojson',
  })

  const response = await fetch(`${PHIVOLCS_ACTIVE_FAULTS_API}?${params}`)
  if (!response.ok) {
    throw new Error(`PHIVOLCS Active Faults API responded with status ${response.status}`)
  }

  return (await response.json()) as FaultLineFeatureCollection
}

/** Return how many events fall within or near Lucena City (±0.15° buffer). */
export function countNearLucena(events: EarthquakeEvent[]): number {
  return events.filter(
    (e) => e.lat >= 13.78 && e.lat <= 14.09 && e.lng >= 121.45 && e.lng <= 121.77,
  ).length
}
