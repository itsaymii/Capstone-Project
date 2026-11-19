import { useEffect, useState } from 'react'
import {
  WAITING_REPORTS_CHANGED,
  discardWaitingReport,
  getWaitingReports,
  sendWaitingReports,
} from '../services/offlineReports'
import type { WaitingReport } from '../services/offlineReports'

/** Reports filed with no connection that are kept on this phone until they can be sent. */
export function WaitingReportsCard() {
  const [reports, setReports] = useState<WaitingReport[]>(getWaitingReports)
  const [isSending, setIsSending] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const refresh = () => setReports(getWaitingReports())
    window.addEventListener(WAITING_REPORTS_CHANGED, refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener(WAITING_REPORTS_CHANGED, refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [])

  if (reports.length === 0) return null

  const sendNow = async () => {
    setIsSending(true)
    setMessage('')
    const { sent, left } = await sendWaitingReports()
    setIsSending(false)
    if (left === 0) setMessage('')
    else if (!navigator.onLine) setMessage('Still no connection. The reports stay on this phone.')
    else if (sent === 0) setMessage('Could not send yet. Check the reason under each report.')
  }

  const discard = (report: WaitingReport) => {
    if (confirm(`Delete this ${report.payload.incidentType} report from this phone? It has not been sent.`)) {
      discardWaitingReport(report.id)
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-amber-200 bg-amber-50 shadow-sm" aria-labelledby="waiting-reports">
      <div className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0">
          <h2 id="waiting-reports" className="text-sm font-black text-amber-900">
            {reports.length === 1 ? 'A report is waiting to be sent' : `${reports.length} reports are waiting to be sent`}
          </h2>
          <p className="mt-0.5 text-xs leading-relaxed text-amber-800">
            Saved on this phone when there was no connection. They are sent when you are back online.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void sendNow()}
          disabled={isSending}
          className="shrink-0 rounded-xl bg-amber-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-amber-700 disabled:opacity-60"
        >
          {isSending ? 'Sending…' : 'Send now'}
        </button>
      </div>

      <ul className="divide-y divide-amber-200/70 border-t border-amber-200/70 bg-white/60">
        {reports.map((report) => (
          <li key={report.id} className="flex items-start justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-900">{report.payload.incidentType}</p>
              <p className="truncate text-xs text-slate-500">
                {report.payload.location}, saved{' '}
                {new Date(report.savedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
              </p>
              {report.lastError ? <p className="mt-1 text-xs font-semibold text-red-700">{report.lastError}</p> : null}
            </div>
            <button type="button" onClick={() => discard(report)} className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-red-50 hover:text-red-600">
              Delete
            </button>
          </li>
        ))}
      </ul>

      {message ? <p className="border-t border-amber-200/70 px-4 py-2.5 text-xs font-semibold text-amber-900" role="status">{message}</p> : null}
    </section>
  )
}
