import { useCallback, useEffect, useMemo, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import { icon } from 'leaflet'
import axios from 'axios'
import 'leaflet/dist/leaflet.css'
import {
  createEvacuationCenters,
  deleteEvacuationCenter,
  getEvacuationCenters,
  updateEvacuationCenter,
} from '../../../services/api'
import type { EvacuationCenter, EvacuationCenterStatus, UpdateEvacuationCenterPayload } from '../../../types/api'
import {
  EVACUATION_STATUS_BADGE_CLASSES,
  EVACUATION_STATUS_LABELS,
  EVACUATION_STATUS_OPTIONS,
  describeOccupancy,
  isAcceptingEvacuees,
  resolveEvacuationStatus,
} from '../../../data/evacuation'
import { glassPanelClass } from './constants'

const lucenaCenter: [number, number] = [13.94, 121.62]
const lucenaBounds: [[number, number], [number, number]] = [[13.88, 121.54], [14.0, 121.7]]

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

// Marker colour follows the status, so full/closed centers stand out on the map.
const statusMarkerIcons: Record<EvacuationCenterStatus, ReturnType<typeof icon>> = {
  available: createHouseIcon('#2563eb'),
  full: createHouseIcon('#d97706'),
  maintenance: createHouseIcon('#ea580c'),
  closed: createHouseIcon('#e11d48'),
}

type CsvCenter = {
  name: string
  address: string
  latitude: number
  longitude: number
  capacity: number | null
  current_occupancy: number | null
  status: EvacuationCenterStatus | null
}

const CSV_STATUS_ALIASES: Record<string, EvacuationCenterStatus> = {
  available: 'available',
  open: 'available',
  full: 'full',
  closed: 'closed',
  close: 'closed',
  maintenance: 'maintenance',
  'under maintenance': 'maintenance',
  under_maintenance: 'maintenance',
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

const CSV_HEADER_MAP: Record<string, string> = {
  label: 'name',
  name: 'name',
  title: 'name',
  description: 'address',
  desc: 'address',
  address: 'address',
  latitude: 'latitude',
  lat: 'latitude',
  longitude: 'longitude',
  lon: 'longitude',
  lng: 'longitude',
  capacity: 'capacity',
  current_occupancy: 'current_occupancy',
  occupancy: 'current_occupancy',
  'current occupancy': 'current_occupancy',
  status: 'status',
}

type CsvParseResult = { centers: CsvCenter[]; error: string | null }

const parseCsv = (csvText: string): CsvParseResult => {
  const lines = csvText
    .replace(/﻿/g, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  if (lines.length < 2) return { centers: [], error: 'The CSV file has no rows.' }

  const headers = parseCsvLine(lines[0]).map((header) => CSV_HEADER_MAP[header.trim().toLowerCase()] ?? header.trim().toLowerCase())
  const missing = ['name', 'latitude', 'longitude'].filter((required) => !headers.includes(required))
  if (missing.length > 0) {
    return { centers: [], error: `Missing column(s): ${missing.join(', ')}. Required: name, latitude, longitude.` }
  }

  const readCount = (value: string | undefined): number | null => {
    if (value === undefined || value.trim() === '') return null
    const number = Math.floor(Number(value))
    return Number.isFinite(number) && number >= 0 ? number : NaN
  }

  const centers: CsvCenter[] = []
  const problems: string[] = []

  lines.slice(1).forEach((line, index) => {
    const rowNumber = index + 2
    const values = parseCsvLine(line)
    const row = headers.reduce<Record<string, string>>((acc, header, idx) => {
      acc[header] = values[idx] ?? ''
      return acc
    }, {})

    const latitude = Number(row.latitude)
    const longitude = Number(row.longitude)
    const capacity = readCount(row.capacity)
    const occupancy = readCount(row.current_occupancy)
    const rawStatus = (row.status ?? '').trim().toLowerCase()
    const status = rawStatus ? CSV_STATUS_ALIASES[rawStatus] ?? null : null

    if (!row.name?.trim()) return void problems.push(`Row ${rowNumber}: name is empty`)
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return void problems.push(`Row ${rowNumber}: invalid coordinates`)
    if (Number.isNaN(capacity) || Number.isNaN(occupancy)) return void problems.push(`Row ${rowNumber}: capacity/occupancy must be whole numbers`)
    if (rawStatus && !status) return void problems.push(`Row ${rowNumber}: unknown status "${row.status}"`)
    if (capacity && occupancy !== null && occupancy > capacity) {
      return void problems.push(`Row ${rowNumber}: occupancy (${occupancy}) is higher than capacity (${capacity})`)
    }

    centers.push({
      name: row.name.trim(),
      address: (row.address ?? '').trim(),
      latitude: Number(latitude.toFixed(6)),
      longitude: Number(longitude.toFixed(6)),
      capacity,
      current_occupancy: occupancy,
      status,
    })
  })

  const error = problems.length > 0 ? `${problems.length} row(s) skipped. ${problems.slice(0, 3).join('; ')}${problems.length > 3 ? '…' : ''}` : null
  return { centers, error }
}

type CenterEditorProps = {
  center: EvacuationCenter
  saving: boolean
  onSave: (id: string, payload: UpdateEvacuationCenterPayload) => Promise<void>
}

/** Capacity / occupancy / status form, used in the map popup and in the list. */
function CenterEditor({ center, saving, onSave }: CenterEditorProps) {
  const [capacity, setCapacity] = useState(String(center.capacity))
  const [occupancy, setOccupancy] = useState(String(center.current_occupancy))
  const [status, setStatus] = useState<EvacuationCenterStatus>(center.status)

  // Reset the inputs whenever the saved values change (after a save or a reload).
  useEffect(() => {
    setCapacity(String(center.capacity))
    setOccupancy(String(center.current_occupancy))
    setStatus(center.status)
  }, [center.capacity, center.current_occupancy, center.status])

  const capacityNumber = Number(capacity)
  const occupancyNumber = Number(occupancy)
  const capacityValid = capacity.trim() !== '' && Number.isInteger(capacityNumber) && capacityNumber >= 0
  const occupancyValid = occupancy.trim() !== '' && Number.isInteger(occupancyNumber) && occupancyNumber >= 0
  const overCapacity = capacityValid && occupancyValid && capacityNumber > 0 && occupancyNumber > capacityNumber

  const resultingStatus = capacityValid && occupancyValid
    ? resolveEvacuationStatus(capacityNumber, occupancyNumber, status)
    : status

  const changed =
    capacityNumber !== center.capacity || occupancyNumber !== center.current_occupancy || status !== center.status
  const canSave = changed && capacityValid && occupancyValid && !overCapacity && !saving

  const inputClass =
    'mt-1 block w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500'

  return (
    <form
      className="space-y-2"
      onSubmit={(event) => {
        event.preventDefault()
        if (!canSave) return
        void onSave(center.id, { capacity: capacityNumber, current_occupancy: occupancyNumber, status })
      }}
    >
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
          Capacity
          <input
            aria-label="Capacity"
            className={inputClass}
            min={0}
            onChange={(event) => setCapacity(event.target.value)}
            step={1}
            type="number"
            value={capacity}
          />
        </label>
        <label className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
          Occupancy
          <input
            aria-label="Current occupancy"
            className={`${inputClass} ${overCapacity ? 'border-rose-400 focus:border-rose-500' : ''}`}
            min={0}
            onChange={(event) => setOccupancy(event.target.value)}
            step={1}
            type="number"
            value={occupancy}
          />
        </label>
      </div>

      <label className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
        Status
        <select
          aria-label="Status"
          className={inputClass}
          onChange={(event) => setStatus(event.target.value as EvacuationCenterStatus)}
          value={status}
        >
          {EVACUATION_STATUS_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {EVACUATION_STATUS_LABELS[option]}
            </option>
          ))}
        </select>
      </label>

      {overCapacity ? (
        <p className="text-[11px] font-semibold text-rose-600">Occupancy cannot be higher than capacity.</p>
      ) : changed && resultingStatus !== status ? (
        <p className="text-[11px] font-medium text-amber-700">
          Will be saved as <strong>{EVACUATION_STATUS_LABELS[resultingStatus]}</strong> based on the numbers.
        </p>
      ) : null}

      <button
        className="w-full rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        disabled={!canSave}
        type="submit"
      >
        {saving ? 'Saving…' : 'Save changes'}
      </button>
    </form>
  )
}

function OccupancyBar({ center }: { center: EvacuationCenter }) {
  const occupancy = describeOccupancy(center)

  return (
    <div>
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-semibold text-slate-700">{occupancy.label}</span>
        {occupancy.slotsLabel ? <span className="text-slate-500">{occupancy.slotsLabel}</span> : null}
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200">
        <div className={`h-full rounded-full ${occupancy.barClass}`} style={{ width: `${occupancy.percent ?? 0}%` }} />
      </div>
    </div>
  )
}

export function ResourcesMapPage() {
  const [centers, setCenters] = useState<EvacuationCenter[]>([])
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [csvError, setCsvError] = useState<string | null>(null)
  const [csvUploadMessage, setCsvUploadMessage] = useState<string | null>(null)
  const [csvFilename, setCsvFilename] = useState<string | null>(null)
  const [formMessage, setFormMessage] = useState<{ text: string; tone: 'ok' | 'error' } | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | EvacuationCenterStatus>('all')

  const loadCenters = useCallback(async (): Promise<void> => {
    try {
      const data = await getEvacuationCenters()
      setCenters(data)
      setLoadState('ready')
    } catch {
      setLoadState('error')
    }
  }, [])

  useEffect(() => {
    void loadCenters()
  }, [loadCenters])

  const describeSaveError = (error: unknown): string => {
    const response = axios.isAxiosError(error) ? error.response : undefined
    const detail = response?.data?.current_occupancy ?? response?.data?.capacity ?? response?.data?.detail
    if (response?.status === 403) return 'Not allowed. Log in again as admin or staff.'
    if (detail) return Array.isArray(detail) ? String(detail[0]) : String(detail)
    return 'Unable to save. Check your connection and try again.'
  }

  const handleSave = async (id: string, payload: UpdateEvacuationCenterPayload): Promise<void> => {
    setSavingId(id)
    try {
      const saved = await updateEvacuationCenter(id, payload)
      setCenters((current) => current.map((center) => (center.id === id ? { ...center, ...saved } : center)))
      setFormMessage({
        text: `${saved.name} saved: ${describeOccupancy(saved).label}, ${EVACUATION_STATUS_LABELS[saved.status]}.`,
        tone: 'ok',
      })
      setEditingId(null)
    } catch (error) {
      setFormMessage({ text: describeSaveError(error), tone: 'error' })
    } finally {
      setSavingId(null)
    }
  }

  const handleDeleteCenter = async (center: EvacuationCenter): Promise<void> => {
    if (!window.confirm(`Remove ${center.name}? This cannot be undone.`)) return
    try {
      await deleteEvacuationCenter(center.id)
      setCenters((current) => current.filter((item) => item.id !== center.id))
      setFormMessage({ text: `${center.name} removed.`, tone: 'ok' })
    } catch {
      setFormMessage({ text: 'Unable to remove this center.', tone: 'error' })
    }
  }

  const handleCsvUpload = (file: File | null): void => {
    if (!file) return
    setCsvFilename(file.name)
    setCsvUploadMessage(null)
    setCsvError(null)

    const reader = new FileReader()

    reader.onload = async () => {
      const { centers: parsed, error } = parseCsv(String(reader.result ?? ''))
      setCsvError(error)
      if (parsed.length === 0) return

      // Only send the optional columns that the CSV actually has, so saved numbers are kept otherwise.
      const payload = parsed.map((center) => ({
        name: center.name,
        address: center.address,
        latitude: center.latitude,
        longitude: center.longitude,
        ...(center.capacity !== null ? { capacity: center.capacity } : {}),
        ...(center.current_occupancy !== null ? { current_occupancy: center.current_occupancy } : {}),
        ...(center.status ? { status: center.status } : {}),
      }))

      try {
        setCsvUploadMessage(`Uploading ${payload.length} center${payload.length === 1 ? '' : 's'}…`)
        await createEvacuationCenters(payload)
        setCsvUploadMessage(`Uploaded ${payload.length} evacuation center${payload.length === 1 ? '' : 's'}.`)
      } catch (uploadError) {
        const status = axios.isAxiosError(uploadError) ? uploadError.response?.status : undefined
        setCsvUploadMessage(
          status === 403
            ? 'Upload not allowed (403). Log in as admin or staff and try again.'
            : `Upload failed${status ? ` (${status})` : ''}. ${describeSaveError(uploadError)}`,
        )
      } finally {
        // Reload from the server so every center has its real ID and can be edited right away.
        await loadCenters()
      }
    }

    reader.onerror = () => setCsvError('Unable to read the selected CSV file.')
    reader.readAsText(file)
  }

  const summary = useMemo(() => {
    const withCapacity = centers.filter((center) => center.capacity > 0)
    return {
      total: centers.length,
      accepting: centers.filter((center) => isAcceptingEvacuees(center)).length,
      full: centers.filter((center) => center.status === 'full').length,
      unavailable: centers.filter((center) => center.status === 'closed' || center.status === 'maintenance').length,
      evacuees: centers.reduce((sum, center) => sum + center.current_occupancy, 0),
      capacity: withCapacity.reduce((sum, center) => sum + center.capacity, 0),
      missingCapacity: centers.length - withCapacity.length,
    }
  }, [centers])

  const listedCenters = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return centers.filter((center) => {
      if (statusFilter !== 'all' && center.status !== statusFilter) return false
      if (!query) return true
      return [center.name, center.address, center.barangay?.name ?? ''].some((value) => value.toLowerCase().includes(query))
    })
  }, [centers, searchQuery, statusFilter])

  return (
    <div className="grid gap-6">
      <div className={`${glassPanelClass} p-6`}>
        <div className="grid gap-4 sm:grid-cols-[1.2fr_auto] sm:items-start">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Resources Map</p>
            <h3 className="mt-2 text-2xl font-bold text-slate-900">Evacuation Center Map</h3>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600">
              Set each center's capacity and current occupancy. A center becomes <strong>Full</strong> automatically
              when occupancy reaches capacity, and <strong>Available</strong> again when people leave. Closed and Under
              Maintenance are set by hand. Residents see the 5 nearest centers that still accept evacuees.
            </p>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Upload CSV</p>
            <label
              htmlFor="evacuation-csv-upload"
              className="mt-3 flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
            >
              <span className="truncate">{csvFilename ?? 'Choose CSV file'}</span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Browse
              </span>
            </label>
            <input
              id="evacuation-csv-upload"
              className="sr-only"
              onChange={(event) => {
                handleCsvUpload(event.target.files?.[0] ?? null)
                event.target.value = ''
              }}
              accept=".csv"
              type="file"
            />
            <div className="mt-3 space-y-1 text-xs text-slate-500">
              <p>Required: <span className="font-mono">name, latitude, longitude</span></p>
              <p>Optional: <span className="font-mono">address, capacity, current_occupancy, status</span></p>
              <p>Existing centers (same name) are updated, not duplicated.</p>
            </div>
            {csvUploadMessage ? <p className="mt-3 text-sm text-slate-700">{csvUploadMessage}</p> : null}
            {csvError ? <p className="mt-2 text-sm text-rose-600">{csvError}</p> : null}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
          {[
            { label: 'Centers', value: summary.total, tone: 'text-slate-900' },
            { label: 'Accepting evacuees', value: summary.accepting, tone: 'text-emerald-700' },
            { label: 'Full', value: summary.full, tone: 'text-amber-700' },
            { label: 'Closed / Maintenance', value: summary.unavailable, tone: 'text-rose-700' },
            {
              label: 'Evacuees / capacity',
              value: `${summary.evacuees.toLocaleString()} / ${summary.capacity.toLocaleString()}`,
              tone: 'text-blue-800',
            },
          ].map((card) => (
            <div key={card.label} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{card.label}</p>
              <p className={`mt-1 text-xl font-bold ${card.tone}`}>{card.value}</p>
            </div>
          ))}
        </div>

        {summary.missingCapacity > 0 ? (
          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
            {summary.missingCapacity} center{summary.missingCapacity === 1 ? ' has' : 's have'} no capacity set yet.
            Residents will see "Capacity not set" for {summary.missingCapacity === 1 ? 'it' : 'them'}.
          </p>
        ) : null}

        {formMessage ? (
          <p
            className={`mt-3 rounded-xl px-4 py-2 text-xs font-medium ${
              formMessage.tone === 'ok' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-700'
            }`}
            role="status"
          >
            {formMessage.text}
          </p>
        ) : null}

        <div className="mt-6 overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
            <p className="text-sm font-semibold text-slate-900">Evacuation center map</p>
            <p className="text-xs text-slate-500">
              {loadState === 'loading'
                ? 'Loading centers…'
                : loadState === 'error'
                  ? 'Unable to load centers. Check that the backend is running.'
                  : `Showing ${centers.length} center${centers.length === 1 ? '' : 's'}. Marker colour: blue Available, amber Full, orange Maintenance, red Closed.`}
            </p>
          </div>

          <MapContainer
            center={lucenaCenter}
            zoom={13}
            scrollWheelZoom
            maxBounds={lucenaBounds}
            maxBoundsViscosity={1.0}
            minZoom={12}
            className="h-[560px] w-full"
          >
            <TileLayer
              attribution='&copy; <a href="https://osm.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {centers.map((center) => (
              <Marker key={center.id} position={[center.latitude, center.longitude]} icon={statusMarkerIcons[center.status]}>
                <Popup minWidth={240}>
                  <div className="min-w-[220px] space-y-2 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold leading-snug text-slate-900">{center.name}</p>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] ${EVACUATION_STATUS_BADGE_CLASSES[center.status]}`}>
                        {EVACUATION_STATUS_LABELS[center.status]}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">{center.address}</p>
                    <OccupancyBar center={center} />
                    <div className="border-t border-slate-100 pt-2">
                      <CenterEditor center={center} onSave={handleSave} saving={savingId === center.id} />
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleDeleteCenter(center)}
                      className="text-xs font-semibold text-rose-700 hover:text-rose-900"
                    >
                      Remove center
                    </button>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>

        <div className="mt-6 overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">Capacity and occupancy</p>
              <p className="text-xs text-slate-500">Update numbers quickly during an evacuation.</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                aria-label="Search centers"
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search name or barangay"
                type="search"
                value={searchQuery}
              />
              <select
                aria-label="Filter by status"
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
                onChange={(event) => setStatusFilter(event.target.value as 'all' | EvacuationCenterStatus)}
                value={statusFilter}
              >
                <option value="all">All statuses</option>
                {EVACUATION_STATUS_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {EVACUATION_STATUS_LABELS[option]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <ul className="max-h-[560px] divide-y divide-slate-100 overflow-y-auto">
            {listedCenters.length === 0 ? (
              <li className="px-5 py-6 text-center text-sm text-slate-500">
                {centers.length === 0 ? 'No evacuation centers yet. Upload a CSV to add them.' : 'No centers match your search.'}
              </li>
            ) : (
              listedCenters.map((center) => (
                <li key={center.id} className="px-5 py-3" data-center-row={center.name}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold text-slate-900">{center.name}</p>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] ${EVACUATION_STATUS_BADGE_CLASSES[center.status]}`}>
                          {EVACUATION_STATUS_LABELS[center.status]}
                        </span>
                      </div>
                      <p className="truncate text-xs text-slate-500">{center.barangay?.name ?? center.address}</p>
                    </div>
                    <div className="sm:w-64">
                      <OccupancyBar center={center} />
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditingId((current) => (current === center.id ? null : center.id))}
                      className="self-start rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 sm:self-center"
                    >
                      {editingId === center.id ? 'Close' : 'Edit'}
                    </button>
                  </div>
                  {editingId === center.id ? (
                    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:max-w-sm">
                      <CenterEditor center={center} onSave={handleSave} saving={savingId === center.id} />
                    </div>
                  ) : null}
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </div>
  )
}