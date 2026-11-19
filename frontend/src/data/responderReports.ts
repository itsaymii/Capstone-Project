// Where a responder's incident report stands, shared by the responder Dashboard and Incidents pages.
import { getCurrentUserProfile } from '../services/auth'
import { getAccountTeam, toTeamName } from './teams'

export type ResponderReportLike = {
  status?: string
  status_update?: string
  createdBy?: string
  createdByRole?: string
  responderTeam?: string
  responder_team?: string
  compiledIn?: string | null
}

export type CurrentResponder = { username: string; teamName: string }

/**
 * ready: approved, filed by your team, not yet compiled (can be compiled now)
 * awaiting: filed by your team, waiting for an admin to approve it
 * compiled: already in one of your team's accomplishment reports
 * other: filed by another team or by an admin
 */
export type ReportStage = 'ready' | 'awaiting' | 'compiled' | 'other'

function normalizeName(value?: string | null): string {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ')
}

export function getCurrentResponder(): CurrentResponder {
  const profile = getCurrentUserProfile()
  return { username: normalizeName(profile?.username), teamName: normalizeName(getAccountTeam(profile)) }
}

export function isApprovedReport(report: ResponderReportLike): boolean {
  const value = String(report.status_update || report.status || '').trim().toLowerCase()
  return value === 'approved' || value === 'approve' || value === 'verified'
}

/** Filed by this account, or under this account's team name. */
export function isOwnReport(report: ResponderReportLike, me: CurrentResponder): boolean {
  if (me.username && normalizeName(report.createdBy) === me.username) return true
  return Boolean(me.teamName) && normalizeName(toTeamName(report.responderTeam || report.responder_team)) === me.teamName
}

export function getReportStage(report: ResponderReportLike, me: CurrentResponder): ReportStage {
  if (report.createdByRole === 'admin' || !isOwnReport(report, me)) return 'other'
  if (report.compiledIn) return 'compiled'
  return isApprovedReport(report) ? 'ready' : 'awaiting'
}

export const STAGE_LABELS: Record<ReportStage, string> = {
  ready: 'Ready to compile',
  awaiting: 'Awaiting approval',
  compiled: 'Compiled',
  other: 'Other team',
}

/** Tailwind classes for a small stage badge (same colors as the status badges). */
export const STAGE_BADGE_CLASSES: Record<ReportStage, string> = {
  ready: 'border-emerald-100 bg-emerald-50 text-emerald-700',
  awaiting: 'border-amber-100 bg-amber-50 text-amber-700',
  compiled: 'border-blue-100 bg-blue-50 text-blue-700',
  other: 'border-slate-200 bg-slate-50 text-slate-500',
}
