import type { ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { adminNavItems, type AdminNavIcon, type AdminNavKey } from '../data/adminNavigation'
import { getCurrentUserProfile, logoutUser } from '../services/auth'
import analyticsIcon from '../images/analytics.png'
import dashboardIcon from '../images/dashboard.png'
import mappingIcon from '../images/mapping.png'
import reportIcon from '../images/report.png'
import resourcesIcon from '../images/resources.png'
import scoringIcon from '../images/scoring.png'
import settingIcon from '../images/setting.png'
import simulationIcon from '../images/simulation.png'
import usersIcon from '../images/users.png'

type AdminSidebarProps = {
  activeKey?: AdminNavKey
  actionOverrides?: Partial<Record<AdminNavKey, () => void>>
}

function SidebarIcon({ icon, isActive = false }: { icon: AdminNavIcon; isActive?: boolean }) {
  const iconSrcMap: Record<AdminNavIcon, string> = {
    dashboard: dashboardIcon,
    mapping: mappingIcon,
    risk: scoringIcon,
    trend: analyticsIcon,
    resources: resourcesIcon,
    community: usersIcon,
    simulation: simulationIcon,
    reports: reportIcon,
    settings: settingIcon,
  }

  return (
    <span
      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition ${
        isActive
          ? 'bg-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
          : 'bg-slate-100 group-hover:bg-[#0b2a57]'
      }`}
    >
      <img
        alt=""
        aria-hidden
        className={`h-4 w-4 object-contain transition duration-200 ${
          isActive
            ? 'brightness-0 invert'
            : 'opacity-80 group-hover:scale-105 group-hover:brightness-0 group-hover:invert'
        }`}
        src={iconSrcMap[icon]}
      />
    </span>
  )
}

function renderItemContent(label: string, icon: AdminNavIcon, isActive = false): ReactNode {
  return (
    <>
      <SidebarIcon icon={icon} isActive={isActive} />
      <span className="font-semibold leading-snug tracking-[-0.01em]">{label}</span>
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
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0b2a57] text-sm font-bold text-white">
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
                ? 'border-[#0b2a57] bg-[#0b2a57] text-white'
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

      <aside className="hidden md:block md:w-[300px] md:shrink-0" aria-hidden="true" />

      <aside className="hidden px-4 py-4 md:fixed md:inset-y-0 md:left-0 md:z-20 md:block md:w-[300px]">
        <div className="flex h-full flex-col overflow-hidden rounded-[32px] border border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] px-4 py-6 shadow-[0_24px_50px_rgba(15,23,42,0.1)]">
          <div className="mb-8 px-4 py-2 text-slate-900">
            <div className="flex items-center gap-3 px-1">
              <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl bg-[#0b2a57] text-base font-bold text-white shadow-[0_0_18px_rgba(11,42,87,0.18)]">
              {profile?.photoUrl ? <img alt="Profile" className="h-full w-full object-cover" src={profile.photoUrl} /> : initials}
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Control Center</p>
                <span className="text-xl font-black tracking-[0.02em] text-slate-900">ADMIN PANEL</span>
              </div>
            </div>
          </div>

          <nav className="flex-1">
            <ul className="space-y-1.5">
              {adminNavItems.map((item) => {
                const isAction = Boolean(actionOverrides?.[item.key])
                const isActive = activeKey === item.key
                const buttonClassName = `group flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition ${
                  isActive
                    ? 'bg-[linear-gradient(135deg,#0b2a57,#123a73)] text-white shadow-[0_14px_26px_rgba(11,42,87,0.2)]'
                    : 'text-slate-700 hover:bg-blue-50 hover:text-[#0b2a57] hover:shadow-[0_10px_22px_rgba(15,23,42,0.08)]'
                }`

                return (
                  <li key={item.key}>
                    {isAction ? (
                      <button className={buttonClassName} onClick={actionOverrides?.[item.key]} type="button">
                        {renderItemContent(item.label, item.icon, isActive)}
                      </button>
                    ) : (
                      <NavLink
                        className={({ isActive }) =>
                          `group flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition ${
                            isActive
                              ? 'bg-[linear-gradient(135deg,#0b2a57,#123a73)] text-white shadow-[0_14px_26px_rgba(11,42,87,0.2)]'
                              : 'text-slate-700 hover:bg-blue-50 hover:text-[#0b2a57] hover:shadow-[0_10px_22px_rgba(15,23,42,0.08)]'
                          }`
                        }
                        to={item.to}
                      >
                        {({ isActive }) => renderItemContent(item.label, item.icon, isActive)}
                      </NavLink>
                    )}
                  </li>
                )
              })}
            </ul>
          </nav>

          <div className="mt-auto px-2 pt-8">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl bg-[#0b2a57] text-sm font-bold text-white shadow-[0_0_14px_rgba(11,42,87,0.18)]">
              {profile?.photoUrl ? <img alt="Profile" className="h-full w-full object-cover" src={profile.photoUrl} /> : initials}
              </div>
              <div className="min-w-0">
                <div className="truncate font-semibold text-slate-900">{displayName}</div>
                <button className="mt-1 text-xs font-medium text-slate-500 transition hover:text-red-700" onClick={handleLogout} type="button">
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}