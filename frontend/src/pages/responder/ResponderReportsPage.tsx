import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentUserProfile } from '../../services/auth'
import { MobileNavBar } from '../../components/MobileNavBar';

export function ResponderReportsPage() {
  const navigate = useNavigate()
  const profile = getCurrentUserProfile()

  // Temporary simulated state para makita ang parehong empty at populated layouts kung kailangan
  const [compiledReports] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState('')

  return (
    <div className="min-h-screen bg-slate-100 pb-28 sm:pb-12 pt-6 antialiased text-slate-800">
      <main className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
        
        {/* Main Control Panel (Pinagsamang Header at Filter Area para iwas lutang) */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Header Navigation */}
          <div className="p-5 sm:p-7 border-b border-slate-200/80 space-y-5 overflow-hidden relative">
            {/* Subtle Accent Gradient for Status */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500" />
            
            <div className="flex items-center gap-4">
              <button 
                onClick={() => navigate('/responder-dashboard')}
                className="group flex items-center justify-center w-10 h-10 bg-slate-50 text-slate-500 hover:bg-blue-50 hover:text-blue-600 rounded-2xl transition-all border border-slate-100 shadow-sm active:scale-90"
                title="Back to Dashboard"
              >
                <svg className="w-5 h-5 transform group-hover:-translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              
              <div>
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600 opacity-60 block mb-0.5 leading-none">Historical Archive</span>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 leading-tight">Compiled Incident Reports</h1>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-slate-100 pt-5">
              <p className="text-sm text-slate-500 font-medium leading-relaxed max-w-lg">
                Archive of all operational field reports and response documentation for administrative review.
              </p>
            </div>
          </div>

          {/* Lower Search/Filter Section */}
          <div className="p-5 sm:p-6 bg-white grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="md:col-span-2 space-y-1.5">
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider">Search Reports</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search by Report ID, Reference Code, or Responder Name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  disabled={compiledReports.length === 0}
                  className="w-full pl-3 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm placeholder:text-slate-400 disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider">Sort By</label>
              <select
                disabled={compiledReports.length === 0}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
              </select>
            </div>
          </div>
        </div>

        {/* Content Section (Empty State or Table) */}
        {compiledReports.length === 0 ? (
          <div className="bg-white rounded-2xl p-16 text-center border border-slate-200 shadow-sm transition-all">
            <div className="max-w-md mx-auto space-y-5">
              <div className="w-16 h-16 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
                <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-slate-900">No compiled reports yet</h3>
                <p className="text-sm text-slate-500 leading-relaxed">
                  Generate your first report from the active incident ledger to build your operational team archive.
                </p>
              </div>
              <div className="pt-2">
                <button
                  onClick={() => navigate('/responder-incidents')}
                  className="inline-flex items-center justify-center gap-2 bg-blue-600 text-white text-sm font-bold px-6 py-3 rounded-xl hover:bg-blue-700 active:scale-95 shadow-sm shadow-blue-500/10 transition-all"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Generate First Report
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Structured Table ready for data binding */
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3.5 font-semibold text-slate-700 text-xs uppercase tracking-wider">Report ID</th>
                    <th className="px-6 py-3.5 font-semibold text-slate-700 text-xs uppercase tracking-wider">Incident Ref</th>
                    <th className="px-6 py-3.5 font-semibold text-slate-700 text-xs uppercase tracking-wider">Compiled Date</th>
                    <th className="px-6 py-3.5 font-semibold text-slate-700 text-xs uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3.5 text-right font-semibold text-slate-700 text-xs uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {compiledReports.map((report) => (
                    <tr key={report.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4 text-sm font-mono font-semibold text-slate-900">
                        #{report.id?.slice(0, 8)}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {report.incident_reference || 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {new Date(report.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-xs">
                        <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full font-semibold">
                          SUBMITTED
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-right">
                        <button className="text-blue-600 hover:text-blue-800 font-bold text-xs uppercase tracking-wider">
                          View PDF
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
      <MobileNavBar />
    </div>
  )
}

export default ResponderReportsPage