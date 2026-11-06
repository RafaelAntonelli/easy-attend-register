import { PAGINAS_OFFLINE, recusarWorker } from "./offline-policy";

/** The only app-shell registrar; Firebase has its own separate scope. */
export async function prepararAberturaOffline() {
  if (!("serviceWorker" in navigator)) return;
  const recusado = recusarWorker(window.location.hostname, import.meta.env.PROD, window.self !== window.top, new URLSearchParams(window.location.search).get("sw") === "off");
  if (recusado) {
    const registros = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registros.filter((r) => [r.active, r.installing, r.waiting].some((w) => w && new URL(w.scriptURL).pathname === "/sw.js")).map((r) => r.unregister()));
    return;
  }
  const { registerSW } = await import("virtual:pwa-register");
  registerSW({ immediate: true, onRegisteredSW: () => {
    const aquecer = async () => {
      if (!navigator.onLine || !navigator.serviceWorker.controller) return;
      await Promise.all(PAGINAS_OFFLINE.map((path) => fetch(path, { headers: { "X-Arena-Offline-Shell": "1" }, credentials: "omit" }).catch(() => undefined)));
    };
    navigator.serviceWorker.addEventListener("controllerchange", () => void aquecer());
    window.addEventListener("online", () => void aquecer());
    void aquecer();
  }});
}