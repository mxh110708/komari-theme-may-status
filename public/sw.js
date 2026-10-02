// Replace a previously installed Komari PWA worker with a network-only worker.
// No fetch handler is registered: /admin and all other paths use the server.
globalThis.addEventListener('install', () => {
  globalThis.skipWaiting()
})

globalThis.addEventListener('activate', (event) => {
  event.waitUntil(globalThis.clients.claim())
})
