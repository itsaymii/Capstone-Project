import { useEffect, useState } from 'react'
import {
  getAdminSimulationCertificates,
  issueAdminSimulationCertificate,
  rejectAdminSimulationCertificate,
  resetSimulationProgressForTesting,
} from '../services/api'
import type { SimulationCertificate, SimulationCertificateStatus } from '../types/api'

const statusTabs: Array<{ value: SimulationCertificateStatus | 'all'; label: string }> = [
  { value: 'pending', label: 'Pending Review' },
  { value: 'issued', label: 'Issued' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'all', label: 'All' },
]

const statusBadgeClass: Record<SimulationCertificateStatus, string> = {
  pending: 'bg-amber-100 text-amber-800',
  issued: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-rose-100 text-rose-800',
}

export function SimulationCertificatesManager() {
  const [activeTab, setActiveTab] = useState<SimulationCertificateStatus | 'all'>('pending')
  const [certificates, setCertificates] = useState<SimulationCertificate[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [busyId, setBusyId] = useState<number | null>(null)
  const [isResetting, setIsResetting] = useState(false)

  const loadCertificates = async (tab: SimulationCertificateStatus | 'all'): Promise<void> => {
    setIsLoading(true)
    try {
      const response = await getAdminSimulationCertificates(tab === 'all' ? undefined : tab)
      setCertificates(response.certificates)
    } catch {
      setFeedback('Unable to load training tickets.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadCertificates(activeTab)
  }, [activeTab])

  const handleIssue = async (certificate: SimulationCertificate): Promise<void> => {
    setBusyId(certificate.id)
    setFeedback('')
    try {
      await issueAdminSimulationCertificate(certificate.id)
      setFeedback(`Certificate issued for ${certificate.traineeName}.`)
      await loadCertificates(activeTab)
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Unable to issue this certificate.')
    } finally {
      setBusyId(null)
    }
  }

  const handleReject = async (certificate: SimulationCertificate): Promise<void> => {
    const reason = window.prompt('Reason for rejecting this training ticket (optional):') ?? ''
    setBusyId(certificate.id)
    setFeedback('')
    try {
      await rejectAdminSimulationCertificate(certificate.id, reason)
      setFeedback(`Training ticket rejected for ${certificate.traineeName}.`)
      await loadCertificates(activeTab)
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Unable to reject this training ticket.')
    } finally {
      setBusyId(null)
    }
  }

  const handleResetForTesting = async (): Promise<void> => {
    const confirmed = window.confirm(
      'Reset ALL trainees\u2019 course progress, quiz attempts, and training tickets? This is meant for testing only.',
    )
    if (!confirmed) return

    setIsResetting(true)
    setFeedback('')
    try {
      const result = await resetSimulationProgressForTesting()
      setFeedback(
        `Reset ${result.resetUsers} trainee record(s), removed ${result.deletedAttempts} quiz attempt(s) and ${result.deletedCertificates} ticket(s).`,
      )
      await loadCertificates(activeTab)
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Unable to reset simulation progress.')
    } finally {
      setIsResetting(false)
    }
  }

  return (
    <div className="rounded-[24px] border border-slate-200/70 bg-white p-6 shadow-[0_2px_8px_rgba(15,23,42,0.04),0_12px_32px_rgba(15,23,42,0.09)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">DRRMO Training</p>
          <h3 className="mt-2 text-2xl font-bold text-slate-900">Training Tickets & Certificates</h3>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
            Citizens request a training ticket after completing DRRMO training. Approve to issue an official certificate, or reject with a reason.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleResetForTesting()}
          disabled={isResetting}
          className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isResetting ? 'Resetting...' : 'Reset progress (testing)'}
        </button>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {statusTabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setActiveTab(tab.value)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] transition ${
              activeTab === tab.value ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {feedback ? <p className="mt-4 rounded-xl bg-slate-50 px-4 py-2 text-xs text-slate-600">{feedback}</p> : null}

      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
            <tr>
              <th className="px-4 py-3">Trainee</th>
              <th className="px-4 py-3">Course</th>
              <th className="px-4 py-3">Ticket</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">Loading training tickets...</td>
              </tr>
            ) : certificates.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">No training tickets in this view.</td>
              </tr>
            ) : (
              certificates.map((certificate) => (
                <tr key={certificate.id}>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-900">{certificate.traineeName}</p>
                    <p className="text-xs text-slate-500">{certificate.traineeEmail}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{certificate.courseTitle || certificate.courseId}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">
                    {certificate.status === 'issued' ? certificate.certificateNumber : certificate.ticketCode}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] ${statusBadgeClass[certificate.status]}`}>
                      {certificate.status}
                    </span>
                    {certificate.status === 'rejected' && certificate.rejectionReason ? (
                      <p className="mt-1 text-xs text-rose-700">{certificate.rejectionReason}</p>
                    ) : null}
                    {certificate.status === 'issued' && certificate.issuedBy ? (
                      <p className="mt-1 text-xs text-slate-500">by {certificate.issuedBy}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    {certificate.status !== 'issued' ? (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={busyId === certificate.id}
                          onClick={() => void handleIssue(certificate)}
                          className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Issue certificate
                        </button>
                        <button
                          type="button"
                          disabled={busyId === certificate.id}
                          onClick={() => void handleReject(certificate)}
                          className="rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Reject
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">No action needed</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
