// services/incidents.ts
import axios from 'axios'
import { ensureCsrfCookie } from './api'

function getDefaultApiBaseUrl(): string {
  if (typeof window === 'undefined') {
    return 'http://localhost:8000'
  }

  const hostname = window.location.hostname === '127.0.0.1' ? '127.0.0.1' : 'localhost'
  return `${window.location.protocol}//${hostname}:8000`
}

function normalizeApiBaseUrl(rawBaseUrl?: string): string {
  const trimmedBaseUrl = rawBaseUrl?.trim()
  if (!trimmedBaseUrl) {
    return getDefaultApiBaseUrl()
  }

  if (typeof window === 'undefined') {
    return trimmedBaseUrl
  }

  try {
    const parsedUrl = new URL(trimmedBaseUrl)
    const currentHost = window.location.hostname
    const isLocalBrowserHost = currentHost === 'localhost' || currentHost === '127.0.0.1'
    const isLocalApiHost = parsedUrl.hostname === 'localhost' || parsedUrl.hostname === '127.0.0.1'

    if (isLocalBrowserHost && isLocalApiHost) {
      parsedUrl.hostname = currentHost
      return parsedUrl.toString().replace(/\/$/, '')
    }

    return trimmedBaseUrl
  } catch {
    return trimmedBaseUrl
  }
}

const apiBaseUrl = normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL)

const api = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: true,
  xsrfCookieName: 'csrftoken',
  xsrfHeaderName: 'X-CSRFToken',
})

// Add CSRF token to request headers
api.interceptors.request.use((config) => {
  const requestMethod = config.method?.toUpperCase()
  const isSafeMethod = requestMethod === 'GET' || requestMethod === 'HEAD' || requestMethod === 'OPTIONS'

  if (!isSafeMethod) {
    const csrfToken = getCookieValue('csrftoken')
    if (csrfToken) {
      config.headers.set('X-CSRFToken', csrfToken)
    }
  }

  return config
})

function getCookieValue(cookieName: string): string | null {
  if (typeof document === 'undefined') {
    return null
  }

  const cookieMatch = document.cookie
    .split('; ')
    .find((entry) => entry.startsWith(`${cookieName}=`))

  if (!cookieMatch) {
    return null
  }

  return decodeURIComponent(cookieMatch.split('=').slice(1).join('='))
}

// ==========================================
// 🔹 Types & Interfaces
// ==========================================

export interface BackendIncident {
  id: string  // UUID (internal)
  reference_code?: string  // ✅ Human-readable: "INC-2025-100"
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
  incident_reference_code_readonly?: string  // ✅ Returned by backend
  responder: string
  responder_username: string
  report_time: string
  report_text: string
  action_taken: string
  status_update: string
}

// ✅ FIXED: Payload now uses incident_reference_code
export interface ResponderReportPayload {
  incident_reference_code: string  // ✅ Send "INC-2025-001" here
  report_text: string
  action_taken: string
  status_update: string
  media_url?: string
}

// ==========================================
// 🔹 API Functions
// ==========================================

/**
 * Fetch all incidents from the backend (handles pagination)
 */
export async function getIncidents(filters?: {
  status?: string
  severity?: string
  hazard_type?: string
  barangay?: string
  reference_code?: string  // ✅ Added
}): Promise<BackendIncident[]> {
  try {
    const params = new URLSearchParams()
    
    if (filters?.status) params.append('status', filters.status)
    if (filters?.severity) params.append('severity', filters.severity)
    if (filters?.hazard_type) params.append('hazard_type', filters.hazard_type)
    if (filters?.barangay) params.append('barangay', filters.barangay)
    if (filters?.reference_code) params.append('reference_code', filters.reference_code)
    
    const queryString = params.toString()
    const url = `/api/incidents/incidents/?${queryString}`
    
    const response = await api.get<BackendIncident[] | { count: number; next: string | null; results: BackendIncident[] }>(url)
    
    if (Array.isArray(response.data)) {
      return response.data
    }
    
    let incidents = response.data.results || []
    let nextUrl = response.data.next
    while (nextUrl) {
      const nextResponse = await api.get<{ count: number; next: string | null; results: BackendIncident[] }>(nextUrl)
      incidents = [...incidents, ...nextResponse.data.results]
      nextUrl = nextResponse.data.next
    }
    
    return incidents
  } catch (error) {
    console.error('[getIncidents] Failed to fetch incidents:', error)
    throw error
  }
}

/**
 * Fetch a single incident by ID or reference_code
 */
