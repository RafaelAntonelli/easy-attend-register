import { describe, expect, it } from "vitest";
import { dataInicialPresenca } from "./data-presenca";

describe("data inicial da Presença", () => {
  const agora = new Date(2026, 9, 23, 9, 0);

  it("ao abrir o aplicativo (sem data escolhida) usa o dia atual", () => {
    expect(dataInicialPresenca(null, agora)).toBe("2026-10-23");
  });

  it("mantém a data escolhida hoje ao trocar de tela", () => {
    expect(dataInicialPresenca({ data: "2026-10-20", escolhidaEm: "2026-10-23" }, agora)).toBe("2026-10-20");
  });

  it("volta para o dia atual se a data foi escolhida em outro dia", () => {
    expect(dataInicialPresenca({ data: "2026-10-20", escolhidaEm: "2026-10-22" }, agora)).toBe("2026-10-23");
  });
});
