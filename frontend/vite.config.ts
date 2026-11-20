import { defineConfig } from 'vite'
import type { ProxyOptions } from 'vite'
import react from '@vitejs/plugin-react'

// Django runs here on the laptop. When the app is opened from a phone (the laptop's IP or an
// HTTPS tunnel), API calls go to this same server and are passed on to Django, so a phone only
// needs one address. See src/services/api.ts (getApiBaseUrl).
const DJANGO_URL = process.env.DJANGO_URL || 'http://127.0.0.1:8000'

const backendProxy: Record<string, ProxyOptions> = {
  '^/(api|accounts|dashboard|media|admin)/': {
    target: DJANGO_URL,
    changeOrigin: true,
    // Django checks that POST requests come from a trusted address. The request is passed on by
    // this server, so it is sent with Django's own address (the phone's address changes per Wi-Fi
    // or tunnel and would otherwise have to be added to FRONTEND_ORIGINS each time).
    configure: (proxy) => {
      proxy.on('proxyReq', (proxyRequest) => {
        if (proxyRequest.getHeader('origin')) proxyRequest.setHeader('origin', DJANGO_URL)
      })
    },
  },
}

// Tunnel addresses used to open the app on a phone over HTTPS (needed for install and GPS).
const tunnelHosts = ['.trycloudflare.com', '.ngrok-free.app', '.ngrok.app', '.loca.lt']

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    allowedHosts: tunnelHosts,
    proxy: backendProxy,
  },
  preview: {
    host: true,
    allowedHosts: tunnelHosts,
    proxy: backendProxy,
  },
})
