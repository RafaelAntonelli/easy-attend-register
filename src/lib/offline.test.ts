import { describe, expect, it } from "vitest";
import { instanteUtc, ordenarFila } from "./offline";

describe("fila offline", () => {
  it("envia na ordem exata: instante UTC e, empatado, a sequência do aparelho", () => {
    const fila = ordenarFila([
      { id: "c", criado_em: 2000, seq: 3 },
      { id: "b", criado_em: 1000, seq: 2 },
      { id: "a", criado_em: 1000, seq: 1 },
    ]);
    expect(fila.map((f) => f.id)).toEqual(["a", "b", "c"]);
  });

  it("usa carimbo UTC em ISO 8601", () => {
    expect(instanteUtc({ criado_em: Date.UTC(2026, 9, 20, 19, 34) })).toBe("2026-10-20T19:34:00.000Z");
  });
});
