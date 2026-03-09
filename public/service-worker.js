// Self-destructing service worker v2
// Takes over from any stale SW, clears all caches, reloads tabs, then unregisters.

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

// While active, always go to network — never serve from cache
self.addEventListener('fetch', function (event) {
  event.respondWith(fetch(event.request))
})
