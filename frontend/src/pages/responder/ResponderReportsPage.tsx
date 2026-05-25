import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { getCurrentUserProfile, logoutUser } from '../../services/auth'

interface Incident {
  id: string
  type: 'Medical' | 'RTC' | 'Fire' | 'Hazmat'
  location: string
  timeOccurred: string
  status: 'Pending Report' | 'Completed'
  victimCount: number
}

interface Report {
  id: string
  incidentIds: string[]
  submittedBy: string
  submittedDate: string
  status: 'Draft' | 'Submitted' | 'Approved'
  incidentType: string
  location: string
}

interface ReportFormData {
  actionsTaken: string
  remarks: string
  equipmentUsed: string[]
  finalOutcome: 'Resolved' | 'Transferred to Hospital' | 'On-going' | 'Cleared'
}

const mockReports: Report[] = [
  {
    id: 'REP-001',
    incidentIds: ['INC-001'],
    submittedBy: 'John Doe',
    submittedDate: '2024-05-15 04:30 PM',
    status: 'Approved',
    incidentType: 'Medical',
    location: 'Barangay 1, Main St',
  },
  {
    id: 'REP-002',
    incidentIds: ['INC-003'],
    submittedBy: 'Jane Smith',
    submittedDate: '2024-05-15 03:45 PM',
    status: 'Submitted',
    incidentType: 'Fire',
    location: 'Barangay 3, Warehouse',
  },
]

// Report Creation Modal Component
interface ReportCreationModalProps {
  isOpen: boolean
  onClose: () => void
  selectedIncidents: Incident[]
  onSubmit: (data: ReportFormData) => void
}

