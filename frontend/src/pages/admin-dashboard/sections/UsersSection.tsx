import axios from 'axios'
import { useState } from 'react'
import { createDashboardAccount, deleteDashboardAccount, getDashboardAccounts, updateDashboardAccount } from '../../../services/api'
import type { AuthUser, UserRole } from '../../../types/api'
import { glassPanelClass, glassPanelSoftClass } from './constants'

type DashboardUserFormState = {
  fullName: string
  email: string
  username: string
  password: string
  role: UserRole
  isActive: boolean
}

const defaultDashboardUserFormState: DashboardUserFormState = {
  fullName: '',
  email: '',
  username: '',
  password: '',
  role: 'citizen',
  isActive: true,
}

const roleOptions: Array<{ value: UserRole; label: string }> = [
  { value: 'citizen', label: 'Citizen' },
  { value: 'staff', label: 'Staff' },
  { value: 'admin', label: 'Admin' },
]

function getUserRole(user: AuthUser): UserRole {
  if (user.role === 'admin' || user.role === 'staff' || user.role === 'citizen') {
    return user.role
  }

  if (user.isAdmin) {
    return 'admin'
  }

  return 'citizen'
}

function getRoleBadgeClass(role: UserRole): string {
  if (role === 'admin') {
    return 'border-blue-200 bg-blue-50 text-blue-700'
  }

  if (role === 'staff') {
    return 'border-cyan-200 bg-cyan-50 text-cyan-700'
  }

  return 'border-slate-200 bg-slate-50 text-slate-700'
}

function getRoleLabel(role: UserRole): string {
  if (role === 'admin') {
    return 'Admin'
  }

  if (role === 'staff') {
    return 'Staff'
  }

  return 'Citizen'
}

