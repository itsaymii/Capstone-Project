import { useEffect, useState } from 'react'
import type { FC } from 'react'
import { useNavigate } from 'react-router-dom'
import { MobileNavBar } from '../../components/MobileNavBar'

interface IndividualReport {
  id: string
  reportCode: string
  incidentCode: string
  incidentType: string
  location: string
  description: string
  actionTaken: string
  victimCount: number
  timeOccurred?: string
}

interface CompiledReport {
  id: string
  compiledCode: string
  title: string
  reports: IndividualReport[]
  totalReports: number
  createdAt: string
  status: string
}

export const ResponderReportsPage: FC = () => {
  const navigate = useNavigate()

  const [compiledReports, setCompiledReports] = useState<CompiledReport[]>([])
  const [selectedCompiled, setSelectedCompiled] = useState<CompiledReport | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchCompiledReports = async () => {
      try {
        setIsLoading(true)

        const response = await fetch(
          'http://127.0.0.1:8000/api/incidents/accomplishment-reports/'
        )

        if (!response.ok) {
          throw new Error('Failed to fetch accomplishment reports')
        }

        const data = await response.json()
        const reportsData = Array.isArray(data) ? data : data.results || []

        setCompiledReports(reportsData)
      } catch (error) {
        console.error('Error fetching accomplishment reports:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchCompiledReports()
  }, [])

  const filteredAndSortedReports = compiledReports
    .filter((report) => {
      const query = searchQuery.toLowerCase()

      return (
        report.compiledCode?.toLowerCase().includes(query) ||
        report.title?.toLowerCase().includes(query)
      )
    })
    .sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime()
      const dateB = new Date(b.createdAt).getTime()

      return sortOrder === 'newest' ? dateB - dateA : dateA - dateB
    })

  const getIncidentBadgeStyle = (type: string) => {
    const lower = type.toLowerCase()

    if (lower.includes('med')) {
      return 'bg-rose-50 text-rose-700 border-rose-100 ring-rose-500/10'
    }

    if (lower.includes('fire')) {
      return 'bg-orange-50 text-orange-700 border-orange-100 ring-orange-500/10'
    }

    if (lower.includes('rtc') || lower.includes('vehic') || lower.includes('rca')) {
      return 'bg-amber-50 text-amber-700 border-amber-100 ring-amber-500/10'
    }

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
                  Historical Archive
                </span>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 leading-tight">
                  Accomplishment Reports
                </h1>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-slate-100 pt-5">
              <p className="text-sm text-slate-500 font-medium leading-relaxed max-w-lg">
                Archive of compiled operational field reports and response documentation for administrative review.
              </p>
            </div>
          </div>

          <div className="p-5 sm:p-6 bg-slate-50/50 border-b border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="md:col-span-2 space-y-1.5 relative group">
              <label className="block text-xs font-extrabold text-slate-400 uppercase tracking-wider">
                Search Reports
              </label>

              <input
                type="text"
                placeholder="Search by Accomplishment Code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                disabled={compiledReports.length === 0}
                className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium placeholder:text-slate-400 disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-extrabold text-slate-400 uppercase tracking-wider">
                Sort By
              </label>

              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as 'newest' | 'oldest')}
                disabled={compiledReports.length === 0}
                className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-bold text-slate-700 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
              </select>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-sm">
            <p className="text-sm font-semibold text-slate-500">
              Loading accomplishment reports...
            </p>
          </div>
        ) : compiledReports.length === 0 ? (
          <div className="bg-white rounded-2xl p-16 text-center border border-slate-200 shadow-sm transition-all">
            <div className="max-w-md mx-auto space-y-5">
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-slate-900">
                  No accomplishment reports yet
                </h3>
                <p className="text-sm text-slate-500 leading-relaxed">
                  Select incident reports first and compile them into an accomplishment report.
                </p>
              </div>

              <button
                onClick={() => navigate('/responder-incidents')}
                className="inline-flex items-center justify-center gap-2 bg-blue-600 text-white text-sm font-bold px-6 py-3 rounded-xl hover:bg-blue-700 active:scale-95 shadow-sm transition-all"
              >
                Go to Incident Reports
              </button>
            </div>
          </div>
        ) : filteredAndSortedReports.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 text-slate-500 shadow-sm">
            <h4 className="text-sm font-bold text-slate-800">
              No matching archives found
            </h4>
            <p className="text-xs text-slate-400 mt-1">
              Refine your search or clear your criteria.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50/70 border-b border-slate-200/80">
                  <tr>
                    <th className="px-6 py-4 font-extrabold text-slate-500 text-xs uppercase tracking-wider">
                      Accomplishment Code
                    </th>
                    <th className="px-6 py-4 font-extrabold text-slate-500 text-xs uppercase tracking-wider">
                      Total Reports
                    </th>
                    <th className="px-6 py-4 font-extrabold text-slate-500 text-xs uppercase tracking-wider">
                      Compiled Date
                    </th>
                    <th className="px-6 py-4 font-extrabold text-slate-500 text-xs uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filteredAndSortedReports.map((report) => (
                      <tr
                        key={report.id}
                        onClick={() => setSelectedCompiled(report)}
                        className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                        title="Click to view accomplishment report"
                      >
                      <td className="px-6 py-4 text-sm font-mono font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                        {report.compiledCode}
                      </td>

                      <td className="px-6 py-4 text-sm font-medium text-slate-600">
                        <span className="bg-slate-100 px-2.5 py-1 rounded-md text-xs font-bold text-slate-700 border border-slate-200/60">
                          {report.totalReports} Files Included
                        </span>
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

                      <td className="px-6 py-4 text-right">
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {selectedCompiled && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[85vh] overflow-hidden flex flex-col border border-slate-100">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2.5">
                  <h2 className="text-lg font-black text-slate-900 tracking-tight font-mono">
                    {selectedCompiled.compiledCode}
                  </h2>
                  <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-100 rounded-md">
                    Package Archive
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-medium">
                  Bundled tactical accomplishment review records
                </p>
              </div>

              <button
                onClick={() => setSelectedCompiled(null)}
                className="p-2 text-sm text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-md transition-colors active:scale-95"
                title="Close Overview"
              >
                Close
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 text-slate-700 bg-slate-50/30">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">
                  Compiled Incident Documents Stack ({selectedCompiled.reports.length})
                </h3>

                <span className="text-xs font-medium text-slate-400">
                  Created:{' '}
                  {new Date(selectedCompiled.createdAt).toLocaleDateString(undefined, {
                    dateStyle: 'long',
                  })}
                </span>
              </div>

              <div className="space-y-6">
                {selectedCompiled.reports.map((report, index) => (
                  <div
                    key={report.id || index}
                    className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4 relative overflow-hidden"
                  >
                    <div className="absolute top-0 bottom-0 left-0 w-1 bg-indigo-500" />

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 block uppercase tracking-wider font-mono">
                          Record Leaf #{index + 1}
                        </span>

                        <h4 className="font-extrabold text-sm text-slate-900 font-mono tracking-tight flex items-center gap-2">
                          <span className="text-blue-600">
                            {report.reportCode}
                          </span>
                          <span className="text-slate-300">/</span>
                          <span className="text-slate-500 text-xs">
                            {report.incidentCode}
                          </span>
                        </h4>
                      </div>

                      <span className={`inline-flex items-center self-start sm:self-auto text-[9px] font-extrabold tracking-wider uppercase px-2.5 py-0.5 border rounded-md ring-1 ${getIncidentBadgeStyle(report.incidentType)}`}>
                        {report.incidentType}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div className="space-y-1 bg-slate-50/60 p-2.5 rounded-xl border border-slate-100">
                        <span className="text-[10px] text-slate-400 block font-extrabold uppercase tracking-wider">
                          Deployment Zone Area
                        </span>
                        <span className="text-slate-800 font-semibold leading-relaxed block">
                          {report.location}
                        </span>
                      </div>

                      <div className="space-y-1 bg-slate-50/60 p-2.5 rounded-xl border border-slate-100">
                        <span className="text-[10px] text-slate-400 block font-extrabold uppercase tracking-wider">
                          Casualties / Victim Metric
                        </span>
                        <span className="inline-flex items-center font-bold text-slate-800 mt-0.5">
                          <span className={`w-1.5 h-1.5 rounded-full mr-2 ${report.victimCount > 0 ? 'bg-amber-500' : 'bg-slate-400'}`} />
                          {report.victimCount} Individual
                          {report.victimCount !== 1 ? 's' : ''} Documented
                        </span>
                      </div>

                      <div className="sm:col-span-2 space-y-1">
                        <span className="text-[10px] text-slate-400 block font-extrabold uppercase tracking-wider">
                          Detailed Description Log
                        </span>
                        <p className="bg-slate-50/30 p-3 rounded-xl border border-slate-100 text-slate-600 leading-relaxed font-medium whitespace-pre-wrap">
                          {report.description || 'No descriptive logs found.'}
                        </p>
                      </div>

                      <div className="sm:col-span-2 space-y-1">
                        <span className="text-[10px] text-slate-400 block font-extrabold uppercase tracking-wider">
                          Mitigation Action Measures
                        </span>
                        <p className="bg-blue-50/10 p-3 rounded-xl border border-blue-100/40 text-slate-700 leading-relaxed font-medium whitespace-pre-wrap">
                          {report.actionTaken || 'No action mitigation sequence tracked.'}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 text-right">
              <button
                type="button"
                onClick={() => setSelectedCompiled(null)}
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

export default ResponderReportsPage