const ReportCreationModal: React.FC<ReportCreationModalProps> = ({
  isOpen,
  onClose,
  selectedIncidents,
  onSubmit,
}) => {
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState<ReportFormData>({
    actionsTaken: '',
    remarks: '',
    equipmentUsed: [],
    finalOutcome: 'Resolved',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [equipmentInput, setEquipmentInput] = useState('')

  if (!isOpen) return null

  const validateStep2 = () => {
    const newErrors: Record<string, string> = {}
    if (!formData.actionsTaken.trim()) {
      newErrors.actionsTaken = 'Actions Taken is required'
    } else if (formData.actionsTaken.length < 10) {
      newErrors.actionsTaken = 'Minimum 10 characters required'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleAddEquipment = () => {
    if (equipmentInput.trim()) {
      setFormData({
        ...formData,
        equipmentUsed: [...formData.equipmentUsed, equipmentInput.trim()],
      })
      setEquipmentInput('')
    }
  }

  const handleRemoveEquipment = (index: number) => {
    setFormData({
      ...formData,
      equipmentUsed: formData.equipmentUsed.filter((_, i) => i !== index),
    })
  }

  const handleSubmit = () => {
    if (validateStep2()) {
      onSubmit(formData)
      setStep(1)
      setFormData({
        actionsTaken: '',
        remarks: '',
        equipmentUsed: [],
        finalOutcome: 'Resolved',
      })
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-gray-100">
        {/* Header */}
        <div className="bg-gray-50/70 border-b border-gray-200/80 p-6 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-gray-900">Create Field Report</h2>
            <div className="flex items-center gap-2 mt-1.5">
              <span className={`h-1.5 w-12 rounded-full transition-colors duration-300 ${step >= 1 ? 'bg-blue-600' : 'bg-gray-200'}`}></span>
              <span className={`h-1.5 w-12 rounded-full transition-colors duration-300 ${step === 2 ? 'bg-blue-600' : 'bg-gray-200'}`}></span>
              <span className="text-xs text-gray-500 font-medium ml-1">Step {step} of 2</span>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Close modal"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Selected Incidents</h3>
              {selectedIncidents.length === 0 ? (
                <div className="text-center py-10 border border-dashed border-gray-200 rounded-xl text-gray-400 text-sm">
                  No active incidents linked to this report profile.
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedIncidents.map((incident) => (
                    <div key={incident.id} className="p-4 bg-gray-50/50 rounded-xl border border-gray-200/60">
                      <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm">
                        <div>
                          <p className="text-xs text-gray-400 font-medium">Incident ID</p>
                          <p className="font-semibold text-gray-900 mt-0.5">{incident.id}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 font-medium">Classification</p>
                          <p className="font-semibold text-gray-900 mt-0.5">{incident.type}</p>
                        </div>
                        <div className="col-span-2 border-t border-gray-100 pt-2.5">
                          <p className="text-xs text-gray-400 font-medium">Location</p>
                          <p className="text-gray-700 mt-0.5 font-medium">{incident.location}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              {/* Context Summary Box */}
              <div className="bg-blue-50/40 p-4 rounded-xl border border-blue-100/70 text-sm">
                <div className="grid grid-cols-2 gap-2 text-gray-600">
                  <p>Incident Type: <span className="font-semibold text-gray-900">{selectedIncidents[0]?.type || 'N/A'}</span></p>
                  <p className="truncate">Location: <span className="font-semibold text-gray-900">{selectedIncidents[0]?.location || 'N/A'}</span></p>
                </div>
              </div>

              {/* Actions Taken Form Field */}
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-1.5">
                  Actions Taken <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={formData.actionsTaken}
                  onChange={(e) => {
                    setFormData({ ...formData, actionsTaken: e.target.value })
                    if (errors.actionsTaken) setErrors({ ...errors, actionsTaken: '' })
                  }}
                  className="w-full px-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all h-28 resize-none"
                  placeholder="Provide a detailed log of tactical parameters executed..."
                />
                {errors.actionsTaken && (
                  <p className="text-red-600 text-xs mt-1.5 flex items-center gap-1 font-medium">
                    <span>⚠️</span> {errors.actionsTaken}
                  </p>
                )}
              </div>

              {/* Remarks Form Field */}
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-1.5">Remarks / Annotations</label>
                <textarea
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all h-20 resize-none"
                  placeholder="Additional context or supportive assessments..."
                />
              </div>

              {/* Equipment Used Input Tracker */}
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-1.5">Deployment Equipment Used</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={equipmentInput}
                    onChange={(e) => setEquipmentInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddEquipment())}
                    className="flex-1 px-4 py-2 bg-gray-50/50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    placeholder="e.g., Spine Board, First Aid Kit Kit-A..."
                  />
                  <button
                    type="button"
                    onClick={handleAddEquipment}
                    className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-200 active:bg-gray-300 transition-colors"
                  >
                    Add
                  </button>
                </div>
                {formData.equipmentUsed.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3 p-3 bg-gray-50/50 rounded-xl border border-gray-100">
                    {formData.equipmentUsed.map((item, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 bg-white border border-gray-200/80 text-gray-700 pl-3 pr-2 py-1 rounded-lg text-xs font-medium shadow-sm animate-fade-in"
                      >
                        {item}
                        <button
                          type="button"
                          onClick={() => handleRemoveEquipment(idx)}
                          className="text-gray-400 hover:text-red-500 transition-colors p-0.5 rounded"
                          aria-label={`Remove ${item}`}
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Final Outcome Custom Picker */}
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-1.5">
                  Final Operational Outcome <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.finalOutcome}
                  onChange={(e) => setFormData({ ...formData, finalOutcome: e.target.value as ReportFormData['finalOutcome'] })}
                  className="w-full px-3 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                >
                  <option value="Resolved">Resolved</option>
                  <option value="Transferred to Hospital">Transferred to Hospital</option>
                  <option value="On-going">On-going</option>
                  <option value="Cleared">Cleared</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="bg-gray-50 border-t border-gray-200/80 p-5 flex items-center justify-between">
          <div>
            {step === 2 && (
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2 text-sm font-semibold text-gray-600 border border-gray-200 rounded-xl hover:bg-white active:bg-gray-100 transition-all shadow-sm"
              >
                Back
              </button>
            )}
          </div>
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-gray-600 border border-gray-200 rounded-xl hover:bg-white active:bg-gray-100 transition-all shadow-sm"
            >
              Cancel
            </button>
            {step === 1 ? (
              <button
                type="button"
                onClick={() => setStep(2)}
                disabled={selectedIncidents.length === 0}
                className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm shadow-blue-200"
              >
                Next Step
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                className="px-5 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 transition-all shadow-sm shadow-emerald-200"
              >
                Submit Report
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Main Reports Page Component
export function ResponderReportsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const profile = getCurrentUserProfile()
  const displayName = profile?.fullName?.trim() || 'Responder'
  const firstName = displayName.split(/\s+/).filter(Boolean)[0] || 'Responder'
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'RE'

  const locationState = location.state as { selectedIncidents?: Incident[] } | null
  const initialSelected = locationState?.selectedIncidents || []

  const [reports, setReports] = useState<Report[]>(mockReports)
  const [isReportModalOpen, setIsReportModalOpen] = useState(initialSelected.length > 0)
  const [selectedIncidents] = useState<Incident[]>(initialSelected)
  const [isTopProfileMenuOpen, setIsTopProfileMenuOpen] = useState(false)
  const [filters, setFilters] = useState({
    dateRange: '',
    incidentType: '',
    status: '',
  })

  const filteredReports = reports.filter((report) => {
    return (
      (!filters.incidentType || report.incidentType.includes(filters.incidentType)) &&
      (!filters.status || report.status === filters.status)
    )
  })

  const handleSubmitReport = (_formData: ReportFormData) => {
    const newReport: Report = {
      id: `REP-${String(reports.length + 1).padStart(3, '0')}`,
      incidentIds: selectedIncidents.map((inc) => inc.id),
      submittedBy: displayName,
      submittedDate: new Date().toLocaleString(),
      status: 'Submitted',
      incidentType: selectedIncidents.map((inc) => inc.type).join(', '),
      location: selectedIncidents[0]?.location || 'Multiple Locations',
    }

    setReports([newReport, ...reports])
  }

  const handleLogout = async () => {
    await logoutUser()
    navigate('/login')
  }

  const handleDownloadPDF = (reportId: string) => {
    alert(`Downloading structured data package for ${reportId}...`)
  }

  const handleEditReport = (reportId: string) => {
    alert(`Requesting modification layer access for ${reportId}...`)
  }

  const handleCreateReport = () => {
    navigate('/create-report')
  }

  const isActiveNav = (path: string) => {
    if (typeof window === 'undefined') return false
    return window.location.pathname.includes(path)
  }

  return (
    <div className="min-h-screen bg-[#f4f7fb] text-slate-900">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white shadow-[0_12px_32px_rgba(15,23,42,0.08)]">
        <div className="flex items-center justify-between px-6 py-3.5">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate('/responder-dashboard')} 
              className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Back to dashboard"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <h1 className="text-xl font-bold tracking-tight text-gray-900">Reports Architecture</h1>
          </div>

          <div className="flex items-center gap-4">
            {/* Notification Icon - FIXED: Using inline SVG instead of undefined variable */}
            <button className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100/80 rounded-lg transition-colors" aria-label="Notifications">
              <svg className="w-5 h-5 opacity-75" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white"></span>
            </button>

            {/* Profile Menu */}
            <div className="relative">
              <button
                onClick={() => setIsTopProfileMenuOpen(!isTopProfileMenuOpen)}
                className="flex items-center gap-2.5 p-1.5 hover:bg-gray-100/80 rounded-lg transition-colors"
                aria-label="Profile menu"
                aria-expanded={isTopProfileMenuOpen}
              >
                <div className="w-7 h-7 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-full flex items-center justify-center text-white text-xs font-semibold shadow-sm">
                  {initials}
                </div>
                <span className="text-sm font-medium text-gray-700 hidden sm:inline">{firstName}</span>
                <svg className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isTopProfileMenuOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Dropdown Menu */}
              {isTopProfileMenuOpen && (
                <div className="absolute right-0 top-[calc(100%+0.5rem)] z-30 w-48 rounded-2xl border border-slate-200 bg-white shadow-[0_18px_38px_rgba(15,23,42,0.12)]">
                  <div className="border-b border-slate-200 px-4 py-3">
                    <p className="text-sm font-semibold text-slate-900 truncate">{displayName}</p>
                    <p className="text-xs text-slate-600 mt-0.5 truncate">{profile?.role || 'Responder'}</p>
                  </div>
                  <div className="py-1">
                    <button 
                      onClick={() => {
                        setIsTopProfileMenuOpen(false)
                        navigate('/responder-profile-settings')
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      Profile Settings
                    </button>
                    <button className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors">
                      Help & Support
                    </button>
                  </div>
                  <div className="border-t border-slate-200 pt-1 mt-1">
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50/60 transition-colors"
                    >
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Module Header layout */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-gray-900">Team Manifest Reports</h2>
            <p className="text-sm text-gray-500 mt-0.5">Audit trail and complete operational log metrics.</p>
          </div>
          <button
            onClick={handleCreateReport}
            className="inline-flex items-center justify-center gap-2 bg-blue-600 text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-blue-700 shadow-sm transition-all shadow-blue-100"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            <span>New Incident Report</span>
          </button>
        </div>

        {/* Filter Management Bar */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200/80 flex gap-3 flex-wrap items-center">
          <select
            value={filters.dateRange}
            onChange={(e) => setFilters({ ...filters, dateRange: e.target.value })}
            className="px-3 py-2 bg-gray-50/50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all min-w-[130px]"
          >
            <option value="">All Timeline</option>
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
          </select>
          <select
            value={filters.incidentType}
            onChange={(e) => setFilters({ ...filters, incidentType: e.target.value })}
            className="px-3 py-2 bg-gray-50/50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all min-w-[130px]"
          >
            <option value="">All Types</option>
            <option value="Medical">Medical</option>
            <option value="RTC">RTC</option>
            <option value="Fire">Fire</option>
            <option value="Hazmat">Hazmat</option>
          </select>
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="px-3 py-2 bg-gray-50/50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all min-w-[130px]"
          >
            <option value="">All Status Profiles</option>
            <option value="Draft">Draft</option>
            <option value="Submitted">Submitted</option>
            <option value="Approved">Approved</option>
          </select>
        </div>

        {/* Reports Core Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200/80 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/70 border-b border-gray-200/80 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  <th className="px-6 py-3.5">Report ID</th>
                  <th className="px-6 py-3.5">Linked Incidents</th>
                  <th className="px-6 py-3.5">Submitted By</th>
                  <th className="px-6 py-3.5">Timestamp Matrix</th>
                  <th className="px-6 py-3.5">Verification Status</th>
                  <th className="px-6 py-3.5 text-right">Actions Panel</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {filteredReports.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-400 font-normal">
                      No validated field reports discovered matching parameter conditions.
                    </td>
                  </tr>
                ) : (
                  filteredReports.map((report) => (
                    <tr key={report.id} className="transition-colors hover:bg-gray-50/40">
                      <td className="px-6 py-3.5 font-semibold text-gray-950">{report.id}</td>
                      <td className="px-6 py-3.5 text-gray-600 font-medium">
                        {report.incidentIds.join(', ')}
                      </td>
                      <td className="px-6 py-3.5 text-gray-600">{report.submittedBy}</td>
                      <td className="px-6 py-3.5 text-gray-500">{report.submittedDate}</td>
                      <td className="px-6 py-3.5">
                        <span className={`inline-flex items-center text-xs font-semibold ${
                          report.status === 'Approved' ? 'text-emerald-600' :
                          report.status === 'Submitted' ? 'text-blue-600' : 'text-gray-500'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                            report.status === 'Approved' ? 'bg-emerald-500' :
                            report.status === 'Submitted' ? 'bg-blue-500' : 'bg-gray-400'
                          }`}></span>
                          {report.status}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <div className="flex gap-1.5 justify-end">
                          <button
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-gray-50 rounded-lg transition-colors"
                            title="View report parameters"
                            aria-label="View report"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDownloadPDF(report.id)}
                            className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-gray-50 rounded-lg transition-colors"
                            title="Download localized package"
                            aria-label="Download report"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                          </button>
                          {report.status !== 'Approved' && (
                            <button
                              onClick={() => handleEditReport(report.id)}
                              className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-gray-50 rounded-lg transition-colors"
                              title="Modify operational matrix"
                              aria-label="Edit report"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Load More Dynamic Controls */}
        <div className="flex justify-center pt-2">
          <button className="px-4 py-2 text-sm font-semibold text-blue-600 border border-blue-200 bg-white rounded-xl hover:bg-blue-50/60 active:bg-blue-50 transition-all shadow-sm">
            Load Historical Assets
          </button>
        </div>
      </main>

      {/* Report Creation Component Trigger Overlay */}
      <ReportCreationModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        selectedIncidents={selectedIncidents}
        onSubmit={handleSubmitReport}
      />

      {/* --- MOBILE BOTTOM NAVIGATION BAR --- */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] z-50 px-2 py-2">
        <div className="flex justify-around items-center">
          
          {/* Incident Button */}
          <button 
            onClick={() => navigate('/responder-incidents')}
            className={`flex flex-col items-center gap-1 transition-colors active:scale-95 ${
              isActiveNav('/responder-incidents') ? 'text-blue-600' : 'text-slate-500 hover:text-blue-600'
            }`}
            aria-label="View Incidents"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <span className="text-[10px] font-medium">Incident</span>
          </button>

          {/* Create Report Button */}
          <button 
            onClick={() => navigate('/create-report')} 
            className={`flex flex-col items-center gap-1 transition-colors active:scale-95 ${
              isActiveNav('/create-report') ? 'text-blue-600' : 'text-slate-500 hover:text-blue-600'
            }`}
            aria-label="Create Report"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="text-[10px] font-medium">Create Report</span>
          </button>

          {/* Accomplishment Report Button */}
          <button 
            onClick={() => navigate('/responder-reports')}
            className={`flex flex-col items-center gap-1 transition-colors active:scale-95 ${
              isActiveNav('/responder-reports') ? 'text-blue-600' : 'text-slate-500 hover:text-blue-600'
            }`}
            aria-label="View Reports"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-[10px] font-medium">Accomplishment</span>
          </button>

          {/* Profile Button */}
          <button 
            onClick={() => navigate('/responder-profile-settings')} 
            className={`flex flex-col items-center gap-1 transition-colors active:scale-95 ${
              isActiveNav('/responder-profile-settings') ? 'text-blue-600' : 'text-slate-500 hover:text-blue-600'
            }`}
            aria-label="Profile Settings"
          >
            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold shadow-sm ${
              isActiveNav('/responder-profile-settings') 
                ? 'bg-gradient-to-br from-blue-700 to-indigo-700 ring-2 ring-blue-300' 
                : 'bg-gradient-to-br from-blue-600 to-indigo-600'
            }`}>
              {initials}
            </div>
            <span className="text-[10px] font-medium">Profile</span>
          </button>

        </div>
      </nav>
    </div>
  )
}

export default ResponderReportsPage
