// Incident reports filed with no connection: kept on this phone and sent when it is back online.
import axios from 'axios'
import { getCurrentUserProfile } from './auth'
import { createIncidentReport } from './incidents'
import type { CreateIncidentReportPayload } from './incidents'

export type WaitingReport = {
  id: string
  /** Username that filed it; only that account sends it. */
  owner: string
  savedAt: string
  payload: CreateIncidentReportPayload
  /** Why the last try failed, when the server answered with an error. */
  lastError?: string
}

const STORAGE_KEY = 'drms-offline-reports'
export const WAITING_REPORTS_CHANGED = 'waiting-reports-changed'

function readAll(): WaitingReport[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeAll(reports: WaitingReport[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reports))
  } catch (error) {
    console.error('[offlineReports] Could not save reports on this phone:', error)
  }
  window.dispatchEvent(new Event(WAITING_REPORTS_CHANGED))
}

function currentOwner(): string {
  return (getCurrentUserProfile()?.username || '').trim().toLowerCase()
}

/** True when the request never reached the server (no signal, server off), not when it refused it. */
export function isConnectionError(error: unknown): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true
  return axios.isAxiosError(error) && !error.response
}

/** Keep a report on this phone. Returns false when it could not be saved (e.g. not logged in). */
export function saveReportForLater(payload: CreateIncidentReportPayload): boolean {
  const owner = currentOwner()
  if (!owner) return false
  const report: WaitingReport = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    owner,
    savedAt: new Date().toISOString(),
    payload,
  }
  writeAll([...readAll(), report])
  return readAll().some((item) => item.id === report.id)
}

/** Reports of the logged-in account that are still waiting to be sent. */
export function getWaitingReports(): WaitingReport[] {
  const owner = currentOwner()
  return owner ? readAll().filter((report) => report.owner === owner) : []
}

function serverMessage(error: unknown): string {
  if (!axios.isAxiosError(error) || !error.response) return 'Could not reach the server.'
  if (error.response.status === 401 || error.response.status === 403) return 'Log in again to send this report.'
  const data = error.response.data as Record<string, unknown> | undefined
  const first = data && typeof data === 'object' ? Object.values(data)[0] : undefined
  if (Array.isArray(first)) return first.map(String).join(' ')
  if (typeof first === 'string') return first
  return `The server refused the report (${error.response.status}).`
}

let isSending = false

/**
 * Send this account's waiting reports, oldest first. Stops at the first connection problem.
 * A report the server refuses stays on the phone with the reason, so nothing is lost.
 */
export async function sendWaitingReports(): Promise<{ sent: number; left: number }> {
  if (isSending) return { sent: 0, left: getWaitingReports().length }
  isSending = true
  let sent = 0
  try {
    for (const report of getWaitingReports()) {
      try {
        await createIncidentReport(report.payload)
        writeAll(readAll().filter((item) => item.id !== report.id))
        sent += 1
      } catch (error) {
        if (isConnectionError(error)) break
        writeAll(readAll().map((item) => (item.id === report.id ? { ...item, lastError: serverMessage(error) } : item)))
        if (axios.isAxiosError(error) && (error.response?.status === 401 || error.response?.status === 403)) break
      }
    }
  } finally {
    isSending = false
  }
  return { sent, left: getWaitingReports().length }
}

/** Remove a waiting report the responder decided not to send. */
export function discardWaitingReport(id: string): void {
  writeAll(readAll().filter((report) => report.id !== id))
}

/** Try again whenever the phone gets a connection or the app comes back to the screen. */
export function startSendingWaitingReports(onSent?: (count: number) => void): void {
  const trySend = () => {
    if (!navigator.onLine || getWaitingReports().length === 0) return
    void sendWaitingReports().then(({ sent }) => {
      if (sent > 0) onSent?.(sent)
    })
  }
  window.addEventListener('online', trySend)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') trySend()
  })
  trySend()
}
