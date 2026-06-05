import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import L, { type LatLngBoundsExpression } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.heat'
import confetti from 'canvas-confetti'
import type { HazardType } from '../data/adminOperations'
import {
  getIncidentReports,
  updateIncidentReportStatus,
  type IncidentReport,
} from '../services/incidents'
import {
  type EarthquakeEvent,
  type FaultLineFeatureCollection,
  type HeatPoint,
  fetchQuezonFaultLines,
  fetchQuezonRegionEarthquakes,
  toHeatPoints,
} from '../services/earthquakes'

type IncidentMapFilter = HazardType
type ReportReviewStatus = 'pending' | 'approved'
type OperationalStatus = 'On-going' | 'Resolved'

type AdminIncidentMapPanelProps = {
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
  status: ReportReviewStatus
  code: 'FR' | 'AC'
  incidentTypeLabel: string
  location: string
  severity: 'Low' | 'Moderate' | 'High' | 'Critical'
  operationalStatus: OperationalStatus
  responseTeam: string
  description: string
  coordinates: [number, number]
  victims: IncidentReport['victims']
  rawReport: IncidentReport
  isNew: boolean
}

type EditableIncident = {
  incidentTypeLabel: string
  location: string
  severity: 'Low' | 'Moderate' | 'High' | 'Critical'
  operationalStatus: OperationalStatus
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

const quezonRegionBounds: LatLngBoundsExpression = [
  [13.72, 121.3],
  [14.12, 121.92],
]

const lucenaCityCenter: [number, number] = [13.94, 121.62]
const nearestFaultLinesLimit = 5

const hazardColors: Record<HazardType, string> = {
  EQ: '#4ade80',
  FR: '#fb923c',
  AC: '#facc15',
}

const hazardTypeMeta: Record<HazardType, { label: string; color: string }> = {
  EQ: { label: 'Earthquake', color: hazardColors.EQ },
  FR: { label: 'Fire', color: hazardColors.FR },
  AC: { label: 'Accident', color: hazardColors.AC },
}

const reviewStatusClass: Record<ReportReviewStatus, string> = {
  pending: 'border border-amber-200 bg-amber-50 text-amber-800',
  approved: 'border border-emerald-200 bg-emerald-50 text-emerald-800',
}

function getNormalizedStatusText(status?: string): string {
  return String(status || '').trim().toLowerCase()
}

function isApprovedStatus(status?: string): boolean {
  const value = getNormalizedStatusText(status)

  // IMPORTANT:
  // Only an explicit report approval should make a responder report plottable.
  // Do not treat backend/admin operational statuses such as verified/resolved/completed
  // as approved here, because newly submitted reports may already create admin
  // incident records but still need review first.
  return value === 'approved' || value === 'approve' || value === 'approved report'
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

function getReportIncidentType(report: IncidentReport): string {
  return report.incidentType || report.incident_type || ''
}

function getReportResponderTeam(report: IncidentReport): string {
  return report.responderTeam || report.responder_team || 'Responder Team'
}

function getReportTime(report: IncidentReport): string {
  const time = report.timeOccurred || report.time_occurred

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

function getReportDateValue(report: IncidentReport): number {
  const createdAt = report.createdAt || report.created_at
  if (createdAt) {
    const createdDate = new Date(createdAt).getTime()
    if (Number.isFinite(createdDate)) return createdDate
  }

  const time = report.timeOccurred || report.time_occurred
  if (time) {
    const today = new Date().toISOString().slice(0, 10)
    const timeDate = new Date(`${today}T${time}`).getTime()
    if (Number.isFinite(timeDate)) return timeDate
  }

  return 0
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

function mapReportToIncident(report: IncidentReport): MapIncident {
  const incidentTypeLabel = getReportIncidentType(report) || 'Incident Report'
  const incidentType = incidentTypeLabel.toLowerCase()

  const code: MapIncident['code'] = incidentType.includes('fire') ? 'FR' : 'AC'
  const victimCount = getVictimCount(report)
  const location = report.location || 'Lucena City'

  return {
    id: report.id,
    title: `${incidentTypeLabel} - ${getReportCode(report)}`,
    time: getReportTime(report),
    status: normalizeStatus(report.status),
    code,
    incidentTypeLabel,
    location,
    severity: victimCount >= 5 ? 'Critical' : victimCount >= 3 ? 'High' : victimCount >= 1 ? 'Moderate' : 'Low',
    operationalStatus: isApprovedStatus(report.status) ? 'Resolved' : 'On-going',
    responseTeam: getReportResponderTeam(report),
    description: report.description || report.actionTaken || report.action_taken || 'No description provided.',
    coordinates: getReportCoordinates(report, location),
    victims: report.victims || [],
    rawReport: report,
    isNew: isNewReport(report),
  }
}


function escapePopupText(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function buildIncidentPopupHtml(incident: MapIncident, statusLabel: string): string {
  const victimCount = incident.victims?.length ?? getVictimCount(incident.rawReport)

  return `
    <div style="min-width: 230px; max-width: 280px; font-family: Inter, system-ui, sans-serif;">
      <div style="font-size: 13px; font-weight: 800; color: #0f172a; margin-bottom: 6px;">
        ${escapePopupText(incident.title)}
      </div>
      <div style="font-size: 12px; color: #475569; line-height: 1.55;">
        <strong>Location:</strong> ${escapePopupText(incident.location)}<br/>
        <strong>Time:</strong> ${escapePopupText(incident.time)}<br/>
        <strong>Type:</strong> ${escapePopupText(incident.incidentTypeLabel)}<br/>
        <strong>Severity:</strong> ${escapePopupText(incident.severity)}<br/>
        <strong>Status:</strong> ${escapePopupText(statusLabel)}<br/>
        <strong>Team:</strong> ${escapePopupText(incident.responseTeam)}<br/>
        <strong>Victims:</strong> ${victimCount}
      </div>
      <div style="margin-top: 8px; border-top: 1px solid #e2e8f0; padding-top: 8px; font-size: 12px; color: #334155; line-height: 1.45;">
        ${escapePopupText(incident.description)}
      </div>
      <div style="margin-top: 8px; font-size: 11px; font-weight: 700; color: #2563eb;">
        Click marker to open full details
      </div>
    </div>
  `
}

function getSavedEditedIncidents(): Record<string, Partial<MapIncident>> {
  try {
    return JSON.parse(localStorage.getItem('adminEditedIncidents') || '{}')
  } catch {
    return {}
  }
}

function saveEditedIncident(id: string, data: Partial<MapIncident>): void {
  const current = getSavedEditedIncidents()
  localStorage.setItem('adminEditedIncidents', JSON.stringify({ ...current, [id]: { ...current[id], ...data } }))
}

function applySavedEdit(incident: MapIncident): MapIncident {
  const saved = getSavedEditedIncidents()[incident.id]
  if (!saved) return incident

  // Do not allow old localStorage edits to force a report into approved/resolved.
  // Approval must come from the current backend report status or the Approve button.
  const {
    status: _ignoredStatus,
    operationalStatus: _ignoredOperationalStatus,
    rawReport: _ignoredRawReport,
    ...safeSavedDisplayFields
  } = saved

  return {
    ...incident,
    ...safeSavedDisplayFields,
    status: normalizeStatus(incident.rawReport.status),
    operationalStatus: isApprovedStatus(incident.rawReport.status) ? 'Resolved' : 'On-going',
    rawReport: incident.rawReport,
  }
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

function getFaultLineDistanceScore(geometry: GeoJSON.Geometry | null | undefined): number {
  if (!geometry) return Number.POSITIVE_INFINITY

  const targetPoint = L.CRS.EPSG3857.project(L.latLng(lucenaCityCenter[0], lucenaCityCenter[1]))
  let nearestDistance = Number.POSITIVE_INFINITY

  const getPointDistanceToSegment = (startCoordinate: number[], endCoordinate: number[]) => {
    const startPoint = L.CRS.EPSG3857.project(L.latLng(startCoordinate[1], startCoordinate[0]))
    const endPoint = L.CRS.EPSG3857.project(L.latLng(endCoordinate[1], endCoordinate[0]))

    const deltaX = endPoint.x - startPoint.x
    const deltaY = endPoint.y - startPoint.y
    const segmentLengthSquared = deltaX ** 2 + deltaY ** 2

    if (segmentLengthSquared === 0) {
      return Math.hypot(targetPoint.x - startPoint.x, targetPoint.y - startPoint.y)
    }

    const projectionRatio = Math.max(
      0,
      Math.min(
        1,
        ((targetPoint.x - startPoint.x) * deltaX + (targetPoint.y - startPoint.y) * deltaY) /
          segmentLengthSquared,
      ),
    )

    const projectedPointX = startPoint.x + projectionRatio * deltaX
    const projectedPointY = startPoint.y + projectionRatio * deltaY

    return Math.hypot(targetPoint.x - projectedPointX, targetPoint.y - projectedPointY)
  }

  const inspectLine = (coordinates: number[][]) => {
    for (let index = 0; index < coordinates.length - 1; index += 1) {
      nearestDistance = Math.min(
        nearestDistance,
        getPointDistanceToSegment(coordinates[index], coordinates[index + 1]),
      )
    }
  }

  if (geometry.type === 'LineString') inspectLine(geometry.coordinates)
  if (geometry.type === 'MultiLineString') geometry.coordinates.forEach((segment) => inspectLine(segment))

  return nearestDistance
}

export function AdminIncidentMapPanel({
  onIncidentReportApproved,
  selectedType,
  onSelectType,
}: AdminIncidentMapPanelProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)

  const [selectedIncident, setSelectedIncident] = useState<MapIncident | null>(null)
  const [editingIncident, setEditingIncident] = useState<MapIncident | null>(null)
  const [editForm, setEditForm] = useState<EditableIncident | null>(null)
  const [incidentReports, setIncidentReports] = useState<MapIncident[]>([])
  const [reportsLoading, setReportsLoading] = useState(false)
  const [reportsError, setReportsError] = useState('')
  const [earthquakeEvents, setEarthquakeEvents] = useState<EarthquakeEvent[]>([])
  const [faultLines, setFaultLines] = useState<FaultLineFeatureCollection | null>(null)
  const [barangayLayer, setBarangayLayer] =
    useState<GeoJSON.FeatureCollection<GeoJSON.Geometry, Record<string, unknown>> | null>(null)
  const [eqHeatPoints, setEqHeatPoints] = useState<HeatPoint[]>([])
  const [eqFetchStatus, setEqFetchStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [faultLineStatus, setFaultLineStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [showHeatmap, setShowHeatmap] = useState(true)
  const [showFaultLines, setShowFaultLines] = useState(true)
  const [eqLastRefreshed, setEqLastRefreshed] = useState<Date | null>(null)
  const [eqIsRefreshing, setEqIsRefreshing] = useState(false)
  const [eqSearchQuery, setEqSearchQuery] = useState('')
  const [accidentTypeFilter, setAccidentTypeFilter] = useState('all')
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
      const mappedReports = reports.map((report) => applySavedEdit(mapReportToIncident(report)))

      setIncidentReports(mappedReports)
    } catch (error) {
      console.error('[AdminIncidentMapPanel] Failed to load responder incident reports:', error)
      setReportsError('Failed to load responder reports.')
      setIncidentReports([])
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

  const accidentTypeOptions = useMemo(() => {
    const uniqueTypes = new Set(
      incidentReports
        .filter((incident) => incident.code === 'AC')
        .map((incident) => incident.incidentTypeLabel)
        .filter(Boolean),
    )

    return Array.from(uniqueTypes).sort((left, right) => left.localeCompare(right))
  }, [incidentReports])

  const filteredIncidents = useMemo(() => {
    // Right-side review list rule:
    // Pending / Submitted / On-going reports must stay visible for review.
    // Approved reports must disappear from the side list because they are already plotted on the map.
    if (selectedType === 'EQ') return []

    const baseReports = incidentReports.filter(
      (incident) => incident.code === selectedType && incident.status !== 'approved',
    )

    const filteredReports =
      selectedType === 'AC' && accidentTypeFilter !== 'all'
        ? baseReports.filter((incident) => incident.incidentTypeLabel === accidentTypeFilter)
        : baseReports

    return [...filteredReports].sort(
      (left, right) => getReportDateValue(right.rawReport) - getReportDateValue(left.rawReport),
    )
  }, [accidentTypeFilter, incidentReports, selectedType])

  const plottableMapIncidents = useMemo(
    () =>
      incidentReports.filter((incident) => {
        if (incident.code !== selectedType) return false

        // Strict rule:
        // Do NOT plot Submitted, Pending, or On-going reports.
        // Only Approved reports are allowed to display on the map.
        return incident.status === 'approved'
      }),
    [incidentReports, selectedType],
  )

  const incidentCounts = useMemo(
    () => ({
      EQ: earthquakeEvents.length,
      FR: incidentReports.filter((incident) => incident.code === 'FR' && incident.status === 'approved').length,
      AC: incidentReports.filter((incident) => incident.code === 'AC' && incident.status === 'approved').length,
    }),
    [incidentReports, earthquakeEvents.length],
  )

  const loadEarthquakes = useCallback(async (silent = false) => {
    if (silent) {
      setEqIsRefreshing(true)
    } else {
      setEqFetchStatus('loading')
    }

    try {
      const events = await fetchQuezonRegionEarthquakes(1825, 1.0)
      setEarthquakeEvents(events)
      setEqHeatPoints(toHeatPoints(events))
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

  const nearestFaultLineFeatures = useMemo(() => {
    if (!faultLines || !faultLines.features) return []

    return faultLines.features
      .map((feature, index) => ({
        feature,
        index,
        distanceScore: getFaultLineDistanceScore(feature.geometry),
      }))
      .filter((item) => Number.isFinite(item.distanceScore))
      .sort((left, right) => left.distanceScore - right.distanceScore)
      .slice(0, nearestFaultLinesLimit)
  }, [faultLines])

  const nearestFaultLineIndexes = useMemo(
    () => new Set(nearestFaultLineFeatures.map((item) => item.index)),
    [nearestFaultLineFeatures],
  )

  const nonHighlightedFaultLineCollection = useMemo(() => {
    if (!faultLines || !faultLines.features) return null

    return {
      ...faultLines,
      features: faultLines.features.filter((_, index) => !nearestFaultLineIndexes.has(index)),
    }
  }, [faultLines, nearestFaultLineIndexes])

  const highlightedFaultLineCollection = useMemo(() => {
    if (!faultLines) return null

    return {
      ...faultLines,
      features: nearestFaultLineFeatures.map((item) => item.feature),
    }
  }, [faultLines, nearestFaultLineFeatures])

  useEffect(() => {
    if (selectedType === 'EQ' && earthquakeEvents.length === 0 && eqFetchStatus === 'idle') {
      void loadEarthquakes()
    }
  }, [selectedType, earthquakeEvents.length, eqFetchStatus, loadEarthquakes])

  useEffect(() => {
    if (selectedType !== 'EQ' || faultLines) return

    let isCancelled = false
    setFaultLineStatus('loading')

    void fetchQuezonFaultLines()
      .then((data) => {
        if (!isCancelled) {
          setFaultLines(data)
          setFaultLineStatus('idle')
        }
      })
      .catch(() => {
        if (!isCancelled) setFaultLineStatus('error')
      })

    return () => {
      isCancelled = true
    }
  }, [selectedType, faultLines])

  useEffect(() => {
    if (selectedType !== 'EQ') return

    const intervalId = setInterval(() => {
      void loadEarthquakes(true)
    }, 5 * 60 * 1000)

    return () => clearInterval(intervalId)
  }, [selectedType, loadEarthquakes])

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
      mapInstanceRef.current.remove()
      mapInstanceRef.current = null
    }

    const isEqView = selectedType === 'EQ'

    const map = L.map(mapContainerRef.current, {
      zoomControl: true,
      attributionControl: false,
      maxBounds: isEqView ? philippinesBounds : lucenaBounds,
      maxBoundsViscosity: 1,
      minZoom: isEqView ? 6 : 12,
      maxZoom: 18,
    })

    if (isEqView) {
      map.fitBounds(quezonRegionBounds)
    } else {
      map.fitBounds(lucenaBounds, { padding: [18, 18] })
    }

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO',
    }).addTo(map)

    if (barangayLayer) {
      const barangayPane = map.getPane('barangay-pane') ?? map.createPane('barangay-pane')
      barangayPane.style.zIndex = '330'
      barangayPane.style.pointerEvents = 'auto'

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
          weight: 0.9,
          opacity: 0.76,
          fillColor: getBarangayColor(feature),
          fillOpacity: 0.01,
          lineJoin: 'round',
          lineCap: 'round',
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

      barangayGeoJson.addTo(map)
    }

    if (isEqView) {
      if (showHeatmap && eqHeatPoints.length > 0) {
        L.heatLayer(eqHeatPoints, {
          minOpacity: 0.35,
          radius: 28,
          blur: 22,
          max: 1.0,
          gradient: {
            0.14: '#38bdf8',
            0.4: '#22c55e',
            0.6: '#facc15',
            0.8: '#f97316',
            1.0: '#dc2626',
          },
        }).addTo(map)
      }

      if (showFaultLines && nonHighlightedFaultLineCollection) {
        const faultPane = map.getPane('fault-lines-pane') ?? map.createPane('fault-lines-pane')
        faultPane.style.zIndex = '420'

        L.geoJSON(nonHighlightedFaultLineCollection, {
          pane: 'fault-lines-pane',
          style: {
            color: '#ef4444',
            weight: 2.5,
            opacity: 0.78,
          },
        }).addTo(map)
      }

      if (showFaultLines && highlightedFaultLineCollection) {
        const highlightPane = map.getPane('fault-highlights-pane') ?? map.createPane('fault-highlights-pane')
        highlightPane.style.zIndex = '430'

        L.geoJSON(highlightedFaultLineCollection, {
          pane: 'fault-highlights-pane',
          style: {
            color: '#f59e0b',
            weight: 5,
            opacity: 0.98,
          },
        }).addTo(map)
      }

      if (showHeatmap) {
        earthquakeEvents
          .filter((event) => event.magnitude >= 3.5)
          .forEach((event) => {
            L.circleMarker([event.lat, event.lng], {
              radius: Math.max(4, (event.magnitude - 1) * 3),
              color: '#ffffff',
              weight: 1,
              fillColor: hazardColors.EQ,
              fillOpacity: 0.85,
            })
              .addTo(map)
              .bindPopup(
                `<strong>M${event.magnitude.toFixed(1)}</strong><br/>${event.place}<br/><small>${event.time} · ${event.depth.toFixed(1)} km deep</small>`,
              )
          })
      }
    } else {
      const incidentPulsePane = map.getPane('incident-pulse-pane') ?? map.createPane('incident-pulse-pane')
      incidentPulsePane.style.zIndex = '650'
      incidentPulsePane.style.pointerEvents = 'auto'

      const incidentMarkerPane = map.getPane('incident-marker-pane') ?? map.createPane('incident-marker-pane')
      incidentMarkerPane.style.zIndex = '640'
      incidentMarkerPane.style.pointerEvents = 'auto'

      const popupPane = map.getPane('popupPane')
      if (popupPane) popupPane.style.zIndex = '1200'

      plottableMapIncidents.forEach((incident) => {
        const markerColor = hazardColors[incident.code]
        const statusLabel = 'Approved / Resolved'

        L.circleMarker(incident.coordinates, {
          pane: 'incident-marker-pane',
          radius: 17,
          stroke: false,
          fillColor: markerColor,
          fillOpacity: 0.26,
          interactive: false,
        }).addTo(map)

        const approvedMarker = L.circleMarker(incident.coordinates, {
          pane: 'incident-marker-pane',
          radius: 9,
          color: '#ffffff',
          weight: 2,
          fillColor: markerColor,
          fillOpacity: 0.98,
          bubblingMouseEvents: false,
        })
          .addTo(map)
          .bindPopup(buildIncidentPopupHtml(incident, statusLabel), {
            maxWidth: 320,
            closeButton: true,
          })

        approvedMarker.on('click', () => {
          approvedMarker.openPopup()
        })
      })
    }

    window.setTimeout(() => {
      map.invalidateSize()
    }, 0)

    mapInstanceRef.current = map

    return () => {
      map.remove()
      mapInstanceRef.current = null
    }
  }, [
    plottableMapIncidents,
    selectedType,
    eqHeatPoints,
    earthquakeEvents,
    showHeatmap,
    showFaultLines,
    nonHighlightedFaultLineCollection,
    highlightedFaultLineCollection,
    barangayLayer,
  ])

  function showApprovalCelebration(incident: MapIncident): void {
    confetti({
      particleCount: 160,
      spread: 90,
      origin: { y: 0.62 },
    })

    confetti({
      particleCount: 90,
      angle: 60,
      spread: 70,
      origin: { x: 0, y: 0.7 },
    })

    confetti({
      particleCount: 90,
      angle: 120,
      spread: 70,
      origin: { x: 1, y: 0.7 },
    })

    setApprovalSuccess({
      open: true,
      title: 'Report Approved',
      message: 'The incident report has been verified, plotted on the map, and moved to the Incident Reports page.',
      reportTitle: incident.title,
    })
  }

  function handleViewIncident(incident: MapIncident): void {
    setViewedReportIds(saveViewedReportId(incident.id))
    setSelectedIncident({ ...incident, isNew: false })
  }

  function handleMapTypeSelect(filter: IncidentMapFilter): void {
    onSelectType(filter)
  }

  async function handleSetReviewStatus(incident: MapIncident, status: ReportReviewStatus): Promise<void> {
    try {
      const backendStatus = status === 'approved' ? 'Approved' : 'Pending'
      const updatedReport = await updateIncidentReportStatus(incident.id, backendStatus)

      // Do not depend only on the backend response here. Some APIs return a
      // partial object after updating status, which can make the approved
      // accident disappear from the map because the mapper loses its original
      // coordinates/type. Keep the current incident data, then force the new
      // review/operation status locally. The next refresh will sync it again
      // from the backend.
      const responseMapped = updatedReport?.id ? applySavedEdit(mapReportToIncident(updatedReport)) : incident
      const mapped: MapIncident = {
        ...incident,
        ...responseMapped,
        id: incident.id,
        code: incident.code,
        coordinates: responseMapped.coordinates || incident.coordinates,
        status,
        operationalStatus: status === 'approved' ? 'Resolved' : 'On-going',
        rawReport: {
          ...incident.rawReport,
          ...(updatedReport || {}),
          status: backendStatus,
        },
      }

      setIncidentReports((current) =>
        current.map((item) => (item.id === incident.id ? mapped : item)),
      )

      if (status === 'approved' && selectedType !== incident.code) {
        onSelectType(incident.code)
      }

      if (selectedIncident?.id === incident.id) {
        setSelectedIncident(mapped)
      }

      if (editingIncident?.id === incident.id) {
        setEditingIncident(mapped)
      }

      if (status === 'approved') {
        setSelectedIncident(null)
        setEditingIncident(null)
        setEditForm(null)
        showApprovalCelebration(mapped)
      }

      if (status === 'approved') {
        onIncidentReportApproved?.()
      }

      window.setTimeout(() => {
        void loadIncidentReports()
      }, 300)
    } catch (error) {
      console.error('[AdminIncidentMapPanel] Failed to update report status:', error)
      alert('Failed to update report status.')
    }
  }

  function handleEditIncident(incident: MapIncident): void {
    setEditingIncident(incident)
    setEditForm({
      incidentTypeLabel: incident.incidentTypeLabel,
      location: incident.location,
      severity: incident.severity,
      operationalStatus: incident.operationalStatus,
      responseTeam: incident.responseTeam,
      description: incident.description,
      latitude: String(incident.coordinates[0]),
      longitude: String(incident.coordinates[1]),
    })
  }

  function handleSaveEdit(): void {
    if (!editingIncident || !editForm) return

    const lat = Number(editForm.latitude)
    const lng = Number(editForm.longitude)
    const coordinates: [number, number] =
      Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : editingIncident.coordinates

    const updatedIncident: MapIncident = {
      ...editingIncident,
      incidentTypeLabel: editForm.incidentTypeLabel,
      title: `${editForm.incidentTypeLabel} - ${getReportCode(editingIncident.rawReport)}`,
      location: editForm.location,
      severity: editForm.severity,
      operationalStatus: editForm.operationalStatus,
      responseTeam: editForm.responseTeam,
      description: editForm.description,
      coordinates,
    }

    saveEditedIncident(editingIncident.id, {
      incidentTypeLabel: updatedIncident.incidentTypeLabel,
      title: updatedIncident.title,
      location: updatedIncident.location,
      severity: updatedIncident.severity,
      operationalStatus: updatedIncident.operationalStatus,
      responseTeam: updatedIncident.responseTeam,
      description: updatedIncident.description,
      coordinates: updatedIncident.coordinates,
    })

    setIncidentReports((current) =>
      current.map((item) => (item.id === editingIncident.id ? updatedIncident : item)),
    )

    setSelectedIncident(updatedIncident)
    setEditingIncident(null)
    setEditForm(null)
  }

  return (
    <section className="px-4 py-5 sm:px-6 sm:py-8">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(320px,0.9fr)] xl:items-start">
        <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_12px_32px_rgba(15,23,42,0.08)] md:flex md:h-[calc(100vh-13rem)] md:flex-col">
          <div className="flex flex-col gap-4 border-b border-slate-200 bg-[linear-gradient(90deg,#e8f1fd_0%,#f6fbff_100%)] px-4 py-4 sm:px-5 sm:py-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                {selectedType === 'EQ' ? 'Seismic Mapping — Quezon Province' : 'Approved Report Mapping'}
              </p>

              <h2 className="mt-1 text-xl font-bold text-slate-900 sm:text-2xl">
                Lucena Incident Map
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                Only approved reports are plotted on the map. Submitted, pending, and on-going reports stay in the review list only.
              </p>
            </div>

            <div className="flex w-full flex-col gap-2 lg:w-auto lg:min-w-[360px] lg:items-end">
              <div className="flex flex-wrap gap-2 lg:justify-end">
                {(Object.keys(hazardTypeMeta) as HazardType[]).map((typeCode) => (
                  <button
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] transition ${
                      selectedType === typeCode
                        ? 'text-slate-950 shadow-[0_8px_18px_rgba(15,23,42,0.12)]'
                        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                    key={typeCode}
                    onClick={() => handleMapTypeSelect(typeCode)}
                    style={{
                      backgroundColor: selectedType === typeCode ? hazardTypeMeta[typeCode].color : undefined,
                      borderColor: selectedType === typeCode ? hazardTypeMeta[typeCode].color : undefined,
                    }}
                    type="button"
                  >
                    {hazardTypeMeta[typeCode].label}
                  </button>
                ))}
              </div>

              {selectedType === 'EQ' ? (
                <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white/75 px-3 py-2 backdrop-blur lg:justify-end">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Layers
                  </span>

                  <button
                    className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition ${
                      showHeatmap
                        ? 'border-emerald-500 bg-emerald-500 text-white'
                        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                    onClick={() => setShowHeatmap((value) => !value)}
                    type="button"
                  >
                    Heatmap
                  </button>

                  <button
                    className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition ${
                      showFaultLines
                        ? 'border-rose-300 bg-rose-50 text-rose-700'
                        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                    onClick={() => setShowFaultLines((value) => !value)}
                    type="button"
                  >
                    Fault Lines
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-4 py-3 text-xs text-slate-600 sm:px-5">
            {(Object.keys(hazardTypeMeta) as HazardType[]).map((typeCode) => (
              <div className="flex items-center gap-2" key={typeCode}>
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: hazardTypeMeta[typeCode].color }}
                />

                <span className="font-semibold text-slate-700">{hazardTypeMeta[typeCode].label}</span>

                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                  {incidentCounts[typeCode]}
                </span>
              </div>
            ))}

            {reportsLoading ? (
              <span className="ml-auto text-[11px] font-semibold text-blue-600">
                Loading responder reports...
              </span>
            ) : (
              <span className="ml-auto text-[11px] font-semibold text-emerald-700">
                {plottableMapIncidents.length} plotted on map
              </span>
            )}
          </div>

          <div className="h-[520px] w-full sm:h-[640px] md:h-auto md:flex-1" ref={mapContainerRef} />
        </div>

        <aside className="overflow-x-hidden rounded-[28px] border border-slate-200 bg-white p-4 shadow-[0_12px_32px_rgba(15,23,42,0.08)] sm:p-5 md:h-[calc(100vh-13rem)] md:overflow-hidden">
          {selectedType === 'EQ' ? (
            <div className="rounded-[24px] border border-emerald-200 bg-[linear-gradient(180deg,#ecfdf5_0%,#ffffff_100%)] p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3 border-b border-emerald-100 pb-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
                    Seismic Events
                  </p>

                  <h3 className="mt-1 text-xl font-bold text-slate-900">
                    PHIVOLCS / USGS Earthquakes
                  </h3>
                </div>

                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                  {eqFetchStatus === 'loading' ? '…' : earthquakeEvents.length}
                </span>
              </div>

              <p className="mt-3 text-xs leading-relaxed text-slate-600">
                Quezon Province seismic log
                {eqLastRefreshed
                  ? ` · Updated ${eqLastRefreshed.toLocaleTimeString('en-PH', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}`
                  : ''}
                {eqIsRefreshing ? ' · Refreshing…' : ''}
              </p>

              {faultLineStatus === 'error' ? (
                <p className="mt-2 text-xs font-semibold text-rose-700">Fault lines failed to load.</p>
              ) : null}

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
                      className="w-full rounded-xl border border-[#0b6b50]/20 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none"
                      onChange={(event) => setEqSearchQuery(event.target.value)}
                      placeholder="Search place or event"
                      type="text"
                      value={eqSearchQuery}
                    />
                  </div>

                  <div className="mt-4 max-h-[420px] space-y-2 overflow-y-auto pr-1">
                    {filteredEarthquakeIncidentCards.length === 0 ? (
                      <div className="rounded-xl border border-slate-200 bg-white p-3 text-center text-xs text-slate-500">
                        No matching earthquake event found.
                      </div>
                    ) : (
                      filteredEarthquakeIncidentCards.map((incident) => (
                        <article className="rounded-xl border border-slate-200 bg-white p-3" key={incident.id}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="inline-flex rounded-md bg-emerald-400 px-1.5 py-0.5 text-[10px] font-black text-slate-900">
                                  EQ
                                </span>

                                <p className="truncate text-sm font-semibold text-slate-900">
                                  {incident.title}
                                </p>
                              </div>

                              <p className="mt-1 pl-7 text-xs text-slate-500">{incident.time}</p>
                              <p className="mt-1 pl-7 text-xs text-slate-500">{incident.location}</p>
                            </div>

                            <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">
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
          ) : (
            <div className="flex h-full min-h-0 flex-col">
              <div className="border-b border-slate-200 pb-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Responder Reports
                </p>

                <h2 className="mt-1 text-xl font-bold text-slate-900 sm:text-2xl">
                  {selectedType === 'FR' ? 'Fire Incident Reports' : 'Accident Incident Reports'}
                </h2>

                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {selectedType === 'FR'
                    ? 'Fire reports stay here for review until approved. Only approved fire reports are plotted on the map as resolved records.'
                    : 'Accident-related reports stay here for review until approved. Only approved reports are plotted on the map.'}
                </p>

                {selectedType === 'AC' ? (
                  <div className="mt-5 rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4 shadow-sm">
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <label
                            className="block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500"
                            htmlFor="accident-hazard-filter"
                          >
                            Filter by Hazard Type
                          </label>
                          <p className="mt-1 text-xs text-slate-500">
                            Select a specific responder report category.
                          </p>
                        </div>

                        {accidentTypeFilter !== 'all' ? (
                          <button
                            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-bold text-slate-600 transition hover:bg-slate-100"
                            onClick={() => setAccidentTypeFilter('all')}
                            type="button"
                          >
                            Clear
                          </button>
                        ) : null}
                      </div>

                      <div className="relative">
                        <select
                          className="block h-12 w-full appearance-none rounded-xl border border-slate-300 bg-white px-4 pr-11 text-sm font-semibold text-slate-800 shadow-sm outline-none transition hover:border-amber-300 focus:border-amber-500 focus:ring-4 focus:ring-amber-100"
                          id="accident-hazard-filter"
                          onChange={(event) => setAccidentTypeFilter(event.target.value)}
                          value={accidentTypeFilter}
                        >
                          <option value="all">All accident-related hazards</option>
                          {accidentTypeOptions.map((type) => (
                            <option key={type} value={type}>
                              {type}
                            </option>
                          ))}
                        </select>

                        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                          ▾
                        </span>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              {reportsError ? (
                <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
                  {reportsError}
                </div>
              ) : null}

              <div className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                {filteredIncidents.length > 0 ? (
                  filteredIncidents.map((incident) => (
                    <article
                      className="rounded-2xl border border-slate-200 bg-[#fbfdff] p-4 shadow-[0_8px_20px_rgba(15,23,42,0.05)]"
                      key={incident.id}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className="inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-black text-slate-900"
                              style={{ backgroundColor: hazardColors[incident.code] }}
                            >
                              {incident.code}
                            </span>

                            <p className="truncate text-sm font-bold text-slate-900">
                              {incident.title}
                            </p>
                          </div>

                          <p className="mt-2 text-xs text-slate-500">{incident.location}</p>
                          <p className="mt-1 text-xs text-slate-500">{incident.time}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            Hazard Type: <span className="font-semibold">{incident.incidentTypeLabel}</span>
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            Team: <span className="font-semibold">{incident.responseTeam}</span>
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            Severity: <span className="font-semibold">{incident.severity}</span>
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            Operation Status: <span className="font-semibold">{incident.operationalStatus}</span>
                          </p>
                        </div>

                        <span
                          className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${reviewStatusClass[incident.status]}`}
                        >
                          {incident.status}
                        </span>

                        {incident.isNew && !viewedReportIds.includes(incident.id) ? (
                          <span className="animate-pulse rounded-full bg-red-500 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-white shadow-sm">
                            New
                          </span>
                        ) : null}
                      </div>

                      <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-slate-600">
                        {incident.description}
                      </p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                      onClick={() => handleViewIncident(incident)}
                      type="button"
                    >
                      View Details
                    </button>

                    <button
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      onClick={() => handleEditIncident(incident)}
                      type="button"
                    >
                      Edit Details
                    </button>
                  </div>
                    </article>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center">
                    <p className="text-sm font-semibold text-slate-700">
                      No responder reports yet.
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      Once responders submit {selectedType === 'FR' ? 'fire' : 'accident'} reports, all records for this tab will appear here.
                    </p>
                  </div>
                )}
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
            <section className="flex max-h-[88vh] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_20px_40px_rgba(15,23,42,0.22)]">
              <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 sm:px-6">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.15em] text-slate-500">
                    Responder Incident Report
                  </p>

                  <h3 className="mt-1 text-xl font-black text-slate-900 sm:text-2xl">
                    {selectedIncident.title}
                  </h3>
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
                <p className="text-sm leading-relaxed text-slate-600 sm:text-base">
                  {selectedIncident.description}
                </p>

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
                    <span className="font-semibold text-slate-800">Operation Status:</span> {selectedIncident.operationalStatus}
                  </p>

                  <p className="text-slate-600">
                    <span className="font-semibold text-slate-800">Response Team:</span>{' '}
                    {selectedIncident.responseTeam}
                  </p>

                  <p className="text-slate-600">
                    <span className="font-semibold text-slate-800">Type:</span>{' '}
                    {selectedIncident.incidentTypeLabel}
                  </p>

                  <p className="text-slate-600">
                    <span className="font-semibold text-slate-800">Status:</span>{' '}
                    <span
                      className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${
                        reviewStatusClass[selectedIncident.status]
                      }`}
                    >
                      {selectedIncident.status}
                    </span>
                  </p>

                  <p className="text-slate-600">
                    <span className="font-semibold text-slate-800">Coordinates:</span>{' '}
                    {selectedIncident.coordinates[0].toFixed(5)}, {selectedIncident.coordinates[1].toFixed(5)}
                  </p>
                </div>

                {selectedIncident.victims && selectedIncident.victims.length > 0 ? (
                  <div className="mt-5 border-t border-slate-200 pt-4">
                    <p className="text-sm font-bold text-slate-900">Victims</p>

                    <div className="mt-2 space-y-2">
                      {selectedIncident.victims.map((victim, index) => (
                        <div
                          className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600"
                          key={victim.id || index}
                        >
                          <p className="font-semibold text-slate-800">
                            Victim {index + 1}: {victim.name}
                          </p>
                          <p>Age: {victim.age}</p>
                          <p>Gender: {victim.gender || 'N/A'}</p>
                          <p>Address: {victim.address}</p>
                          <p>Condition: {victim.condition}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="shrink-0 border-t border-slate-200 bg-white px-5 py-4 sm:px-6">
                <div className="flex flex-wrap gap-2">
                  <button
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    onClick={() => handleEditIncident(selectedIncident)}
                    type="button"
                  >
                    Edit Details
                  </button>

                  <button
                    className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100"
                    onClick={() => void handleSetReviewStatus(selectedIncident, 'pending')}
                    type="button"
                  >
                    Mark as Pending
                  </button>

                  <button
                    className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
                    onClick={() => void handleSetReviewStatus(selectedIncident, 'approved')}
                    type="button"
                  >
                    Approved Report
                  </button>
                </div>
              </div>
            </section>
          </div>
        </div>
      ) : null}

      {editingIncident && editForm ? (
        <div
          className="fixed inset-0 z-[1400] overflow-y-auto bg-slate-900/50 p-4 backdrop-blur-sm sm:p-8"
          onClick={() => {
            setEditingIncident(null)
            setEditForm(null)
          }}
        >
          <div className="mx-auto my-6 w-full max-w-3xl" onClick={(event) => event.stopPropagation()}>
            <section className="rounded-2xl border border-slate-200 bg-white shadow-[0_20px_40px_rgba(15,23,42,0.22)]">
              <div className="border-b border-slate-200 px-5 py-4 sm:px-6">
                <p className="text-xs font-bold uppercase tracking-[0.15em] text-blue-700">
                  Edit Incident Details
                </p>
                <h3 className="mt-1 text-xl font-black text-slate-900">
                  {editingIncident.title}
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  This updates the admin display and map coordinates locally. Backend update requires a separate update API.
                </p>
              </div>

              <div className="grid gap-4 px-5 py-5 sm:grid-cols-2 sm:px-6">
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Incident Type</span>
                  <input
                    className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
                    onChange={(event) => setEditForm({ ...editForm, incidentTypeLabel: event.target.value })}
                    value={editForm.incidentTypeLabel}
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Response Team</span>
                  <input
                    className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
                    onChange={(event) => setEditForm({ ...editForm, responseTeam: event.target.value })}
                    value={editForm.responseTeam}
                  />
                </label>

                <label className="block sm:col-span-2">
                  <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Location</span>
                  <input
                    className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
                    onChange={(event) => setEditForm({ ...editForm, location: event.target.value })}
                    value={editForm.location}
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Severity</span>
                  <select
                    className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
                    onChange={(event) =>
                      setEditForm({
                        ...editForm,
                        severity: event.target.value as EditableIncident['severity'],
                      })
                    }
                    value={editForm.severity}
                  >
                    <option value="Low">Low</option>
                    <option value="Moderate">Moderate</option>
                    <option value="High">High</option>
                    <option value="Critical">Critical</option>
                  </select>
                </label>

                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Operation Status</span>
                  <select
                    className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
                    onChange={(event) =>
                      setEditForm({
                        ...editForm,
                        operationalStatus: event.target.value as EditableIncident['operationalStatus'],
                      })
                    }
                    value={editForm.operationalStatus}
                  >
                    <option value="On-going">On-going</option>
                    <option value="Resolved">Resolved</option>
                  </select>
                </label>

                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Latitude</span>
                  <input
                    className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
                    onChange={(event) => setEditForm({ ...editForm, latitude: event.target.value })}
                    value={editForm.latitude}
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Longitude</span>
                  <input
                    className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
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
              </div>

              <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 px-5 py-4 sm:px-6">
                <button
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  onClick={() => {
                    setEditingIncident(null)
                    setEditForm(null)
                  }}
                  type="button"
                >
                  Cancel
                </button>

                <button
                  className="rounded-xl bg-blue-800 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-900"
                  onClick={handleSaveEdit}
                  type="button"
                >
                  Save Details
                </button>
              </div>
            </section>
          </div>
        </div>
      ) : null}
    </section>
  )
}
