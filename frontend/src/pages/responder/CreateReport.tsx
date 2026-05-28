import { useState, useEffect } from 'react'
import type { FC, FormEvent } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { submitResponderReport } from '../../services/incidents'
import { MobileNavBar } from '../../components/MobileNavBar'
import { addNotification } from '../../services/notifications'

interface VictimDetails {
  name: string
  age: string
  gender: 'M' | 'F' | ''
  address: string
  condition: string
}

interface IncidentReportForm {
  timeOccurred: string
  incidentType: string
  responderTeam: string
  description: string
  location: string
  victimCount: number
  victims: VictimDetails[]
  actionTaken: string
}

export const CreateReport: FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  
  const state = location.state as { incidentId?: string; incident?: any } | null
  // ✅ Support both UUID and reference_code from state
  const incidentIdFromState = state?.incidentId 
    || state?.incident?.reference_code
    || state?.incident?.rawData?.id
    || state?.incident?.id
    || ''

  const [formData, setFormData] = useState<IncidentReportForm>({
    timeOccurred: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
    incidentType: 'RCA',
    responderTeam: 'Ambulance Assistance',
    description: 'Involving 1 Motorcycle vs 1 Pick up Hilux',
    location: 'Near Rotonda Brgy. Isabang L.C',
    victimCount: 1,
    victims: [
      {
        name: 'Rico Daniel Altar',
        age: '26',
        gender: 'M',
        address: 'Brgy. 4 Lucena City',
        condition: 'Right Knee Cap Fractured',
      },
    ],
    actionTaken: 'First aid management, Splinting and Transported to QMC',
  })

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // ✅ Store normalized reference code (INC-YYYY-NNN)
  const [incidentId, setIncidentId] = useState(incidentIdFromState?.toUpperCase() || '')

  useEffect(() => {
    if (state?.incident) {
      const inc = state.incident
      // ✅ Prefer reference_code if available
      const refCode = inc.reference_code || inc.rawData?.reference_code
      if (refCode) setIncidentId(refCode.toUpperCase())
      
      setFormData(prev => ({
        ...prev,
        incidentType: inc.type || prev.incidentType,
        description: inc.description !== 'No description' ? inc.description : prev.description,
        location: inc.location !== 'Unknown location' ? inc.location : prev.location,
        victimCount: inc.victimCount || prev.victimCount,
      }))
    }
  }, [state])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleVictimChange = (index: number, field: keyof VictimDetails, value: string) => {
    const updatedVictims = [...formData.victims]
    updatedVictims[index] = { ...updatedVictims[index], [field]: value }
    setFormData((prev) => ({ ...prev, victims: updatedVictims }))
  }

  const syncVictimCount = (count: number) => {
    let currentVictims = [...formData.victims]
    if (count > currentVictims.length) {
      const diff = count - currentVictims.length
      for (let i = 0; i < diff; i++) {
        currentVictims.push({ name: '', age: '', gender: '', address: '', condition: '' })
      }
    } else if (count < currentVictims.length) {
      currentVictims = currentVictims.slice(0, count)
    }
    setFormData((prev) => ({ ...prev, victimCount: count, victims: currentVictims }))
  }

  const addVictimRow = () => {
    const nextCount = formData.victimCount + 1
    setFormData((prev) => ({
      ...prev,
      victimCount: nextCount,
      victims: [...prev.victims, { name: '', age: '', gender: '', address: '', condition: '' }]
    }))
  }

  const removeVictimRow = (index: number) => {
    const updatedVictims = formData.victims.filter((_, idx) => idx !== index)
    setFormData((prev) => ({
      ...prev,
      victimCount: updatedVictims.length,
      victims: updatedVictims
    }))
  }

  // ✅ UPDATED: Validate INC-YYYY-NNN format (primary) + UUID (fallback)
  const isValidIncidentId = (value: string): boolean => {
    const normalized = value.toUpperCase().trim()
    // Primary: INC-YYYY-NNN format (e.g., INC-2025-001)
    const referenceCodeRegex = /^INC-\d{4}-\d{3}$/
    // Fallback: UUID format for backward compatibility
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    return referenceCodeRegex.test(normalized) || uuidRegex.test(value)
  }

  const getIncidentIdFormat = (value: string): 'reference' | 'uuid' | 'invalid' => {
    const normalized = value.toUpperCase().trim()
    if (/^INC-\d{4}-\d{3}$/.test(normalized)) return 'reference'
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) return 'uuid'
    return 'invalid'
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    
    if (!incidentId || incidentId.trim() === '') {
      const errorMsg = 'Please enter a valid Incident Reference Code (e.g., INC-2025-001)'
      setError(errorMsg)
      addNotification(errorMsg)
      return
    }

    // ✅ Normalize to uppercase for API consistency
    const normalizedIncidentId = incidentId.trim().toUpperCase()
    const format = getIncidentIdFormat(normalizedIncidentId)

    if (format === 'invalid') {
      const errorMsg = `Invalid format. Use INC-YYYY-NNN (e.g., INC-2025-001)`
      setError(errorMsg)
      addNotification(errorMsg)
      console.error('[CreateReport] Invalid incident ID format:', incidentId)
      return
    }

    if (!formData.description?.trim()) {
      const errorMsg = 'Incident description is required.'
      setError(errorMsg)
      addNotification(errorMsg)
      return
    }

    if (!formData.location?.trim()) {
      const errorMsg = 'Location is required.'
      setError(errorMsg)
      addNotification(errorMsg)
      return
    }

    if (!formData.actionTaken?.trim()) {
      const errorMsg = 'Action taken details are required.'
      setError(errorMsg)
      addNotification(errorMsg)
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      const victimsText = formData.victims.length > 0
        ? formData.victims
            .map(
              (v, i) =>
                `Victim ${i + 1}: ${v.name || 'N/A'}, Age: ${v.age || 'N/A'}, Gender: ${v.gender || 'N/A'}, Address: ${v.address || 'N/A'}, Condition: ${v.condition || 'N/A'}`
            )
            .join('\n')
        : 'No victims recorded'

      const reportText = `
TIME: ${formData.timeOccurred}
INCIDENT TYPE: ${formData.incidentType}
RESPONDER TEAM: ${formData.responderTeam}
LOCATION: ${formData.location}
DESCRIPTION: ${formData.description}

VICTIM(S) INFORMATION:
${victimsText}
`.trim()

      console.log('[CreateReport] Submitting report for incident:', normalizedIncidentId)

      // ✅ Send with reference_code field (backend expects this now)
      await submitResponderReport({
        incident_reference_code: normalizedIncidentId,  // ← CHANGED: use reference_code
        report_text: reportText,
        action_taken: formData.actionTaken.trim(),
        status_update: 'Report submitted by responder',
      })

      console.log('[CreateReport] ✅ Report submitted successfully')
      addNotification(`✅ Report for ${normalizedIncidentId} submitted successfully!`)

      setTimeout(() => {
        navigate('/responder-reports', {
          state: { message: 'Report submitted successfully', success: true },
        })
      }, 1200)

    } catch (err: any) {
      console.error('[CreateReport] ❌ Error submitting report:', err)
      
      let errorMessage = 'Failed to submit report. Please try again.'
      
      if (err?.message?.startsWith('Backend Error:')) {
        const backendErrors = err.message.replace('Backend Error: ', '')
        
        if (backendErrors.toLowerCase().includes('not found') || backendErrors.toLowerCase().includes('incident')) {
          errorMessage = `Incident "${incidentId.toUpperCase()}" not found. Please select from Dispatch Ledger.`
        } else if (backendErrors.toLowerCase().includes('invalid') || backendErrors.toLowerCase().includes('format')) {
          errorMessage = 'Invalid Incident Code format. Use INC-YYYY-NNN (e.g., INC-2025-001)'
        } else if (backendErrors.toLowerCase().includes('report_text') || backendErrors.toLowerCase().includes('blank')) {
          errorMessage = 'Report content is missing. Please fill in all required fields.'
        } else if (backendErrors.toLowerCase().includes('action_taken')) {
          errorMessage = 'Action taken details are required. Please describe the interventions made.'
        } else {
          errorMessage = backendErrors
        }
      } else if (err?.response) {
        const { status } = err.response
        if (status === 401) {
          errorMessage = 'Session expired. Please log in again.'
        } else if (status === 403) {
          errorMessage = 'You do not have permission to submit reports.'
        } else if (status === 404) {
          errorMessage = `Incident "${incidentId.toUpperCase()}" not found.`
        } else if (status >= 500) {
          errorMessage = 'Server error. Please try again in a moment.'
        }
      } else if (err?.request) {
        errorMessage = 'No response from server. Please check your internet connection.'
      } else if (err instanceof Error) {
        errorMessage = err.message
      }

      console.error('[CreateReport] Final error message:', errorMessage)
      setError(errorMessage)
      addNotification(`❌ ${errorMessage}`)
      
    } finally {
      setIsLoading(false)
    }
  }

  const getAccentColor = (type: string) => {
    switch (type) {
      case 'Fire Incident': return 'border-l-4 border-l-red-500'
      case 'RCA': return 'border-l-4 border-l-amber-500'
      case 'Medical Emergency': return 'border-l-4 border-l-blue-600'
      case 'Crime Against Person/Property': return 'border-l-4 border-l-orange-600'
      default: return 'border-l-4 border-l-slate-400'
    }
  }

  const format = getIncidentIdFormat(incidentId)

  return (
    <div className="min-h-screen bg-slate-50 pb-28 sm:pb-12 pt-6 antialiased text-slate-800">
      <main className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
        
        {/* Header Navigation */}
        <div className="bg-white p-5 sm:p-7 rounded-2xl border border-slate-200/80 shadow-sm space-y-5 overflow-hidden relative">
          {/* Subtle Accent Gradient for Status */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500" />
          
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/responder-incidents')}
              className="group flex items-center justify-center w-10 h-10 bg-slate-50 text-slate-500 hover:bg-blue-50 hover:text-blue-600 rounded-2xl transition-all border border-slate-100 shadow-sm active:scale-90"
              title="Back to Incident Ledger"
            >
              <svg className="w-5 h-5 transform group-hover:-translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            
            <div>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600 opacity-60 block mb-0.5 leading-none">Response Protocol</span>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 leading-tight">New Incident Report</h1>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-slate-100 pt-5">
            <p className="text-sm text-slate-500 font-medium leading-relaxed max-w-lg">
              Document emergency response operations and victim assessments for synchronization with central command.
            </p>
            <button 
              onClick={() => navigate('/responder-incidents')}
              className="hidden sm:inline-flex text-xs font-bold text-slate-400 hover:text-red-500 transition-colors uppercase tracking-widest"
            >
              Discard Report
            </button>
          </div>
        </div>

        {/* Form Container */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden divide-y divide-slate-100">
          
          {/* Error Message Display */}
          {error && (
            <div className="p-4 bg-red-50 border-l-4 border-l-red-500 flex items-start gap-3">
              <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1">
                <p className="text-sm font-semibold text-red-800">Submission Error</p>
                <p className="text-sm text-red-700 mt-0.5">{error}</p>
                {(error.toLowerCase().includes('not found') || error.toLowerCase().includes('incident')) && (
                  <button
                    type="button"
                    onClick={() => navigate('/responder-incidents')}
                    className="mt-2 text-xs font-bold text-red-600 hover:underline"
                  >
                    ← Go back to Incident Ledger to select a valid incident
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Section 0: Incident Selection */}
          <div className="p-6 space-y-4 bg-blue-50 border-l-4 border-l-blue-500">
            <h3 className="text-xs font-bold uppercase tracking-wider text-blue-700 bg-blue-100 inline-block px-2.5 py-1 rounded-md">0. Incident Reference</h3>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Incident Code *</label>
              <input 
                type="text" 
                value={incidentId}
                onChange={(e) => {
                  // ✅ Auto-uppercase for consistency
                  setIncidentId(e.target.value.toUpperCase())
                  setError(null)
                }}
                placeholder="e.g. INC-2025-001"
                className="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2.5 bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none font-medium placeholder-slate-400 font-mono tracking-tight uppercase"
                required
              />
              <p className="text-xs text-slate-500 mt-1">Enter the reference code from the Emergency Dispatch Ledger</p>
              
              {incidentId && format === 'reference' && (
                <p className="text-[10px] text-emerald-600 mt-1 font-medium flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Valid reference code format ✓
                </p>
              )}
              {incidentId && format === 'uuid' && (
                <p className="text-[10px] text-amber-600 mt-1 font-medium flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  UUID detected. Prefer INC-YYYY-NNN format for shorter input.
                </p>
              )}
              {incidentId && format === 'invalid' && incidentId.length > 0 && (
                <p className="text-[10px] text-red-600 mt-1 font-medium flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Invalid format. Use INC-YYYY-NNN (e.g., INC-2025-001)
                </p>
              )}
            </div>
          </div>
          
          <div className={`p-6 space-y-5 transition-all ${getAccentColor(formData.incidentType)}`}>
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md">1. Incident Overview</h3>
              <span className="text-[11px] font-semibold text-slate-400 uppercase bg-slate-100 px-2 py-0.5 rounded">Required Form</span>
            </div>
            
            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Time Occurred</label>
                <input 
                  type="time" 
                  name="timeOccurred"
                  value={formData.timeOccurred}
                  onChange={handleInputChange}
                  className="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2.5 bg-slate-50/50 focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none font-medium"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Incident Type</label>
                <select 
                  name="incidentType"
                  value={formData.incidentType}
                  onChange={handleInputChange}
                  className="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2.5 bg-slate-50/50 focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none font-medium"
                  required
                >
                  <option value="RCA">RCA</option>
                  <option value="Fire Incident">Fire Incident</option>
                  <option value="Crime Against Person/Property">Crime Against Person/Property</option>
                  <option value="Medical Emergency">Medical Emergency</option>
                  <option value="Ambulance Assistance">Ambulance Assistance</option>
                  <option value="Stand-by Medical Team">Stand-by Medical Team</option>
                  <option value="Drowning">Drowning</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Responding Team</label>
                <input 
                  type="text" 
                  name="responderTeam"
                  value={formData.responderTeam}
                  onChange={handleInputChange}
                  placeholder="e.g. Fire Department, Ambulance Assistance"
                  className="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2.5 bg-slate-50/50 focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none font-medium placeholder-slate-400"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Incident Description / Particulars</label>
              <textarea 
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                rows={3}
                placeholder="e.g. Involving 1 Motorcycle vs 1 SUV..."
                className="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2.5 bg-slate-50/50 focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none resize-none font-medium placeholder-slate-400"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Location / Ground Zero</label>
              <div className="relative">
                <input 
                  type="text" 
                  name="location"
                  value={formData.location}
                  onChange={handleInputChange}
                  placeholder="Exact landmark, street or Barangay"
                  className="w-full text-sm border border-slate-200 rounded-xl pl-9 pr-3.5 py-2.5 bg-slate-50/50 focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none font-medium placeholder-slate-400"
                  required
                />
                <svg className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Section 2: Victims Profiling */}
          <div className="p-6 space-y-4 bg-slate-50/50 border-l-4 border-l-slate-400">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 bg-slate-200/80 inline-block px-2.5 py-1 rounded-md">2. Victim Profiling</h3>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center bg-white border border-slate-200 rounded-xl p-1 shadow-inner">
                  <span className="text-xs text-slate-500 font-bold px-2">Total Count:</span>
                  <input 
                    type="number" 
                    value={formData.victimCount}
                    onChange={(e) => syncVictimCount(Math.max(0, parseInt(e.target.value) || 0))}
                    min="0"
                    className="w-12 text-center text-sm font-bold bg-slate-50 rounded-lg py-1 text-blue-600 outline-none border border-transparent focus:border-slate-200"
                  />
                </div>
                <button
                  type="button"
                  onClick={addVictimRow}
                  className="px-3 py-1.5 bg-white border border-slate-200 hover:border-blue-500 hover:text-blue-600 text-slate-600 font-semibold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1"
                >
                  <span>+ Add Victim</span>
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {formData.victims.map((victim, idx) => (
                <div key={idx} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 relative group transition-all hover:border-slate-300">
                  <div className="text-xs font-bold text-slate-400 border-b border-slate-100 pb-2 flex justify-between items-center">
                    <span className="flex items-center gap-1.5 text-slate-600 font-mono text-[11px]">
                      <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                      CASE PATIENT #{idx + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeVictimRow(idx)}
                      className="text-red-500 hover:bg-red-50 px-2 py-1 rounded-lg transition text-[11px] font-semibold flex items-center gap-0.5"
                    >
                      Delete
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Full Name</label>
                      <input 
                        type="text"
                        value={victim.name}
                        onChange={(e) => handleVictimChange(idx, 'name', e.target.value)}
                        placeholder="John Doe"
                        className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Age</label>
                      <input 
                        type="text"
                        value={victim.age}
                        onChange={(e) => handleVictimChange(idx, 'age', e.target.value)}
                        placeholder="Age"
                        className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 text-center outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Biological Sex</label>
                      <select 
                        value={victim.gender}
                        onChange={(e) => handleVictimChange(idx, 'gender', e.target.value as 'M' | 'F')}
                        className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition font-medium"
                      >
                        <option value="">Select</option>
                        <option value="M">Male</option>
                        <option value="F">Female</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Permanent/Temporary Address</label>
                    <input 
                      type="text"
                      value={victim.address}
                      onChange={(e) => handleVictimChange(idx, 'address', e.target.value)}
                      placeholder="Street, Barangay, City/Municipality"
                      className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition font-medium placeholder-slate-400"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Physical Condition / Medical Assessment</label>
                    <input 
                      type="text"
                      value={victim.condition}
                      onChange={(e) => handleVictimChange(idx, 'condition', e.target.value)}
                      placeholder="e.g. Semi-conscious, Abrasion on left arm"
                      className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition font-medium placeholder-slate-400"
                    />
                  </div>
                </div>
              ))}
            </div>

            {formData.victimCount === 0 && (
              <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-2xl bg-white text-sm text-slate-400 font-medium">
                No casualties or victims profiles logged for this response operation.
              </div>
            )}
          </div>

          {/* Section 3: Action Taken */}
          <div className="p-6 space-y-4 border-l-4 border-l-emerald-500">
            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 inline-block px-2.5 py-1 rounded-md">3. Operation Log</h3>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Action Taken (A/T Intervention)</label>
              <textarea 
                name="actionTaken"
                value={formData.actionTaken}
                onChange={handleInputChange}
                rows={3}
                placeholder="Describe field operations interventions or medical treatments rendered..."
                className="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2.5 bg-slate-50/50 focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none resize-none font-medium placeholder-slate-400"
                required
              />
            </div>
          </div>

          {/* Bottom Submit Buttons */}
          <div className="p-4 bg-slate-50/80 flex items-center justify-end gap-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => navigate('/responder-dashboard')}
              disabled={isLoading}
              className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-200/60 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-6 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-95 rounded-xl shadow-md shadow-blue-500/10 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-600"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <span>Submit Report</span>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </>
              )}
            </button>
          </div>

        </form>
      </main>

      <MobileNavBar />
    </div>
  )
}

export default CreateReport