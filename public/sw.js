function cacheDoApp(nome) {
  return nome.startsWith("arena-aquatica-");
}

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) =>
  event.waitUntil(
    (async () => {
      try {
        const nomes = await caches.keys();
        await Promise.allSettled(nomes.filter(cacheDoApp).map((nome) => caches.delete(nome)));
        await self.clients.claim();
        const paginas = await self.clients.matchAll({ type: "window" });
        await Promise.allSettled(paginas.map((pagina) => pagina.navigate(pagina.url)));
      } finally {
        await self.registration.unregister();
      }
    })(),
  ),
);
