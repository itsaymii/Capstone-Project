import { useState } from 'react'
import type { FC, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'

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
  description: string
  location: string
  victimCount: number
  victims: VictimDetails[]
  actionTaken: string
}

export const CreateReport: FC = () => {
  const navigate = useNavigate()

  const [formData, setFormData] = useState<IncidentReportForm>({
    timeOccurred: '19:35',
    incidentType: 'RTC',
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleVictimChange = (index: number, field: keyof VictimDetails, value: string) => {
    const updatedVictims = [...formData.victims]
    updatedVictims[index] = { ...updatedVictims[index], [field]: value }
    setFormData((prev) => ({ ...prev, victims: updatedVictims }))
  }

  // Updates array when counter field is manipulated directly
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

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    console.log('Submitted Report Data:', formData)
    alert('Incident Report successfully submitted!')
    navigate('/responder-dashboard')
  }

  const isActiveNav = (path: string) => {
    if (typeof window === 'undefined') return false
    return window.location.pathname.includes(path)
  }

  // Interactive styling helper based on emergency incident type
  const getAccentColor = (type: string) => {
    switch (type) {
      case 'RTC': return 'border-l-4 border-l-amber-500'
      case 'Fire': return 'border-l-4 border-l-red-500'
      case 'Hazmat': return 'border-l-4 border-l-purple-600'
      default: return 'border-l-4 border-l-blue-600'
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-28 sm:pb-12 pt-6 antialiased text-slate-800">
      <main className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
        
        {/* Header Navigation */}
        <div className="flex items-center gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
          <button 
            onClick={() => navigate('/responder-dashboard')}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition"
            aria-label="Back to dashboard"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">New Incident Report</h1>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">Provide accurate details regarding the emergency operation.</p>
          </div>
        </div>

        {/* Form Container */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden divide-y divide-slate-100">
          
          {/* Section 1: Incident Log */}
          <div className={`p-6 space-y-5 transition-all ${getAccentColor(formData.incidentType)}`}>
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md">1. Incident Overview</h3>
              <span className="text-[11px] font-semibold text-slate-400 uppercase bg-slate-100 px-2 py-0.5 rounded">Required Form</span>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  <option value="Medical">Medical Emergency</option>
                  <option value="RTC">Road Traffic Crash (RTC)</option>
                  <option value="Fire">Fire Incident</option>
                  <option value="Hazmat">Hazmat / Chemical Leak</option>
                </select>
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
                      placeholder="e.g. Semi-conscious, Abrasion on left arm, Right Knee Cap Fractured"
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
              className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-200/60 rounded-xl transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-95 rounded-xl shadow-md shadow-blue-500/10 transition-all flex items-center gap-2"
            >
              <span>Submit Report</span>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </button>
          </div>

        </form>
      </main>

      {/* --- MOBILE BOTTOM NAVIGATION BAR --- */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-[0_-4px_16px_rgba(15,23,42,0.06)] z-50 px-2 py-2">
        <div className="flex justify-around items-center">
          
          {/* Incident Button */}
          <button 
            onClick={() => navigate('/responder-incidents')}
            className={`flex flex-col items-center gap-1 py-1 px-3 transition-all active:scale-95 ${
              isActiveNav('/responder-incidents') ? 'text-blue-600 font-bold' : 'text-slate-400 hover:text-slate-600'
            }`}
            aria-label="View Incidents"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={isActiveNav('/responder-incidents') ? 2.5 : 2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <span className="text-[10px] tracking-tight">Incident</span>
          </button>

          {/* Create Report Button */}
          <button 
            onClick={() => navigate('/create-report')} 
            className={`flex flex-col items-center gap-1 py-1 px-3 transition-all active:scale-95 ${
              isActiveNav('/create-report') ? 'text-blue-600 font-bold' : 'text-slate-400 hover:text-slate-600'
            }`}
            aria-label="Create Report"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={isActiveNav('/create-report') ? 2.5 : 2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span className="text-[10px] tracking-tight">New Report</span>
          </button>

          {/* Accomplishment Report Button */}
          <button 
            onClick={() => navigate('/responder-reports')}
            className={`flex flex-col items-center gap-1 py-1 px-3 transition-all active:scale-95 ${
              isActiveNav('/responder-reports') ? 'text-blue-600 font-bold' : 'text-slate-400 hover:text-slate-600'
            }`}
            aria-label="View Reports"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={isActiveNav('/responder-reports') ? 2.5 : 2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-[10px] tracking-tight">Logs</span>
          </button>

          {/* Profile Button */}
          <button 
            onClick={() => navigate('/responder-profile-settings')} 
            className={`flex flex-col items-center gap-1 py-1 px-3 transition-all active:scale-95 ${
              isActiveNav('/responder-profile-settings') ? 'text-blue-600 font-bold' : 'text-slate-400'
            }`}
            aria-label="Profile Settings"
          >
            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-extrabold shadow-sm ${
              isActiveNav('/responder-profile-settings') 
                ? 'bg-blue-600 ring-2 ring-blue-100' 
                : 'bg-slate-400'
            }`}>
              CR
            </div>
            <span className="text-[10px] tracking-tight">Profile</span>
          </button>

        </div>
      </nav>
    </div>
  )
}