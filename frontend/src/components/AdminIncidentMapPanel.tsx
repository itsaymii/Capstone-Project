import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import L, { type LatLngBoundsExpression } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.heat'
import confetti from 'canvas-confetti'
import axios from 'axios'
import type { HazardType } from '../data/adminOperations'
import {
  getIncidentCategoryKey,
  getIncidentCategoryLabel,
  getIncidentCategoryMeta,
  sortIncidentCategoryLabels,
} from '../data/incidentCategories'
import { toLucenaBarangay, withAllBarangays } from '../data/barangays'
import { formatDetailValue, getIncidentTypeConfig } from '../data/incidentTypeFields'
import {
  getIncidentReports,
  updateIncidentReportFields,
  updateIncidentReportStatus,
  type IncidentReport,
} from '../services/incidents'
import {
  type EarthquakeEvent,
  type FaultLineFeatureCollection,
  type HeatPoint,
  fetchPhilippinesEarthquakes,
  fetchPhilippinesFaultLines,
  toHeatPoints,
} from '../services/earthquakes'
import { toTeamName } from '../data/teams'

type IncidentMapFilter = HazardType
type ReportReviewStatus = 'pending' | 'approved'
type OperationalStatus = 'For review' | 'On-going' | 'Resolved'
type Severity = 'Low' | 'Moderate' | 'High' | 'Critical'
type SideListTab = 'review' | 'map'

type AdminIncidentMapPanelProps = {
  /** Dashboard records for the same reports; used for the linked incident's severity and status. */
  incidents?: unknown[]
  selectedType: IncidentMapFilter
  onSelectType: (filter: IncidentMapFilter) => void
  onCreateIncident?: unknown
  onIncidentReportApproved?: () => void
}

type MapIncident = {
  id: string
  title: string
  time: string
  /** When the report was filed (used by the year/month filters). */
  date: Date | null
  status: ReportReviewStatus
  code: HazardType
  /** Shared incident type name (see data/incidentCategories.ts). */
  incidentTypeLabel: string
  color: string
  location: string
  barangay: string
  severity: Severity
  operationalStatus: OperationalStatus
  responseTeam: string
  description: string
  coordinates: [number, number]
  victims: IncidentReport['victims']
  rawReport: IncidentReport
  isNew: boolean
}

type LinkedIncidentInfo = { severity?: Severity; status?: string }

type EditableIncident = {
  location: string
  responseTeam: string
  description: string
  latitude: string
  longitude: string
}

type ApprovalSuccessModal = {
  open: boolean
  title: string
  message: string
  reportTitle: string
}

const lucenaBounds: LatLngBoundsExpression = [
  [13.89, 121.57],
  [13.98, 121.69],
]

const philippinesBounds: LatLngBoundsExpression = [
  [4.5, 116.0],
  [21.5, 127.5],
]

const hazardColors: Record<HazardType, string> = {
  EQ: getIncidentCategoryMeta('earthquake').color,
  FR: getIncidentCategoryMeta('fire').color,
  AC: getIncidentCategoryMeta('rca').color,
}

const hazardTypeMeta: Record<HazardType, { label: string; color: string; description: string }> = {
  FR: { label: 'Fire', color: hazardColors.FR, description: 'Fire incidents' },
  AC: {
    label: 'Accident & Others',
    color: hazardColors.AC,
    description: 'Road crashes, medical, ambulance, crime, stand-by and drowning',
  },
  EQ: { label: 'Earthquake', color: hazardColors.EQ, description: 'Live seismic events' },
}

const hazardTabOrder: HazardType[] = ['FR', 'AC', 'EQ']

// Report cards shown at first in the side list; scrolling down adds this many more.
const LIST_PAGE_SIZE = 10

const mapLegendItems = [
  { label: 'Philippine Fault Zone', color: '#dc2626' },
  { label: 'Valley Fault System', color: '#3b82f6' },
  { label: 'Other Active Faults', color: '#ef4444' },
  { label: 'Earthquake Epicenter', color: hazardColors.EQ },
]

// Heatmap colors, from few to many reports or earthquakes (shared by the map and the legend).
const heatGradient: Record<number, string> = {
  0.12: '#2563eb',
  0.32: '#22d3ee',
  0.5: '#22c55e',
  0.68: '#facc15',
  0.84: '#f97316',
  1.0: '#dc2626',
}
// Sorted: JavaScript lists the key "1" before "0.12", which would paint the whole bar red.
const heatGradientCss = `linear-gradient(90deg, ${Object.entries(heatGradient)
  .sort(([left], [right]) => Number(left) - Number(right))
  .map(([stop, color]) => `${color} ${Number(stop) * 100}%`)
  .join(', ')})`

// Fault lines as drawn on the map: color and dash pattern.
const faultLegendItems = [
  { label: 'Philippine Fault Zone', color: '#dc2626', dash: '' },
  { label: 'Valley Fault System', color: '#3b82f6', dash: '4,6' },
  { label: 'Other active faults', color: '#ef4444', dash: '8,7' },
]

type MapLegendProps = {
  isEqView: boolean
  typeItems: Array<{ label: string; color: string; count: number }>
  showHeatmap: boolean
  showFaultLines: boolean
}

/** Legend for the map-only view: every color and symbol that can appear on the current map. */
function MapLegend({ isEqView, typeItems, showHeatmap, showFaultLines }: MapLegendProps) {
  // Starts folded on phones, where it would cover most of the map.
  const [open, setOpen] = useState(() => typeof window === 'undefined' || window.innerWidth >= 640)
  const heading = 'text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500'
  const row = 'flex items-center gap-2.5 text-xs text-slate-700'

  if (!open) {
    return (
      <button
        aria-expanded={false}
        className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-800 shadow-[0_8px_20px_rgba(15,23,42,0.18)] hover:bg-slate-50"
        onClick={() => setOpen(true)}
        type="button"
      >
        Show legend
      </button>
    )
  }

  return (
    <div className="max-h-[calc(100%-2rem)] w-64 space-y-4 overflow-y-auto rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-[0_12px_32px_rgba(15,23,42,0.18)] backdrop-blur">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-slate-900">Legend</p>
        <button
          aria-expanded={true}
          className="rounded-full px-2 py-0.5 text-[11px] font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          onClick={() => setOpen(false)}
          type="button"
        >
          Hide
        </button>
      </div>

      {isEqView ? (
        <>
          <section className="space-y-2">
            <p className={heading}>Earthquakes</p>
            <div className={row}>
              <span className="flex w-7 items-center justify-center gap-0.5">
                <span className="h-2 w-2 rounded-full border border-white" style={{ backgroundColor: hazardColors.EQ }} />
                <span className="h-3.5 w-3.5 rounded-full border-2 border-white shadow" style={{ backgroundColor: hazardColors.EQ }} />
              </span>
              <span>Epicenter (M3.5 and up). Bigger circle = stronger.</span>
            </div>
          </section>

          {showFaultLines ? (
            <section className="space-y-2">
              <p className={heading}>Fault lines (PHIVOLCS)</p>
              {faultLegendItems.map((item) => (
                <div className={row} key={item.label}>
                  <svg aria-hidden="true" className="w-7 shrink-0" height="8" viewBox="0 0 28 8">
                    <line stroke={item.color} strokeDasharray={item.dash || undefined} strokeWidth="3.5" x1="0" x2="28" y1="4" y2="4" />
                  </svg>
                  <span>{item.label}</span>
                </div>
              ))}
            </section>
          ) : null}
        </>
      ) : (
        <>
          <section className="space-y-2">
            <p className={heading}>Incident types</p>
            {typeItems.length > 0 ? (
              typeItems.map((item) => (
                <div className={row} key={item.label}>
                  <span className="flex w-7 justify-center">
                    <span className="h-3.5 w-3.5 rounded-full border-2 border-white shadow" style={{ backgroundColor: item.color }} />
                  </span>
                  <span className="flex-1">{item.label}</span>
                  <span className="text-[11px] font-semibold text-slate-500">{item.count}</span>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-500">No approved reports match these filters.</p>
            )}
          </section>

          <section className="space-y-2">
            <p className={heading}>Status</p>
            <div className={row}>
              <span className="ongoing-incident-pulse-marker flex w-7 justify-center">
                <span className="pulse-wrap block scale-[0.6]" style={{ margin: '-8px' }}>
                  <span className="pulse-ring" style={{ background: '#64748b47' }} />
                  <span className="pulse-dot" style={{ background: '#64748b' }} />
                </span>
              </span>
              <span>Pulsing: on-going</span>
            </div>
            <div className={row}>
              <span className="flex w-7 justify-center">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-500/20">
                  <span className="h-3.5 w-3.5 rounded-full border-2 border-white bg-slate-500" />
                </span>
              </span>
              <span>Still dot: resolved or closed</span>
            </div>
          </section>

          <section className="space-y-2">
            <p className={heading}>Barangays</p>
            <div className={row}>
              <span className="flex w-7 justify-center">
                <span className="h-3.5 w-5 rounded-sm border-2 border-blue-600 bg-blue-600/10" />
              </span>
              <span>Colored outlines: the 33 barangay boundaries</span>
            </div>
          </section>
        </>
      )}

      {showHeatmap ? (
        <section className="space-y-2">
          <p className={heading}>Heatmap</p>
          <div className="h-2.5 rounded-full" style={{ background: heatGradientCss }} />
          <div className="flex justify-between text-[11px] text-slate-500">
            <span>Few</span>
            <span>Many {isEqView ? 'earthquakes' : 'reports'}</span>
          </div>
        </section>
      ) : null}
    </div>
  )
}

const monthOptions = [
  { value: '01', label: 'January' },
  { value: '02', label: 'February' },
  { value: '03', label: 'March' },
  { value: '04', label: 'April' },
  { value: '05', label: 'May' },
  { value: '06', label: 'June' },
  { value: '07', label: 'July' },
  { value: '08', label: 'August' },
  { value: '09', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
]

const reviewStatusClass: Record<ReportReviewStatus, string> = {
  pending: 'border border-amber-200 bg-amber-50 text-amber-800',
  approved: 'border border-emerald-200 bg-emerald-50 text-emerald-800',
}

const operationalStatusClass: Record<OperationalStatus, string> = {
  'For review': 'bg-amber-50 text-amber-800',
  'On-going': 'bg-red-50 text-red-700',
  Resolved: 'bg-emerald-50 text-emerald-700',
}

const filterSelectClass =
  'h-9 rounded-xl border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 shadow-sm outline-none transition hover:border-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100'

function isApprovedStatus(status?: string): boolean {
  // Only an explicit report approval makes a responder report plottable.
  return String(status || '').trim().toLowerCase().startsWith('approve')
}

function normalizeStatus(status?: string): ReportReviewStatus {
  return isApprovedStatus(status) ? 'approved' : 'pending'
}

function getLucenaFallbackCoordinates(location: string): [number, number] {
  const text = location.toLowerCase()

  if (text.includes('barangay 10')) return [13.941, 121.614]
  if (text.includes('diversion')) return [13.918, 121.626]
  if (text.includes('highway')) return [13.926, 121.609]
  if (text.includes('commercial')) return [13.934, 121.621]
  if (text.includes('industrial')) return [13.929, 121.642]
  if (text.includes('east')) return [13.947, 121.632]
  if (text.includes('north')) return [13.963, 121.618]
  if (text.includes('isabang')) return [13.9718, 121.5821]
  if (text.includes('dalahican')) return [13.9147, 121.6502]
  if (text.includes('cotta')) return [13.933, 121.6279]

  return [13.9414, 121.6236]
}

function getReportCoordinates(report: IncidentReport, location: string): [number, number] {
  const data = report as IncidentReport & {
    latitude?: string | number
    longitude?: string | number
    lat?: string | number
    lng?: string | number
    coordinates?: [number, number] | { lat?: string | number; lng?: string | number }
    incident?: {
      latitude?: string | number
      longitude?: string | number
      coordinates?: { lat?: string | number; lng?: string | number }
    }
  }

  const possibleLat =
    data.latitude ??
    data.lat ??
    (Array.isArray(data.coordinates) ? data.coordinates[0] : data.coordinates?.lat) ??
    data.incident?.latitude ??
    data.incident?.coordinates?.lat

  const possibleLng =
    data.longitude ??
    data.lng ??
    (Array.isArray(data.coordinates) ? data.coordinates[1] : data.coordinates?.lng) ??
    data.incident?.longitude ??
    data.incident?.coordinates?.lng

  const lat = Number(possibleLat)
  const lng = Number(possibleLng)

  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return [lat, lng]
  }

  return getLucenaFallbackCoordinates(location)
}

function getReportCode(report: IncidentReport): string {
  return report.reportCode || report.report_code || report.incidentCode || report.incident_code || report.id
}

function getReportResponderTeam(report: IncidentReport): string {
  return toTeamName(report.responderTeam || report.responder_team) || 'Responder Team'
}

function getReportTime(report: IncidentReport): string {
  const time = report.timeOccurred || report.time_occurred
  const match = /^(\d{1,2}):(\d{2})/.exec(time || '')

  if (match) {
    const hours = Number(match[1])
    return `${hours % 12 || 12}:${match[2]} ${hours < 12 ? 'AM' : 'PM'}`
  }
  if (time) return time

  const createdAt = report.createdAt || report.created_at
  if (!createdAt) return 'Unknown time'

  return new Date(createdAt).toLocaleTimeString('en-PH', {
    hour: 'numeric',
    minute: '2-digit',
  })
}

function getVictimCount(report: IncidentReport): number {
  return Number(report.victimCount ?? report.victim_count ?? report.victims?.length ?? 0)
}

function isNewReport(report: IncidentReport): boolean {
  const createdAt = report.createdAt || report.created_at

  if (!createdAt) return false

  const createdTime = new Date(createdAt).getTime()
  if (!Number.isFinite(createdTime)) return false

  const hoursSinceCreated = (Date.now() - createdTime) / (1000 * 60 * 60)

  return hoursSinceCreated >= 0 && hoursSinceCreated <= 24
}

function getViewedReportIds(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem('adminViewedIncidentReports') || '[]')
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    return []
  }
}

