// services/incidents.ts
import axios from 'axios'
import { API_BASE_URL, ensureCsrfCookie } from './api'
import type { DetailValues } from '../data/incidentTypeFields'

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  xsrfCookieName: 'csrftoken',
  xsrfHeaderName: 'X-CSRFToken',
})

api.interceptors.request.use((config) => {
  const requestMethod = config.method?.toUpperCase()
  const isSafeMethod = requestMethod === 'GET' || requestMethod === 'HEAD' || requestMethod === 'OPTIONS'

  if (!isSafeMethod) {
    const csrfToken = getCookieValue('csrftoken')
    if (csrfToken) config.headers.set('X-CSRFToken', csrfToken)
  }

  return config
})

function getCookieValue(cookieName: string): string | null {
  if (typeof document === 'undefined') return null

  const cookieMatch = document.cookie
    .split('; ')
    .find((entry) => entry.startsWith(`${cookieName}=`))

  if (!cookieMatch) return null

  return decodeURIComponent(cookieMatch.split('=').slice(1).join('='))
}

export interface BackendIncident {
  id: string
  reference_code?: string
  hazard_type: {
    id: string
    name: string
    description: string
  }
  latitude: string
  longitude: string
  address: string
  barangay: {
    id: string
    name: string
  } | null
  reported_by_username: string
  date_reported: string
  incident_datetime: string
  severity_level: 'low' | 'moderate' | 'high' | 'critical'
  status: 'reported' | 'verified' | 'ongoing' | 'contained' | 'resolved' | 'false_alarm'
  impact_level: 'minimal' | 'minor' | 'major' | 'severe' | 'catastrophic'
  description: string
  fire_details?: {
    casualties: number
    injuries: number
    structures_affected: number
  }
  medical_details?: {
    patient_count: number
    transported: number
  }
  vehicular_accident_details?: {
    vehicles_involved: number
    casualties: number
    injuries: number
  }
  created_at: string
  updated_at: string
}

export interface ResponderReport {
  id: string
  incident_id: string
  incident_reference_code_readonly?: string
  responder: string
  responder_username: string
  report_time: string
  report_text: string
  action_taken: string
  status_update: string
}

export interface ResponderReportPayload {
  incident_reference_code: string
  report_text: string
  action_taken: string
  status_update: string
  media_url?: string
}

export interface IncidentReportVictim {
  id?: string
  name: string
  age: string
  gender: 'M' | 'F' | ''
  address: string
  condition: string
  /** Per-victim fields for the report's incident type (see data/incidentTypeFields.ts). */
  details?: DetailValues
}

export interface IncidentReport {
  id: string
  reportCode?: string
  report_code?: string
  incidentCode?: string
  incident_code?: string
  incident_reference_code_readonly?: string
  timeOccurred?: string
  time_occurred?: string
  incidentType?: string
  incident_type?: string
  responderTeam?: string
  responder_team?: string
  location: string
  /** Name of the report's barangay, or null when none was linked. */
  barangayName?: string | null
  description: string
  victimCount?: number
  victim_count?: number
  victims?: IncidentReportVictim[]
  actionTaken?: string
  action_taken?: string
  // Another team's report seen by a responder: victims, description and actions taken are left out.
  personalDataHidden?: boolean
  status: string
  status_update?: string
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
  createdAt?: string
  created_at?: string
  /** Fields that only this incident type has (see data/incidentTypeFields.ts). */
  details?: DetailValues
  /** Severity the backend gave the incident on approval (low, moderate, high, critical); null while pending. */
  severityLevel?: string | null
}

export interface CreateIncidentReportPayload {
  timeOccurred: string
  incidentType: string
  responderTeam: string
  description: string
  location: string
  latitude: number
  longitude: number
  victimCount: number
  victims: IncidentReportVictim[]
  actionTaken: string
  details: DetailValues
  status: 'Pending'
}

/** Submit a new responder report. The backend checks the type-specific details again. */
export async function createIncidentReport(payload: CreateIncidentReportPayload): Promise<IncidentReport> {
  await ensureCsrfCookie()
  const response = await api.post<IncidentReport>('/api/incidents/incident-reports/', payload)
  return response.data
}

export async function getIncidents(filters?: {
  status?: string
  severity?: string
  hazard_type?: string
  barangay?: string
  reference_code?: string
}): Promise<BackendIncident[]> {
  try {
    const params = new URLSearchParams()

    if (filters?.status) params.append('status', filters.status)
    if (filters?.severity) params.append('severity', filters.severity)
    if (filters?.hazard_type) params.append('hazard_type', filters.hazard_type)
    if (filters?.barangay) params.append('barangay', filters.barangay)
    if (filters?.reference_code) params.append('reference_code', filters.reference_code)

    const response = await api.get<
      BackendIncident[] | { count: number; next: string | null; results: BackendIncident[] }
    >('/api/incidents/incidents/', { params })

    if (Array.isArray(response.data)) return response.data

    let incidents = response.data.results || []
    let nextUrl = response.data.next

    while (nextUrl) {
      const nextResponse = await api.get<{
        count: number
        next: string | null
        results: BackendIncident[]
      }>(nextUrl)

      incidents = [...incidents, ...nextResponse.data.results]
      nextUrl = nextResponse.data.next
    }

    return incidents
  } catch (error) {
    console.error('[getIncidents] Failed to fetch incidents:', error)
    throw error
  }
}

