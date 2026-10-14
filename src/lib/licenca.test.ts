import { describe, expect, it } from "vitest";
import { licencaEmVigor, retornoPendente, type Licenca } from "./licenca";

const base: Licenca = { id: "1", aluno_id: "a", data_inicio: "2026-10-01", data_retorno: "2026-11-01", motivo: null, encerrada_em: null };

describe("licença médica", () => {
  it("vigora entre o início e a véspera do retorno", () => {
    expect(licencaEmVigor(base, "2026-10-01")).toBe(true);
    expect(licencaEmVigor(base, "2026-10-31")).toBe(true);
    expect(licencaEmVigor(base, "2026-11-01")).toBe(false);
    expect(licencaEmVigor(base, "2026-09-30")).toBe(false);
  });
  it("licença encerrada não vigora nem avisa retorno", () => {
    const enc = { ...base, encerrada_em: "2026-10-10T10:00:00Z" };
    expect(licencaEmVigor(enc, "2026-10-15")).toBe(false);
    expect(retornoPendente(enc, "2026-11-05")).toBe(false);
  });
  it("avisa retorno a partir da data prevista", () => {
    expect(retornoPendente(base, "2026-10-31")).toBe(false);
    expect(retornoPendente(base, "2026-11-01")).toBe(true);
  });
});
