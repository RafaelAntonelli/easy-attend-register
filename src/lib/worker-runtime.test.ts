import { describe, expect, it } from "vitest";
import { guardWorkerRuntimeUrl } from "../../build/worker-runtime";

describe("Worker runtime URL guard", () => {
  const source = "return createRequire(import.meta.url);";
  const evaluate = (url: string | undefined) => {
    const code = guardWorkerRuntimeUrl(source).replaceAll("import.meta.url", "url");
    return new Function("createRequire", "url", code)((path: unknown) => {
      if (typeof path !== "string") throw new TypeError("Invalid module path");
      return path;
    }, url);
  };

  it("provides a valid file URL when dynamic Worker imports have no URL", () => {
    expect(evaluate(undefined)).toBe("file:///");
  });

  it("preserves a real module URL when available", () => {
    expect(evaluate("file:///app/_runtime.mjs")).toBe("file:///app/_runtime.mjs");
  });

  it("also guards the minified generated runtime", () => {
    expect(guardWorkerRuntimeUrl("const r=c(import.meta.url);")).toBe('const r=c((import.meta.url || "file:///"));');
  });
});