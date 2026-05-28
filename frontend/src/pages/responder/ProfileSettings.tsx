import { useState } from 'react'
import type { FC, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCurrentUserProfile } from '../../services/auth'
import { MobileNavBar } from '../../components/MobileNavBar'

interface TeamMember {
  id: string
  name: string
  role: string
  contactNumber: string
  status: 'Active' | 'On Leave' | 'Off Duty'
}

interface ProfileData {
  teamLeaderName: string
  teamName: string
  badgeId: string
  contactNumber: string
  stationAddress: string
}

const ProfileSettingsPage: FC = () => {
  const navigate = useNavigate()
  const profile = getCurrentUserProfile()

  const [profileData, setProfileData] = useState<ProfileData>({
    teamLeaderName: profile?.fullName || 'Team Leader',
    teamName: 'Alpha Responder Squad',
    badgeId: 'RES-2026-0982',
    contactNumber: '09123456789',
    stationAddress: 'Zone 4, Lucena City Command Center',
  })

  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([
    { id: '1', name: 'Mark Anthony Santos', role: 'Medic / EMT', contactNumber: '09221113344', status: 'Active' },
    { id: '2', name: 'Maria Clara Reyes', role: 'Rescue Specialist', contactNumber: '09334445566', status: 'Active' },
  ])

  const [newMember, setNewMember] = useState<Omit<TeamMember, 'id'>>({
    name: '',
    role: '',
    contactNumber: '',
    status: 'Active'
  })

  const [isAddingMember, setIsAddingMember] = useState(false)

  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setProfileData(prev => ({ ...prev, [name]: value }))
  }

  const handleProfileSubmit = (e: FormEvent) => {
    e.preventDefault()
    alert('Profile settings updated successfully!')
  }

  const handleAddMember = (e: FormEvent) => {
    e.preventDefault()
    if (!newMember.name || !newMember.role) return

    const id = typeof crypto !== 'undefined' && crypto.randomUUID 
      ? crypto.randomUUID() 
      : Date.now().toString(36) + Math.random().toString(36).slice(2)

    setTeamMembers(prev => [...prev, { id, ...newMember }])
    setNewMember({ name: '', role: '', contactNumber: '', status: 'Active' })
    setIsAddingMember(false)
  }

  const handleRemoveMember = (id: string) => {
    if (confirm('Are you sure you want to remove this team member?')) {
      setTeamMembers(prev => prev.filter(member => member.id !== id))
    }
  }

  const getStatusStyles = (status: TeamMember['status']) => {
    switch (status) {
      case 'Active': return 'bg-emerald-50 text-emerald-700 border-emerald-200'
      case 'On Leave': return 'bg-amber-50 text-amber-700 border-amber-200'
      default: return 'bg-slate-100 text-slate-600 border-slate-200'
    }
  }

  const initials = profileData.teamLeaderName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'RE'

  return (
    <div className="min-h-screen bg-slate-50 pb-28 sm:pb-12 pt-6 antialiased text-slate-800">
      <main className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
        
        {/* Header Navigation */}
        <div className="bg-white p-5 sm:p-7 rounded-2xl border border-slate-200/80 shadow-sm space-y-5 overflow-hidden relative">
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
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600 opacity-60 block mb-0.5 leading-none">Account Identity</span>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 leading-tight">Profile & Team Settings</h1>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-slate-100 pt-5">
            <p className="text-sm text-slate-500 font-medium leading-relaxed max-w-lg">
              Manage your responder credentials and team roster assignments for operational deployment.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          
          {/* Left Column: Profile Card & Form */}
          <div className="lg:col-span-1 bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-6">
            <div className="flex flex-col items-center text-center pb-5 border-b border-slate-100">
              <div className="w-20 h-20 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-full flex items-center justify-center text-white text-2xl font-extrabold shadow-md mb-3 ring-4 ring-blue-50">
                {initials}
              </div>
              <h2 className="font-bold text-lg text-slate-900 tracking-tight">{profileData.teamLeaderName}</h2>
              <span className="text-[10px] uppercase font-bold tracking-wider text-blue-600 bg-blue-50 border border-blue-100 px-3 py-1 rounded-md mt-2">
                Team Leader
              </span>
            </div>

            <form onSubmit={handleProfileSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Team Assignment</label>
                <input type="text" name="teamName" value={profileData.teamName} onChange={handleProfileChange} className="w-full text-sm font-medium border border-slate-200 rounded-xl px-3.5 py-2.5 bg-slate-50/50 outline-none focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/5 transition-all" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Full Name</label>
                <input type="text" name="teamLeaderName" value={profileData.teamLeaderName} onChange={handleProfileChange} className="w-full text-sm font-medium border border-slate-200 rounded-xl px-3.5 py-2.5 bg-slate-50/50 outline-none focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/5 transition-all" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Agency Badge ID</label>
                <input type="text" name="badgeId" value={profileData.badgeId} readOnly className="w-full text-sm font-semibold border border-slate-200 rounded-xl px-3.5 py-2.5 bg-slate-100 text-slate-400 cursor-not-allowed font-mono" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Station HQ Address</label>
                <input type="text" name="stationAddress" value={profileData.stationAddress} onChange={handleProfileChange} className="w-full text-sm font-medium border border-slate-200 rounded-xl px-3.5 py-2.5 bg-slate-50/50 outline-none focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/5 transition-all" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Emergency Contact</label>
                <input type="tel" name="contactNumber" value={profileData.contactNumber} onChange={handleProfileChange} className="w-full text-sm font-medium border border-slate-200 rounded-xl px-3.5 py-2.5 bg-slate-50/50 outline-none focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/5 transition-all" />
              </div>
              <button type="submit" className="w-full text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-[0.98] py-3 rounded-xl shadow-md shadow-blue-500/10 transition-all">
                Save Account Profile
              </button>
            </form>
          </div>

          {/* Right Column: Roster Management */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden divide-y divide-slate-100">
            <div className="p-5 flex items-center justify-between bg-slate-50/50 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Responder Team Roster</h3>
                <p className="text-xs text-slate-400 font-medium mt-0.5">Add and manage active field units assigned under your cluster.</p>
              </div>
              {!isAddingMember && (
                <button 
                  type="button" 
                  onClick={() => setIsAddingMember(true)} 
                  className="text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-95 px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow-sm transition-all"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Add Unit</span>
                </button>
              )}
            </div>

            {/* Expansion Panel: Add Member Form */}
            {isAddingMember && (
              <form onSubmit={handleAddMember} className="p-5 bg-gradient-to-b from-blue-50/30 to-white border-b border-blue-100/50 space-y-4">
                <div className="text-xs font-bold text-blue-600 uppercase tracking-wider flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse"></span>
                  New Operational Unit Registration
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <input type="text" placeholder="Full Name" value={newMember.name} onChange={e => setNewMember(p => ({ ...p, name: e.target.value }))} className="text-sm border border-slate-200 rounded-xl px-3.5 py-2 bg-white outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all font-medium" required />
                  <input type="text" placeholder="Role (e.g. Medic / EMT)" value={newMember.role} onChange={e => setNewMember(p => ({ ...p, role: e.target.value }))} className="text-sm border border-slate-200 rounded-xl px-3.5 py-2 bg-white outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all font-medium" required />
                  <input type="tel" placeholder="Contact Number" value={newMember.contactNumber} onChange={e => setNewMember(p => ({ ...p, contactNumber: e.target.value }))} className="text-sm border border-slate-200 rounded-xl px-3.5 py-2 bg-white outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all font-medium" />
                  <select value={newMember.status} onChange={e => setNewMember(p => ({ ...p, status: e.target.value as TeamMember['status'] }))} className="text-sm border border-slate-200 rounded-xl px-3.5 py-2 bg-white outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all font-semibold text-slate-700">
                    <option value="Active">🟢 Active Duty</option>
                    <option value="On Leave">🟡 On Leave</option>
                    <option value="Off Duty">⚪ Off Duty</option>
                  </select>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button type="button" onClick={() => setIsAddingMember(false)} className="text-xs text-slate-500 hover:bg-slate-100 font-semibold px-3 py-2 rounded-xl transition-all">Cancel</button>
                  <button type="submit" className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-xl shadow-sm active:scale-95 transition-all">Register Member</button>
                </div>
              </form>
            )}

            {/* Roster Listing */}
            <div className="divide-y divide-slate-100">
              {teamMembers.map(member => (
                <div key={member.id} className="p-4 sm:p-5 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                  <div className="flex items-center gap-3.5">
                    <div className="relative">
                      <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center font-bold text-slate-600 border border-slate-200">
                        {member.name.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()}
                      </div>
                      <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${member.status === 'Active' ? 'bg-emerald-500' : member.status === 'On Leave' ? 'bg-amber-500' : 'bg-slate-400'}`} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900 tracking-tight">{member.name}</p>
                      <p className="text-xs font-medium text-slate-400 mt-0.5">{member.role} • <span className="font-mono">{member.contactNumber || 'No Contact'}</span></p>
                    </div>
                    <span className={`ml-2 text-[10px] font-bold px-2.5 py-0.5 border rounded-full uppercase tracking-wider ${getStatusStyles(member.status)}`}>
                      {member.status}
                    </span>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => handleRemoveMember(member.id)} 
                    className="text-xs font-semibold text-slate-400 hover:text-red-500 hover:bg-red-50 px-2.5 py-1.5 rounded-xl transition-all" 
                    aria-label={`Remove ${member.name}`}
                  >
                    Remove
                  </button>
                </div>
              ))}
              {teamMembers.length === 0 && (
                <div className="p-10 text-center text-slate-400 text-sm font-medium border-2 border-dashed border-slate-100 m-4 rounded-xl bg-slate-50/30">
                  No active team deployment units listed under this roster profile.
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <MobileNavBar />
    </div>
  )
}

export default ProfileSettingsPage