import { useEffect, useRef, useState } from 'react'
import L, { type LatLngBoundsExpression } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { LoginPage } from '../auth/login/LoginPage'
import { RegisterPage } from '../auth/register/RegisterPage'
import { NavigationBar } from '../../components/NavigationBar'
import { useLocation, useNavigate } from 'react-router-dom'
import { isAuthenticated } from '../../services/auth'
import { hazardIncidents } from '../../data/adminOperations'
import landingPageImage from '../../images/LandingPage.jpg'
import earthquakeIcon from '../../images/earthquake.png'
import alarmIcon from '../../images/alarm.png'
import accidentIcon from '../../images/accident.png'

const lucenaBounds: LatLngBoundsExpression = [
  [13.89, 121.57],
  [13.98, 121.69],
]

const mapLegend = [
  { label: 'Earthquake', color: '#facc15' },
  { label: 'Fire', color: '#ef4444' },
  { label: 'Accident', color: '#f59e0b' },
]

const mapColorByCode = {
  EQ: '#facc15',
  FR: '#ef4444',
  AC: '#f59e0b',
} as const

const hazardRiskLevels = [
  {
    title: 'Low Risk',
    description: 'Normal conditions. No immediate hazard detected.',
    color: '#22c55e',
    bgColor: 'bg-emerald-500',
    ringColor: 'ring-emerald-300/60',
    icon: 'OK',
  },
  {
    title: 'Moderate Risk',
    description: 'Elevated conditions. Monitor official advisories closely.',
    color: '#facc15',
    bgColor: 'bg-amber-400',
    ringColor: 'ring-amber-200/70',
    icon: 'AL',
  },
  {
    title: 'High Risk',
    description: 'Significant threat. Prepare evacuation plans early.',
    color: '#f97316',
    bgColor: 'bg-orange-500',
    ringColor: 'ring-orange-200/70',
    icon: 'HI',
  },
  {
    title: 'Critical Risk',
    description: 'Immediate danger. Evacuate designated areas now.',
    color: '#dc2626',
    bgColor: 'bg-red-600',
    ringColor: 'ring-red-200/70',
    icon: 'CR',
  },
]

const preparednessGuides = [
  {
    title: 'Earthquake Safety',
    color: '#facc15',
    iconSrc: earthquakeIcon,
    tips: ['Drop, cover, and hold on', 'Stay away from windows', 'Prepare an emergency kit'],
  },
  {
    title: 'Fire Emergency',
    color: '#ef4444',
    iconSrc: alarmIcon,
    tips: ['Crawl low under smoke', 'Use stairs, not elevators', 'Call emergency services quickly'],
  },
  {
    title: 'Accident Response',
    color: '#f59e0b',
    iconSrc: accidentIcon,
    tips: ['Secure the accident scene', 'Call responders immediately', 'Give basic first aid if safe'],
  },
]

const emergencyHotlines = [
  { agency: 'National Emergency', number: '911' },
  { agency: 'Lucena CDRRMO', number: '(042) XXX-XXXX' },
  { agency: 'Lucena BFP', number: '(042) XXX-XXXX' },
  { agency: 'Lucena PNP', number: '(042) XXX-XXXX' },
]


