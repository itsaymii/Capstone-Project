import { useEffect, useState } from 'react'
import { INSTALL_STATE_CHANGED, canShowInstallPrompt, isInstalledApp, isIosBrowser, showInstallPrompt } from '../pwa'

const DISMISSED_KEY = 'drms-install-card-dismissed'

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === '1'
  } catch {
    return false
  }
}

type InstallAppCardProps = {
  /** "card": dismissible card on the dashboard. "section": always shown, e.g. on the Profile page. */
  variant?: 'card' | 'section'
}

/** Offers to add the app to the home screen: the browser's prompt, or the steps on an iPhone. */
export function InstallAppCard({ variant = 'card' }: InstallAppCardProps) {
  const [canPrompt, setCanPrompt] = useState(canShowInstallPrompt)
  const [installed, setInstalled] = useState(isInstalledApp)
  const [dismissed, setDismissed] = useState(readDismissed)

  useEffect(() => {
    const refresh = () => {
      setCanPrompt(canShowInstallPrompt())
      setInstalled(isInstalledApp())
    }
    window.addEventListener(INSTALL_STATE_CHANGED, refresh)
    return () => window.removeEventListener(INSTALL_STATE_CHANGED, refresh)
  }, [])

  const ios = isIosBrowser()

  if (variant === 'card' && (installed || dismissed || (!canPrompt && !ios))) return null

  const dismiss = () => {
    setDismissed(true)
    try {
      localStorage.setItem(DISMISSED_KEY, '1')
    } catch {
      // The card simply shows again next time.
    }
  }

  const body = installed ? (
    <p className="text-sm text-slate-600">The app is installed on this phone.</p>
  ) : canPrompt ? (
    <>
      <p className="text-sm leading-relaxed text-slate-600">Open it from your home screen like any app, full screen and quicker to start.</p>
      <button
        type="button"
        onClick={() => void showInstallPrompt()}
        className="mt-3 w-full rounded-xl bg-blue-600 py-3 text-sm font-bold text-white shadow-sm hover:bg-blue-700"
      >
        Install app
      </button>
    </>
  ) : ios ? (
    <p className="text-sm leading-relaxed text-slate-600">
      In Safari, tap the <span className="font-semibold">Share</span> button, then <span className="font-semibold">Add to Home Screen</span>.
    </p>
  ) : (
    <p className="text-sm leading-relaxed text-slate-600">
      Open this page in Chrome on your phone, then choose <span className="font-semibold">Install app</span> or{' '}
      <span className="font-semibold">Add to Home screen</span> from the menu.
    </p>
  )

  return (
    <section className="relative rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" aria-labelledby={`install-app-${variant}`}>
      <div className="flex items-start gap-3">
        <img src="/icons/pwa-192x192.png" alt="" className="h-11 w-11 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          <h2 id={`install-app-${variant}`} className="text-sm font-black text-slate-900">
            {variant === 'card' ? 'Install the app on this phone' : 'App'}
          </h2>
          <div className="mt-1">{body}</div>
        </div>
        {variant === 'card' ? (
          <button type="button" onClick={dismiss} aria-label="Hide" className="-mr-1 -mt-1 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        ) : null}
      </div>
    </section>
  )
}
