/*
 * Service worker for the installed app (PWA).
 *
 * - Pages: from the network first; with no connection, the saved app is shown so it still opens.
 * - App files (JS, CSS, icons, maps): saved on the phone and refreshed in the background.
 * - Server data (/api, /accounts, /dashboard, /media, /admin): never saved here, always live.
 *
 * Registered only in a production build (src/main.tsx), so `npm run dev` is not affected.
 * Change CACHE_VERSION to drop everything saved by an older version.
 */
const CACHE_VERSION = 'v1'
const CACHE_NAME = `disaster-vision-${CACHE_VERSION}`
const APP_SHELL = '/index.html'

const PRECACHE = [
  '/',
  '/manifest.webmanifest',
  '/icons/icon.svg',
  '/icons/pwa-192x192.png',
  '/icons/pwa-512x512.png',
  '/icons/favicon-32x32.png',
  '/lucena_barangays.geojson',
]

const SERVER_PATHS = /^\/(api|accounts|dashboard|media|admin)\//

// The built index.html lists the app's JS and CSS files; save them too so the first offline
// opening works even if those files were loaded before this worker was installed.
async function precacheAppFiles(cache) {
  const response = await fetch('/', { cache: 'no-store' })
  if (!response.ok) return
  const html = await response.clone().text()
  await cache.put(APP_SHELL, response)
  const files = Array.from(html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g), (match) => match[1])
  await cache.addAll(Array.from(new Set(files)))
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME)
      await Promise.allSettled(PRECACHE.map((url) => cache.add(url)))
      await precacheAppFiles(cache).catch(() => {})
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys()
      await Promise.all(names.filter((name) => name.startsWith('disaster-vision-') && name !== CACHE_NAME).map((name) => caches.delete(name)))
      await self.clients.claim()
    })(),
  )
})

async function pageFromNetworkFirst(request) {
  const cache = await caches.open(CACHE_NAME)
  try {
    const response = await fetch(request)
    if (response.ok) await cache.put(APP_SHELL, response.clone())
    return response
  } catch {
    // Offline: every page is the same single-page app.
    return (await cache.match(APP_SHELL)) || (await cache.match('/')) || Response.error()
  }
}

async function fileFromCacheThenRefresh(request, event) {
  const cache = await caches.open(CACHE_NAME)
  const cached = await cache.match(request)
  const refresh = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone())
      return response
    })
    .catch(() => undefined)

  if (cached) {
    event.waitUntil(refresh)
    return cached
  }
  return (await refresh) || Response.error()
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return // map tiles, the API on port 8000, etc.
  if (SERVER_PATHS.test(url.pathname)) return // live server data is never saved

  if (request.mode === 'navigate') {
    event.respondWith(pageFromNetworkFirst(request))
    return
  }

  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/') || /\.(geojson|webmanifest|svg|png|woff2?)$/.test(url.pathname)) {
    event.respondWith(fileFromCacheThenRefresh(request, event))
  }
})
