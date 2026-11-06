// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { workerRuntimeUrlGuard } from "./src/lib/worker-runtime";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [workerRuntimeUrlGuard(), VitePWA({
    strategies: "generateSW",
    filename: "sw.js",
    outDir: "dist/client",
    manifest: false,
    registerType: "autoUpdate",
    injectRegister: null,
    devOptions: { enabled: false },
    integration: { closeBundleOrder: "post" },
    includeAssets: ["favicon.png", "icons/*.png"],
    workbox: {
      globDirectory: "dist/client",
      globPatterns: ["assets/**/*.{js,css,png,jpg,jpeg,webp,svg,woff2}"],
      maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
      navigateFallback: null,
      clientsClaim: true,
      cleanupOutdatedCaches: true,
      runtimeCaching: [{
        // These routes SSR only public loading shells; private routes and RPCs stay network-only.
        urlPattern: ({ request, url, sameOrigin }) => sameOrigin && !url.search && ["/", "/auth", "/alunos", "/presenca"].includes(url.pathname) && (request.mode === "navigate" || request.headers.get("X-Arena-Offline-Shell") === "1"),
        handler: "NetworkFirst",
        options: { cacheName: "arena-shell-v1", networkTimeoutSeconds: 3, cacheableResponse: { statuses: [200] }, expiration: { maxEntries: 4, maxAgeSeconds: 7 * 24 * 60 * 60 } },
      }, {
        urlPattern: ({ url, sameOrigin }) => sameOrigin && /^\/assets\/.+-[\w-]{8,}\.(js|css|png|jpg|jpeg|webp|svg|woff2)$/.test(url.pathname),
        handler: "CacheFirst",
        options: { cacheName: "arena-assets-v1", cacheableResponse: { statuses: [200] }, expiration: { maxEntries: 150, maxAgeSeconds: 30 * 24 * 60 * 60 } },
      }],
    },
  })],
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
