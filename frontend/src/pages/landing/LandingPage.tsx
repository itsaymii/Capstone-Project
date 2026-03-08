import { useEffect, useRef, useState } from 'react'
import L, { type LatLngBoundsExpression } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { LoginPage } from '../auth/login/LoginPage'
import { RegisterPage } from '../auth/register/RegisterPage'
import { NavigationBar } from '../../components/NavigationBar'
import landingPageImage from '../../images/LandingPage.jpg'

const lucenaBounds: LatLngBoundsExpression = [
  [13.89, 121.57],
  [13.98, 121.69],
]

const mapLegend = [
  { label: 'Earthquake', color: '#facc15' },
  { label: 'Fire', color: '#ef4444' },
  { label: 'Accident', color: '#f59e0b' },
]

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
    badge: 'EQ',
    tips: ['Drop, cover, and hold on', 'Stay away from windows', 'Prepare an emergency kit'],
  },
  {
    title: 'Fire Emergency',
    color: '#ef4444',
    badge: 'FR',
    tips: ['Crawl low under smoke', 'Use stairs, not elevators', 'Call emergency services quickly'],
  },
  {
    title: 'Accident Response',
    color: '#f59e0b',
    badge: 'AC',
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
  const [activeModal, setActiveModal] = useState<'sign-in' | 'sign-up' | null>(null)
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)

  const alertItems = [
    'KEN LLOYD ALCOREZA: Laging nag bi-vape.',
    'JULIUS REYESS: Mahilig mangutingting.',
    'LOUIZZA PAJARILLON: Palaging naka Chinese Drama.',
  ]

  const tickerItems = [...alertItems, ...alertItems]
  const systemStats = [
    { value: '33', label: 'Barangays Monitored' },
    { value: '24/7', label: 'Real-time Monitoring' },
    { value: '< 5min', label: 'Average Alert Time' },
    { value: '99.9%', label: 'System Uptime' },
  ]
  const isModalOpen = activeModal !== null

  function closeModal() {
    setActiveModal(null)
  }

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

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO',
    }).addTo(map)

    L.rectangle(lucenaBounds, {
      color: '#60a5fa',
      weight: 2,
      fillColor: '#1d4ed8',
      fillOpacity: 0.05,
      dashArray: '6 5',
    }).addTo(map)

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
      <div className={isModalOpen ? 'blur-[1px]' : ''}>
        <NavigationBar
          onSignInClick={() => setActiveModal('sign-in')}
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

                <div className="mx-auto mt-6 grid max-w-4xl grid-cols-3 gap-2 sm:mt-8 sm:gap-3">
                  <button
                    className="inline-flex min-h-12 w-full items-center justify-center gap-2 whitespace-nowrap rounded-2xl bg-red-600 px-3 py-3 text-xs font-semibold text-white shadow-[0_0_24px_rgba(239,68,68,0.5)] transition duration-200 hover:bg-red-500 hover:shadow-[0_0_32px_rgba(248,113,113,0.6)] sm:min-h-14 sm:px-4 sm:py-3.5 sm:text-sm"
                    onClick={() => setActiveModal('sign-in')}
                    type="button"
                  >
                    Report Incident
                  </button>

                  <button
                    className="inline-flex min-h-12 w-full items-center justify-center gap-2 whitespace-nowrap rounded-2xl bg-blue-600 px-3 py-3 text-xs font-semibold text-white shadow-[0_0_24px_rgba(37,99,235,0.48)] transition duration-200 hover:bg-blue-500 hover:shadow-[0_0_32px_rgba(59,130,246,0.58)] sm:min-h-14 sm:px-4 sm:py-3.5 sm:text-sm"
                    onClick={() => setActiveModal('sign-in')}
                    type="button"
                  >
                    View Disaster Map
                  </button>

                  <button
                    className="inline-flex min-h-12 w-full items-center justify-center gap-2 whitespace-nowrap rounded-2xl border border-white/15 bg-slate-900/80 px-3 py-3 text-xs font-semibold text-slate-100 shadow-[0_0_18px_rgba(148,163,184,0.2)] transition duration-200 hover:bg-slate-800 hover:shadow-[0_0_24px_rgba(148,163,184,0.3)] sm:min-h-14 sm:px-4 sm:py-3.5 sm:text-sm"
                    onClick={() => setActiveModal('sign-in')}
                    type="button"
                  >
                    Start Simulation
                  </button>
                </div>
              </div>
            </section>
          </div>

          <section className="border-t border-cyan-300/10 bg-[#294468] px-6 py-10 sm:px-10 sm:py-12">
            <div className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-6 text-center md:grid-cols-4 md:gap-8">
              {systemStats.map((stat) => (
                <div key={stat.label}>
                  <p className="text-3xl font-black tracking-tight text-amber-300 sm:text-4xl">{stat.value}</p>
                  <p className="mt-1 text-xs font-medium text-slate-300 sm:mt-2 sm:text-base">{stat.label}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="border-t border-slate-200 bg-[radial-gradient(circle_at_top,#ffffff_0%,#f7faff_45%,#eef4ff_100%)] px-6 py-16 sm:px-10 sm:py-20">
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

          <section className="overflow-x-hidden border-t border-slate-200 bg-[radial-gradient(circle_at_top,#ffffff_0%,#f4f7fb_42%,#edf3fb_100%)] px-6 py-20 sm:px-10 sm:py-24">
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
                        <span
                          className={`inline-flex h-6 w-6 items-center justify-center rounded-full border border-white/70 text-[10px] font-black ring-2 transition duration-200 group-hover:scale-105 ${riskLevel.ringColor}`}
                        >
                          {riskLevel.icon}
                        </span>
                        <p className="min-w-0 text-xl font-bold leading-tight tracking-tight sm:text-2xl">{riskLevel.title}</p>
                      </div>
                    </div>

                    <p className="min-h-24 px-5 py-5 text-sm leading-relaxed text-slate-600 sm:text-base">{riskLevel.description}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className="border-t border-slate-200 bg-white px-6 pb-28 pt-20 sm:px-10 sm:pb-32 sm:pt-24">
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
                    className="group relative h-full overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50/80 p-6 shadow-[0_12px_28px_rgba(15,23,42,0.1)] transition duration-300 hover:-translate-y-1.5 hover:border-slate-300 hover:shadow-[0_22px_38px_rgba(15,23,42,0.16)]"
                    key={guide.title}
                  >
                    <div
                      className="pointer-events-none absolute inset-x-0 top-0 h-1 opacity-80"
                      style={{ background: `linear-gradient(90deg, ${guide.color}, transparent)` }}
                    />
                    <div className="flex flex-col items-start gap-3">
                      <span
                        className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 text-sm font-black transition duration-200 group-hover:scale-105"
                        style={{
                          color: guide.color,
                          boxShadow: `0 0 0 2px ${guide.color}1f, 0 0 16px ${guide.color}66`,
                        }}
                      >
                        {guide.badge}
                      </span>
                      <h4 className="text-2xl font-bold text-slate-900">{guide.title}</h4>
                    </div>

                    <ul className="mt-5 space-y-2.5">
                      {guide.tips.map((tip) => (
                        <li className="flex items-start gap-2.5 text-base text-slate-600" key={tip}>
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: guide.color }} />
                          <span>{tip}</span>
                        </li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className="border-t border-slate-200 bg-[linear-gradient(110deg,#0b1f3b,#163964_55%,#0b1f3b)] px-6 py-12 sm:px-10 sm:py-14">
            <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="inline-flex rounded-full border border-cyan-200/30 bg-cyan-300/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-cyan-100">
                  Emergency Contacts
                </p>
                <p className="mt-2 text-sm text-slate-200 sm:text-base">Lucena hotline banner for quick response access</p>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-center lg:gap-3">
                {emergencyHotlines.map((hotline) => (
                  <div
                    className="rounded-xl border border-white/20 bg-white/12 px-4 py-2 text-sm text-white shadow-[0_8px_18px_rgba(2,8,18,0.25)] backdrop-blur-sm transition duration-200 hover:border-cyan-200/40 hover:bg-white/18"
                    key={hotline.agency}
                  >
                    <span className="font-semibold text-cyan-100">{hotline.agency}:</span>{' '}
                    <span className="font-black tracking-wide">{hotline.number}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 bg-slate-900/25 backdrop-blur-[1px]" onClick={closeModal}>
          <div className="h-full overflow-auto">
            {activeModal === 'sign-in' ? (
              <LoginPage
                modalMode
                onAuthenticated={closeModal}
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
