// Installed-app (PWA) helpers: the service worker and the "Install app" prompt.

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export const INSTALL_STATE_CHANGED = 'pwa-install-state-changed'

let installPrompt: InstallPromptEvent | null = null

/** True when the app runs from the home screen, not in a browser tab. */
export function isInstalledApp(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

/** iPhone and iPad Safari have no install prompt; the app is added from the Share menu. */
export function isIosBrowser(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !isInstalledApp()
}

/** Chrome, Edge and Android offer an install prompt that the app can show from a button. */
export function canShowInstallPrompt(): boolean {
  return installPrompt !== null && !isInstalledApp()
}

export async function showInstallPrompt(): Promise<boolean> {
  if (!installPrompt) return false
  const prompt = installPrompt
  installPrompt = null
  await prompt.prompt()
  const { outcome } = await prompt.userChoice
  window.dispatchEvent(new Event(INSTALL_STATE_CHANGED))
  return outcome === 'accepted'
}

/** Call once at start-up, before React renders: the browser fires the prompt event early. */
export function setUpInstalledApp(): void {
  if (typeof window === 'undefined') return

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    installPrompt = event as InstallPromptEvent
    window.dispatchEvent(new Event(INSTALL_STATE_CHANGED))
  })

  window.addEventListener('appinstalled', () => {
    installPrompt = null
    window.dispatchEvent(new Event(INSTALL_STATE_CHANGED))
  })

  // Only a production build registers the worker, so `npm run dev` always shows fresh code.
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch((error) => {
        console.warn('[pwa] Service worker was not registered:', error)
      })
    })
  }
}
