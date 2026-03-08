import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import logoImage from '../images/Logo.png'
import { AUTH_CHANGED_EVENT, getCurrentUserDisplayName, isAuthenticated, logoutUser } from '../services/auth'

const mainLinks = [
  { to: '/landing', label: 'Home' },
  { to: '/disaster-map', label: 'Disaster Map' },
  { to: '/simulation', label: 'Simulation' },
  { to: '/report-incident', label: 'Report Incident' },
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
  const [authSnapshot, setAuthSnapshot] = useState(() => ({
    authenticated: isAuthenticated(),
    displayName: getCurrentUserDisplayName(),
  }))
  const profileMenuRef = useRef<HTMLDivElement | null>(null)
  const isHero = variant === 'hero'

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
      })
    }

    window.addEventListener('storage', syncAuthSnapshot)
    window.addEventListener(AUTH_CHANGED_EVENT, syncAuthSnapshot)

    return () => {
      window.removeEventListener('storage', syncAuthSnapshot)
      window.removeEventListener(AUTH_CHANGED_EVENT, syncAuthSnapshot)
    }
  }, [])

  useEffect(() => {
    function handleDocumentClick(event: MouseEvent) {
      if (!profileMenuRef.current) {
        return
      }

      const target = event.target as Node
      if (!profileMenuRef.current.contains(target)) {
        setIsProfileMenuOpen(false)
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
    navigate('/landing')
  }

  function handleOpenProfileSettings() {
    setIsProfileMenuOpen(false)
    setIsMenuOpen(false)
    navigate('/profile-settings')
  }

  const navClasses = isHero
    ? 'sticky top-0 z-[1200] w-full border-b border-slate-200/90 bg-white/95 px-4 py-4 backdrop-blur-md sm:px-6'
    : 'sticky top-0 z-[1200] w-full border-b border-slate-200/80 bg-slate-100/85 px-4 py-4 backdrop-blur-xl sm:px-6'

  const inactiveLinkClasses = isHero ? 'text-slate-600 hover:text-blue-700' : 'text-slate-600 hover:text-blue-700'
  const activeLinkClasses = isHero ? 'text-blue-700' : 'text-blue-700'
  const registerLinkClasses = isHero
    ? 'rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-500'
    : ''

  const mobilePanelClasses = isHero
    ? 'border-t border-slate-200 bg-white/95'
    : 'border-t border-slate-200 bg-slate-100/95'

  const menuButtonClasses = isHero
    ? 'rounded-md border border-slate-300 px-3 py-2 text-slate-700 hover:bg-slate-100'
    : 'rounded-md border border-slate-300 px-3 py-2 text-slate-700 hover:bg-slate-200'

  return (
    <nav className={`${navClasses} relative`}>
      <div className="flex items-center justify-between gap-4">
        <Link className="inline-flex items-center" to="/landing">
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

        <ul className="hidden items-center gap-2 sm:gap-3 xl:flex">
          {mainLinks.map((link) => (
            <li key={link.to}>
              <NavLink
                className={({ isActive }) =>
                  `inline-flex rounded-lg px-3 py-2 text-sm font-semibold transition ${
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
          <div className="relative hidden xl:block" ref={profileMenuRef}>
            <button
              aria-expanded={isProfileMenuOpen}
              aria-label="Open profile menu"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-300 bg-white text-sm font-bold text-[#0b2a57] shadow-sm transition hover:border-blue-500 hover:text-blue-700"
              onClick={() => setIsProfileMenuOpen((current) => !current)}
              type="button"
            >
              {userInitials}
            </button>

            {isProfileMenuOpen ? (
              <div className="absolute right-0 top-12 z-50 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
                <div className="border-b border-slate-100 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Signed in as</p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">{authSnapshot.displayName ?? 'User'}</p>
                </div>

                <button
                  className="inline-flex w-full px-4 py-3 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  onClick={handleOpenProfileSettings}
                  type="button"
                >
                  Profile Settings
                </button>
                <button
                  className="inline-flex w-full px-4 py-3 text-left text-sm font-semibold text-red-600 transition hover:bg-red-50"
                  onClick={handleLogout}
                  type="button"
                >
                  Logout
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <ul className="hidden items-center gap-2 xl:flex">
            {authLinks.map((link) => (
              <li key={link.to}>
                {link.label === 'Sign in' && onSignInClick ? (
                  <button
                    className={`inline-flex rounded-lg px-3 py-2 text-sm font-semibold transition ${inactiveLinkClasses}`}
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
                    className={`inline-flex text-sm font-semibold transition ${
                      registerLinkClasses || `rounded-lg px-3 py-2 ${inactiveLinkClasses}`
                    }`}
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
                    className={({ isActive }) =>
                      `inline-flex text-sm font-semibold transition ${
                        link.label === 'Sign up'
                          ? registerLinkClasses
                          : `rounded-lg px-3 py-2 ${isActive ? activeLinkClasses : inactiveLinkClasses}`
                      }`
                    }
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
                    `inline-flex w-full rounded-lg px-3 py-2 text-sm font-semibold transition ${
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
                <p className="text-sm font-semibold text-slate-700">{authSnapshot.displayName ?? 'User'}</p>
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
                      className={`inline-flex w-full rounded-lg px-3 py-2 text-left text-sm font-semibold transition ${inactiveLinkClasses}`}
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
                      className={`inline-flex w-full text-sm font-semibold transition ${
                        registerLinkClasses || `rounded-lg px-3 py-2 ${inactiveLinkClasses}`
                      }`}
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
                      className={({ isActive }) =>
                        `inline-flex w-full text-sm font-semibold transition ${
                          link.label === 'Sign up'
                            ? registerLinkClasses
                            : `rounded-lg px-3 py-2 ${isActive ? activeLinkClasses : inactiveLinkClasses}`
                        }`
                      }
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