function saveViewedReportId(id: string): string[] {
  const current = new Set(getViewedReportIds())
  current.add(id)

  const next = Array.from(current)
  localStorage.setItem('adminViewedIncidentReports', JSON.stringify(next))

  return next
}

function escapePopupText(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function getReportDate(report: IncidentReport): Date | null {
  const createdAt = report.createdAt || report.created_at
  if (!createdAt) return null
  const date = new Date(createdAt)
  return Number.isNaN(date.getTime()) ? null : date
}

function getBarangayName(report: IncidentReport, location: string): string {
  const barangay = toLucenaBarangay(report.barangayName) ?? toLucenaBarangay(location)
  if (barangay) return barangay
  if (report.barangayName) return report.barangayName
  const match = location.match(/(?:barangay|brgy\.?|bgy\.?)\s+([^,]+)/i)
  if (match?.[1]) return match[1].trim()
  const firstPart = location.split(',')[0]?.trim()
  return firstPart && !/lucena/i.test(firstPart) ? firstPart : 'Unspecified'
}

/** Same rules the backend uses when it creates the incident on approval. */
function estimateSeverity(categoryKey: string, victimCount: number): Severity {
  if (victimCount >= 5) return 'Critical'
  if (victimCount >= 3) return 'High'
  if (victimCount > 0 || ['fire', 'drowning', 'crime'].includes(categoryKey)) return 'Moderate'
  return 'Low'
}

function getOperationalStatus(report: IncidentReport, linkedStatus?: string): OperationalStatus {
  if (!isApprovedStatus(report.status)) return 'For review'
  const value = String(linkedStatus || '').toLowerCase()
  if (['resolved', 'contained', 'false_alarm'].includes(value)) return 'Resolved'
  return 'On-going'
}

function mapReportToIncident(report: IncidentReport, linked?: LinkedIncidentInfo): MapIncident {
  const categoryKey = getIncidentCategoryKey(report)
  const incidentTypeLabel = getIncidentCategoryLabel(report)
  const code: HazardType = categoryKey === 'fire' ? 'FR' : categoryKey === 'earthquake' ? 'EQ' : 'AC'
  const victimCount = getVictimCount(report)
  const location = report.location || 'Lucena City'

  return {
    id: report.id,
    title: `${incidentTypeLabel} - ${getReportCode(report)}`,
    time: getReportTime(report),
    date: getReportDate(report),
    status: normalizeStatus(report.status),
    code,
    incidentTypeLabel,
    color: getIncidentCategoryMeta(categoryKey).color,
    location,
    barangay: getBarangayName(report, location),
    severity: linked?.severity || estimateSeverity(categoryKey, victimCount),
    operationalStatus: getOperationalStatus(report, linked?.status),
    responseTeam: getReportResponderTeam(report),
    description: report.description || report.actionTaken || report.action_taken || 'No description provided.',
    coordinates: getReportCoordinates(report, location),
    victims: report.victims || [],
    rawReport: report,
    isNew: isNewReport(report),
  }
}

function buildIncidentPopupHtml(incident: MapIncident): string {
  const victimCount = incident.victims?.length || getVictimCount(incident.rawReport)
  const date = incident.date ? incident.date.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : ''

  return `
    <div style="min-width: 230px; max-width: 280px; font-family: Inter, system-ui, sans-serif;">
      <div style="display:inline-block; margin-bottom:6px; border-radius:999px; padding:2px 8px; font-size:10px; font-weight:800; color:#fff; background:${incident.color};">
        ${escapePopupText(incident.incidentTypeLabel)}
      </div>
      <div style="font-size: 13px; font-weight: 800; color: #0f172a; margin-bottom: 6px;">
        ${escapePopupText(incident.title)}
      </div>
      <div style="font-size: 12px; color: #475569; line-height: 1.55;">
        <strong>Barangay:</strong> ${escapePopupText(incident.barangay)}<br/>
        <strong>Location:</strong> ${escapePopupText(incident.location)}<br/>
        <strong>Date:</strong> ${escapePopupText(date)} ${escapePopupText(incident.time)}<br/>
        <strong>Severity:</strong> ${escapePopupText(incident.severity)}<br/>
        <strong>Status:</strong> ${escapePopupText(incident.operationalStatus)}<br/>
        <strong>Team:</strong> ${escapePopupText(incident.responseTeam)}<br/>
        <strong>Victims:</strong> ${victimCount}
      </div>
      <div style="margin-top: 8px; border-top: 1px solid #e2e8f0; padding-top: 8px; font-size: 12px; color: #334155; line-height: 1.45;">
        ${escapePopupText(incident.description)}
      </div>
    </div>
  `
}

/** Readable list of the report's type-specific details, e.g. [["Vehicle types", "Motorcycle, Car"]]. */
function getDetailRows(report: IncidentReport): Array<[string, string]> {
  const config = getIncidentTypeConfig(report.incidentType || report.incident_type || '')
  const details = report.details || {}
  if (!config) return []
  return config.fields
    .filter((spec) => details[spec.name] !== undefined && details[spec.name] !== '')
    .map((spec) => [spec.label, formatDetailValue(spec, details[spec.name])])
}

function getVictimDetailRows(report: IncidentReport, victimIndex: number): Array<[string, string]> {
  const config = getIncidentTypeConfig(report.incidentType || report.incident_type || '')
  const details = report.victims?.[victimIndex]?.details || {}
  if (!config) return []
  return config.victimFields
    .filter((spec) => details[spec.name] !== undefined && details[spec.name] !== '')
    .map((spec) => [spec.label, formatDetailValue(spec, details[spec.name])])
}

function getServerErrorMessage(error: unknown, fallback: string): string {
  const data = axios.isAxiosError(error) ? (error.response?.data as Record<string, unknown> | undefined) : undefined
  if (!data || typeof data !== 'object') return fallback
  const first = Object.entries(data)[0]
  if (!first) return fallback
  const [field, value] = first
  const message = Array.isArray(value) ? value.join(' ') : typeof value === 'string' ? value : JSON.stringify(value)
  return ['detail', 'non_field_errors', 'coordinates'].includes(field) ? message : `${field}: ${message}`
}

function readLinkedIncidents(records: unknown[] | undefined): Map<string, LinkedIncidentInfo> {
  const linked = new Map<string, LinkedIncidentInfo>()
  ;(records || []).forEach((record) => {
    const item = record as { id?: unknown; severity?: Severity; linkedIncidentStatus?: string }
    if (item?.id) linked.set(String(item.id), { severity: item.linkedIncidentStatus ? item.severity : undefined, status: item.linkedIncidentStatus })
  })
  return linked
}

function sortNewestFirst(left: MapIncident, right: MapIncident): number {
  return (right.date?.getTime() ?? 0) - (left.date?.getTime() ?? 0)
}

function getEarthquakeDescription(event: EarthquakeEvent): string {
  if (event.magnitude >= 5) {
    return `Strong seismic event at ${event.depth.toFixed(1)} km depth. Priority validation recommended.`
  }

  if (event.magnitude >= 4) {
    return `Moderate event at ${event.depth.toFixed(1)} km depth. Field teams advised to verify affected zones.`
  }

  return `Minor-to-light event at ${event.depth.toFixed(1)} km depth. Continue routine monitoring.`
}



function createHeatCloudPoints(points: HeatPoint[]): HeatPoint[] {
  const cloudOffsets: Array<[number, number, number]> = [
    [0, 0, 1],
    [0.0015, 0.0012, 0.78],
    [-0.0015, -0.0012, 0.78],
    [0.0028, -0.0018, 0.58],
    [-0.0028, 0.0018, 0.58],
    [0.0042, 0.0028, 0.38],
    [-0.0042, -0.0028, 0.38],
  ]

  return points.flatMap(([lat, lng, intensity]) =>
    cloudOffsets.map(([latOffset, lngOffset, multiplier]) => [
      lat + latOffset,
      lng + lngOffset,
      Math.min(1, Math.max(0.08, intensity * multiplier)),
    ] as HeatPoint),
  )
}

function getIncidentHeatIntensity(severity: MapIncident['severity']): number {
  switch (severity) {
    case 'Critical':
      return 0.95
    case 'High':
      return 0.75
    case 'Moderate':
      return 0.55
    default:
      return 0.35
  }
}

export function AdminIncidentMapPanel({
  incidents,
  onIncidentReportApproved,
  selectedType,
  onSelectType,
}: AdminIncidentMapPanelProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const savedMapViewRef = useRef<{ center: [number, number]; zoom: number } | null>(null)
  const previousSelectedTypeRef = useRef<IncidentMapFilter>(selectedType)
  const markerRefs = useRef(new Map<string, L.Layer & { openPopup: () => unknown }>())
  const lastReportsSignatureRef = useRef('')

  const [selectedIncident, setSelectedIncident] = useState<MapIncident | null>(null)
  const [editingIncident, setEditingIncident] = useState<MapIncident | null>(null)
  const [editForm, setEditForm] = useState<EditableIncident | null>(null)
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')
  const [actionError, setActionError] = useState('')
  const [approvingId, setApprovingId] = useState('')
  const [rawReports, setRawReports] = useState<IncidentReport[]>([])
  const [reportsLoading, setReportsLoading] = useState(false)
  const [reportsError, setReportsError] = useState('')
  const [earthquakeEvents, setEarthquakeEvents] = useState<EarthquakeEvent[]>([])
  const [barangayLayer, setBarangayLayer] =
    useState<GeoJSON.FeatureCollection<GeoJSON.Geometry, Record<string, unknown>> | null>(null)
  const [eqFetchStatus, setEqFetchStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [faultLines, setFaultLines] = useState<FaultLineFeatureCollection | null>(null)
  const [faultLineFetchStatus, setFaultLineFetchStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [showHeatmap, setShowHeatmap] = useState(true)
  const [showFaultLines, setShowFaultLines] = useState(true)
  const [showIncidentHeatmap, setShowIncidentHeatmap] = useState(true)
  // "Map only": the map fills the whole window, with a full legend.
  const [isMapOnly, setIsMapOnly] = useState(false)
  const [eqLastRefreshed, setEqLastRefreshed] = useState<Date | null>(null)
  const [eqIsRefreshing, setEqIsRefreshing] = useState(false)
  const [eqSearchQuery, setEqSearchQuery] = useState('')
  const [selectedYear, setSelectedYear] = useState('')
  const [selectedMonth, setSelectedMonth] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [barangayFilter, setBarangayFilter] = useState('all')
  const [severityFilter, setSeverityFilter] = useState('all')
  const [listSearch, setListSearch] = useState('')
  const [sideTab, setSideTab] = useState<SideListTab>('review')
  const [focusRequest, setFocusRequest] = useState<{ id: string; at: number } | null>(null)
  const [viewedReportIds, setViewedReportIds] = useState<string[]>(() => getViewedReportIds())
  const [approvalSuccess, setApprovalSuccess] = useState<ApprovalSuccessModal>({
    open: false,
    title: '',
    message: '',
    reportTitle: '',
  })

  useEffect(() => {
    const styleId = 'barangay-hover-tooltip-style'
    if (document.getElementById(styleId)) return

    const style = document.createElement('style')
    style.id = styleId
    style.textContent = `
      .barangay-hover-tooltip {
        background: rgba(15, 23, 42, 0.92) !important;
        border: 0 !important;
        border-radius: 999px !important;
        color: #ffffff !important;
        font-size: 11px !important;
        font-weight: 700 !important;
        letter-spacing: 0.01em !important;
        padding: 5px 9px !important;
        box-shadow: 0 8px 20px rgba(15, 23, 42, 0.18) !important;
      }

      .barangay-hover-tooltip::before {
        border-top-color: rgba(15, 23, 42, 0.92) !important;
      }

      .ongoing-incident-pulse-marker {
        background: transparent !important;
        border: 0 !important;
        cursor: pointer !important;
      }

      .ongoing-incident-pulse-marker .pulse-wrap {
        position: relative;
        width: 38px;
        height: 38px;
        pointer-events: auto;
      }

      .ongoing-incident-pulse-marker .pulse-ring {
        position: absolute;
        inset: 0;
        border-radius: 999px;
        background: rgba(239, 68, 68, 0.28);
        animation: incidentPulse 1.35s ease-out infinite;
      }

      .ongoing-incident-pulse-marker .pulse-dot {
        position: absolute;
        left: 50%;
        top: 50%;
        width: 15px;
        height: 15px;
        transform: translate(-50%, -50%);
        border-radius: 999px;
        border: 2px solid #ffffff;
        background: #ef4444;
        box-shadow: 0 8px 18px rgba(239, 68, 68, 0.35);
      }

      .leaflet-popup-pane {
        z-index: 1200 !important;
      }

      .leaflet-popup {
        z-index: 1200 !important;
      }

      .leaflet-popup-content-wrapper,
      .leaflet-popup-tip {
        position: relative;
        z-index: 1201 !important;
      }

      @keyframes incidentPulse {
        0% { transform: scale(0.35); opacity: 0.95; }
        70% { transform: scale(1); opacity: 0.2; }
        100% { transform: scale(1.15); opacity: 0; }
      }
    `

    document.head.appendChild(style)
  }, [])

  const loadIncidentReports = useCallback(async () => {
    try {
      setReportsLoading(true)
      setReportsError('')

      const reports = await getIncidentReports()
      // Skip the update when nothing changed, so the 30-second refresh does not redraw the map.
      const signature = JSON.stringify(reports)
      if (signature !== lastReportsSignatureRef.current) {
        lastReportsSignatureRef.current = signature
        setRawReports(reports)
      }
    } catch (error) {
      console.error('[AdminIncidentMapPanel] Failed to load responder incident reports:', error)
      setReportsError('Failed to load responder reports.')
    } finally {
      setReportsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadIncidentReports()

    const intervalId = window.setInterval(() => {
      void loadIncidentReports()
    }, 30000)

    return () => window.clearInterval(intervalId)
  }, [loadIncidentReports])

  const linkedIncidents = useMemo(() => readLinkedIncidents(incidents), [incidents])
  const linkedSignature = useMemo(
    () => JSON.stringify(Array.from(linkedIncidents.entries())),
    [linkedIncidents],
  )

  const incidentReports = useMemo(
    () => rawReports.map((report) => mapReportToIncident(report, linkedIncidents.get(String(report.id)))),
    // linkedSignature instead of linkedIncidents: the dashboard passes a new array on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rawReports, linkedSignature],
  )

  // Reports of the selected tab (Fire, or Accident & Others).
  const tabReports = useMemo(
    () => (selectedType === 'EQ' ? [] : incidentReports.filter((incident) => incident.code === selectedType)),
    [incidentReports, selectedType],
  )

  // Filters reset when they no longer match the tab.
  useEffect(() => {
    setTypeFilter('all')
    setBarangayFilter('all')
    setSeverityFilter('all')
    setListSearch('')
    setFocusRequest(null)
  }, [selectedType])

  const matchesDate = useCallback(
    (date: Date | null): boolean => {
      if (!selectedYear) return true
      if (!date) return false
      if (date.getFullYear().toString() !== selectedYear) return false
      if (selectedMonth && (date.getMonth() + 1).toString().padStart(2, '0') !== selectedMonth) return false
      return true
    },
    [selectedMonth, selectedYear],
  )

  const matchesFilters = useCallback(
    (incident: MapIncident): boolean =>
      matchesDate(incident.date) &&
      (typeFilter === 'all' || incident.incidentTypeLabel === typeFilter) &&
      (barangayFilter === 'all' || incident.barangay === barangayFilter) &&
      (severityFilter === 'all' || incident.severity === severityFilter),
    [barangayFilter, matchesDate, severityFilter, typeFilter],
  )

  const matchesSearch = useCallback(
    (incident: MapIncident): boolean => {
      const query = listSearch.trim().toLowerCase()
      if (!query) return true
      return [incident.title, incident.location, incident.barangay, incident.responseTeam, incident.description]
        .join(' ')
        .toLowerCase()
        .includes(query)
    },
    [listSearch],
  )

  // Right side "For review" list: pending reports that match the filters.
  const reviewIncidents = useMemo(
    () => tabReports.filter((incident) => incident.status === 'pending' && matchesFilters(incident) && matchesSearch(incident)).sort(sortNewestFirst),
    [matchesFilters, matchesSearch, tabReports],
  )

  // Approved reports plotted on the map (same filters, search only narrows the side list).
  const plottableMapIncidents = useMemo(
    () => tabReports.filter((incident) => incident.status === 'approved' && matchesFilters(incident)),
    [matchesFilters, tabReports],
  )

  const onMapListIncidents = useMemo(
    () => plottableMapIncidents.filter(matchesSearch).sort(sortNewestFirst),
    [matchesSearch, plottableMapIncidents],
  )

  // The side list shows LIST_PAGE_SIZE cards at first and adds more as the user scrolls,
  // so long lists do not slow the page down.
  const sideListIncidents = sideTab === 'review' ? reviewIncidents : onMapListIncidents
  const [visibleListCount, setVisibleListCount] = useState(LIST_PAGE_SIZE)
  const sideListRef = useRef<HTMLDivElement | null>(null)
  const sideListEndRef = useRef<HTMLDivElement | null>(null)
  const hasMoreListItems = visibleListCount < sideListIncidents.length

  // Back to the first page (and the top) when the list changes to other reports.
  useEffect(() => {
    setVisibleListCount(LIST_PAGE_SIZE)
    sideListRef.current?.scrollTo({ top: 0 })
  }, [sideTab, selectedType, listSearch, selectedYear, selectedMonth, typeFilter, barangayFilter, severityFilter])

  // Load the next page when the end of the list scrolls into view.
  useEffect(() => {
    const root = sideListRef.current
    const end = sideListEndRef.current
    if (!root || !end || !hasMoreListItems) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisibleListCount((count) => count + LIST_PAGE_SIZE)
        }
      },
      { root, rootMargin: '0px 0px 120px 0px' },
    )
    observer.observe(end)
    return () => observer.disconnect()
  }, [hasMoreListItems, visibleListCount])

  const filteredEarthquakeEvents = useMemo(
    () => earthquakeEvents.filter((event) => matchesDate(new Date(event.rawTimestamp))),
    [earthquakeEvents, matchesDate],
  )

  const filteredEqHeatPoints = useMemo(() => toHeatPoints(filteredEarthquakeEvents), [filteredEarthquakeEvents])

  // Filter options come from the data of the current tab.
  const yearOptions = useMemo(() => {
    const years = new Set<string>()
    if (selectedType === 'EQ') {
      earthquakeEvents.forEach((event) => years.add(new Date(event.rawTimestamp).getFullYear().toString()))
    } else {
      tabReports.forEach((incident) => incident.date && years.add(incident.date.getFullYear().toString()))
    }
    if (selectedYear) years.add(selectedYear)
    return Array.from(years).sort((a, b) => Number(b) - Number(a))
  }, [earthquakeEvents, selectedType, selectedYear, tabReports])

  const monthValues = useMemo(() => {
    if (!selectedYear) return []
    const months = new Set<string>()
    const add = (date: Date | null) => {
      if (date && date.getFullYear().toString() === selectedYear) months.add((date.getMonth() + 1).toString().padStart(2, '0'))
    }
    if (selectedType === 'EQ') earthquakeEvents.forEach((event) => add(new Date(event.rawTimestamp)))
    else tabReports.forEach((incident) => add(incident.date))
    if (selectedMonth) months.add(selectedMonth)
    return monthOptions.map((month) => month.value).filter((month) => months.has(month))
  }, [earthquakeEvents, selectedMonth, selectedType, selectedYear, tabReports])

  const typeOptions = useMemo(
    () => sortIncidentCategoryLabels(Array.from(new Set(tabReports.map((incident) => incident.incidentTypeLabel)))),
    [tabReports],
  )

  // All 33 barangays, even those without reports yet.
  const barangayOptions = useMemo(() => withAllBarangays(tabReports.map((incident) => incident.barangay)), [tabReports])

  const hasActiveFilters =
    Boolean(selectedYear) || typeFilter !== 'all' || barangayFilter !== 'all' || severityFilter !== 'all'

  function clearFilters(): void {
    setSelectedYear('')
    setSelectedMonth('')
    setTypeFilter('all')
    setBarangayFilter('all')
    setSeverityFilter('all')
  }

  const incidentHeatPoints = useMemo(
    () =>
      plottableMapIncidents.map((incident) => [
        incident.coordinates[0],
        incident.coordinates[1],
        getIncidentHeatIntensity(incident.severity),
      ]) as HeatPoint[],
    [plottableMapIncidents],
  )

  // Approved records per tab, with the date filter applied.
  const incidentCounts = useMemo(
    () => ({
      EQ: filteredEarthquakeEvents.length,
      FR: incidentReports.filter((incident) => incident.code === 'FR' && incident.status === 'approved' && matchesDate(incident.date)).length,
      AC: incidentReports.filter((incident) => incident.code === 'AC' && incident.status === 'approved' && matchesDate(incident.date)).length,
    }),
    [filteredEarthquakeEvents.length, incidentReports, matchesDate],
  )

  // Legend for the incident tabs: one entry per incident type on the map.
  const plottedTypeLegend = useMemo(() => {
    const counts = new Map<string, { color: string; count: number }>()
    plottableMapIncidents.forEach((incident) => {
      const current = counts.get(incident.incidentTypeLabel) || { color: incident.color, count: 0 }
      current.count += 1
      counts.set(incident.incidentTypeLabel, current)
    })
    return sortIncidentCategoryLabels(Array.from(counts.keys())).map((label) => ({ label, ...counts.get(label)! }))
  }, [plottableMapIncidents])

  const loadEarthquakes = useCallback(async (silent = false) => {
    if (silent) {
      setEqIsRefreshing(true)
    } else {
      setEqFetchStatus('loading')
    }

    try {
      const events = await fetchPhilippinesEarthquakes(730, 1.0)
      setEarthquakeEvents(events)
      setEqFetchStatus('idle')
      setEqLastRefreshed(new Date())
    } catch {
      if (!silent) setEqFetchStatus('error')
    } finally {
      setEqIsRefreshing(false)
    }
  }, [])

  const earthquakeIncidentCards = useMemo(
    () =>
      [...earthquakeEvents]
        .sort((a, b) => b.rawTimestamp - a.rawTimestamp)
        .map((event) => ({
          id: event.id,
          title: `Earthquake Event - ${event.place}`,
          time: event.time,
          location: event.place,
          description: getEarthquakeDescription(event),
          magnitude: event.magnitude,
        })),
    [earthquakeEvents],
  )

  const filteredEarthquakeIncidentCards = useMemo(() => {
    const normalizedQuery = eqSearchQuery.trim().toLowerCase()

    if (!normalizedQuery) return earthquakeIncidentCards.slice(0, 24)

    return earthquakeIncidentCards.filter(
      (incident) =>
        incident.location.toLowerCase().includes(normalizedQuery) ||
        incident.title.toLowerCase().includes(normalizedQuery) ||
        incident.description.toLowerCase().includes(normalizedQuery),
    )
  }, [earthquakeIncidentCards, eqSearchQuery])


  const earthquakeSummary = useMemo(() => {
    const significantCount = filteredEarthquakeEvents.filter((event) => event.magnitude >= 4).length
    const strongestMagnitude = filteredEarthquakeEvents.reduce((max, event) => Math.max(max, event.magnitude), 0)
    const recentCount = filteredEarthquakeEvents.filter(
      (event) => event.rawTimestamp >= Date.now() - 30 * 24 * 60 * 60 * 1000,
    ).length

    return {
      total: filteredEarthquakeEvents.length,
      significant: significantCount,
      strongest: strongestMagnitude > 0 ? strongestMagnitude.toFixed(1) : '0.0',
      recent: recentCount,
    }
  }, [filteredEarthquakeEvents])


  useEffect(() => {
    // Load once. An empty feed is a valid answer: it must not trigger another load (and a map rebuild) forever.
    if (selectedType === 'EQ' && eqLastRefreshed === null && eqFetchStatus === 'idle') {
      void loadEarthquakes()
    }
  }, [selectedType, eqLastRefreshed, eqFetchStatus, loadEarthquakes])

  useEffect(() => {
    if (selectedType !== 'EQ' || faultLines || faultLineFetchStatus !== 'idle') return

    async function loadFaultLines(): Promise<void> {
      setFaultLineFetchStatus('loading')
      try {
        const data = await fetchPhilippinesFaultLines()
        setFaultLines(data)
        setFaultLineFetchStatus('idle')
      } catch (error) {
        console.error('[AdminIncidentMapPanel] Failed to load PHIVOLCS fault lines:', error)
        setFaultLineFetchStatus('error')
      }
    }

    void loadFaultLines()
  }, [selectedType, faultLines, faultLineFetchStatus])

  useEffect(() => {
    if (selectedType !== 'EQ') return

    const intervalId = setInterval(() => {
      void loadEarthquakes(true)
    }, 5 * 60 * 1000)

    return () => clearInterval(intervalId)
  }, [selectedType, loadEarthquakes])

  useEffect(() => {
    if (!isMapOnly) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsMapOnly(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [isMapOnly])

  useEffect(() => {
    void fetch('/lucena_barangays.geojson')
      .then((response) => response.json())
      .then((data) => setBarangayLayer(data))
      .catch(() => {
        console.error('Failed to load Lucena barangay boundaries')
      })
  }, [])

  useEffect(() => {
    if (!mapContainerRef.current) return

    const existingLeafletId = (mapContainerRef.current as { _leaflet_id?: number })._leaflet_id
    if (existingLeafletId) {
      ;(mapContainerRef.current as { _leaflet_id?: number })._leaflet_id = undefined
    }

    if (mapInstanceRef.current) {
      if (previousSelectedTypeRef.current === selectedType) {
        const currentCenter = mapInstanceRef.current.getCenter()
        savedMapViewRef.current = {
          center: [currentCenter.lat, currentCenter.lng],
          zoom: mapInstanceRef.current.getZoom(),
        }
      } else {
        savedMapViewRef.current = null
      }

      mapInstanceRef.current.remove()
      mapInstanceRef.current = null
    }

    const isEqView = selectedType === 'EQ'

    // Free to pan and zoom out; each view only starts on the Philippines (earthquakes) or Lucena.
    const map = L.map(mapContainerRef.current, {
      zoomControl: true,
      attributionControl: false,
      maxZoom: 18,
    })

    if (savedMapViewRef.current && previousSelectedTypeRef.current === selectedType) {
      map.setView(savedMapViewRef.current.center, savedMapViewRef.current.zoom)
    } else if (isEqView) {
      map.fitBounds(philippinesBounds)
    } else {
      map.fitBounds(lucenaBounds, { padding: [18, 18] })
    }

    const mapBaseLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    })
    mapBaseLayer.addTo(map)

    const overlayLayerGroup = L.layerGroup().addTo(map)

    const heatmapPane = map.getPane('heatmap-pane') ?? map.createPane('heatmap-pane')
    heatmapPane.style.zIndex = '350'
    heatmapPane.style.pointerEvents = 'none'

    const barangayPane = map.getPane('barangay-pane') ?? map.createPane('barangay-pane')
    barangayPane.style.zIndex = '590'
    barangayPane.style.pointerEvents = 'auto'

    const incidentMarkerPane = map.getPane('incident-marker-pane') ?? map.createPane('incident-marker-pane')
    incidentMarkerPane.style.zIndex = '670'
    incidentMarkerPane.style.pointerEvents = 'auto'

    const faultPane = map.getPane('fault-pane') ?? map.createPane('fault-pane')
    faultPane.style.zIndex = '640'
    faultPane.style.pointerEvents = 'none'

    const mapLabelsPane = map.getPane('map-labels-pane') ?? map.createPane('map-labels-pane')
    mapLabelsPane.style.zIndex = '650'
    mapLabelsPane.style.pointerEvents = 'none'

    const popupPane = map.getPane('popupPane')
    if (popupPane) popupPane.style.zIndex = '1200'

    if (barangayLayer) {

      const barangayBorderColors = [
        '#2563eb',
        '#059669',
        '#d97706',
        '#7c3aed',
        '#dc2626',
        '#0891b2',
        '#9333ea',
        '#16a34a',
        '#db2777',
        '#0f766e',
      ]

      function getBarangayName(feature?: GeoJSON.Feature<GeoJSON.Geometry, Record<string, unknown>>): string {
        return String(
          feature?.properties?.barangay_name ??
            feature?.properties?.brgy_name ??
            feature?.properties?.name ??
            'Unknown Barangay',
        )
      }

      function getBarangayColor(feature?: GeoJSON.Feature<GeoJSON.Geometry, Record<string, unknown>>): string {
        const barangayName = getBarangayName(feature)

        let hash = 0
        for (let index = 0; index < barangayName.length; index += 1) {
          hash = barangayName.charCodeAt(index) + ((hash << 5) - hash)
        }

        return barangayBorderColors[Math.abs(hash) % barangayBorderColors.length]
      }

      const barangayGeoJson = L.geoJSON(barangayLayer, {
        pane: 'barangay-pane',
        interactive: true,
        style: (feature) => ({
          color: getBarangayColor(feature),
          weight: 2,
          opacity: 1,
          fillColor: '#ffffff',
          fillOpacity: 0,
          lineJoin: 'round',
          lineCap: 'round',
          stroke: true,
        }),
        onEachFeature: (feature, layer) => {
          const barangayName = getBarangayName(feature)

          layer.bindTooltip(barangayName, {
            sticky: true,
            direction: 'top',
            opacity: 0.95,
            className: 'barangay-hover-tooltip',
          })

          layer.on({
            mouseover: (event) => {
              const target = event.target as L.Path
              target.setStyle({
                color: getBarangayColor(feature),
                weight: 2.1,
                opacity: 1,
                fillColor: getBarangayColor(feature),
                fillOpacity: 0.08,
              })
              target.bringToFront()
            },
            mouseout: () => {
              barangayGeoJson.resetStyle(layer)
            },
          })
        },
      })

      barangayGeoJson.addTo(overlayLayerGroup)
    }

    if (isEqView) {
      if (showHeatmap && filteredEqHeatPoints.length > 0) {
        const earthquakeHeatLayer = (L as any).heatLayer(createHeatCloudPoints(filteredEqHeatPoints), {
          pane: 'heatmap-pane',
          minOpacity: 0.24,
          radius: 42,
          blur: 32,
          max: 1.0,
          maxZoom: 16,
          gradient: heatGradient,
        })
        earthquakeHeatLayer.addTo(overlayLayerGroup)
      }

      if (showFaultLines && faultLines) {
        const faultLayer = L.geoJSON(faultLines, {
          pane: 'fault-pane',
          style: (feature) => {
            const faultName = String(feature?.properties?.FAULT_NAME || '')
            const segName = String(feature?.properties?.SEG_NAME || '')
            const isValleyFault = faultName.includes('Valley Fault System') || segName.includes('Valley Fault')
            const isPFZ = faultName.includes('Philippine Fault Zone')

            if (isValleyFault) {
              return {
                color: '#3b82f6',
                weight: 4,
                opacity: 0.94,
                dashArray: '4,6',
              }
            }

            if (isPFZ) {
              return {
                color: '#dc2626',
                weight: 4,
                opacity: 0.96,
                dashArray: '',
              }
            }

            return {
              color: '#ef4444',
              weight: 3,
              opacity: 0.88,
              dashArray: '8,7',
            }
          },
          onEachFeature: (feature, layer) => {
            const name = String(
              feature.properties?.FAULT_NAME || feature.properties?.SEG_NAME || 'PHIVOLCS Fault Line',
            )
            layer.bindTooltip(name, {
              sticky: true,
              direction: 'top',
              opacity: 0.9,
              className: 'fault-line-tooltip',
            })
          },
        })
        faultLayer.addTo(overlayLayerGroup)
      }

      if (showHeatmap) {
        filteredEarthquakeEvents
          .filter((event) => event.magnitude >= 3.5)
          .forEach((event) => {
            const seismicMarker = L.circleMarker([event.lat, event.lng], {
              pane: 'incident-marker-pane',
              radius: Math.max(4, (event.magnitude - 1) * 3),
              color: '#ffffff',
              weight: 1,
              fillColor: hazardColors.EQ,
              fillOpacity: 0.85,
            })
            seismicMarker.addTo(overlayLayerGroup)
            seismicMarker.bindPopup(
                `<strong>M${event.magnitude.toFixed(1)}</strong><br/>${event.place}<br/><small>${event.time} · ${event.depth.toFixed(1)} km deep</small>`,
              )
          })
      }
    } else {
      if (showIncidentHeatmap && incidentHeatPoints.length > 0 && typeof (L as any).heatLayer === 'function') {
        const incidentHeatLayer = (L as any).heatLayer(createHeatCloudPoints(incidentHeatPoints), {
          pane: 'heatmap-pane',
          minOpacity: 0.24,
          radius: 46,
          blur: 34,
          max: 1.0,
          maxZoom: 17,
          gradient: heatGradient,
        })
        incidentHeatLayer.addTo(overlayLayerGroup)
      }

      plottableMapIncidents.forEach((incident) => {
        const markerColor = incident.color

        // On-going incidents pulse; resolved ones are a plain dot.
        if (incident.operationalStatus === 'On-going') {
          const pulseMarker = L.marker(incident.coordinates, {
            pane: 'incident-marker-pane',
            icon: L.divIcon({
              className: 'ongoing-incident-pulse-marker',
              html: `<div class="pulse-wrap"><span class="pulse-ring" style="background:${markerColor}47"></span><span class="pulse-dot" style="background:${markerColor}"></span></div>`,
              iconSize: [38, 38],
              iconAnchor: [19, 19],
            }),
            title: incident.title,
          })
            .addTo(overlayLayerGroup)
            .bindPopup(buildIncidentPopupHtml(incident), { maxWidth: 320, closeButton: true })
          markerRefs.current.set(incident.id, pulseMarker)
          return
        }

        L.circleMarker(incident.coordinates, {
          pane: 'incident-marker-pane',
          radius: 17,
          stroke: false,
          fillColor: markerColor,
          fillOpacity: 0.22,
          interactive: false,
        }).addTo(overlayLayerGroup)

        const approvedMarker = L.circleMarker(incident.coordinates, {
          pane: 'incident-marker-pane',
          radius: 9,
          color: '#ffffff',
          weight: 2,
          fillColor: markerColor,
          fillOpacity: 0.98,
          bubblingMouseEvents: false,
        })
          .addTo(overlayLayerGroup)
          .bindPopup(buildIncidentPopupHtml(incident), { maxWidth: 320, closeButton: true })

        markerRefs.current.set(incident.id, approvedMarker)
      })
    }

    // Cancelled in the cleanup: on a quick rebuild it would run on a removed map and throw.
    const resizeTimer = window.setTimeout(() => {
      map.invalidateSize()
    }, 0)

    // Small in-map legend: fault lines for earthquakes, incident types for the other tabs.
    const legendItems = isEqView
      ? mapLegendItems
      : [
          ...plottedTypeLegend.map((item) => ({ label: `${item.label} (${item.count})`, color: item.color })),
          { label: 'Pulsing = on-going', color: '#64748b' },
        ]

    if (legendItems.length > 0 && !isMapOnly) {
      const legendControl = new L.Control({ position: 'topright' })
      legendControl.onAdd = function () {
        const container = L.DomUtil.create('div', 'map-legend leaflet-bar') as HTMLDivElement
        container.style.cssText =
          'font-size:12px;line-height:1.2;pointer-events:auto;background:rgba(255,255,255,0.92);padding:8px 10px;border-radius:10px;max-width:220px;'

        legendItems.forEach((item) => {
          const row = document.createElement('div')
          row.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:5px;'
          const swatch = document.createElement('span')
          swatch.style.cssText = `width:12px;height:12px;flex-shrink:0;border-radius:999px;display:inline-block;background:${item.color};`
          const label = document.createElement('span')
          label.textContent = item.label
          row.appendChild(swatch)
          row.appendChild(label)
          container.appendChild(row)
        })

        return container
      }
      legendControl.addTo(map)
    }

    mapInstanceRef.current = map
    previousSelectedTypeRef.current = selectedType

    return () => {
      // Keep the zoom and position for the rebuilt map (new filters, layers, or the map-only view).
      // A different map type starts from its own default view instead (see the setView above).
      const center = map.getCenter()
      savedMapViewRef.current = { center: [center.lat, center.lng], zoom: map.getZoom() }
      window.clearTimeout(resizeTimer)
      markerRefs.current.clear()
      map.remove()
      mapInstanceRef.current = null
    }
  }, [
    plottableMapIncidents,
    plottedTypeLegend,
    incidentHeatPoints,
    showIncidentHeatmap,
    selectedType,
    filteredEarthquakeEvents,
    filteredEqHeatPoints,
    showHeatmap,
    showFaultLines,
    faultLines,
    barangayLayer,
    // The map moves between the page and the map-only view, so it is rebuilt there (keeping the view).
    isMapOnly,
  ])

  // Fly to an incident picked from the "On map" list and open its popup.
  useEffect(() => {
    if (!focusRequest) return
    const map = mapInstanceRef.current
    const incident = plottableMapIncidents.find((item) => item.id === focusRequest.id)
    const marker = markerRefs.current.get(focusRequest.id)
    if (!map || !incident || !marker) return
    map.setView(incident.coordinates, Math.max(map.getZoom(), 16))
    const timer = window.setTimeout(() => marker.openPopup(), 250)
    return () => window.clearTimeout(timer)
  }, [focusRequest, plottableMapIncidents])

  function showApprovalCelebration(incident: MapIncident): void {
    confetti({ particleCount: 160, spread: 90, origin: { y: 0.62 } })
    confetti({ particleCount: 90, angle: 60, spread: 70, origin: { x: 0, y: 0.7 } })
    confetti({ particleCount: 90, angle: 120, spread: 70, origin: { x: 1, y: 0.7 } })

    setApprovalSuccess({
      open: true,
      title: 'Report Approved',
      message: 'The incident report has been verified, plotted on the map, and moved to the Incident Reports page.',
      reportTitle: incident.title,
    })
  }

  function handleViewIncident(incident: MapIncident): void {
    setViewedReportIds(saveViewedReportId(incident.id))
    setActionError('')
    setSelectedIncident({ ...incident, isNew: false })
  }

  function replaceRawReport(updated: IncidentReport): void {
    setRawReports((current) => current.map((report) => (report.id === updated.id ? { ...report, ...updated } : report)))
  }

  async function handleApprove(incident: MapIncident): Promise<void> {
    setApprovingId(incident.id)
    setActionError('')
    try {
      const updatedReport = await updateIncidentReportStatus(incident.id, 'Approved')
      replaceRawReport({ ...incident.rawReport, ...(updatedReport || {}), status: updatedReport?.status || 'Approved' })

      setSelectedIncident(null)
      setEditingIncident(null)
      setEditForm(null)
      showApprovalCelebration(incident)
      onIncidentReportApproved?.()

      if (selectedType !== incident.code) onSelectType(incident.code)

      window.setTimeout(() => {
        void loadIncidentReports()
      }, 300)
    } catch (error) {
      console.error('[AdminIncidentMapPanel] Failed to approve report:', error)
      setActionError(getServerErrorMessage(error, 'Failed to approve the report. Please try again.'))
    } finally {
      setApprovingId('')
    }
  }

  function handleEditIncident(incident: MapIncident): void {
    setEditingIncident(incident)
    setEditError('')
    setEditForm({
      location: incident.location,
      responseTeam: incident.responseTeam,
      description: incident.description,
      latitude: String(incident.coordinates[0]),
      longitude: String(incident.coordinates[1]),
    })
  }

  async function handleSaveEdit(): Promise<void> {
    if (!editingIncident || !editForm) return

    const latitude = Number(editForm.latitude)
    const longitude = Number(editForm.longitude)
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      setEditError('Latitude and longitude must be numbers.')
      return
    }
    if (!editForm.location.trim() || !editForm.description.trim() || !editForm.responseTeam.trim()) {
      setEditError('Location, response team and description are required.')
      return
    }

    setEditSaving(true)
    setEditError('')
    try {
      const updated = await updateIncidentReportFields(editingIncident.id, {
        location: editForm.location.trim(),
        description: editForm.description.trim(),
        responderTeam: editForm.responseTeam.trim(),
        latitude,
        longitude,
      })
      const merged = { ...editingIncident.rawReport, ...updated }
      replaceRawReport(merged)
      setSelectedIncident(mapReportToIncident(merged, linkedIncidents.get(String(merged.id))))
      setEditingIncident(null)
      setEditForm(null)
    } catch (error) {
      console.error('[AdminIncidentMapPanel] Failed to save report details:', error)
      setEditError(getServerErrorMessage(error, 'Failed to save the changes. Please try again.'))
    } finally {
      setEditSaving(false)
    }
  }

  // Shared by the page and the map-only view.
  const typeTabs = (
  <div className="flex flex-wrap gap-2 lg:justify-end" role="tablist" aria-label="Map type">
    {hazardTabOrder.map((typeCode) => {
      const active = selectedType === typeCode
      return (
        <button
          aria-selected={active}
          className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
            active ? 'text-white shadow-[0_8px_18px_rgba(15,23,42,0.16)]' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
          }`}
          key={typeCode}
          onClick={() => onSelectType(typeCode)}
          role="tab"
          style={active ? { backgroundColor: hazardTypeMeta[typeCode].color, borderColor: hazardTypeMeta[typeCode].color } : undefined}
          title={hazardTypeMeta[typeCode].description}
          type="button"
        >
          {hazardTypeMeta[typeCode].label}
          {typeCode !== 'EQ' || earthquakeEvents.length > 0 ? (
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${active ? 'bg-white/25' : 'bg-slate-100 text-slate-600'}`}>
              {incidentCounts[typeCode]}
            </span>
          ) : null}
        </button>
      )
    })}
  </div>
  )

  const layerButtons = (
  <div className="ml-auto flex flex-wrap items-center gap-2">
    <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Layers</span>
    {selectedType === 'EQ' ? (
      <>
        <button
          aria-pressed={showHeatmap}
          className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition ${showHeatmap ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}
          onClick={() => setShowHeatmap((value) => !value)}
          type="button"
        >
          Heatmap
        </button>
        <button
          aria-pressed={showFaultLines}
          className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition ${showFaultLines ? 'border-rose-500 bg-rose-500 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}
          onClick={() => setShowFaultLines((value) => !value)}
          type="button"
        >
          Fault Lines
        </button>
      </>
    ) : (
      <button
        aria-pressed={showIncidentHeatmap}
        className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition ${showIncidentHeatmap ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}
        onClick={() => setShowIncidentHeatmap((value) => !value)}
        type="button"
      >
        Heatmap
      </button>
    )}
  </div>
  )

  return (
    <section className="px-4 py-5 sm:px-6 sm:py-8">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(320px,0.9fr)] xl:items-start">
        <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_12px_32px_rgba(15,23,42,0.08)] md:flex md:h-[calc(100vh-13rem)] md:flex-col">
          <div className="flex flex-col gap-4 border-b border-slate-200 bg-[linear-gradient(90deg,#e8f1fd_0%,#f6fbff_100%)] px-4 py-4 sm:px-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {selectedType === 'EQ' ? 'Seismic Mapping — Philippines' : 'Approved Report Mapping'}
                </p>
                <h2 className="mt-1 text-xl font-bold text-slate-900 sm:text-2xl">Lucena Incident Map</h2>
                <p className="mt-1 text-xs text-slate-500">
                  {selectedType === 'EQ'
                    ? 'Live earthquake events with heatmap and PHIVOLCS fault lines.'
                    : 'Only approved reports are plotted. Pending reports stay in the review list until approved.'}
                </p>
              </div>

              {typeTabs}
            </div>

            <div className="flex flex-wrap items-end gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Year</span>
                <select
                  aria-label="Year"
                  className={filterSelectClass}
                  onChange={(event) => {
                    setSelectedYear(event.target.value)
                    setSelectedMonth('')
                  }}
                  value={selectedYear}
                >
                  <option value="">All years</option>
                  {yearOptions.map((year) => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Month</span>
                <select
                  aria-label="Month"
                  className={`${filterSelectClass} disabled:cursor-not-allowed disabled:opacity-50`}
                  disabled={!selectedYear}
                  onChange={(event) => setSelectedMonth(event.target.value)}
                  title={selectedYear ? undefined : 'Choose a year first'}
                  value={selectedMonth}
                >
                  <option value="">All months</option>
                  {monthOptions
                    .filter((month) => monthValues.includes(month.value))
                    .map((month) => (
                      <option key={month.value} value={month.value}>{month.label}</option>
                    ))}
                </select>
              </label>

              {selectedType !== 'EQ' ? (
                <>
                  {selectedType === 'AC' ? (
                    <label className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Incident type</span>
                      <select aria-label="Incident type" className={filterSelectClass} onChange={(event) => setTypeFilter(event.target.value)} value={typeFilter}>
                        <option value="all">All types</option>
                        {typeOptions.map((type) => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    </label>
                  ) : null}

                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Barangay</span>
                    <select aria-label="Barangay" className={filterSelectClass} onChange={(event) => setBarangayFilter(event.target.value)} value={barangayFilter}>
                      <option value="all">All barangays</option>
                      {barangayOptions.map((barangay) => (
                        <option key={barangay} value={barangay}>{barangay}</option>
                      ))}
                    </select>
                  </label>

                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Severity</span>
                    <select aria-label="Severity" className={filterSelectClass} onChange={(event) => setSeverityFilter(event.target.value)} value={severityFilter}>
                      <option value="all">All severity</option>
                      {(['Critical', 'High', 'Moderate', 'Low'] as const).map((severity) => (
                        <option key={severity} value={severity}>{severity}</option>
                      ))}
                    </select>
                  </label>
                </>
              ) : null}

              {hasActiveFilters ? (
                <button
                  className="h-9 rounded-xl border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                  onClick={clearFilters}
                  type="button"
                >
                  Clear filters
                </button>
              ) : null}

              {layerButtons}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-4 py-2.5 text-xs text-slate-600 sm:px-5">
            {selectedType === 'EQ' ? (
              <span className="font-semibold text-slate-700">{filteredEarthquakeEvents.length} earthquake events in view</span>
            ) : plottedTypeLegend.length > 0 ? (
              plottedTypeLegend.map((item) => (
                <button
                  className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 transition hover:bg-slate-100 ${typeFilter === item.label ? 'bg-slate-100' : ''}`}
                  disabled={selectedType !== 'AC'}
                  key={item.label}
                  onClick={() => setTypeFilter((current) => (current === item.label ? 'all' : item.label))}
                  title={selectedType === 'AC' ? 'Show only this type' : undefined}
                  type="button"
                >
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="font-semibold text-slate-700">{item.label}</span>
                  <span className="text-[11px] text-slate-500">{item.count}</span>
                </button>
              ))
            ) : (
              <span className="text-slate-500">No approved reports match these filters.</span>
            )}

            {reportsLoading && rawReports.length === 0 ? (
              <span className="ml-auto text-[11px] font-semibold text-blue-600">Loading responder reports...</span>
            ) : selectedType !== 'EQ' ? (
              <span className="ml-auto text-[11px] font-semibold text-emerald-700">{plottableMapIncidents.length} plotted on map</span>
            ) : null}

            <button
              className={`${selectedType === 'EQ' ? 'ml-auto' : ''} flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-50`}
              onClick={() => setIsMapOnly(true)}
              title="Show only the map, in the whole window, with a full legend"
              type="button"
            >
              <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Map only
            </button>
          </div>

          {isMapOnly ? (
            <div className="flex h-[520px] w-full flex-col items-center justify-center gap-3 bg-slate-50 text-sm text-slate-500 sm:h-[640px] md:h-auto md:flex-1">
              The map is open in the map-only view.
              <button
                className="rounded-full border border-slate-300 bg-white px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                onClick={() => setIsMapOnly(false)}
                type="button"
              >
                Back to this page
              </button>
            </div>
          ) : (
            <div className="h-[520px] w-full sm:h-[640px] md:h-auto md:flex-1" ref={mapContainerRef} />
          )}

          {isMapOnly
            ? createPortal(
                <div aria-label="Map only" aria-modal="true" className="fixed inset-0 z-[1600] flex flex-col bg-white" role="dialog">
                  <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-[linear-gradient(90deg,#e8f1fd_0%,#f6fbff_100%)] px-4 py-3 sm:px-5">
                    <div className="mr-2">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        {selectedType === 'EQ' ? 'Seismic Mapping — Philippines' : 'Approved Report Mapping'}
                      </p>
                      <h2 className="text-lg font-bold text-slate-900">Lucena Incident Map</h2>
                    </div>
                    {typeTabs}
                    {layerButtons}
                    <button
                      className="rounded-full bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-700"
                      onClick={() => setIsMapOnly(false)}
                      title="Close (Esc)"
                      type="button"
                    >
                      Close
                    </button>
                  </div>
                  <div className="relative min-h-0 flex-1">
                    <div className="absolute inset-0" ref={mapContainerRef} />
                    <div className="pointer-events-none absolute bottom-4 left-4 top-4 z-[1000] flex items-end">
                      <div className="pointer-events-auto max-h-full">
                        <MapLegend
                          isEqView={selectedType === 'EQ'}
                          showFaultLines={showFaultLines}
                          showHeatmap={selectedType === 'EQ' ? showHeatmap : showIncidentHeatmap}
                          typeItems={plottedTypeLegend}
                        />
                      </div>
                    </div>
                  </div>
                </div>,
                document.body,
              )
            : null}
        </div>

        <aside className="overflow-x-hidden rounded-[28px] border border-slate-200 bg-white p-4 shadow-[0_12px_32px_rgba(15,23,42,0.08)] sm:p-5 md:h-[calc(100vh-13rem)] md:overflow-hidden">
          {selectedType === 'EQ' ? (
            <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[28px] border border-emerald-100 bg-[radial-gradient(circle_at_top_left,#d1fae5_0%,#f0fdf4_34%,#ffffff_100%)] shadow-[0_14px_34px_rgba(15,23,42,0.08)]">
              <div className="border-b border-emerald-100 bg-white/70 px-4 py-4 backdrop-blur sm:px-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-700">
                      Seismic Events
                    </p>

                    <h3 className="mt-1 text-xl font-black tracking-tight text-slate-900">
                      Earthquake Monitoring
                    </h3>

                    <p className="mt-1 text-xs leading-relaxed text-slate-500">
                      Live earthquake records for the Philippines and nearby areas.
                    </p>
                  </div>

                  <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-800">
                    {eqFetchStatus === 'loading' ? 'Loading' : `${earthquakeSummary.total} events`}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  <div className="rounded-2xl border border-emerald-100 bg-white/85 p-3 text-center shadow-sm">
                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">Strongest</p>
                    <p className="mt-1 text-xl font-black text-emerald-700">M{earthquakeSummary.strongest}</p>
                  </div>
                  <div className="rounded-2xl border border-orange-100 bg-white/85 p-3 text-center shadow-sm">
                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">M4+</p>
                    <p className="mt-1 text-xl font-black text-orange-600">{earthquakeSummary.significant}</p>
                  </div>
                  <div className="rounded-2xl border border-blue-100 bg-white/85 p-3 text-center shadow-sm">
                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">30 Days</p>
                    <p className="mt-1 text-xl font-black text-blue-600">{earthquakeSummary.recent}</p>
                  </div>
                </div>

                <p className="mt-3 rounded-2xl border border-emerald-100 bg-emerald-50/70 px-3 py-2 text-xs leading-relaxed text-emerald-800">
                  {eqLastRefreshed
                    ? `Last updated ${eqLastRefreshed.toLocaleTimeString('en-PH', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}`
                    : 'Waiting for earthquake data'}
                  {eqIsRefreshing ? ' · Refreshing…' : ''}
                </p>
              </div>

              <div className="min-h-0 flex-1 overflow-hidden px-4 py-4 sm:px-5">

              {eqFetchStatus === 'loading' ? (
                <div className="mt-4 flex items-center gap-3">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
                  <span className="text-sm text-slate-600">Fetching seismic data…</span>
                </div>
              ) : eqFetchStatus === 'error' ? (
                <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-center">
                  <p className="text-sm font-semibold text-red-800">Failed to load seismic data</p>

                  <button
                    className="mt-3 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-800 hover:bg-red-50"
                    onClick={() => void loadEarthquakes()}
                    type="button"
                  >
                    Retry
                  </button>
                </div>
              ) : (
                <>
                  <div className="mt-4">
                    <input
                      className="w-full rounded-2xl border border-emerald-100 bg-white px-4 py-3 text-sm font-medium text-slate-800 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                      onChange={(event) => setEqSearchQuery(event.target.value)}
                      placeholder="Search earthquake location or event"
                      type="text"
                      value={eqSearchQuery}
                    />
                  </div>

                  <div className="mt-4 max-h-[calc(100vh-27rem)] min-h-[320px] space-y-3 overflow-y-auto pr-1">
                    {filteredEarthquakeIncidentCards.length === 0 ? (
                      <div className="rounded-xl border border-slate-200 bg-white p-3 text-center text-xs text-slate-500">
                        No matching earthquake event found.
                      </div>
                    ) : (
                      filteredEarthquakeIncidentCards.map((incident) => (
                        <article className="group rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md" key={incident.id}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="inline-flex rounded-lg bg-emerald-500 px-2 py-1 text-[10px] font-black text-white shadow-sm">
                                  EQ
                                </span>

                                <p className="truncate text-sm font-semibold text-slate-900">
                                  {incident.title}
                                </p>
                              </div>

                              <p className="mt-1 pl-7 text-xs text-slate-500">{incident.time}</p>
                              <p className="mt-1 pl-7 text-xs text-slate-500">{incident.location}</p>
                            </div>

                            <span className="shrink-0 rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-[10px] font-black text-emerald-700">
                              M{incident.magnitude.toFixed(1)}
                            </span>
                          </div>

                          <p className="mt-2 pl-7 text-xs text-slate-600">{incident.description}</p>
                        </article>
                      ))
                    )}
                  </div>
                </>
              )}
              </div>
            </div>
          ) : (
            <div className="flex h-full min-h-0 flex-col">
              <div className="border-b border-slate-200 pb-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Responder Reports</p>
                <h2 className="mt-1 text-xl font-bold text-slate-900 sm:text-2xl">
                  {selectedType === 'FR' ? 'Fire Incident Reports' : 'Accident & Other Incident Reports'}
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  {hazardTypeMeta[selectedType].description}. The filters on the map apply to both lists.
                </p>

                <div className="mt-4 grid grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1" role="tablist" aria-label="Report list">
                  {([
                    ['review', 'For review', reviewIncidents.length],
                    ['map', 'On map', onMapListIncidents.length],
                  ] as const).map(([tab, label, count]) => (
                    <button
                      aria-selected={sideTab === tab}
                      className={`rounded-xl px-3 py-2 text-xs font-bold transition ${sideTab === tab ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                      key={tab}
                      onClick={() => setSideTab(tab)}
                      role="tab"
                      type="button"
                    >
                      {label} <span className="ml-1 rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] text-slate-700">{count}</span>
                    </button>
                  ))}
                </div>

                <input
                  aria-label="Search reports"
                  className="mt-3 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  onChange={(event) => setListSearch(event.target.value)}
                  placeholder="Search code, location, team..."
                  type="search"
                  value={listSearch}
                />
              </div>

              {reportsError ? (
                <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
                  {reportsError}{' '}
                  <button className="underline" onClick={() => void loadIncidentReports()} type="button">Retry</button>
                </div>
              ) : null}

              <div className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1" ref={sideListRef}>
                {sideListIncidents.slice(0, visibleListCount).map((incident) => (
                  <article
                    className="rounded-2xl border border-slate-200 bg-[#fbfdff] p-4 shadow-[0_8px_20px_rgba(15,23,42,0.05)]"
                    key={incident.id}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <span
                          className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
                          style={{ backgroundColor: incident.color }}
                        >
                          {incident.incidentTypeLabel}
                        </span>
                        <p className="mt-1.5 truncate text-sm font-bold text-slate-900">{incident.title}</p>
                      </div>

                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${operationalStatusClass[incident.operationalStatus]}`}>
                          {incident.operationalStatus}
                        </span>
                        {incident.isNew && !viewedReportIds.includes(incident.id) ? (
                          <span className="animate-pulse rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white">
                            New
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-xs text-slate-500">
                      <dt>Barangay</dt>
                      <dd className="truncate font-semibold text-slate-700">{incident.barangay}</dd>
                      <dt>Date</dt>
                      <dd className="font-semibold text-slate-700">
                        {incident.date ? incident.date.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '-'} · {incident.time}
                      </dd>
                      <dt>Severity</dt>
                      <dd className="font-semibold text-slate-700">{incident.severity}</dd>
                      <dt>Team</dt>
                      <dd className="truncate font-semibold text-slate-700">{incident.responseTeam}</dd>
                    </dl>

                    <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-600">{incident.description}</p>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                        onClick={() => handleViewIncident(incident)}
                        type="button"
                      >
                        View Details
                      </button>

                      {incident.status === 'pending' ? (
                        <button
                          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          onClick={() => handleEditIncident(incident)}
                          type="button"
                        >
                          Edit Details
                        </button>
                      ) : (
                        <button
                          className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                          onClick={() => setFocusRequest({ id: incident.id, at: Date.now() })}
                          type="button"
                        >
                          Show on map
                        </button>
                      )}
                    </div>
                  </article>
                ))}

                {sideListIncidents.length > LIST_PAGE_SIZE ? (
                  <div className="py-2 text-center text-[11px] font-semibold text-slate-400" ref={sideListEndRef}>
                    {hasMoreListItems
                      ? `Showing ${visibleListCount} of ${sideListIncidents.length}. Scroll for more...`
                      : `All ${sideListIncidents.length} reports shown`}
                  </div>
                ) : null}

                {sideListIncidents.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center">
                    <p className="text-sm font-semibold text-slate-700">
                      {reportsLoading && rawReports.length === 0
                        ? 'Loading reports...'
                        : sideTab === 'review'
                          ? 'No reports waiting for review.'
                          : 'No approved reports on the map.'}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {hasActiveFilters || listSearch
                        ? 'Try clearing the filters or the search.'
                        : sideTab === 'review'
                          ? 'New responder reports for this tab will appear here.'
                          : 'Approve a report to plot it on the map.'}
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </aside>
      </div>

      {approvalSuccess.open ? (
        <div className="fixed inset-0 z-[1500] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
          <section className="w-full max-w-md overflow-hidden rounded-[28px] border border-emerald-100 bg-white shadow-[0_28px_70px_rgba(15,23,42,0.30)]">
            <div className="bg-gradient-to-br from-emerald-50 via-white to-blue-50 px-6 py-7 text-center">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-4xl shadow-inner">
                🎉
              </div>

              <p className="mt-5 text-xs font-black uppercase tracking-[0.22em] text-emerald-700">
                Approval Complete
              </p>

              <h3 className="mt-2 text-2xl font-black text-slate-900">
                {approvalSuccess.title}
              </h3>

              <p className="mt-3 text-sm leading-6 text-slate-600">
                {approvalSuccess.message}
              </p>

              {approvalSuccess.reportTitle ? (
                <div className="mt-4 rounded-2xl border border-emerald-100 bg-white/80 px-4 py-3 text-sm font-bold text-slate-800 shadow-sm">
                  {approvalSuccess.reportTitle}
                </div>
              ) : null}

              <button
                className="mt-6 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white shadow-[0_12px_24px_rgba(5,150,105,0.25)] transition hover:bg-emerald-700 active:scale-95"
                onClick={() =>
                  setApprovalSuccess({
                    open: false,
                    title: '',
                    message: '',
                    reportTitle: '',
                  })
                }
                type="button"
              >
                Continue
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {selectedIncident ? (
        <div
          className="fixed inset-0 z-[1300] overflow-y-auto bg-slate-900/40 p-4 backdrop-blur-sm sm:p-8"
          onClick={() => setSelectedIncident(null)}
        >
          <div className="mx-auto my-6 w-full max-w-3xl sm:my-8" onClick={(event) => event.stopPropagation()}>
            <section
              aria-label="Report details"
              className="flex max-h-[88vh] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_20px_40px_rgba(15,23,42,0.22)]"
              role="dialog"
            >
              <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 sm:px-6">
                <div>
                  <span
                    className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
                    style={{ backgroundColor: selectedIncident.color }}
                  >
                    {selectedIncident.incidentTypeLabel}
                  </span>
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

              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
                <p className="text-sm leading-relaxed text-slate-600 sm:text-base">{selectedIncident.description}</p>

                <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                  {([
                    ['Barangay', selectedIncident.barangay],
                    ['Location', selectedIncident.location],
                    ['Date', `${selectedIncident.date ? selectedIncident.date.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }) : '-'} · ${selectedIncident.time}`],
                    ['Severity', selectedIncident.severity],
                    ['Response Team', selectedIncident.responseTeam],
                    ['Operation Status', selectedIncident.operationalStatus],
                    ['Coordinates', `${selectedIncident.coordinates[0].toFixed(5)}, ${selectedIncident.coordinates[1].toFixed(5)}`],
                  ] as const).map(([label, value]) => (
                    <p className="text-slate-600" key={label}>
                      <span className="font-semibold text-slate-800">{label}:</span> {value}
                    </p>
                  ))}
                  <p className="text-slate-600">
                    <span className="font-semibold text-slate-800">Review:</span>{' '}
                    <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${reviewStatusClass[selectedIncident.status]}`}>
                      {selectedIncident.status === 'approved' ? 'Approved' : 'Pending'}
                    </span>
                  </p>
                </div>

                {getDetailRows(selectedIncident.rawReport).length > 0 ? (
                  <div className="mt-5 border-t border-slate-200 pt-4">
                    <p className="text-sm font-bold text-slate-900">{selectedIncident.incidentTypeLabel} details</p>
                    <dl className="mt-2 grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-2">
                      {getDetailRows(selectedIncident.rawReport).map(([label, value]) => (
                        <div className="flex gap-2" key={label}>
                          <dt className="font-semibold text-slate-800">{label}:</dt>
                          <dd className="text-slate-600">{value}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                ) : null}

                {selectedIncident.victims && selectedIncident.victims.length > 0 ? (
                  <div className="mt-5 border-t border-slate-200 pt-4">
                    <p className="text-sm font-bold text-slate-900">Victims ({selectedIncident.victims.length})</p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {selectedIncident.victims.map((victim, index) => (
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600" key={victim.id || index}>
                          <p className="font-semibold text-slate-800">Victim {index + 1}: {victim.name}</p>
                          <p>Age: {victim.age} · Gender: {victim.gender || 'N/A'}</p>
                          <p>Address: {victim.address}</p>
                          <p>Condition: {victim.condition}</p>
                          {getVictimDetailRows(selectedIncident.rawReport, index).map(([label, value]) => (
                            <p key={label}>{label}: {value}</p>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {actionError ? (
                  <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700" role="alert">
                    {actionError}
                  </p>
                ) : null}
              </div>

              <div className="shrink-0 border-t border-slate-200 bg-white px-5 py-4 sm:px-6">
                {selectedIncident.status === 'pending' ? (
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      onClick={() => handleEditIncident(selectedIncident)}
                      type="button"
                    >
                      Edit Details
                    </button>
                    <button
                      className="rounded-lg border border-emerald-600 bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                      disabled={approvingId === selectedIncident.id}
                      onClick={() => void handleApprove(selectedIncident)}
                      type="button"
                    >
                      {approvingId === selectedIncident.id ? 'Approving...' : 'Approve Report'}
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-slate-500">
                      Approved and plotted on the map. Update its status from the Incident Reports page.
                    </p>
                    <button
                      className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                      onClick={() => {
                        setFocusRequest({ id: selectedIncident.id, at: Date.now() })
                        setSelectedIncident(null)
                      }}
                      type="button"
                    >
                      Show on map
                    </button>
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      ) : null}

      {editingIncident && editForm ? (
        <div
          className="fixed inset-0 z-[1400] overflow-y-auto bg-slate-900/50 p-4 backdrop-blur-sm sm:p-8"
          onClick={() => {
            if (editSaving) return
            setEditingIncident(null)
            setEditForm(null)
          }}
        >
          <div className="mx-auto my-6 w-full max-w-3xl" onClick={(event) => event.stopPropagation()}>
            <section aria-label="Edit report" className="rounded-2xl border border-slate-200 bg-white shadow-[0_20px_40px_rgba(15,23,42,0.22)]" role="dialog">
              <div className="border-b border-slate-200 px-5 py-4 sm:px-6">
                <p className="text-xs font-bold uppercase tracking-[0.15em] text-blue-700">Edit Report Before Approval</p>
                <h3 className="mt-1 text-xl font-black text-slate-900">{editingIncident.title}</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Changes are saved to the report. Incident type and type details come from the responder and cannot be changed here.
                  Severity is set when the report is approved.
                </p>
              </div>

              <div className="grid gap-4 px-5 py-5 sm:grid-cols-2 sm:px-6">
                <label className="block sm:col-span-2">
                  <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Location</span>
                  <input
                    className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
                    onChange={(event) => setEditForm({ ...editForm, location: event.target.value })}
                    value={editForm.location}
                  />
                </label>

                <label className="block sm:col-span-2">
                  <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Response Team</span>
                  <input
                    className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
                    onChange={(event) => setEditForm({ ...editForm, responseTeam: event.target.value })}
                    value={editForm.responseTeam}
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Latitude</span>
                  <input
                    className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
                    inputMode="decimal"
                    onChange={(event) => setEditForm({ ...editForm, latitude: event.target.value })}
                    value={editForm.latitude}
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Longitude</span>
                  <input
                    className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
                    inputMode="decimal"
                    onChange={(event) => setEditForm({ ...editForm, longitude: event.target.value })}
                    value={editForm.longitude}
                  />
                </label>

                <label className="block sm:col-span-2">
                  <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Description</span>
                  <textarea
                    className="mt-2 min-h-32 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
                    onChange={(event) => setEditForm({ ...editForm, description: event.target.value })}
                    value={editForm.description}
                  />
                </label>

                {editError ? (
                  <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 sm:col-span-2" role="alert">
                    {editError}
                  </p>
                ) : null}
              </div>

              <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 px-5 py-4 sm:px-6">
                <button
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  disabled={editSaving}
                  onClick={() => {
                    setEditingIncident(null)
                    setEditForm(null)
                  }}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="rounded-xl bg-blue-800 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-900 disabled:opacity-60"
                  disabled={editSaving}
                  onClick={() => void handleSaveEdit()}
                  type="button"
                >
                  {editSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </section>
          </div>
        </div>
      ) : null}
    </section>
  )
}