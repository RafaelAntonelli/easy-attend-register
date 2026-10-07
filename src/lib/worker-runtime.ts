import type { Plugin } from "vite";

/** Dynamic Worker modules do not provide a filesystem-backed import.meta.url. */
export function guardWorkerRuntimeUrl(code: string): string {
  return code.replace(/\bimport\.meta\.url\b/g, '(import.meta.url || "file:///")');
}

export function workerRuntimeUrlGuard(): Plugin {
  return {
    name: "arena:worker-runtime-url-guard",
    apply: "build",
    enforce: "post",
    applyToEnvironment: (environment) => environment.name !== "client",
    generateBundle(_options, bundle) {
      for (const entry of Object.values(bundle)) {
        if (entry.type !== "chunk" || !entry.fileName.endsWith("_runtime.mjs")) continue;
        // Apply after bundling: Rolldown's generated require helper is not source code.
        entry.code = guardWorkerRuntimeUrl(entry.code);
      }
    },
  };
}