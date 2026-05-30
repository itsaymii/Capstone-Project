import { useEffect, useState } from 'react'
import type { FC } from 'react'
import { useNavigate } from 'react-router-dom'
import { MobileNavBar } from '../../components/MobileNavBar'
import { addNotification } from '../../services/notifications'

interface VictimDetails {
  name: string
  age: string
  gender: 'M' | 'F' | ''
  address: string
  condition: string
}

interface IncidentReport {
  id: string
  reportCode: string
  incidentCode: string
  timeOccurred: string
  incidentType: string
  responderTeam: string
  location: string
  description: string
  victimCount: number
  victims: VictimDetails[]
  actionTaken: string
  status: string
  createdAt: string
}

const IncidentReportPage: FC = () => {
  const navigate = useNavigate()

  const [reports, setReports] = useState<IncidentReport[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [detailsReport, setDetailsReport] = useState<IncidentReport | null>(null)

  const [searchQuery, setSearchQuery] = useState('')
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc')
  const [hazardFilter, setHazardFilter] = useState('All')

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const response = await fetch('http://127.0.0.1:8000/api/incidents/incident-reports/')

        if (!response.ok) {
          throw new Error('Failed to fetch incident reports')
        }

        const data = await response.json()
        const reportsData = Array.isArray(data) ? data : data.results || []

        setReports(reportsData)
      } catch (error) {
        console.error('Error fetching incident reports:', error)
        addNotification('Failed to load incident reports.')
      }
    }

    fetchReports()
  }, [])

  const isWithin24Hours = (createdAt: string) => {
    const reportTime = new Date(createdAt).getTime()
    const now = new Date().getTime()
    const twentyFourHours = 24 * 60 * 60 * 1000

    return now - reportTime <= twentyFourHours
  }

  const hazardTypes = Array.from(new Set(reports.map((report) => report.incidentType)))

  const filteredAndSortedReports = reports
    .filter((report) => {
      const query = searchQuery.toLowerCase()

      const matchesSearch =
        report.reportCode.toLowerCase().includes(query) ||
        report.incidentCode.toLowerCase().includes(query) ||
        report.incidentType.toLowerCase().includes(query) ||
        report.location.toLowerCase().includes(query)

      const matchesHazard =
        hazardFilter === 'All' || report.incidentType === hazardFilter

      return matchesSearch && matchesHazard
    })
    .sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime()
      const dateB = new Date(b.createdAt).getTime()

      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB
    })

  const toggleSelect = (report: IncidentReport) => {
    if (!isWithin24Hours(report.createdAt)) {
      addNotification('Only reports created within the last 24 hours can be selected.')
      return
    }

    setSelectedIds((prev) =>
      prev.includes(report.id)
        ? prev.filter((item) => item !== report.id)
        : [...prev, report.id]
    )
  }

  const toggleSelectAll = () => {
    const selectableReports = filteredAndSortedReports.filter((report) =>
      isWithin24Hours(report.createdAt)
    )

    if (selectableReports.length === 0) {
      addNotification('No reports within the last 24 hours can be selected.')
      return
    }

    const selectableIds = selectableReports.map((report) => report.id)
    const allSelected = selectableIds.every((id) => selectedIds.includes(id))

    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !selectableIds.includes(id)))
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...selectableIds])))
    }
  }

  const compileReports = async () => {
    const selectedReports = reports.filter((report) =>
      selectedIds.includes(report.id)
    )

    if (selectedReports.length === 0) {
      addNotification('Please select at least one report.')
      return
    }

    try {
      const response = await fetch(
        'http://127.0.0.1:8000/api/incidents/accomplishment-reports/',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: 'Accomplishment Report',
            status: 'Compiled',
            reportIds: selectedIds,
          }),
        }
      )

      if (!response.ok) {
        throw new Error('Failed to compile reports')
      }

      addNotification('Reports compiled successfully!')
      navigate('/responder-reports')
    } catch (error) {
      console.error('Error compiling reports:', error)
      addNotification('Failed to compile reports.')
    }
  }

  const getIncidentBadgeStyle = (type: string) => {
    const lower = type.toLowerCase()

    if (lower.includes('med')) return 'bg-rose-50 text-rose-700 border-rose-100 ring-rose-500/10'
    if (lower.includes('fire')) return 'bg-orange-50 text-orange-700 border-orange-100 ring-orange-500/10'
    if (lower.includes('rtc') || lower.includes('vehic')) return 'bg-amber-50 text-amber-700 border-amber-100 ring-amber-500/10'

    return 'bg-purple-50 text-purple-700 border-purple-100 ring-purple-500/10'
  }

  return (
    <div className="min-h-screen bg-slate-100 pb-28 sm:pb-12 pt-6 antialiased text-slate-800">
      <main className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 sm:p-7 border-b border-slate-200/80 space-y-5 overflow-hidden relative">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500" />

            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/responder-dashboard')}
                className="group flex items-center justify-center w-10 h-10 bg-slate-50 text-slate-500 hover:bg-blue-50 hover:text-blue-600 rounded-2xl transition-all border border-slate-100 shadow-sm active:scale-90"
                title="Back to Dashboard"
              >
                <svg
                  className="w-5 h-5 transform group-hover:-translate-x-0.5 transition-transform"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={3}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              <div>
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600 opacity-60 block mb-0.5 leading-none">
                  Field Documentation
                </span>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 leading-tight">
                  Incident Report Central
                </h1>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-slate-100 pt-5">
              <p className="text-sm text-slate-500 font-medium leading-relaxed max-w-lg">
                Click any report row to view full details. Select only reports created within the last 24 hours and compile them into accomplishment reports.
              </p>

              {selectedIds.length > 0 && (
                <button
                  onClick={compileReports}
                  className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-95 shadow-sm transition-all"
                >
                  Compile Reports ({selectedIds.length})
                </button>
              )}
            </div>
          </div>
        </div>

        {reports.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col md:flex-row gap-4 justify-between items-center">
            <div className="relative w-full md:max-w-md group">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400 group-focus-within:text-blue-600 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>

              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search report code, type, or location..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 text-sm font-medium text-slate-800 placeholder-slate-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all"
              />

              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto justify-end">
              <div className="flex items-center gap-2 justify-end">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Hazard Type:
                </span>

                <select
                  value={hazardFilter}
                  onChange={(e) => setHazardFilter(e.target.value)}
                  className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none"
                >
                  <option value="All">All</option>
                  {hazardTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 justify-end">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Sort Date:
                </span>

                <button
                  onClick={() => setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:text-slate-900 transition-all shadow-sm active:scale-95"
                >
                  <span>{sortOrder === 'desc' ? 'Newest First' : 'Oldest First'}</span>
                  <svg
                    className={`w-4 h-4 text-slate-500 transition-transform duration-300 ${
                      sortOrder === 'asc' ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {reports.length === 0 ? (
            <div className="p-16 text-center">
              <div className="max-w-md mx-auto space-y-5">
                <h3 className="text-lg font-bold text-slate-900">No incident reports yet</h3>
                <p className="text-sm text-slate-500 mt-1">Create your first incident report to display it here.</p>

                <button
                  onClick={() => navigate('/create-report')}
                  className="inline-flex items-center justify-center gap-2 bg-blue-600 text-white text-sm font-bold px-6 py-3 rounded-xl hover:bg-blue-700 active:scale-95 shadow-sm transition-all"
                >
                  Create Report
                </button>
              </div>
            </div>
          ) : filteredAndSortedReports.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <h4 className="text-sm font-bold text-slate-800">No results found</h4>
              <p className="text-xs text-slate-400 mt-1">Try adjusting your search or hazard type filter.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50/70 border-b border-slate-200/80">
                  <tr>
                    <th className="px-6 py-4 w-12">
                      <input
                        type="checkbox"
                        checked={
                          filteredAndSortedReports.filter((r) => isWithin24Hours(r.createdAt)).length > 0 &&
                          filteredAndSortedReports
                            .filter((r) => isWithin24Hours(r.createdAt))
                            .every((r) => selectedIds.includes(r.id))
                        }
                        onClick={(e) => e.stopPropagation()}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 accent-blue-600 rounded transition"
                      />
                    </th>
                    <th className="px-6 py-4 text-xs font-extrabold uppercase text-slate-500 tracking-wider">Report Code</th>
                    <th className="px-6 py-4 text-xs font-extrabold uppercase text-slate-500 tracking-wider">Incident Code</th>
                    <th className="px-6 py-4 text-xs font-extrabold uppercase text-slate-500 tracking-wider">Incident Type</th>
                    <th className="px-6 py-4 text-xs font-extrabold uppercase text-slate-500 tracking-wider">Location</th>
                    <th className="px-6 py-4 text-xs font-extrabold uppercase text-slate-500 tracking-wider">Date Recorded</th>
                    <th className="px-6 py-4 text-xs font-extrabold uppercase text-slate-500 tracking-wider">Status</th>
                    <th className="px-6 py-4 text-xs font-extrabold uppercase text-slate-500 tracking-wider">Selection</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filteredAndSortedReports.map((report) => {
                    const selectable = isWithin24Hours(report.createdAt)

                    return (
                      <tr
                        key={report.id}
                        onClick={() => setDetailsReport(report)}
                        className={`hover:bg-slate-50/80 transition-colors group cursor-pointer ${
                          !selectable ? 'opacity-60' : ''
                        }`}
                        title="Click to view full details"
                      >
                        <td className="px-6 py-4">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(report.id)}
                            onClick={(e) => e.stopPropagation()}
                            onChange={() => toggleSelect(report)}
                            disabled={!selectable}
                            title={
                              selectable
                                ? 'Select for accomplishment report'
                                : 'Only reports within 24 hours can be selected'
                            }
                            className="w-4 h-4 accent-blue-600 rounded transition disabled:cursor-not-allowed"
                          />
                        </td>

                        <td className="px-6 py-4 text-sm font-bold text-slate-900 font-mono tracking-tight group-hover:text-blue-600 transition-colors">
                          {report.reportCode}
                        </td>

                        <td className="px-6 py-4 text-sm text-slate-500 font-mono">
                          {report.incidentCode}
                        </td>

                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center text-[10px] font-extrabold tracking-wider uppercase px-2.5 py-0.5 border rounded-md ring-2 ${getIncidentBadgeStyle(report.incidentType)}`}>
                            {report.incidentType}
                          </span>
                        </td>

                        <td className="px-6 py-4 text-sm text-slate-600 max-w-[200px] truncate font-medium">
                          {report.location}
                        </td>

                        <td className="px-6 py-4 text-xs font-medium text-slate-500">
                          {new Date(report.createdAt).toLocaleString(undefined, {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </td>

                        <td className="px-6 py-4">
                          <span className="inline-flex items-center text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5" />
                            {report.status}
                          </span>
                        </td>

                        <td className="px-6 py-4">
                          {selectable ? (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-1 rounded-md">
                              Available
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-1 rounded-md">
                              Expired
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {detailsReport && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col border border-slate-100">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <h2 className="text-lg font-black text-slate-900 tracking-tight font-mono">
                    {detailsReport.reportCode}
                  </h2>
                  <span className={`inline-flex items-center text-[9px] font-extrabold tracking-wider uppercase px-2 py-0.5 border rounded-md ring-1 ${getIncidentBadgeStyle(detailsReport.incidentType)}`}>
                    {detailsReport.incidentType}
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-medium">
                  Full incident operational tactical deployment logs
                </p>
              </div>

              <button
                onClick={() => setDetailsReport(null)}
                className="p-2 text-sm text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-md transition-colors active:scale-95"
                title="Close Overview"
              >
                Close
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 text-slate-700">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 bg-slate-50/60 p-4 rounded-xl border border-slate-100">
                <DetailItem label="Incident Identifier Code" value={detailsReport.incidentCode} isMono />
                <DetailItem label="Time of Occurrence" value={detailsReport.timeOccurred} />
                <DetailItem label="Assigned Field Responders" value={detailsReport.responderTeam} />
                <DetailItem label="Operation Live Status" value={detailsReport.status} isStatus />
              </div>

              <div className="space-y-1">
                <span className="text-[10px] text-slate-400 block font-extrabold uppercase tracking-wider">
                  Deployment Area Zone
                </span>
                <div className="bg-slate-50/40 p-3 rounded-xl border border-slate-100">
                  <p className="text-xs font-semibold text-slate-800">
                    {detailsReport.location}
                  </p>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] text-slate-400 block font-extrabold uppercase tracking-wider">
                  Detailed Description Log
                </span>
                <div className="bg-slate-50/40 p-3.5 rounded-xl border border-slate-100">
                  <p className="text-xs text-slate-600 leading-relaxed font-medium whitespace-pre-wrap">
                    {detailsReport.description || 'No specific descriptive log file submitted.'}
                  </p>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] text-slate-400 block font-extrabold uppercase tracking-wider">
                  Mitigation & Actions Executed
                </span>
                <div className="bg-blue-50/10 p-3.5 rounded-xl border border-blue-100/50">
                  <p className="text-xs text-slate-700 leading-relaxed font-medium whitespace-pre-wrap">
                    {detailsReport.actionTaken || 'No recorded data of triage mitigation steps.'}
                  </p>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
                    Victims Information Directory
                  </h3>
                  <span className="text-xs font-bold px-2 py-0.5 bg-slate-100 rounded-md text-slate-600">
                    {detailsReport.victimCount} Total
                  </span>
                </div>

                {detailsReport.victims.length === 0 ? (
                  <p className="text-xs text-slate-400 font-medium italic">
                    No casualties or victim information files recorded for this catalog code.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {detailsReport.victims.map((victim, index) => (
                      <div key={index} className="border border-slate-200/80 rounded-xl p-4 bg-slate-50/50 space-y-3 shadow-inner">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                          <p className="font-extrabold text-xs text-slate-900 uppercase tracking-wide">
                            Victim Profile #{index + 1}
                          </p>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                            {victim.condition || 'Status Unknown'}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-y-2 text-xs font-medium">
                          <div className="col-span-2">
                            <span className="text-slate-400 text-[10px] block uppercase font-bold tracking-tight">
                              Full Name
                            </span>
                            <span className="text-slate-800 font-semibold">
                              {victim.name || 'N/A'}
                            </span>
                          </div>

                          <div>
                            <span className="text-slate-400 text-[10px] block uppercase font-bold tracking-tight">
                              Age
                            </span>
                            <span className="text-slate-800 font-semibold">
                              {victim.age || 'N/A'} yrs old
                            </span>
                          </div>

                          <div>
                            <span className="text-slate-400 text-[10px] block uppercase font-bold tracking-tight">
                              Biological Sex
                            </span>
                            <span className="text-slate-800 font-semibold">
                              {victim.gender === 'M' ? 'Male' : victim.gender === 'F' ? 'Female' : 'N/A'}
                            </span>
                          </div>

                          <div className="col-span-2">
                            <span className="text-slate-400 text-[10px] block uppercase font-bold tracking-tight">
                              Home Address Range
                            </span>
                            <span className="text-slate-700 text-[11px] leading-tight block">
                              {victim.address || 'N/A'}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 text-right">
              <button
                type="button"
                onClick={() => setDetailsReport(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl shadow-sm transition-all active:scale-95"
              >
                Dismiss Ledger Overview
              </button>
            </div>
          </div>
        </div>
      )}

      <MobileNavBar />
    </div>
  )
}

const DetailItem = ({
  label,
  value,
  isMono,
  isStatus,
}: {
  label: string
  value: string | number
  isMono?: boolean
  isStatus?: boolean
}) => (
  <div className="space-y-0.5">
    <span className="text-[10px] text-slate-400 block font-extrabold uppercase tracking-wider">
      {label}
    </span>

    {isStatus ? (
      <span className="inline-flex items-center font-bold text-xs text-emerald-600 mt-1">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5" />
        {value || 'N/A'}
      </span>
    ) : (
      <span className={`text-sm font-semibold text-slate-800 block ${isMono ? 'font-mono tracking-tight text-blue-600' : ''}`}>
        {value || 'N/A'}
      </span>
    )}
  </div>
)

export default IncidentReportPage