export async function getIncidentById(identifier: string): Promise<BackendIncident> {
  try {
    // ✅ If it's INC-XXXX format, use lookup endpoint
    if (/^INC-\d{4}-\d{3}$/i.test(identifier)) {
      const response = await api.get<BackendIncident>(`/api/incidents/incidents/lookup/${identifier.toUpperCase()}/`)
      return response.data
    }
    // Otherwise treat as UUID
    const response = await api.get<BackendIncident>(`/api/incidents/${identifier}/`)
    return response.data
  } catch (error) {
    console.error(`Failed to fetch incident ${identifier}:`, error)
    throw error
  }
}

/**
 * Fetch incidents by status
 */
export async function getIncidentsByStatus(status: string): Promise<BackendIncident[]> {
  return getIncidents({ status })
}

/**
 * Fetch incidents by severity
 */
export async function getIncidentsBySeverity(severity: string): Promise<BackendIncident[]> {
  return getIncidents({ severity })
}

/**
 * Get incident statistics
 */
export async function getIncidentStats(): Promise<Record<string, number>> {
  try {
    const response = await api.get<Record<string, number>>('/api/incidents/by_status/')
    return response.data
  } catch (error) {
    console.error('Failed to fetch incident statistics:', error)
    throw error
  }
}

/**
 * Get incidents by hazard type
 */
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

/**
 * ✅ FIXED: Lookup incident UUID by reference_code (helper for legacy support)
 */
async function lookupIncidentByReferenceCode(referenceCode: string): Promise<string | null> {
  try {
    const response = await api.get<{ count: number; results: BackendIncident[] }>(
      `/api/incidents/incidents/?reference_code=${encodeURIComponent(referenceCode)}&limit=1`
    )
    
    if (response.data.count > 0 && response.data.results[0]?.id) {
      return response.data.results[0].id
    }
    return null
  } catch (error) {
    console.error('[lookupIncidentByReferenceCode] Error:', error)
    return null
  }
}

/**
 * ✅✅✅ FIXED: Submit responder report - NOW ACCEPTS INC-1001 FORMAT
 * 
 * Backend expects: { incident_reference_code: "INC-2025-001", ... }
 * Frontend sends: same format - no more UUID conversion needed!
 */
export async function submitResponderReport(reportData: ResponderReportPayload): Promise<ResponderReport> {
  try {
    await ensureCsrfCookie()
    
    // ✅ Normalize reference code to uppercase (INC-1001)
    const normalizedCode = reportData.incident_reference_code.trim().toUpperCase()
    
    // ✅ Validate format before sending
    if (!/^INC-\d{4}-\d{3}$/.test(normalizedCode)) {
      throw new Error(`Invalid incident code format. Expected INC-YYYY-NNN, got: "${reportData.incident_reference_code}"`)
    }
    
    // ✅ Payload matches backend serializer exactly
    const payload = {
      incident_reference_code: normalizedCode,  // ← KEY CHANGE: use reference_code field
      report_text: reportData.report_text,
      action_taken: reportData.action_taken,
      status_update: reportData.status_update,
      ...(reportData.media_url && { media_url: reportData.media_url }),
    }
    
    console.log('[submitResponderReport] Payload:', payload)
    const response = await api.post<ResponderReport>('/api/incidents/responder-reports/', payload)
    console.log('[submitResponderReport] ✅ Success:', response.data)
    return response.data
  } catch (error: any) {
    console.error('❌ Failed to submit responder report:', error)
    
    if (error?.response) {
      const { status, data } = error.response
      console.error('🔍 Server Response:', { status, data })
      
      if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
        const errorMessages = Object.entries(data)
          .map(([field, messages]) => `${field}: ${Array.isArray(messages) ? messages.join(', ') : String(messages)}`)
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

/**
 * Get all responder reports (handles pagination)
 */
export async function getResponderReports(): Promise<ResponderReport[]> {
  try {
    const response = await api.get<{ count: number; next: string | null; results: ResponderReport[] }>('/api/incidents/responder-reports/')
    
    if (Array.isArray(response.data)) {
      return response.data
    }
    
    let reports = response.data.results || []
    let nextUrl = response.data.next
    while (nextUrl) {
      const nextResponse = await api.get<{ count: number; next: string | null; results: ResponderReport[] }>(nextUrl)
      reports = [...reports, ...nextResponse.data.results]
      nextUrl = nextResponse.data.next
    }
    
    return reports
  } catch (error) {
    console.error('Failed to fetch responder reports:', error)
    throw error
  }
}

/**
 * ✅ NEW: Quick lookup incident by reference code
 */
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