export async function getIncidentById(identifier: string): Promise<BackendIncident> {
  try {
    if (/^INC-\d{4}-\d{3}$/i.test(identifier)) {
      const response = await api.get<BackendIncident>(
        `/api/incidents/incidents/lookup/${identifier.toUpperCase()}/`,
      )
      return response.data
    }

    const response = await api.get<BackendIncident>(`/api/incidents/incidents/${identifier}/`)
    return response.data
  } catch (error) {
    console.error(`Failed to fetch incident ${identifier}:`, error)
    throw error
  }
}

export async function getIncidentsByStatus(status: string): Promise<BackendIncident[]> {
  return getIncidents({ status })
}

export async function getIncidentsBySeverity(severity: string): Promise<BackendIncident[]> {
  return getIncidents({ severity })
}

export async function getIncidentStats(): Promise<Record<string, number>> {
  try {
    const response = await api.get<Record<string, number>>('/api/incidents/by_status/')
    return response.data
  } catch (error) {
    console.error('Failed to fetch incident statistics:', error)
    throw error
  }
}

export async function getIncidentsByHazardType(): Promise<
  Array<{
    hazard_type_id: string
    hazard_type_name: string
    count: number
  }>
> {
  try {
    const response = await api.get('/api/incidents/by_hazard_type/')
    return response.data
  } catch (error) {
    console.error('Failed to fetch incidents by hazard type:', error)
    throw error
  }
}

export async function submitResponderReport(reportData: ResponderReportPayload): Promise<ResponderReport> {
  try {
    await ensureCsrfCookie()

    const normalizedCode = reportData.incident_reference_code.trim().toUpperCase()

    if (!/^INC-\d{4}-\d{3}$/.test(normalizedCode)) {
      throw new Error(
        `Invalid incident code format. Expected INC-YYYY-NNN, got: "${reportData.incident_reference_code}"`,
      )
    }

    const payload = {
      incident_reference_code: normalizedCode,
      report_text: reportData.report_text,
      action_taken: reportData.action_taken,
      status_update: reportData.status_update,
      ...(reportData.media_url && { media_url: reportData.media_url }),
    }

    const response = await api.post<ResponderReport>('/api/incidents/responder-reports/', payload)
    return response.data
  } catch (error: any) {
    console.error('Failed to submit responder report:', error)

    if (error?.response) {
      const { data } = error.response

      if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
        const errorMessages = Object.entries(data)
          .map(([field, messages]) =>
            `${field}: ${Array.isArray(messages) ? messages.join(', ') : String(messages)}`,
          )
          .join(' | ')

        throw new Error(`Backend Error: ${errorMessages}`)
      }

      if (typeof data === 'string') throw new Error(data)
    }

    if (error?.request) throw new Error('No response from server. Please check your connection.')
    if (error instanceof Error) throw error
    throw new Error('Unknown error occurred')
  }
}

export async function getResponderReports(): Promise<ResponderReport[]> {
  try {
    const response = await api.get<
      ResponderReport[] | { count: number; next: string | null; results: ResponderReport[] }
    >('/api/incidents/responder-reports/')

    if (Array.isArray(response.data)) return response.data

    let reports = response.data.results || []
    let nextUrl = response.data.next

    while (nextUrl) {
      const nextResponse = await api.get<{
        count: number
        next: string | null
        results: ResponderReport[]
      }>(nextUrl)

      reports = [...reports, ...nextResponse.data.results]
      nextUrl = nextResponse.data.next
    }

    return reports
  } catch (error) {
    console.error('Failed to fetch responder reports:', error)
    throw error
  }
}

export async function getIncidentByReferenceCode(referenceCode: string): Promise<BackendIncident | null> {
  try {
    const normalized = referenceCode.trim().toUpperCase()

    if (!/^INC-\d{4}-\d{3}$/.test(normalized)) {
      console.warn('[getIncidentByReferenceCode] Invalid format:', referenceCode)
      return null
    }

    const response = await api.get<BackendIncident>(`/api/incidents/incidents/lookup/${normalized}/`)
    return response.data
  } catch (error) {
    console.error(`[getIncidentByReferenceCode] Failed to fetch ${referenceCode}:`, error)
    return null
  }
}

