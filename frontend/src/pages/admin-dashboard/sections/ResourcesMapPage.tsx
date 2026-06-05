import { useEffect, useMemo, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import { icon } from 'leaflet'
import axios from 'axios'
import 'leaflet/dist/leaflet.css'
import { createEvacuationCenters, getEvacuationCenters } from '../../../services/api'
import { glassPanelClass } from './constants'

type ResourceLocation = {
  id: string
  label: string
  description: string
  category: 'Evacuation' | 'Vehicle Hub' | 'Medical'
  coordinates: [number, number]
}

const lucenaCenter: [number, number] = [13.94, 121.62]
const lucenaBounds: [[number, number], [number, number]] = [[13.88, 121.54], [14.0, 121.7]]

const resourceLocations: ResourceLocation[] = []

const createHouseIcon = (color: string) =>
  icon({
    iconUrl: `data:image/svg+xml,${encodeURIComponent(
      `<svg width="32" height="32" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 3.5 4 9.5v10.5h5v-6h6v6h5V9.5L12 3.5Z" fill="${color}"/><path d="M8 14.5h8v5H8v-5Z" fill="#ffffff" opacity="0.9"/><path d="M9.5 13.5h5v-3h-5v3Z" fill="#ffffff" opacity="0.8"/><path d="M12 7l4 3.3H8L12 7Z" fill="#ffffff" opacity="0.6"/></svg>`,
    )}`,
    iconSize: [34, 34],
    iconAnchor: [17, 34],
    popupAnchor: [0, -30],
    className: '',
  })

const categoryMarkerIcons: Record<ResourceLocation['category'], ReturnType<typeof icon>> = {
  Evacuation: createHouseIcon('#2563eb'),
  'Vehicle Hub': createHouseIcon('#f59e0b'),
  Medical: createHouseIcon('#22c55e'),
}

const parseCsvLine = (line: string): string[] => {
  const values: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === ',' && !inQuotes) {
      values.push(current.trim())
      current = ''
      continue
    }

    current += char
  }

  values.push(current.trim())
  return values
}

const parseCsv = (csvText: string): ResourceLocation[] => {
  const cleanText = csvText.replace(/\uFEFF/g, '')
  const lines = cleanText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  if (lines.length < 2) return []

  const rawHeaders = parseCsvLine(lines[0])
  const headers = rawHeaders.map((header) => header.trim().toLowerCase())

  const headerMap: Record<string, string> = {
    label: 'label',
    name: 'label',
    title: 'label',
    description: 'description',
    desc: 'description',
    address: 'description',
    latitude: 'latitude',
    lat: 'latitude',
    longitude: 'longitude',
    lon: 'longitude',
    lng: 'longitude',
  }

  const mappedHeaders = headers.map((header) => headerMap[header] ?? header)
  const requiredHeaders = ['label', 'description', 'latitude', 'longitude']
  const hasRequiredHeaders = requiredHeaders.every((required) => mappedHeaders.includes(required))

  if (!hasRequiredHeaders) return []

  const normalizeCoordinate = (value: string, decimals: number): number => {
    const num = Number(value.trim())
    if (!Number.isFinite(num)) return NaN
    return Number(num.toFixed(decimals))
  }

  return lines.slice(1).flatMap((line, index) => {
    const values = parseCsvLine(line)
    if (values.length < mappedHeaders.length) return []

    const row = mappedHeaders.reduce<Record<string, string>>((acc, header, idx) => {
      acc[header] = values[idx] ?? ''
      return acc
    }, {})

    const latitude = normalizeCoordinate(row.latitude, 6)
    const longitude = normalizeCoordinate(row.longitude, 6)
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return []

    return [
      {
        id: `csv-${index}-${row.label}`,
        label: row.label || `Uploaded center ${index + 1}`,
        description: row.description || 'Evacuation center uploaded from CSV.',
        category: 'Evacuation',
        coordinates: [latitude, longitude],
      },
    ]
  })
}

export function ResourcesMapPage() {
  const [uploadedLocations, setUploadedLocations] = useState<ResourceLocation[]>([])
  const [csvError, setCsvError] = useState<string | null>(null)
  const [csvUploadMessage, setCsvUploadMessage] = useState<string | null>(null)
  const [csvFilename, setCsvFilename] = useState<string | null>(null)

  useEffect(() => {
    const loadSavedCenters = async (): Promise<void> => {
      try {
        const centers = await getEvacuationCenters()
        if (Array.isArray(centers) && centers.length > 0) {
          setUploadedLocations(
            centers.map((center, index) => ({
              id: center.id ?? `server-${index}`,
              label: center.name,
              description: center.address,
              category: 'Evacuation',
              coordinates: [center.latitude, center.longitude],
            })),
          )
          return
        }
      } catch {
        // backend may be unavailable; fall back to localStorage
      }

      if (typeof window === 'undefined') return

      try {
        const stored = window.localStorage.getItem('resourcesMapUploadedLocations')
        if (!stored) return
        const parsed = JSON.parse(stored) as ResourceLocation[]
        if (Array.isArray(parsed)) {
          setUploadedLocations(parsed)
        }
      } catch {
        // ignore invalid local storage data
      }
    }

    void loadSavedCenters()
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem('resourcesMapUploadedLocations', JSON.stringify(uploadedLocations))
  }, [uploadedLocations])

  const filteredLocations = useMemo(() => [...resourceLocations, ...uploadedLocations], [uploadedLocations])

  const uploadCsvToResourcesApp = async (locations: ResourceLocation[]): Promise<void> => {
    const payload = locations.map((location) => ({
      name: location.label,
      latitude: Number(location.coordinates[0]),
      longitude: Number(location.coordinates[1]),
      address: location.description,
    }))

    try {
      setCsvUploadMessage('Uploading centers to resources app...')
      await createEvacuationCenters(payload)
      setCsvUploadMessage(`Successfully uploaded ${payload.length} evacuation center${payload.length === 1 ? '' : 's'} to the resources app.`)

      if (typeof window !== 'undefined') {
        window.localStorage.setItem('resourcesMapUploadedLocations', JSON.stringify(locations))
      }
    } catch (error) {
      console.error('Evacuation center upload failed', error)

      const axiosError = axios.isAxiosError(error) ? error : null
      const status = axiosError?.response?.status
      const rawDetail = axiosError?.response?.data?.detail ?? axiosError?.response?.data
      const detail = typeof rawDetail === 'string' ? rawDetail : JSON.stringify(rawDetail)

      if (status === 403) {
        setCsvUploadMessage(
          `Upload forbidden (${status}). Ensure you are logged in as staff/admin and the CSRF token is valid.`,
        )
      } else if (status) {
        setCsvUploadMessage(`Upload failed (${status}): ${String(detail)}`)
      } else {
        setCsvUploadMessage('Upload failed. Please check your connection and try again.')
      }
    }
  }

  const handleCsvUpload = (file: File | null): void => {
    if (!file) return
    setCsvFilename(file.name)
    setCsvUploadMessage(null)
    const reader = new FileReader()

    reader.onload = async () => {
      const text = String(reader.result ?? '')
      const parsed = parseCsv(text)
      if (parsed.length === 0) {
        setCsvError('CSV parsing failed. Use headers label, description, latitude, longitude.')
        setUploadedLocations([])
        setCsvUploadMessage(null)
        return
      }

      setCsvError(null)
      setUploadedLocations(parsed)
      await uploadCsvToResourcesApp(parsed)
    }

    reader.onerror = () => {
      setCsvError('Unable to read the selected CSV file.')
      setUploadedLocations([])
      setCsvUploadMessage(null)
    }

    reader.readAsText(file)
  }

  const mapCenter = lucenaCenter

  return (
    <div className="grid gap-6">
      <div className={`${glassPanelClass} p-6`}>
        <div className="grid gap-4 sm:grid-cols-[1.2fr_auto] sm:items-start">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Resources Map</p>
            <h3 className="mt-2 text-2xl font-bold text-slate-900">Evacuation Center Map</h3>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600">
              Upload a CSV of evacuation centers and display them instantly on the Lucena City map. Required columns: label, description, latitude, longitude.
            </p>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Upload CSV</p>
            <label
              htmlFor="evacuation-csv-upload"
              className="mt-3 flex cursor-pointer items-center justify-between rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
            >
              <span>{csvFilename ?? 'Choose CSV file'}</span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Browse
              </span>
            </label>
            <input
              id="evacuation-csv-upload"
              className="sr-only"
              onChange={(event) => handleCsvUpload(event.target.files?.[0] ?? null)}
              accept=".csv"
              type="file"
            />
            <div className="mt-3 space-y-2 text-xs text-slate-500">
              <p>Headers: <span className="font-mono">label,description,latitude,longitude</span></p>
              <p>Only one CSV at a time. Uploaded centers replace the current data set.</p>
            </div>
            {csvFilename ? <p className="mt-3 text-sm font-semibold text-slate-800">Loaded: {csvFilename}</p> : null}
            {csvUploadMessage ? <p className="mt-3 text-sm text-slate-700">{csvUploadMessage}</p> : null}
            {csvError ? <p className="mt-3 text-sm text-rose-600">{csvError}</p> : null}
          </div>
        </div>

        <div className="mt-6 rounded-[28px] border border-slate-200 bg-white shadow-sm">
          <div className="grid gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4 sm:grid-cols-[1fr_auto] sm:items-center">
            <div className="flex flex-col gap-1">
              <p className="text-sm font-semibold text-slate-900">Evacuation center map</p>
              <p className="text-xs text-slate-500">Displaying {filteredLocations.length} location{filteredLocations.length === 1 ? '' : 's'}.</p>
            </div>
          </div>

          <MapContainer
            center={mapCenter}
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
            {filteredLocations.map((location) => (
              <Marker
                key={location.id}
                position={location.coordinates}
                icon={categoryMarkerIcons[location.category]}
              >
                <Popup>
                  <div className="space-y-1 text-sm">
                    <p className="font-semibold text-slate-900">{location.label}</p>
                    <p className="text-slate-600">{location.description}</p>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{location.category}</p>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      </div>
    </div>
  )
}
