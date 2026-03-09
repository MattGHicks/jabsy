// Self-destructing service worker
// Clears all caches left by old Vite/PWA builds, then unregisters itself.
// This takes control immediately so stale cached pages stop being served.

self.addEventListener('install', function () {
  self.skipWaiting()
})

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) { return caches.delete(key) }))
    }).then(function () {
      return self.registration.unregister()
    }).then(function () {
      return self.clients.matchAll()
    }).then(function (clients) {
      clients.forEach(function (client) { client.navigate(client.url) })
    })
  )
})
