import { describe, expect, it } from "vitest";
import { aplicarChamadaPendente, pertenceConta, recusarWorker } from "./offline-policy";

describe("abertura offline segura", () => {
  it("nunca registra na prévia, desenvolvimento, iframe ou com sw=off", () => {
    for (const host of ["id-preview--abc.lovable.app", "preview-2--abc.gpt-eng.com", "project--abc-dev.lovable.app", "abc.lovableproject-dev.com", "beta.lovable.dev"]) expect(recusarWorker(host, true, false, false)).toBe(true);
    expect(recusarWorker("arenaaquaticalf.lovable.app", false, false, false)).toBe(true);
    expect(recusarWorker("arenaaquaticalf.lovable.app", true, true, false)).toBe(true);
    expect(recusarWorker("arenaaquaticalf.lovable.app", true, false, true)).toBe(true);
    expect(recusarWorker("minha-previa.example.com", true, false, false, "minha-previa.example.com")).toBe(true);
  });
  it("permite a publicação e domínios próprios sem bloquear nomes semelhantes", () => {
    expect(recusarWorker("arenaaquaticalf.lovable.app", true, false, false)).toBe(false);
    expect(recusarWorker("preview-v2--shop.example.com", true, false, false)).toBe(false);
  });
  it("nunca mostra ou envia a fila de outra conta nem ações antigas sem dono", () => {
    expect(pertenceConta({ usuario_id: "rafael" }, "rafael")).toBe(true);
    expect(pertenceConta({ usuario_id: "rafael" }, "outra-conta")).toBe(false);
    expect(pertenceConta({}, "rafael")).toBe(false);
    expect(pertenceConta({ usuario_id: "rafael" }, null)).toBe(false);
  });
  it("restaura as chamadas pendentes após reabrir, sem incluir outros dias", () => {
    const resultado = aplicarChamadaPendente([], [
      { tipo: "presenca", aluno_id: "1", data: "2026-11-06", status: "presente", horario: "2026-11-06T22:00:00Z" },
      { tipo: "presenca", aluno_id: "2", data: "2026-11-05", status: "falta", horario: "2026-11-05T22:00:00Z" },
    ], "2026-11-06", { "1": "Aluno de teste" });
    expect(resultado.map((r) => [r.aluno_id, r.status, r.nome])).toEqual([["1", "presente", "Aluno de teste"]]);
  });
  it("a última ação prevalece, inclusive ao desfazer uma chamada offline", () => {
    const base = [{ aluno_id: "1", horario: "2026-11-06T20:00:00Z", status: "falta", observacoes: null, nome: "Teste" }];
    expect(aplicarChamadaPendente(base, [{ tipo: "presenca_remover", aluno_id: "1", data: "2026-11-06" }], "2026-11-06", {})).toEqual([]);
    const resultado = aplicarChamadaPendente(base, [{ tipo: "presenca", aluno_id: "1", data: "2026-11-06", status: "presente", horario: "2026-11-06T22:00:00Z" }], "2026-11-06", {});
    expect(resultado[0]?.status).toBe("presente");
  });
});