import { useState } from 'react'
import type { FC, FormEvent, ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCurrentUserProfile, logoutUser } from '../../services/auth'
import { MobileNavBar } from '../../components/MobileNavBar'
import { ResponderPageHeader } from '../../components/ResponderPageHeader'
import { getAccountTeam } from '../../data/teams'

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

const RESPONDER_PROFILE_STORAGE_KEY = 'responderProfileSettingsData'
const RESPONDER_TEAM_STORAGE_KEY = 'responderTeamMembers'

const defaultProfileData = (profileFullName?: string): ProfileData => ({
  teamLeaderName: profileFullName || 'Team Leader',
  teamName: '',
  badgeId: 'RES-2026-0982',
  contactNumber: '09123456789',
  stationAddress: 'Zone 4, Lucena City Command Center',
})

function loadSavedResponderProfile(): ProfileData | null {
  try {
    const raw = localStorage.getItem(RESPONDER_PROFILE_STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as ProfileData
  } catch {
    return null
  }
}

function loadSavedResponderTeam(): TeamMember[] | null {
  try {
    const raw = localStorage.getItem(RESPONDER_TEAM_STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as TeamMember[]
  } catch {
    return null
  }
}

function saveResponderProfile(profileData: ProfileData, teamMembers: TeamMember[]): boolean {
  try {
    localStorage.setItem(RESPONDER_PROFILE_STORAGE_KEY, JSON.stringify(profileData))
    localStorage.setItem(RESPONDER_TEAM_STORAGE_KEY, JSON.stringify(teamMembers))
    return true
  } catch {
    return false
  }
}

const ProfileSettingsPage: FC = () => {
  const navigate = useNavigate()
  const profile = getCurrentUserProfile()

  const [profileData, setProfileData] = useState<ProfileData>(() => {
    const stored = loadSavedResponderProfile()
    // The name always comes from the account: it is how reports are matched to this team.
    const accountName = profile?.fullName || stored?.teamLeaderName || 'Team Leader'
    // The team is set by an admin on the account; it is how reports are filed and matched.
    return { ...(stored ?? defaultProfileData(accountName)), teamLeaderName: accountName, teamName: getAccountTeam(profile) }
  })

  const [teamMembers, setTeamMembers] = useState<TeamMember[]>(() => {
    const stored = loadSavedResponderTeam()
    return (
      stored ?? [
        { id: '1', name: 'Mark Anthony Santos', role: 'Medic / EMT', contactNumber: '09221113344', status: 'Active' },
        { id: '2', name: 'Maria Clara Reyes', role: 'Rescue Specialist', contactNumber: '09334445566', status: 'Active' },
      ]
    )
  })

  const [editingMemberId, setEditingMemberId] = useState<string | null>(null)
  const [memberDraft, setMemberDraft] = useState<Omit<TeamMember, 'id'>>({
    name: '',
    role: '',
    contactNumber: '',
    status: 'Active'
  })

  const [isAddingMember, setIsAddingMember] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  const handleProfileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setProfileData(prev => ({ ...prev, [name]: value }))
  }

  const handleProfileSubmit = (e: FormEvent) => {
    e.preventDefault()

    const savedLocally = saveResponderProfile(profileData, teamMembers)

    if (!savedLocally) {
      setErrorMessage('Unable to save profile on this device. Please check your browser settings.')
      setStatusMessage('')
      return
    }

    setStatusMessage('Profile settings updated successfully!')
    setErrorMessage('')
  }

  const openAddMember = () => {
    setEditingMemberId(null)
    setMemberDraft({ name: '', role: '', contactNumber: '', status: 'Active' })
    setIsAddingMember(true)
    setStatusMessage('')
    setErrorMessage('')
  }

  const handleSaveMember = (e: FormEvent) => {
    e.preventDefault()
    if (!memberDraft.name || !memberDraft.role) return

    if (editingMemberId) {
      const nextMembers = teamMembers.map(member =>
        member.id === editingMemberId ? { id: editingMemberId, ...memberDraft } : member,
      )
      setTeamMembers(nextMembers)
      setStatusMessage('Team member updated successfully.')
      setErrorMessage('')
      saveResponderProfile(profileData, nextMembers)
    } else {
      const id = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : Date.now().toString(36) + Math.random().toString(36).slice(2)
      const nextMembers = [...teamMembers, { id, ...memberDraft }]
      setTeamMembers(nextMembers)
      setStatusMessage('Team unit added successfully.')
      setErrorMessage('')
      saveResponderProfile(profileData, nextMembers)
    }

    setMemberDraft({ name: '', role: '', contactNumber: '', status: 'Active' })
    setEditingMemberId(null)
    setIsAddingMember(false)
  }

  const startEditingMember = (member: TeamMember) => {
    setEditingMemberId(member.id)
    setMemberDraft({
      name: member.name,
      role: member.role,
      contactNumber: member.contactNumber,
      status: member.status,
    })
    setIsAddingMember(true)
    setStatusMessage('')
    setErrorMessage('')
  }

  const handleCancelMemberEdit = () => {
    setEditingMemberId(null)
    setMemberDraft({ name: '', role: '', contactNumber: '', status: 'Active' })
    setIsAddingMember(false)
    setErrorMessage('')
  }

  const handleRemoveMember = (id: string) => {
    if (confirm('Are you sure you want to remove this team member?')) {
      const nextMembers = teamMembers.filter(member => member.id !== id)
      setTeamMembers(nextMembers)
      saveResponderProfile(profileData, nextMembers)
      setStatusMessage('Team roster updated and saved.')
      setErrorMessage('')
    }
  }

  // Functional Log Out Handler
  const handleLogOut = () => {
    if (confirm('Are you sure you want to log out of your session?')) {
      // Ends the server session and clears the stored login.
      logoutUser()
      navigate('/login', { replace: true })
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

  const fieldClass =
    'w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-medium outline-none transition-colors focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10'
  const labelClass = 'mb-1.5 block text-xs font-semibold text-slate-600'

  return (
    <div className="min-h-screen bg-slate-100 pb-28 pt-4 text-slate-800 antialiased">
      <main className="mx-auto max-w-lg space-y-4 px-4">
        <ResponderPageHeader title="Profile" description="Your account and the people on your team." />

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" aria-label="Your account">
          <div className="flex items-center gap-4 p-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-lg font-extrabold text-white ring-4 ring-blue-50">
              {initials}
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-base font-bold text-slate-900">{profileData.teamLeaderName}</h2>
              <p className="mt-0.5 text-sm text-slate-500">
                {profileData.teamName ? `Team ${profileData.teamName}` : 'No team yet'} · Team leader
              </p>
            </div>
          </div>

          <dl className="divide-y divide-slate-100 border-t border-slate-100 text-sm">
            <div className="flex items-center justify-between gap-4 px-4 py-3">
              <dt className="text-slate-500">Team</dt>
              <dd className="font-semibold text-slate-900">{profileData.teamName || 'Ask an admin to set it'}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 px-4 py-3">
              <dt className="text-slate-500">Full name</dt>
              <dd className="truncate font-semibold text-slate-900">{profileData.teamLeaderName}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 px-4 py-3">
              <dt className="text-slate-500">Badge ID</dt>
              <dd className="font-mono font-semibold text-slate-900">{profileData.badgeId}</dd>
            </div>
          </dl>
          <p className="border-t border-slate-100 bg-slate-50/60 px-4 py-2.5 text-xs text-slate-500">
            Your team, name and badge ID are set by an admin.
          </p>
        </section>

        <form onSubmit={handleProfileSubmit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" aria-label="Contact details">
          <h2 className="text-sm font-black text-slate-900">Contact details</h2>
          <div>
            <label htmlFor="stationAddress" className={labelClass}>Station address</label>
            <input id="stationAddress" type="text" name="stationAddress" value={profileData.stationAddress} onChange={handleProfileChange} className={fieldClass} />
          </div>
          <div>
            <label htmlFor="contactNumber" className={labelClass}>Emergency contact number</label>
            <input id="contactNumber" type="tel" inputMode="tel" name="contactNumber" value={profileData.contactNumber} onChange={handleProfileChange} className={fieldClass} />
          </div>
          <button type="submit" className="w-full rounded-xl bg-blue-600 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-blue-700">
            Save changes
          </button>
          {statusMessage ? (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800" role="status">{statusMessage}</p>
          ) : null}
          {errorMessage ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{errorMessage}</p>
          ) : null}
        </form>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" aria-labelledby="team-members">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-4">
            <div>
              <h2 id="team-members" className="text-sm font-black text-slate-900">Team members</h2>
              <p className="mt-0.5 text-xs text-slate-500">The people who respond with you.</p>
            </div>
            {!isAddingMember && (
              <button
                type="button"
                onClick={openAddMember}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-blue-700"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Add member
              </button>
            )}
          </div>

          {isAddingMember && (
            <form onSubmit={handleSaveMember} className="space-y-3 border-b border-blue-100 bg-blue-50/30 p-4">
              <p className="text-sm font-bold text-blue-700">{editingMemberId ? 'Edit team member' : 'New team member'}</p>
              <div>
                <label htmlFor="memberName" className={labelClass}>Full name</label>
                <input id="memberName" type="text" value={memberDraft.name} onChange={e => setMemberDraft(p => ({ ...p, name: e.target.value }))} className={fieldClass} required />
              </div>
              <div>
                <label htmlFor="memberRole" className={labelClass}>Role</label>
                <input id="memberRole" type="text" placeholder="e.g. Medic / EMT" value={memberDraft.role} onChange={e => setMemberDraft(p => ({ ...p, role: e.target.value }))} className={fieldClass} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="memberContact" className={labelClass}>Contact number</label>
                  <input id="memberContact" type="tel" inputMode="tel" value={memberDraft.contactNumber} onChange={e => setMemberDraft(p => ({ ...p, contactNumber: e.target.value }))} className={fieldClass} />
                </div>
                <div>
                  <label htmlFor="memberStatus" className={labelClass}>Status</label>
                  <select id="memberStatus" value={memberDraft.status} onChange={e => setMemberDraft(p => ({ ...p, status: e.target.value as TeamMember['status'] }))} className={fieldClass}>
                    <option value="Active">Active</option>
                    <option value="On Leave">On leave</option>
                    <option value="Off Duty">Off duty</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={handleCancelMemberEdit} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100">Cancel</button>
                <button type="submit" className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-blue-700">
                  {editingMemberId ? 'Save member' : 'Add member'}
                </button>
              </div>
            </form>
          )}

          <ul className="divide-y divide-slate-100">
            {teamMembers.map(member => (
              <li key={member.id} className="flex items-start gap-3 p-4">
                <div className="relative shrink-0">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-sm font-bold text-slate-600">
                    {member.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white ${member.status === 'Active' ? 'bg-emerald-500' : member.status === 'On Leave' ? 'bg-amber-500' : 'bg-slate-400'}`} aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-900">{member.name}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{member.role}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${getStatusStyles(member.status)}`}>{member.status}</span>
                    {member.contactNumber ? (
                      <a href={`tel:${member.contactNumber}`} className="font-mono text-xs font-semibold text-blue-700">{member.contactNumber}</a>
                    ) : (
                      <span className="text-xs text-slate-400">No contact number</span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <button type="button" onClick={() => startEditingMember(member)} className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-blue-50 hover:text-blue-700" aria-label={`Edit ${member.name}`}>
                    Edit
                  </button>
                  <button type="button" onClick={() => handleRemoveMember(member.id)} className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label={`Remove ${member.name}`}>
                    Remove
                  </button>
                </div>
              </li>
            ))}
            {teamMembers.length === 0 && (
              <li className="p-8 text-center text-sm text-slate-500">No team members yet. Add the people who respond with you.</li>
            )}
          </ul>
        </section>

        <button
          type="button"
          onClick={handleLogOut}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-200 bg-white py-3.5 text-sm font-bold text-red-600 shadow-sm transition-colors hover:bg-red-50"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Log out
        </button>
      </main>

      <MobileNavBar />
    </div>
  )
}

export default ProfileSettingsPage
