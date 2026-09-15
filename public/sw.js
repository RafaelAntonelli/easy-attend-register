const CACHE = "arena-aquatica-v6-abertura";
const RECURSOS_INICIAIS = [
  "/",
  "/manifest.webmanifest",
  "/favicon.png",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
  "/icons/apple-touch-icon.png",
  "/__l5e/assets-v1/a5d19cad-0c09-4153-ab96-9d4a730210b9/abertura-seculje-atual.png",
  "/__l5e/assets-v1/fc8e833a-0b40-4e95-90e7-3d2f13da9acd/abertura-esporte-360.png",
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(RECURSOS_INICIAIS).catch(() => undefined)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((chaves) => Promise.all(chaves.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.status === 200 && res.type === "basic") {
          const copia = res.clone();
          void caches.open(CACHE).then((c) => c.put(req, copia));
        }
        return res;
      })
      .catch(async () => {
        const cacheado = await caches.match(req);
        if (cacheado) return cacheado;
        if (req.mode === "navigate") {
          const inicial = await caches.match("/");
          if (inicial) return inicial;
        }
        return new Response("Offline", { status: 503, statusText: "Offline" });
      }),
  );
});