export async function getIncidentReports(): Promise<IncidentReport[]> {
  // 500 a page (the server's limit) so a long list takes a few requests, not one per 100 reports.
  const response = await api.get<
    IncidentReport[] | { count: number; next: string | null; results: IncidentReport[] }
  >('/api/incidents/incident-reports/', {
    params: { ordering: '-created_at', page_size: 500, _: Date.now() },
  })

  if (Array.isArray(response.data)) return response.data

  let reports = response.data.results || []
  let nextUrl = response.data.next

  while (nextUrl) {
    const nextResponse = await api.get<{
      count: number
      next: string | null
      results: IncidentReport[]
    }>(toApiPath(nextUrl))

    reports = [...reports, ...nextResponse.data.results]
    nextUrl = nextResponse.data.next
  }

  return reports
}

/** Only the newest few reports, e.g. the dashboard's "Latest reports" list. */
export async function getLatestIncidentReports(limit = 5): Promise<IncidentReport[]> {
  const response = await api.get<IncidentReport[] | { results: IncidentReport[] }>('/api/incidents/incident-reports/', {
    params: { ordering: '-created_at', page_size: limit, _: Date.now() },
  })
  const reports = Array.isArray(response.data) ? response.data : response.data.results || []
  return reports.slice(0, limit)
}

/**
 * Approved reports for public pages (Landing, Disaster Map). Works without login and
 * leaves out victims, descriptions and other personal details.
 */
export async function getPublicIncidentReports(): Promise<IncidentReport[]> {
  const response = await api.get<IncidentReport[]>('/api/incidents/incident-reports/public/')
  return response.data
}

/** A paginated `next` link as a path, so it goes through the same host (and cookies) as the first page. */
function toApiPath(url: string): string {
  try {
    const parsed = new URL(url)
    return `${parsed.pathname}${parsed.search}`
  } catch {
    return url
  }
}

/** Compile approved incident reports into one accomplishment report. */
export async function createAccomplishmentReport(reportIds: string[], title = 'Accomplishment Report'): Promise<any> {
  await ensureCsrfCookie()
  const response = await api.post('/api/incidents/accomplishment-reports/', {
    title,
    status: 'Compiled',
    reportIds,
  })
  return response.data
}

export async function getAccomplishmentReports(): Promise<any[]> {
  try {
    const response = await api.get<any[] | { count: number; next: string | null; results: any[] }>(
      '/api/incidents/accomplishment-reports/'
    )

    if (Array.isArray(response.data)) return response.data

    let items = response.data.results || []
    let nextUrl = response.data.next

    while (nextUrl) {
      const nextResponse = await api.get<{ count: number; next: string | null; results: any[] }>(toApiPath(nextUrl))
      items = [...items, ...nextResponse.data.results]
      nextUrl = nextResponse.data.next
    }

    return items
  } catch (error) {
    console.error('[getAccomplishmentReports] Failed to fetch accomplishment reports:', error)
    throw error
  }
}

export type IncidentReportEditableFields = {
  location: string
  description: string
  responderTeam: string
  latitude: number
  longitude: number
}

/** Save admin edits to a report (only the fields an admin may correct before approval). */
export async function updateIncidentReportFields(
  id: string,
  fields: IncidentReportEditableFields,
): Promise<IncidentReport> {
  await ensureCsrfCookie()
  const response = await api.patch<IncidentReport>(`/api/incidents/incident-reports/${id}/`, {
    ...fields,
    latitude: Number(fields.latitude.toFixed(6)),
    longitude: Number(fields.longitude.toFixed(6)),
  })
  return response.data
}

export async function updateIncidentReportStatus(
  id: string,
  status: 'Pending' | 'Approved' | 'Submitted',
): Promise<IncidentReport> {
  await ensureCsrfCookie()

  const normalizedStatus =
    status === 'Approved' ? 'approved' : status === 'Pending' ? 'pending' : 'submitted'

  const existingReport = await api.get<IncidentReport>(`/api/incidents/incident-reports/${id}/`)

  const report = existingReport.data

  const latitude =
    report.latitude ??
    report.lat ??
    (Array.isArray(report.coordinates) ? report.coordinates[0] : report.coordinates?.lat) ??
    report.incident?.latitude ??
    report.incident?.coordinates?.lat ??
    13.9414

  const longitude =
    report.longitude ??
    report.lng ??
    (Array.isArray(report.coordinates) ? report.coordinates[1] : report.coordinates?.lng) ??
    report.incident?.longitude ??
    report.incident?.coordinates?.lng ??
    121.6236

  const payload = {
    status: normalizedStatus,
    status_update: normalizedStatus,
    latitude,
    longitude,
  }

  try {
    const response = await api.patch<IncidentReport>(
      `/api/incidents/incident-reports/${id}/`,
      payload,
    )

    return response.data
  } catch (error: any) {
    console.log('========== PATCH ERROR ==========')
    console.log('Payload:', payload)
    console.log('Status:', error.response?.status)
    console.log('Data:', JSON.stringify(error.response?.data, null, 2))
    console.log('=================================')

    throw error
  }
}