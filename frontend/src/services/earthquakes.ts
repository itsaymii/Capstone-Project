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
const LOCAL_PHILIPPINES_FAULTS_GEOJSON = '/philippines_fault_lines.geojson'

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
 * The bounding box covers the entire Philippine archipelago so the UI can
 * display all earthquakes affecting the country.
 *
 * @param days      How many days back to query (default: 730 — 2 years)
 * @param minMag    Minimum magnitude to include (default: 1.0)
 */
export async function fetchPhilippinesEarthquakes(
  days = 730,
  minMag = 1.0,
): Promise<EarthquakeEvent[]> {
  const endTime = new Date().toISOString()
  const startTime = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  const params = new URLSearchParams({
    format: 'geojson',
    starttime: startTime,
    endtime: endTime,
    minlatitude: '4.0',
    maxlatitude: '21.8',
    minlongitude: '116.0',
    maxlongitude: '127.8',
    minmagnitude: String(minMag),
    orderby: 'time',
    limit: '20000',
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

type ArcGISFaultsError = {
  error: {
    code: number
    message: string
    messageCode?: string
    details?: string[]
  }
}

function isArcGISFaultsError(value: unknown): value is ArcGISFaultsError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'error' in value &&
    typeof (value as any).error === 'object' &&
    (value as any).error !== null &&
    typeof (value as any).error.code === 'number' &&
    typeof (value as any).error.message === 'string'
  )
}

function isFaultLineFeatureCollection(value: unknown): value is FaultLineFeatureCollection {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as any).type === 'FeatureCollection' &&
    Array.isArray((value as any).features)
  )
}

async function loadLocalPhilippinesFaultLines(): Promise<FaultLineFeatureCollection> {
  const response = await fetch(LOCAL_PHILIPPINES_FAULTS_GEOJSON)
  if (!response.ok) {
    throw new Error(`Local fault line fallback not found: ${response.status}`)
  }

  const data = await response.json()
  if (!isFaultLineFeatureCollection(data)) {
    throw new Error('Local fault line fallback returned invalid GeoJSON payload')
  }

  return data
}

export async function fetchPhilippinesFaultLines(): Promise<FaultLineFeatureCollection> {
  const params = new URLSearchParams({
    where: '1=1',
    geometry: JSON.stringify({
      xmin: 116.0,
      ymin: 4.0,
      xmax: 127.5,
      ymax: 21.8,
      spatialReference: { wkid: 4326 },
    }),
    geometryType: 'esriGeometryEnvelope',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: 'FAULT_NAME,SEG_NAME,TRACE_TYPE,LINE_TYPE,FAULT_CAT,YR_MAPPED',
    returnGeometry: 'true',
    f: 'geojson',
  })

  try {
    const response = await fetch(`${PHIVOLCS_ACTIVE_FAULTS_API}?${params}`)
    if (!response.ok) {
      throw new Error(`PHIVOLCS Active Faults API responded with status ${response.status}`)
    }

    const maybeData = await response.json()

    if (isArcGISFaultsError(maybeData)) {
      throw new Error(
        `PHIVOLCS Active Faults API error ${maybeData.error.code}: ${maybeData.error.message}` +
          (maybeData.error.details?.length ? ` (${maybeData.error.details.join('; ')})` : ''),
      )
    }

    if (!isFaultLineFeatureCollection(maybeData)) {
      throw new Error('PHIVOLCS Active Faults API returned invalid GeoJSON payload')
    }

    return maybeData
  } catch (error) {
    console.warn('[earthquakes] PHIVOLCS fault line fetch failed, using local fallback:', error)
    return loadLocalPhilippinesFaultLines()
  }
}

/** Return how many events fall within or near Lucena City (±0.15° buffer). */
export function countNearLucena(events: EarthquakeEvent[]): number {
  return events.filter(
    (e) => e.lat >= 13.78 && e.lat <= 14.09 && e.lng >= 121.45 && e.lng <= 121.77,
  ).length
}