export function LandingPage() {
  const LOGIN_POPUP_MS = 2800
  const LOGOUT_POPUP_MS = 1800
  const POPUP_FADE_MS = 380
  const navigate = useNavigate()
  const location = useLocation()
  const [activeModal, setActiveModal] = useState<'sign-in' | 'sign-up' | null>(null)
  const [pendingProtectedPath, setPendingProtectedPath] = useState<string | null>(null)
  const [authPopup, setAuthPopup] = useState<{
    type: 'login' | 'logout'
    title: string
    message: string
    accentClass: string
    badgeClass: string
    icon: string
  } | null>(null)
  const [isAuthPopupVisible, setIsAuthPopupVisible] = useState(false)
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const popupFadeTimerRef = useRef<number | null>(null)
  const popupClearTimerRef = useRef<number | null>(null)

  const alertItems = [
    'KEN LLOYD ALCOREZA: Laging nag bi-vape.',
    'JULIUS REYESS: Mahilig mangutingting.',
    'LOUIZZA PAJARILLON: Palaging naka Chinese Drama.',
  ]

  const tickerItems = [...alertItems, ...alertItems]
  const systemStats = [
    {
      value: '33',
      label: 'Barangays Monitored',
      detail: 'active zones',
      glow: 'from-cyan-400/35 to-blue-500/20',
      marker: 'BM',
    },
    {
      value: '24/7',
      label: 'Real-time Monitoring',
      detail: 'continuous watch',
      glow: 'from-indigo-400/35 to-cyan-500/20',
      marker: 'RT',
    },
    {
      value: '< 5min',
      label: 'Average Alert Time',
      detail: 'response speed',
      glow: 'from-orange-400/35 to-amber-500/20',
      marker: 'AT',
    },
    {
      value: '99.9%',
      label: 'System Uptime',
      detail: 'service reliability',
      glow: 'from-emerald-400/35 to-teal-500/20',
      marker: 'UP',
    },
  ]
  const isModalOpen = activeModal !== null

  function closeModal() {
    setActiveModal(null)
  }

  function clearAuthPopupTimers() {
    if (popupFadeTimerRef.current) {
      window.clearTimeout(popupFadeTimerRef.current)
      popupFadeTimerRef.current = null
    }

    if (popupClearTimerRef.current) {
      window.clearTimeout(popupClearTimerRef.current)
      popupClearTimerRef.current = null
    }
  }

  function showAuthPopup(
    popup: {
      type: 'login' | 'logout'
      title: string
      message: string
      accentClass: string
      badgeClass: string
      icon: string
    },
    durationMs: number,
  ) {
    clearAuthPopupTimers()
    setAuthPopup(popup)
    setIsAuthPopupVisible(true)

    popupFadeTimerRef.current = window.setTimeout(() => {
      setIsAuthPopupVisible(false)
    }, Math.max(0, durationMs - POPUP_FADE_MS))

    popupClearTimerRef.current = window.setTimeout(() => {
      setAuthPopup(null)
      popupFadeTimerRef.current = null
      popupClearTimerRef.current = null
    }, durationMs)
  }

  function handleAuthenticatedFromModal() {
    setActiveModal(null)

    if (pendingProtectedPath) {
      const targetPath = pendingProtectedPath
      setPendingProtectedPath(null)
      navigate(targetPath, {
        state: {
          loginSuccessMessage: 'Login successful. Welcome back to Lucena City DRRMO.',
        },
      })
      return
    }

    showAuthPopup({
      type: 'login',
      title: 'Login Successful',
      message: 'Login successful. Welcome back to Lucena City DRRMO.',
      accentClass: 'from-emerald-400 via-teal-500 to-cyan-500',
      badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      icon: '✓',
    }, LOGIN_POPUP_MS)
  }

  function handleProtectedNavigation(path: string) {
    if (isAuthenticated()) {
      navigate(path)
      return
    }

    setPendingProtectedPath(path)
    setActiveModal('sign-in')
  }

  function scrollToSection(sectionId: string) {
    const section = document.getElementById(sectionId)
    if (!section) {
      return
    }

    section.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  useEffect(() => {
    const navState = location.state as { loginSuccessMessage?: string; logoutSuccessMessage?: string } | null
    if (!navState?.loginSuccessMessage && !navState?.logoutSuccessMessage) {
      return
    }

    const popupConfig = navState.logoutSuccessMessage
      ? {
          type: 'logout' as const,
          title: 'Logged Out',
          message: navState.logoutSuccessMessage,
          accentClass: 'from-sky-400 via-blue-500 to-indigo-500',
          badgeClass: 'border-blue-200 bg-blue-50 text-blue-700',
          icon: 'i',
        }
      : {
          type: 'login' as const,
          title: 'Login Successful',
          message: navState.loginSuccessMessage ?? 'Login successful.',
          accentClass: 'from-emerald-400 via-teal-500 to-cyan-500',
          badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-700',
          icon: '✓',
        }

    showAuthPopup(
      popupConfig,
      popupConfig.type === 'logout' ? LOGOUT_POPUP_MS : LOGIN_POPUP_MS,
    )

    navigate(location.pathname, { replace: true, state: null })
  }, [location.pathname, location.state, navigate])

  useEffect(() => {
    return () => {
      clearAuthPopupTimers()
    }
  }, [])

  useEffect(() => {
    if (!mapContainerRef.current) {
      return
    }

    // React StrictMode can mount/unmount effects twice in development.
    // Clear stale Leaflet container state before creating a new map instance.
    const existingLeafletId = (mapContainerRef.current as { _leaflet_id?: number })._leaflet_id
    if (existingLeafletId) {
      ;(mapContainerRef.current as { _leaflet_id?: number })._leaflet_id = undefined
    }

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove()
      mapInstanceRef.current = null
    }

    const map = L.map(mapContainerRef.current, {
      zoomControl: true,
      attributionControl: false,
      maxBounds: lucenaBounds,
      maxBoundsViscosity: 1,
      minZoom: 12,
      maxZoom: 17,
    })

    map.fitBounds(lucenaBounds)

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO',
    }).addTo(map)

    L.rectangle(lucenaBounds, {
      color: '#60a5fa',
      weight: 2,
      fillColor: '#1d4ed8',
      fillOpacity: 0.05,
      dashArray: '6 5',
    }).addTo(map)

    // Plot currently tracked incidents on the home map preview.
    const incidentBounds = L.latLngBounds(hazardIncidents.map((incident) => incident.coordinates))

    hazardIncidents.forEach((incident) => {
      const markerColor = mapColorByCode[incident.code]

      L.circleMarker(incident.coordinates, {
        radius: 16,
        stroke: false,
        fillColor: markerColor,
        fillOpacity: 0.26,
        interactive: false,
      }).addTo(map)

      if (incident.status !== 'resolved') {
        L.circleMarker(incident.coordinates, {
          radius: 11,
          color: markerColor,
          weight: 2,
          fillColor: markerColor,
          fillOpacity: 0.16,
          interactive: false,
          className: 'hazard-marker-pulse',
        }).addTo(map)
      }

      L.circleMarker(incident.coordinates, {
        radius: 8,
        color: '#ffffff',
        weight: 2,
        fillColor: markerColor,
        fillOpacity: 0.98,
      })
        .addTo(map)
        .bindTooltip(`${incident.code}`, {
          permanent: true,
          direction: 'top',
          offset: [0, -9],
          className: 'text-[10px] font-bold',
        })
        .bindPopup(
          `<strong>${incident.title}</strong><br/>${incident.location}<br/><small>${incident.time} · ${incident.status.toUpperCase()}</small>`,
        )
    })

    if (incidentBounds.isValid()) {
      map.fitBounds(incidentBounds.pad(0.25))
    }

    // Ensure tiles render even when section starts off-screen.
    window.setTimeout(() => {
      map.invalidateSize()
    }, 0)

    mapInstanceRef.current = map

    return () => {
      map.remove()
      mapInstanceRef.current = null
    }
  }, [])

  return (
    <main className="min-h-screen bg-[#0b2a57] text-slate-100">
      {authPopup ? (
        <div className="fixed left-1/2 top-20 z-[1400] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 px-1 sm:top-24">
          <div
            className={`relative overflow-hidden rounded-2xl border border-slate-200 bg-white px-5 py-4 text-slate-800 shadow-[0_20px_44px_rgba(15,23,42,0.24)] transition duration-300 sm:px-6 sm:py-5 ${
              isAuthPopupVisible ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0'
            }`}
          >
            <div className={`pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${authPopup.accentClass}`} />

            <div className="flex items-start gap-3">
              <div className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-lg font-bold ${authPopup.badgeClass}`}>
                {authPopup.icon}
              </div>

              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-700">{authPopup.title}</p>
                <p className="mt-1 text-sm font-medium leading-relaxed text-slate-700">{authPopup.message}</p>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className={isModalOpen ? 'blur-[1px]' : ''}>
        <NavigationBar
          onSignInClick={() => {
            setPendingProtectedPath(null)
            setActiveModal('sign-in')
          }}
          onSignUpClick={() => setActiveModal('sign-up')}
          variant="hero"
        />

        <div className="relative flex w-full items-center overflow-hidden bg-orange-500 py-2.5 text-xs font-semibold text-white sm:py-3 sm:text-sm">
          <span className="shrink-0 border-r border-white/40 px-4 whitespace-nowrap sm:px-6">⚠ LIVE ALERT</span>

          <div className="min-w-0 flex-1 overflow-hidden">
            <div className="live-alert-track flex w-max items-center gap-8 pl-4 pr-6 sm:gap-12 sm:pl-6 sm:pr-8">
              {tickerItems.map((item, index) => (
                <span className="whitespace-nowrap text-xs sm:text-sm" key={`${item}-${index}`}>
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="w-full">
          <div className="relative h-[calc(100vh-144px)] w-full overflow-hidden">
            <img alt="Landing page" className="block h-full w-full object-cover object-center" src={landingPageImage} />

            <div className="pointer-events-none absolute inset-0 bg-[#0b2a57]/65" />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#0b2a57]/80 via-[#0b2a57]/60 to-[#0b2a57]/75" />

            <section className="absolute inset-0 flex items-center justify-center">
              <div className="w-full max-w-5xl px-6 text-center sm:px-12 lg:px-16">

                <h1 className="mt-6 text-4xl font-black leading-[0.98] text-slate-100 sm:mt-8 sm:text-6xl lg:text-7xl">
                  <span className="block">Lucena Risk</span>
                  <span className="block text-red-600">Monitoring & Response</span>
                  <span className="block">Vision</span>
                </h1>

                  <p className="mx-auto mt-6 max-w-3xl text-sm font-normal leading-relaxed text-slate-400 sm:text-base lg:text-lg">
                  Advanced real-time disaster monitoring, citizen reporting, and emergency response coordination platform for safer communities.
                </p>

                <div className="mx-auto mt-6 grid max-w-3xl grid-cols-2 gap-2 sm:mt-8 sm:gap-3">

                  <button
                    className="inline-flex min-h-12 w-full items-center justify-center gap-2 whitespace-nowrap rounded-2xl bg-blue-600 px-3 py-3 text-xs font-semibold text-white shadow-[0_0_24px_rgba(37,99,235,0.48)] transition duration-200 hover:bg-blue-500 hover:shadow-[0_0_32px_rgba(59,130,246,0.58)] sm:min-h-14 sm:px-4 sm:py-3.5 sm:text-sm"
                    onClick={() => handleProtectedNavigation('/disaster-map')}
                    type="button"
                  >
                    View Disaster Map
                  </button>

                  <button
                    className="inline-flex min-h-12 w-full items-center justify-center gap-2 whitespace-nowrap rounded-2xl border border-white/15 bg-slate-900/80 px-3 py-3 text-xs font-semibold text-slate-100 shadow-[0_0_18px_rgba(148,163,184,0.2)] transition duration-200 hover:bg-slate-800 hover:shadow-[0_0_24px_rgba(148,163,184,0.3)] sm:min-h-14 sm:px-4 sm:py-3.5 sm:text-sm"
                    onClick={() => handleProtectedNavigation('/simulation')}
                    type="button"
                  >
                    Start Simulation
                  </button>
                </div>
              </div>
            </section>
          </div>

          <section className="border-y border-cyan-200/10 bg-[linear-gradient(90deg,#112d58_0%,#173f7c_50%,#102a54_100%)] px-6 py-9 sm:px-10 sm:py-11">
            <div className="mx-auto w-full max-w-6xl">
              <div className="grid grid-cols-2 gap-6 text-center md:grid-cols-4 md:gap-8">
                {systemStats.map((stat) => (
                  <div className="relative" key={stat.label}>
                    <p className="text-3xl font-black tracking-tight text-amber-200 sm:text-4xl">{stat.value}</p>
                    <p className="mt-1 text-xs font-semibold text-cyan-100 sm:text-sm">{stat.label}</p>
                    <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-slate-300/85 sm:text-[11px]">{stat.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section
            className="border-t border-slate-200 bg-[radial-gradient(circle_at_top,#ffffff_0%,#f7faff_45%,#eef4ff_100%)] px-6 py-16 sm:px-10 sm:py-20"
            id="disaster-map"
          >
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 sm:gap-7">
              <div className="mt-6 text-center sm:mt-8">
                <p className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-4 py-1 text-xs font-bold uppercase tracking-[0.2em] text-sky-700">
                  Mapping
                </p>
                <h2 className="text-5xl font-black text-slate-900 sm:text-5xl">Disaster Map</h2>
                <p className="mx-auto mt-2 max-w-3xl text-sm font-medium leading-relaxed text-slate-600 sm:text-base">
                  Real-time monitoring of incidents across the region with color-coded severity indicators.
                </p>
              </div>

              <div className="mt-4 overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-[0_18px_44px_rgba(15,23,42,0.16)] sm:mt-5">
                <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 border-b border-[#132744] bg-gradient-to-r from-[#061226] to-[#0d2240] px-4 py-3 shadow-[0_10px_24px_rgba(2,8,18,0.5)] sm:px-6">
                  <div className="flex items-center gap-3">
                    <span className="h-3 w-3 rounded-full bg-red-500" />
                    <span className="h-3 w-3 rounded-full bg-amber-400" />
                    <span className="h-3 w-3 rounded-full bg-emerald-500" />
                    <p className="ml-2 font-mono text-sm font-semibold tracking-tight text-slate-100">disaster-monitor.map</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-100 sm:text-sm">
                    {mapLegend.map((item) => (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-2.5 py-1" key={item.label}>
                        <span
                          aria-hidden
                          className="h-2.5 w-2.5 rounded-full"
                          style={{
                            backgroundColor: item.color,
                            boxShadow: `0 0 10px ${item.color}`,
                          }}
                        />
                        {item.label}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="relative">
                  <div className="h-[420px] w-full sm:h-[560px]" ref={mapContainerRef} />
                  <div className="pointer-events-none absolute inset-y-0 left-0 w-[30%] bg-gradient-to-r from-slate-100/45 via-slate-100/20 to-transparent" />
                </div>
              </div>
            </div>
          </section>

          <section
            className="overflow-x-hidden border-t border-slate-200 bg-[radial-gradient(circle_at_top,#ffffff_0%,#f4f7fb_42%,#edf3fb_100%)] px-6 py-20 sm:px-10 sm:py-24"
            id="risk-levels"
          >
            <div className="mx-auto w-full max-w-7xl">
              <div className="text-center">
                <p className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-4 py-1 text-xs font-bold uppercase tracking-[0.2em] text-sky-700">
                  Classification
                </p>
                <h3 className="mt-4 text-3xl font-black text-slate-900 sm:text-4xl">Hazard Risk Levels</h3>
                <p className="mx-auto mt-3 max-w-3xl text-sm leading-relaxed text-slate-600 sm:text-lg">
                  Standardized color-coded classification for all hazard assessments
                </p>
              </div>

              <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                {hazardRiskLevels.map((riskLevel) => (
                  <article
                    className="group relative min-w-0 overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_10px_26px_rgba(15,23,42,0.09)] transition duration-300 hover:-translate-y-1.5 hover:border-slate-300 hover:shadow-[0_22px_40px_rgba(15,23,42,0.16)]"
                    key={riskLevel.title}
                  >
                    <div className="pointer-events-none absolute -right-8 -top-10 h-24 w-24 rounded-full bg-slate-200/35 blur-xl transition duration-300 group-hover:bg-slate-300/45" />
                    <div className={`${riskLevel.bgColor} px-5 py-4 text-white`}>
                      <div className="flex flex-wrap items-center gap-3">
                        <p className="min-w-0 text-xl font-bold leading-tight tracking-tight sm:text-2xl">{riskLevel.title}</p>
                      </div>
                    </div>

                    <p className="min-h-24 px-5 py-5 text-sm leading-relaxed text-slate-600 sm:text-base">{riskLevel.description}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className="border-t border-slate-200 bg-white px-6 pb-28 pt-20 sm:px-10 sm:pb-32 sm:pt-24" id="preparedness-guides">
            <div className="mx-auto w-full max-w-7xl">
              <div className="text-center">
                <p className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-4 py-1 text-xs font-bold uppercase tracking-[0.2em] text-sky-700">
                  Preparedness
                </p>
                <h3 className="mt-3 text-3xl font-black text-slate-900 sm:text-4xl">Preparedness Guides</h3>
                <p className="mx-auto mt-3 max-w-3xl text-sm leading-relaxed text-slate-600 sm:text-lg">
                  Essential safety tips for key disaster scenarios.
                </p>
              </div>

              <div className="mt-10 grid gap-6 lg:grid-cols-3">
                {preparednessGuides.map((guide) => (
                  <article
                    className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50/90 p-6 shadow-[0_12px_28px_rgba(15,23,42,0.1)] transition duration-300 hover:-translate-y-1.5 hover:border-slate-300 hover:shadow-[0_22px_38px_rgba(15,23,42,0.16)]"
                    key={guide.title}
                  >
                    <div
                      className="pointer-events-none absolute inset-x-0 top-0 h-1 opacity-80"
                      style={{ background: `linear-gradient(90deg, ${guide.color}, transparent)` }}
                    />
                    <div className="flex items-start gap-3.5">
                      <img
                        alt=""
                        aria-hidden="true"
                        className="h-11 w-11 object-contain transition duration-200 group-hover:scale-105"
                        src={guide.iconSrc}
                        style={{ filter: `drop-shadow(0 6px 12px ${guide.color}55)` }}
                      />
                      <h4 className="pt-0.5 text-2xl font-bold leading-tight text-slate-900">{guide.title}</h4>
                    </div>

                    <div className="mt-4 h-px w-full bg-slate-200/80" />

                    <ul className="mt-4 space-y-3">
                      {guide.tips.map((tip) => (
                        <li className="flex items-start gap-2.5 text-[15px] leading-relaxed text-slate-600" key={tip}>
                          <span className="mt-0.5 shrink-0 text-base font-black leading-none" style={{ color: guide.color }}>
                            &gt;
                          </span>
                          <span>{tip}</span>
                        </li>
                      ))}
                    </ul>

                    <div className="mt-auto pt-5">
                      <div className="h-1.5 w-20 rounded-full" style={{ background: `linear-gradient(90deg, ${guide.color}b3, transparent)` }} />
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section
            className="border-t border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] px-6 py-12 sm:px-10 sm:py-14"
            id="emergency-contacts"
          >
            <div className="mx-auto rounded-3xl border border-slate-200 bg-white px-5 py-6 shadow-[0_14px_30px_rgba(15,23,42,0.08)] sm:px-7 sm:py-8">
              <div className="flex w-full flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="inline-flex rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-red-700">
                  Emergency Contacts
                </p>
                <h3 className="mt-3 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">Rapid Response Hotlines</h3>
                <p className="mt-1 text-sm text-slate-600 sm:text-base">Immediate contact lines for urgent incidents in Lucena City.</p>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-center lg:gap-3">
                {emergencyHotlines.map((hotline) => (
                  <div
                    className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-800 transition duration-200 hover:border-red-300 hover:bg-white hover:shadow-[0_10px_18px_rgba(15,23,42,0.12)]"
                    key={hotline.agency}
                  >
                    <span className="font-semibold text-red-700">{hotline.agency}:</span>{' '}
                    <span className="font-black tracking-wide text-slate-900">{hotline.number}</span>
                  </div>
                ))}
              </div>
            </div>
            </div>
          </section>

          <footer className="border-t-4 border-[#1f4f82] bg-[#0d223f] px-6 py-10 text-slate-200 sm:px-10 sm:py-12">
            <div className="mx-auto w-full max-w-7xl">
              <div className="grid gap-8 md:grid-cols-3 md:gap-10">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#a9c7e6] sm:text-sm">Lucena City DRRMO</p>
                  <h4 className="mt-2 text-lg font-black tracking-tight text-white">Disaster Risk Monitoring and Response System</h4>
                  <p className="mt-3 max-w-sm text-sm leading-relaxed text-slate-300">
                    Official information platform for hazard updates, preparedness guidance, and emergency response coordination.
                  </p>
                </div>

                <div>
                  <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#a9c7e6]">Site Navigation</p>
                  <div className="mt-3 grid grid-cols-2 gap-x-5 gap-y-2 text-sm">
                    {[
                      { label: 'Disaster Map', id: 'disaster-map' },
                      { label: 'Risk Levels', id: 'risk-levels' },
                      { label: 'Preparedness', id: 'preparedness-guides' },
                      { label: 'Emergency', id: 'emergency-contacts' },
                    ].map((linkItem) => (
                      <button
                        className="text-left font-semibold text-slate-200 underline-offset-4 transition duration-150 hover:text-white hover:underline"
                        key={linkItem.id}
                        onClick={() => scrollToSection(linkItem.id)}
                        type="button"
                      >
                        {linkItem.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#a9c7e6]">Emergency Hotline</p>
                  <p className="mt-3 text-sm leading-relaxed text-slate-300">
                    For urgent incidents, call <span className="font-black text-white">911</span> and proceed to the emergency contacts section for local responder numbers.
                  </p>
                  <button
                    className="mt-4 inline-flex rounded-md border border-[#7aa6d3]/45 bg-[#14345e] px-4 py-2 text-sm font-semibold text-[#d7e7f7] transition duration-150 hover:border-[#9ac0e5]/60 hover:bg-[#1a416f]"
                    onClick={() => scrollToSection('emergency-contacts')}
                    type="button"
                  >
                    View Emergency Contacts
                  </button>
                </div>
              </div>

              <div className="mt-8 border-t border-slate-600/70 pt-4 text-xs text-slate-400 sm:mt-10 sm:flex sm:items-center sm:justify-between sm:text-sm">
                <p>© 2026 Lucena City DRRMO. All rights reserved.</p>
                <p className="mt-2 sm:mt-0">Public Safety and Disaster Risk Reduction</p>
              </div>
            </div>
          </footer>
        </div>
      </div>

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 bg-slate-900/25 backdrop-blur-[1px]" onClick={closeModal}>
          <div className="h-full overflow-auto">
            {activeModal === 'sign-in' ? (
              <LoginPage
                modalMode
                onAuthenticated={handleAuthenticatedFromModal}
                onRequestAdminLogin={() => setActiveModal('sign-in')}
                onRequestRegister={() => setActiveModal('sign-up')}
              />
            ) : (
              <RegisterPage modalMode onRegistered={closeModal} onRequestLogin={() => setActiveModal('sign-in')} />
            )}
          </div>
        </div>
      ) : null}
    </main>
  )
}
