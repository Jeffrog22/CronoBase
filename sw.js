// Service worker do CronoBase — cache offline dos assets locais.
// Regra importante: NUNCA ativa uma nova versão sozinho (sem skipWaiting
// automático). A ativação só acontece quando a página pede, e a página só
// pede quando não há sessão em andamento (ou o usuário confirma o risco).

const VERSION = "cronobase-v4";
const CORE = [
  "./",
  "./index.html",
  "./styles/tokens.css",
  "./styles/app.css",
  "./js/state.js",
  "./js/clock.js",
  "./js/modo2.js",
  "./js/store.js",
  "./js/xlsx.js",
  "./js/themes.js",
  "./js/wake.js",
  "./js/gamepad.js",
  "./js/ui.js",
  "./js/main.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-192.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(CORE)).catch((err) => {
      console.warn("CronoBase SW: cache parcial.", err);
    })
  );
  // Sem skipWaiting automático: atualização só sob pedido da página.
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(VERSION);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw err;
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  if (new URL(request.url).origin !== self.location.origin) return;

  // Tudo same-origin: rede primeiro (sempre código atual quando online),
  // cache como fallback offline. Evita cache híbrido HTML novo + JS/CSS velho.
  event.respondWith(networkFirst(request));
});
