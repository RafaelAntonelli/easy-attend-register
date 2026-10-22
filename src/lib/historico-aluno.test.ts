import { describe, expect, it } from "vitest";
import { descreverAlteracao, formatarValorHistorico } from "./historico-aluno";

describe("histórico da ficha do aluno", () => {
  it("mostra o valor antes e depois da alteração", () => {
    expect(descreverAlteracao({ campo: "telefone", antes: null, depois: "71999990000" })).toBe("Telefone: vazio → 71999990000");
  });
  it("mostra datas no formato brasileiro", () => {
    expect(descreverAlteracao({ campo: "atestado_data", antes: "2025-01-10", depois: "2026-01-10" })).toBe("Data do atestado: 10/01/2025 → 10/01/2026");
  });
  it("descreve entrada e saída de turma", () => {
    expect(descreverAlteracao({ campo: "turma", antes: null, depois: "TQ 08:00" })).toBe("Matriculado na turma TQ 08:00");
    expect(descreverAlteracao({ campo: "turma", antes: "TQ 08:00", depois: null })).toBe("Saiu da turma TQ 08:00");
  });
  it("mostra a situação como Ativo/Inativo", () => {
    expect(formatarValorHistorico("ativo", false)).toBe("Inativo");
    expect(formatarValorHistorico("pcd", true)).toBe("Sim");
  });
});
