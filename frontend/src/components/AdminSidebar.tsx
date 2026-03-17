import type { ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { adminNavItems, type AdminNavIcon, type AdminNavKey } from '../data/adminNavigation'
import { getCurrentUserProfile, logoutUser } from '../services/auth'

type AdminSidebarProps = {
  activeKey?: AdminNavKey
  actionOverrides?: Partial<Record<AdminNavKey, () => void>>
}

function SidebarIcon({ icon }: { icon: AdminNavIcon }) {
  if (icon === 'dashboard') {
    return (
      <svg aria-hidden className="h-4 w-4" fill="none" viewBox="0 0 24 24">
        <path d="M4.5 5.5h6v6h-6zm9 0h6v6h-6zm-9 9h6v6h-6zm9 0h6v6h-6z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
      </svg>
    )
  }

  if (icon === 'mapping') {
    return (
      <svg aria-hidden className="h-4 w-4" fill="none" viewBox="0 0 24 24">
        <path d="M9 5 4.5 6.5v12L9 17l6 1.5 4.5-1.5v-12L15 6.5 9 5Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
        <path d="M9 5v12M15 6.5v12" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      </svg>
    )
  }

  if (icon === 'risk') {
    return (
      <svg aria-hidden className="h-4 w-4" fill="none" viewBox="0 0 24 24">
        <path d="M12 4.5 19 8v8l-7 3.5L5 16V8l7-3.5Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
        <path d="M12 8.25v4.5m0 3h.01" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      </svg>
    )
  }

  if (icon === 'trend') {
    return (
      <svg aria-hidden className="h-4 w-4" fill="none" viewBox="0 0 24 24">
        <path d="M5 16.5 10 11l3.5 3.5L19 8.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
        <path d="M14 8.5h5v5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      </svg>
    )
  }

  if (icon === 'resources') {
    return (
      <svg aria-hidden className="h-4 w-4" fill="none" viewBox="0 0 24 24">
        <path d="M7 5.5h10A1.5 1.5 0 0 1 18.5 7v10A1.5 1.5 0 0 1 17 18.5H7A1.5 1.5 0 0 1 5.5 17V7A1.5 1.5 0 0 1 7 5.5Z" stroke="currentColor" strokeWidth="1.8" />
        <path d="M12 8.5v7M8.5 12h7" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      </svg>
    )
  }

  if (icon === 'community') {
    return (
      <svg aria-hidden className="h-4 w-4" fill="none" viewBox="0 0 24 24">
        <path d="M8 11a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm8 1a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm-8 1.5c-2.76 0-5 1.79-5 4v1h10v-1c0-2.21-2.24-4-5-4Zm8 1c-1.03 0-1.99.24-2.79.66 1.05.93 1.79 2.19 1.79 3.84v.5h6v-.5c0-2.49-2.24-4.5-5-4.5Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.4" />
      </svg>
    )
  }

  if (icon === 'simulation') {
    return (
      <svg aria-hidden className="h-4 w-4" fill="none" viewBox="0 0 24 24">
        <path d="m10 4-4 7h4l-1 9 9-12h-5l1-4h-4Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      </svg>
    )
  }

  if (icon === 'reports') {
    return (
      <svg aria-hidden className="h-4 w-4" fill="none" viewBox="0 0 24 24">
        <path d="M6.5 5.5h11A1.5 1.5 0 0 1 19 7v10a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 17V7a1.5 1.5 0 0 1 1.5-1.5Z" stroke="currentColor" strokeWidth="1.8" />
        <path d="M8.5 14.5h2v-3h-2zm5 0h2v-6h-2z" fill="currentColor" />
      </svg>
    )
  }

  return (
    <svg aria-hidden className="h-4 w-4" fill="none" viewBox="0 0 24 24">
      <path d="M7 5.5h10A1.5 1.5 0 0 1 18.5 7v10A1.5 1.5 0 0 1 17 18.5H7A1.5 1.5 0 0 1 5.5 17V7A1.5 1.5 0 0 1 7 5.5Z" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8.5 9h7M8.5 12h7M8.5 15h4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  )
}

function renderItemContent(label: string, icon: AdminNavIcon): ReactNode {
  return (
    <>
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-700">
        <SidebarIcon icon={icon} />
      </span>
      <span className="font-medium leading-snug">{label}</span>
    </>
  )
}

export function AdminSidebar({ activeKey, actionOverrides }: AdminSidebarProps) {
  const navigate = useNavigate()
  const profile = getCurrentUserProfile()
  const displayName = profile?.fullName?.trim() || 'Administrator'
  const initials =
    displayName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase() || 'AD'

  function handleLogout(): void {
    logoutUser()
    navigate('/admin-page', {
      replace: true,
      state: {
        logoutSuccessMessage: 'You have been logged out successfully.',
      },
    })
  }

  return (
    <>
      <div className="border-b border-slate-800 bg-[#181c23] px-4 py-3 md:hidden">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-700 text-sm font-bold text-white">
            {profile?.photoUrl ? <img alt="Profile" className="h-full w-full rounded-full object-cover" src={profile.photoUrl} /> : initials}
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Control Center</p>
            <p className="text-sm font-bold text-white">ADMIN PANEL</p>
          </div>
        </div>
        <nav className="flex gap-2 overflow-x-auto pb-1">
          {adminNavItems.map((item) => {
            const isAction = Boolean(actionOverrides?.[item.key])
            const isActive = activeKey === item.key
            const mobileClassName = `whitespace-nowrap rounded-full border px-3 py-2 text-xs font-semibold transition ${
              isActive
                ? 'border-blue-500 bg-blue-500 text-white'
                : 'border-slate-700 bg-[#232837] text-slate-200 hover:border-slate-500'
            }`

            if (isAction) {
              return (
                <button className={mobileClassName} key={item.key} onClick={actionOverrides?.[item.key]} type="button">
                  {item.label}
                </button>
              )
            }

            return (
              <NavLink className={mobileClassName} key={item.key} to={item.to}>
                {item.label}
              </NavLink>
            )
          })}
        </nav>
      </div>

      <aside className="hidden px-4 py-4 md:block md:w-[300px]">
        <div className="sticky top-4 flex min-h-[calc(100vh-2rem)] flex-col rounded-[28px] border border-slate-200 bg-white px-4 py-9 shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
          <div className="mb-8 flex items-center gap-3 px-2">
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-blue-700 text-base font-bold text-white shadow-[0_0_18px_rgba(29,78,216,0.18)]">
              {profile?.photoUrl ? <img alt="Profile" className="h-full w-full object-cover" src={profile.photoUrl} /> : initials}
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Control Center</p>
              <span className="text-xl font-bold tracking-wide text-slate-900">ADMIN PANEL</span>
            </div>
          </div>

          <nav className="flex-1">
            <ul className="space-y-2">
              {adminNavItems.map((item) => {
                const isAction = Boolean(actionOverrides?.[item.key])
                const buttonClassName = `flex w-full items-center gap-3 rounded-lg px-4 py-2 text-left transition ${
                  activeKey === item.key
                    ? 'border border-blue-700 bg-blue-700 text-white shadow-[0_10px_20px_rgba(29,78,216,0.12)]'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                }`

                return (
                  <li key={item.key}>
                    {isAction ? (
                      <button className={buttonClassName} onClick={actionOverrides?.[item.key]} type="button">
                        {renderItemContent(item.label, item.icon)}
                      </button>
                    ) : (
                      <NavLink
                        className={({ isActive }) =>
                          `flex w-full items-center gap-3 rounded-lg px-4 py-2 text-left transition ${
                            isActive
                              ? 'border border-blue-700 bg-blue-700 text-white shadow-[0_10px_20px_rgba(29,78,216,0.12)]'
                              : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                          }`
                        }
                        to={item.to}
                      >
                        {renderItemContent(item.label, item.icon)}
                      </NavLink>
                    )}
                  </li>
                )
              })}
            </ul>
          </nav>

          <div className="mt-auto flex items-center gap-3 px-2 pt-8">
            <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-blue-700 text-sm font-bold text-white shadow-[0_0_14px_rgba(29,78,216,0.18)]">
              {profile?.photoUrl ? <img alt="Profile" className="h-full w-full object-cover" src={profile.photoUrl} /> : initials}
            </div>
            <div className="min-w-0">
              <div className="truncate font-semibold text-slate-900">{displayName}</div>
              <button className="mt-1 text-xs text-slate-500 transition hover:text-red-700" onClick={handleLogout} type="button">
                Logout
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}