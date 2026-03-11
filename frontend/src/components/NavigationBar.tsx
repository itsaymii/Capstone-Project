import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import logoImage from '../images/Logo.png'
import notificationIcon from '../images/notification.png'
import { AUTH_CHANGED_EVENT, getCurrentUserDisplayName, getCurrentUserProfile, isAuthenticated, logoutUser } from '../services/auth'
import {
  getNotifications,
  markAllNotificationsRead,
  NOTIFICATIONS_CHANGED_EVENT,
  type NotificationItem,
} from '../services/notifications'

const mainLinks = [
  { to: '/landing', label: 'Home' },
  { to: '/disaster-map', label: 'Disaster Map' },
  { to: '/simulation', label: 'Simulation' },
]

const authLinks = [
  { to: '/login', label: 'Sign in' },
  { to: '/register', label: 'Sign up' },
]

interface NavigationBarProps {
  variant?: 'default' | 'hero'
  onSignInClick?: () => void
  onSignUpClick?: () => void
}

export function NavigationBar({ variant = 'default', onSignInClick, onSignUpClick }: NavigationBarProps) {
  const navigate = useNavigate()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false)
  const [isNotificationMenuOpen, setIsNotificationMenuOpen] = useState(false)
  const [notifications, setNotifications] = useState<NotificationItem[]>(() => getNotifications())
  const [authSnapshot, setAuthSnapshot] = useState(() => ({
    authenticated: isAuthenticated(),
    displayName: getCurrentUserDisplayName(),
    photoUrl: getCurrentUserProfile()?.photoUrl ?? null,
  }))
  const profileMenuRef = useRef<HTMLDivElement | null>(null)
  const notificationMenuRef = useRef<HTMLDivElement | null>(null)
  const isHero = variant === 'hero'
  const unreadCount = useMemo(() => notifications.filter((item) => !item.read).length, [notifications])
  const displayFirstName = useMemo(() => {
    const rawName = authSnapshot.displayName?.trim() || 'User'
    const firstName = rawName.split(/\s+/).filter(Boolean)[0]
    return firstName || 'User'
  }, [authSnapshot.displayName])

  const userInitials = useMemo(() => {
    const name = authSnapshot.displayName?.trim()
    if (!name) {
      return 'U'
    }

    const nameParts = name.split(/\s+/).filter(Boolean)
    if (nameParts.length === 0) {
      return 'U'
    }

    if (nameParts.length === 1) {
      return nameParts[0].slice(0, 2).toUpperCase()
    }

    return `${nameParts[0][0]}${nameParts[1][0]}`.toUpperCase()
  }, [authSnapshot.displayName])

  useEffect(() => {
    function syncAuthSnapshot() {
      setAuthSnapshot({
        authenticated: isAuthenticated(),
        displayName: getCurrentUserDisplayName(),
        photoUrl: getCurrentUserProfile()?.photoUrl ?? null,
      })
    }

    function syncNotifications() {
      setNotifications(getNotifications())
    }

    window.addEventListener('storage', syncAuthSnapshot)
    window.addEventListener(AUTH_CHANGED_EVENT, syncAuthSnapshot)
    window.addEventListener('storage', syncNotifications)
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, syncNotifications)

    return () => {
      window.removeEventListener('storage', syncAuthSnapshot)
      window.removeEventListener(AUTH_CHANGED_EVENT, syncAuthSnapshot)
      window.removeEventListener('storage', syncNotifications)
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, syncNotifications)
    }
  }, [])

  useEffect(() => {
    function handleDocumentClick(event: MouseEvent) {
      if (!profileMenuRef.current) {
        setIsProfileMenuOpen(false)
      }

      const target = event.target as Node
      if (profileMenuRef.current && !profileMenuRef.current.contains(target)) {
        setIsProfileMenuOpen(false)
      }

      if (notificationMenuRef.current && !notificationMenuRef.current.contains(target)) {
        setIsNotificationMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleDocumentClick)
    return () => {
      document.removeEventListener('mousedown', handleDocumentClick)
    }
  }, [])

  function handleLogout() {
    logoutUser()
    setIsMenuOpen(false)
    setIsProfileMenuOpen(false)
    setIsNotificationMenuOpen(false)
    navigate('/landing', {
      state: {
        logoutSuccessMessage: 'You have been logged out successfully.',
      },
    })
  }

  function handleOpenProfileSettings() {
    setIsProfileMenuOpen(false)
    setIsNotificationMenuOpen(false)
    setIsMenuOpen(false)
    navigate('/profile-settings')
  }

  function handleToggleNotifications() {
    setIsNotificationMenuOpen((current) => {
      const nextOpen = !current
      if (nextOpen) {
        markAllNotificationsRead()
      }
      return nextOpen
    })
  }

  function formatNotificationTime(timestamp: string): string {
    const parsed = Date.parse(timestamp)
    if (Number.isNaN(parsed)) {
      return 'Now'
    }

    const diffInSeconds = Math.max(0, Math.floor((Date.now() - parsed) / 1000))
    if (diffInSeconds < 60) {
      return 'Just now'
    }
    if (diffInSeconds < 3600) {
      return `${Math.floor(diffInSeconds / 60)}m ago`
    }
    if (diffInSeconds < 86400) {
      return `${Math.floor(diffInSeconds / 3600)}h ago`
    }
    return `${Math.floor(diffInSeconds / 86400)}d ago`
  }

  const navClasses = isHero
    ? 'sticky top-0 z-[1200] w-full border-b border-slate-200/90 bg-white/95 px-4 py-4 backdrop-blur-md sm:px-6'
    : 'sticky top-0 z-[1200] w-full border-b border-slate-200/80 bg-slate-100/85 px-4 py-4 backdrop-blur-xl sm:px-6'

  const inactiveLinkClasses = isHero
    ? 'text-slate-600 hover:text-[#0b2a57] hover:[text-shadow:0_0_10px_rgba(11,42,87,0.35)]'
    : 'text-slate-600 hover:text-[#0b2a57] hover:[text-shadow:0_0_10px_rgba(11,42,87,0.35)]'
  const activeLinkClasses = isHero
    ? 'text-[#0b2a57] [text-shadow:0_0_8px_rgba(11,42,87,0.2)]'
    : 'text-[#0b2a57] [text-shadow:0_0_8px_rgba(11,42,87,0.2)]'
  const signInButtonClasses = isHero
    ? 'inline-flex items-center rounded-full border border-slate-300 bg-white px-4 py-2 text-[15px] font-semibold text-slate-700 shadow-sm transition hover:border-[#0b2a57]/40 hover:bg-[#0b2a57]/5 hover:text-[#0b2a57]'
    : 'inline-flex items-center rounded-full border border-slate-300 bg-white px-4 py-2 text-[15px] font-semibold text-slate-700 shadow-sm transition hover:border-[#0b2a57]/40 hover:bg-[#0b2a57]/5 hover:text-[#0b2a57]'
  const signUpButtonClasses = isHero
    ? 'inline-flex items-center rounded-full bg-gradient-to-r from-[#0b2a57] to-[#1d4f93] px-4 py-2 text-[15px] font-semibold text-white shadow-[0_8px_20px_rgba(11,42,87,0.35)] transition hover:from-[#12366f] hover:to-[#2563b0]'
    : 'inline-flex items-center rounded-full bg-gradient-to-r from-[#0b2a57] to-[#1d4f93] px-4 py-2 text-[15px] font-semibold text-white shadow-[0_8px_20px_rgba(11,42,87,0.35)] transition hover:from-[#12366f] hover:to-[#2563b0]'
  const mobileSignInButtonClasses =
    'inline-flex w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-[#0b2a57]/40 hover:bg-[#0b2a57]/5 hover:text-[#0b2a57]'
  const mobileSignUpButtonClasses =
    'inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-[#0b2a57] to-[#1d4f93] px-3 py-2.5 text-sm font-semibold text-white transition hover:from-[#12366f] hover:to-[#2563b0]'

  const mobilePanelClasses = isHero
    ? 'border-t border-slate-200 bg-white/95'
    : 'border-t border-slate-200 bg-slate-100/95'

  const menuButtonClasses = isHero
    ? 'rounded-md border border-slate-300 px-3 py-2 text-slate-700 hover:bg-slate-100'
    : 'rounded-md border border-slate-300 px-3 py-2 text-slate-700 hover:bg-slate-200'

  return (
    <nav className={`${navClasses} relative`}>
      <div className="flex items-center justify-between gap-4">
        <Link className="ml-6 inline-flex items-center sm:ml-20 md:ml-32 xl:ml-56" to="/landing">
          <img
            alt="DRMS Logo"
            className="h-14 w-auto pl-2 sm:pl-4 md:pl-5"
            src={logoImage}
          />
        </Link>

        <button
          aria-expanded={isMenuOpen}
          aria-label="Toggle navigation menu"
          className={`xl:hidden ${menuButtonClasses}`}
          onClick={() => setIsMenuOpen((current) => !current)}
          type="button"
        >
          ☰
        </button>

        <ul className="hidden items-center gap-2 sm:gap-3 xl:-ml-[18.5rem] xl:flex">
          {mainLinks.map((link) => (
            <li key={link.to}>
              <NavLink
                className={({ isActive }) =>
                  `inline-flex rounded-lg px-3 py-2 text-[15px] font-semibold transition ${
                    isActive ? activeLinkClasses : inactiveLinkClasses
                  }`
                }
                onClick={() => setIsMenuOpen(false)}
                to={link.to}
              >
                {link.label}
              </NavLink>
            </li>
          ))}
        </ul>

        {authSnapshot.authenticated ? (
          <div className="hidden items-center gap-2 xl:flex">
            <div className="relative" ref={notificationMenuRef}>
              <button
                aria-expanded={isNotificationMenuOpen}
                aria-label="Notifications"
                className="relative inline-flex items-center justify-center rounded-full p-1 transition hover:bg-slate-100"
                onClick={handleToggleNotifications}
                type="button"
              >
                <img alt="Notifications" className="h-6 w-6 object-contain" src={notificationIcon} />
                {unreadCount > 0 ? (
                  <span className="absolute -right-1 -top-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-4 text-white shadow-sm">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                ) : null}
              </button>

              {isNotificationMenuOpen ? (
                <div className="absolute right-0 top-11 z-50 w-[24rem] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl sm:w-[27rem]">
                  <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                    <p className="text-base font-semibold text-slate-800">Notifications</p>
                    <p className="text-xs font-medium text-slate-500">{unreadCount} unread</p>
                  </div>

                  {notifications.length === 0 ? (
                    <p className="px-5 py-7 text-sm text-slate-500">No notifications yet.</p>
                  ) : (
                    <ul className="max-h-96 overflow-y-auto">
                      {notifications.map((item) => (
                        <li className="border-b border-slate-100 px-5 py-4 last:border-b-0" key={item.id}>
                          <p className="text-[15px] font-medium text-slate-700">{item.message}</p>
                          <p className="mt-1 text-xs text-slate-500">{formatNotificationTime(item.createdAt)}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : null}
            </div>

            <div className="relative" ref={profileMenuRef}>
              <button
                aria-expanded={isProfileMenuOpen}
                aria-label="Open profile menu"
                className="inline-flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-slate-300 bg-white text-sm font-bold text-[#0b2a57] shadow-sm transition hover:border-blue-500 hover:text-blue-700"
                onClick={() => setIsProfileMenuOpen((current) => !current)}
                type="button"
              >
                {authSnapshot.photoUrl ? (
                  <img alt="Profile" className="h-full w-full object-cover" src={authSnapshot.photoUrl} />
                ) : (
                  userInitials
                )}
              </button>

              {isProfileMenuOpen ? (
                <div className="absolute right-0 top-12 z-50 w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_18px_36px_rgba(15,23,42,0.16)]">
                <div className="p-3">
                  <div className="rounded-2xl border border-slate-200 bg-[linear-gradient(120deg,#f8fbff_0%,#eef5ff_100%)] p-3">
                    <div className="flex items-center gap-3">
                      {authSnapshot.photoUrl ? (
                        <img alt="Profile" className="h-12 w-12 rounded-full border border-slate-200 object-cover" src={authSnapshot.photoUrl} />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#0b2a57] text-sm font-bold text-white">{userInitials}</div>
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Signed in as</p>
                        <p className="mt-1 truncate text-base font-semibold text-slate-800">{displayFirstName}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-100 px-2 pb-2 pt-1">
                  <button
                    className="inline-flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    onClick={handleOpenProfileSettings}
                    type="button"
                  >
                    <span>Profile Settings</span>
                    <span className="text-slate-400">›</span>
                  </button>
                  <button
                    className="inline-flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm font-semibold text-red-600 transition hover:bg-red-50"
                    onClick={handleLogout}
                    type="button"
                  >
                    <span>Logout</span>
                    <span className="text-red-300">›</span>
                  </button>
                </div>
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <ul className="hidden items-center gap-2 xl:flex">
            {authLinks.map((link) => (
              <li key={link.to}>
                {link.label === 'Sign in' && onSignInClick ? (
                  <button
                    className={signInButtonClasses}
                    onClick={() => {
                      onSignInClick()
                      setIsMenuOpen(false)
                    }}
                    type="button"
                  >
                    {link.label}
                  </button>
                ) : link.label === 'Sign up' && onSignUpClick ? (
                  <button
                    className={signUpButtonClasses}
                    onClick={() => {
                      onSignUpClick()
                      setIsMenuOpen(false)
                    }}
                    type="button"
                  >
                    {link.label}
                  </button>
                ) : (
                  <NavLink
                    className={() => (link.label === 'Sign up' ? signUpButtonClasses : signInButtonClasses)}
                    onClick={() => setIsMenuOpen(false)}
                    to={link.to}
                  >
                    {link.label}
                  </NavLink>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {isMenuOpen ? (
        <div className={`absolute left-0 right-0 top-full z-50 px-2 py-3 shadow-lg xl:hidden ${mobilePanelClasses}`}>
          <ul className="flex flex-col gap-1">
            {mainLinks.map((link) => (
              <li key={link.to}>
                <NavLink
                  className={({ isActive }) =>
                    `inline-flex w-full rounded-lg px-3 py-2 text-[15px] font-semibold transition ${
                      isActive ? activeLinkClasses : inactiveLinkClasses
                    }`
                  }
                  onClick={() => setIsMenuOpen(false)}
                  to={link.to}
                >
                  {link.label}
                </NavLink>
              </li>
            ))}
          </ul>

          {authSnapshot.authenticated ? (
            <div className="mt-3 border-t border-slate-200 pt-3">
              <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0b2a57] text-xs font-bold text-white">
                  {userInitials}
                </div>
                <p className="text-sm font-semibold text-slate-700">{displayFirstName}</p>
              </div>

              <button
                className="mt-2 inline-flex w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                onClick={handleOpenProfileSettings}
                type="button"
              >
                Profile Settings
              </button>
              <button
                className="mt-2 inline-flex w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                onClick={handleLogout}
                type="button"
              >
                Logout
              </button>
            </div>
          ) : (
            <ul className="mt-3 flex flex-col gap-1 border-t border-slate-200 pt-3">
              {authLinks.map((link) => (
                <li key={link.to}>
                  {link.label === 'Sign in' && onSignInClick ? (
                    <button
                      className={mobileSignInButtonClasses}
                      onClick={() => {
                        onSignInClick()
                        setIsMenuOpen(false)
                      }}
                      type="button"
                    >
                      {link.label}
                    </button>
                  ) : link.label === 'Sign up' && onSignUpClick ? (
                    <button
                      className={mobileSignUpButtonClasses}
                      onClick={() => {
                        onSignUpClick()
                        setIsMenuOpen(false)
                      }}
                      type="button"
                    >
                      {link.label}
                    </button>
                  ) : (
                    <NavLink
                      className={() => (link.label === 'Sign up' ? mobileSignUpButtonClasses : mobileSignInButtonClasses)}
                      onClick={() => setIsMenuOpen(false)}
                      to={link.to}
                    >
                      {link.label}
                    </NavLink>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </nav>
  )
}