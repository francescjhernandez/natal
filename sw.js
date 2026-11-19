/* Service Worker — Informador de Caicó (PWA offline) */
const CACHE = "caico-v1";
const ESTÀTICS = [
  "./", "./index.html", "./styles.css", "./app.js", "./manifest.json",
  "./iconos/icon-192.png", "./iconos/icon-512.png", "./iconos/icon-maskable-512.png",
  "./iconos/apple-touch-icon.png", "./iconos/favicon-48.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ESTÀTICS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then(claus => Promise.all(claus.filter(c => c !== CACHE).map(c => caches.delete(c))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  // As APIs (Worker Cloudflare) sempre vão por rede
  if (e.request.method !== "GET" || url.pathname.startsWith("/api/")) return;
  // HTML: rede primeiro, cache de reserva
  if (e.request.mode === "navigate"){
    e.respondWith(fetch(e.request).catch(() => caches.match("./index.html")));
    return;
  }
  // Resto (JS/CSS/imagens): rede primeiro, cache só sem conexão
  e.respondWith(
    fetch(e.request).then(r => {
      if (r.ok){ const copia = r.clone(); caches.open(CACHE).then(cache => cache.put(e.request, copia)); }
      return r;
    }).catch(() => caches.match(e.request))
  );
});