function formatUserDateTime(value?: string | null): string {
  if (!value) return 'Not available'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return 'Not available'
  return parsed.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function getUsersApiErrorMessage(error: unknown, fallbackMessage: string): string {
  if (!axios.isAxiosError(error)) return fallbackMessage

  const statusCode = error.response?.status
  const apiError = (error.response?.data as { error?: string } | undefined)?.error

  if (statusCode === 401 || statusCode === 403) {
    return 'Unable to load website accounts because the admin session is missing or expired. Log out, log in again, then refresh Users.'
  }

  if (!error.response) {
    return 'Unable to connect to the backend server. Make sure Django is running, then refresh Users.'
  }

  return apiError ?? fallbackMessage
}

export function UsersSection() {
  const [dashboardUsers, setDashboardUsers] = useState<AuthUser[]>([])
  const [isUsersLoading, setIsUsersLoading] = useState(false)
  const [usersMessage, setUsersMessage] = useState('')
  const [usersError, setUsersError] = useState('')
  const [editingUserId, setEditingUserId] = useState<number | null>(null)
  const [userFormState, setUserFormState] = useState<DashboardUserFormState>(defaultDashboardUserFormState)
  const [isSavingUser, setIsSavingUser] = useState(false)
  const [deletingUserId, setDeletingUserId] = useState<number | null>(null)
  const [isUserModalOpen, setIsUserModalOpen] = useState(false)

  const userAccountStats = {
    total: dashboardUsers.length,
    admin: dashboardUsers.filter((user) => getUserRole(user) === 'admin').length,
    staff: dashboardUsers.filter((user) => getUserRole(user) === 'staff').length,
    citizen: dashboardUsers.filter((user) => getUserRole(user) === 'citizen').length,
  }

  async function loadDashboardUsers(): Promise<void> {
    setIsUsersLoading(true)
    setUsersError('')
    try {
      const response = await getDashboardAccounts()
      setDashboardUsers(response.users)
    } catch (error) {
      setDashboardUsers([])
      setUsersError(getUsersApiErrorMessage(error, 'Unable to load website accounts right now.'))
    } finally {
      setIsUsersLoading(false)
    }
  }

  function resetUserForm(): void {
    setEditingUserId(null)
    setUserFormState(defaultDashboardUserFormState)
  }

  function handleOpenCreateUserModal(): void {
    resetUserForm()
    setUsersMessage('')
    setUsersError('')
    setIsUserModalOpen(true)
  }

  function handleCloseUserModal(): void {
    setIsUserModalOpen(false)
    resetUserForm()
  }

  function handleUserFieldChange(field: keyof DashboardUserFormState, value: string | boolean): void {
    setUserFormState((current) => ({ ...current, [field]: value }))
    if (usersMessage) setUsersMessage('')
    if (usersError) setUsersError('')
  }

  function handleEditUser(user: AuthUser): void {
    setEditingUserId(user.id ?? null)
    setUserFormState({
      fullName: user.fullName,
      email: user.email,
      username: user.username ?? '',
      password: '',
      role: getUserRole(user),
      isActive: user.isActive ?? true,
    })
    setUsersMessage('')
    setUsersError('')
    setIsUserModalOpen(true)
  }

  async function handleSubmitUserForm(): Promise<void> {
    setIsSavingUser(true)
    setUsersMessage('')
    setUsersError('')

    if (!userFormState.fullName.trim() || !userFormState.email.trim() || (!editingUserId && !userFormState.password)) {
      setUsersError('Full name, email, and password for new accounts are required.')
      setIsSavingUser(false)
      return
    }

    if (userFormState.password && userFormState.password.length < 6) {
      setUsersError('Password must be at least 6 characters.')
      setIsSavingUser(false)
      return
    }

    try {
      if (editingUserId) {
        const response = await updateDashboardAccount(editingUserId, {
          fullName: userFormState.fullName,
          email: userFormState.email,
          username: userFormState.username,
          password: userFormState.password || undefined,
          role: userFormState.role,
          isActive: userFormState.isActive,
        })
        setDashboardUsers((currentUsers) =>
          currentUsers.map((user) => (user.id === editingUserId ? response.user : user)),
        )
        setUsersMessage(response.message)
      } else {
        const response = await createDashboardAccount({
          fullName: userFormState.fullName,
          email: userFormState.email,
          username: userFormState.username || undefined,
          password: userFormState.password,
          role: userFormState.role,
        })
        setDashboardUsers((currentUsers) => [response.user, ...currentUsers])
        setUsersMessage(response.message)
      }
      handleCloseUserModal()
    } catch (error) {
      setUsersError(getUsersApiErrorMessage(error, 'Unable to save account changes right now.'))
    } finally {
      setIsSavingUser(false)
    }
  }

  async function handleDeleteUser(user: AuthUser): Promise<void> {
    if (!user.id) return
    setDeletingUserId(user.id)
    setUsersMessage('')
    setUsersError('')
    try {
      const response = await deleteDashboardAccount(user.id)
      setDashboardUsers((currentUsers) => currentUsers.filter((currentUser) => currentUser.id !== user.id))
      setUsersMessage(response.message)
      if (editingUserId === user.id) resetUserForm()
    } catch (error) {
      setUsersError(getUsersApiErrorMessage(error, 'Unable to delete this account right now.'))
    } finally {
      setDeletingUserId(null)
    }
  }

  function renderLoadingSkeleton() {
    return (
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div className={`${glassPanelSoftClass} animate-pulse p-4`} key={`users-stats-skeleton-${index}`}>
              <div className="h-3 w-24 rounded-full bg-slate-200" />
              <div className="mt-3 h-8 w-16 rounded-full bg-slate-200" />
            </div>
          ))}
        </div>
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="hidden grid-cols-[1.2fr_1.3fr_1fr_0.8fr_0.8fr_1fr_0.9fr] gap-4 border-b border-slate-200 bg-slate-50 px-4 py-3 md:grid">
            {Array.from({ length: 7 }).map((_, index) => (
              <div className="h-4 rounded-full bg-slate-200" key={`users-header-skeleton-${index}`} />
            ))}
          </div>
          <div className="space-y-3 p-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <div className="grid gap-3 rounded-xl border border-slate-100 p-3 md:grid-cols-[1.2fr_1.3fr_1fr_0.8fr_0.8fr_1fr_0.9fr] md:items-center" key={`users-row-skeleton-${index}`}>
                <div className="h-4 w-3/4 rounded-full bg-slate-200" />
                <div className="h-4 w-5/6 rounded-full bg-slate-200" />
                <div className="h-4 w-2/3 rounded-full bg-slate-200" />
                <div className="h-7 w-20 rounded-full bg-slate-200" />
                <div className="h-7 w-20 rounded-full bg-slate-200" />
                <div className="h-4 w-4/5 rounded-full bg-slate-200" />
                <div className="flex gap-2 md:justify-end">
                  <div className="h-8 w-16 rounded-lg bg-slate-200" />
                  <div className="h-8 w-16 rounded-lg bg-slate-200" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <section className="px-6 py-8">
      <div className={`${glassPanelClass} p-6`}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Registered Users</p>
            <h2 className="mt-1 text-2xl font-bold text-slate-900">All website accounts</h2>
            <p className="mt-2 text-sm text-slate-600">Citizen-side registrations and admin accounts are both listed here.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_20px_rgba(29,78,216,0.18)] transition hover:bg-blue-800"
              onClick={handleOpenCreateUserModal}
              type="button"
            >
              Add
            </button>
            <button
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
              disabled={isUsersLoading}
              onClick={() => void loadDashboardUsers()}
              type="button"
            >
              {isUsersLoading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          {usersMessage ? (
            <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{usersMessage}</p>
          ) : null}
          {usersError && !isUserModalOpen ? (
            <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{usersError}</p>
          ) : null}

          {isUsersLoading ? (
            renderLoadingSkeleton()
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-4">
                <div className={`${glassPanelSoftClass} p-4`}>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Total accounts</p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">{userAccountStats.total}</p>
                </div>
                <div className={`${glassPanelSoftClass} p-4`}>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Citizen accounts</p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">{userAccountStats.citizen}</p>
                </div>
                <div className={`${glassPanelSoftClass} p-4`}>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Staff accounts</p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">{userAccountStats.staff}</p>
                </div>
                <div className={`${glassPanelSoftClass} p-4`}>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Admin accounts</p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">{userAccountStats.admin}</p>
                </div>
              </div>

              {!usersError && dashboardUsers.length === 0 ? (
                <p className="text-sm text-slate-500">No citizen, staff, or admin accounts found.</p>
              ) : null}

              {dashboardUsers.length > 0 ? (
                <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
                  <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-[linear-gradient(180deg,#f8fafc_0%,#ffffff_100%)] px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Accounts directory</p>
                      <p className="text-xs text-slate-500">Manage citizen and admin records from one table.</p>
                    </div>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                      {dashboardUsers.length} total
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                      <thead className="bg-slate-50/80">
                        <tr>
                          <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Name</th>
                          <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Email</th>
                          <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Username</th>
                          <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Role</th>
                          <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Status</th>
                          <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Joined</th>
                          <th className="px-4 py-3.5 text-right text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 bg-white">
                        {dashboardUsers.map((user) => (
                          <tr className="transition hover:bg-slate-50/80" key={user.id ?? user.email}>
                            <td className="px-4 py-4 align-top">
                              <div>
                                <p className="font-semibold text-slate-900">{user.fullName}</p>
                                <p className="mt-1 text-xs text-slate-500">User ID: {user.id ?? 'Not set'}</p>
                              </div>
                            </td>
                            <td className="px-4 py-4 align-top text-slate-600">{user.email}</td>
                            <td className="px-4 py-4 align-top text-slate-600">{user.username || 'Not set'}</td>
                            <td className="px-4 py-4 align-top">
                              <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] ${getRoleBadgeClass(getUserRole(user))}`}>
                                {getRoleLabel(getUserRole(user))}
                              </span>
                            </td>
                            <td className="px-4 py-4 align-top">
                              <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] ${user.isActive === false ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
                                {user.isActive === false ? 'Inactive' : 'Active'}
                              </span>
                            </td>
                            <td className="px-4 py-4 align-top text-slate-600">{formatUserDateTime(user.dateJoined)}</td>
                            <td className="px-4 py-4 align-top">
                              <div className="flex justify-end gap-2">
                                <button
                                  className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 font-semibold text-blue-700 transition hover:bg-blue-100"
                                  onClick={() => handleEditUser(user)}
                                  type="button"
                                >
                                  Edit
                                </button>
                                <button
                                  className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                                  disabled={deletingUserId === user.id}
                                  onClick={() => void handleDeleteUser(user)}
                                  type="button"
                                >
                                  {deletingUserId === user.id ? 'Deleting...' : 'Delete'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>

        {isUserModalOpen ? (
          <div
            className="fixed inset-0 z-[1400] flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-[1px]"
            onClick={handleCloseUserModal}
          >
            <div
              className="w-full max-w-2xl rounded-[28px] border border-slate-200 bg-white shadow-[0_24px_50px_rgba(15,23,42,0.22)]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Account Form</p>
                  <h3 className="mt-1 text-xl font-bold text-slate-900">{editingUserId ? 'Edit account' : 'Add account'}</h3>
                  <p className="mt-2 text-sm text-slate-600">Update account details, access level, and active status from this popup.</p>
                </div>
                <button
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  onClick={handleCloseUserModal}
                  type="button"
                >
                  Close panel
                </button>
              </div>

              <div className="grid gap-5 px-6 py-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="grid gap-2 text-sm font-medium text-slate-700">
                    Full name
                    <input
                      className="rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
                      onChange={(event) => handleUserFieldChange('fullName', event.target.value)}
                      placeholder="Enter full name"
                      type="text"
                      value={userFormState.fullName}
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-medium text-slate-700">
                    Email
                    <input
                      className="rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
                      onChange={(event) => handleUserFieldChange('email', event.target.value)}
                      placeholder="Enter email address"
                      type="email"
                      value={userFormState.email}
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-medium text-slate-700">
                    Username
                    <input
                      className="rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
                      onChange={(event) => handleUserFieldChange('username', event.target.value)}
                      placeholder="Enter username"
                      type="text"
                      value={userFormState.username}
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-medium text-slate-700">
                    {editingUserId ? 'New password (optional)' : 'Password'}
                    <input
                      className="rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
                      onChange={(event) => handleUserFieldChange('password', event.target.value)}
                      placeholder={editingUserId ? 'Leave blank to keep current password' : 'Enter password'}
                      type="password"
                      value={userFormState.password}
                    />
                  </label>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <label className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
                    <div>
                      <p className="font-semibold text-slate-900">Account role</p>
                      <p className="mt-1 text-xs text-slate-500">Choose whether the account is citizen, staff, or admin.</p>
                    </div>
                    <select
                      className="mt-3 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
                      onChange={(event) => handleUserFieldChange('role', event.target.value as UserRole)}
                      value={userFormState.role}
                    >
                      {roleOptions.map((roleOption) => (
                        <option key={roleOption.value} value={roleOption.value}>
                          {roleOption.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
                    <div>
                      <p className="font-semibold text-slate-900">Active status</p>
                      <p className="mt-1 text-xs text-slate-500">Inactive accounts can stay in the list without being able to sign in.</p>
                    </div>
                    <input
                      checked={userFormState.isActive}
                      onChange={(event) => handleUserFieldChange('isActive', event.target.checked)}
                      type="checkbox"
                    />
                  </label>
                </div>

                {usersError ? (
                  <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{usersError}</p>
                ) : null}

                <div className="flex flex-wrap justify-end gap-3 border-t border-slate-200 pt-5">
                  <button
                    className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    onClick={handleCloseUserModal}
                    type="button"
                  >
                    Cancel
                  </button>
                  <button
                    className="rounded-xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_20px_rgba(29,78,216,0.18)] transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                    disabled={isSavingUser}
                    onClick={() => void handleSubmitUserForm()}
                    type="button"
                  >
                    {isSavingUser ? 'Saving...' : editingUserId ? 'Update account' : 'Add account'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}
