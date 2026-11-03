import { describe, expect, it } from "vitest";
import { diasSemAulaNaData, proximosDiasSemAula, turmaSemAula, type DiaSemAula } from "./dias-sem-aula";

const feriado: DiaSemAula = { id: "1", data: "2026-11-15", turma_id: null, motivo: "Feriado", criado_por_nome: null };
const cancelada: DiaSemAula = { id: "2", data: "2026-11-10", turma_id: "turma-a", motivo: "Piscina em manutenção", criado_por_nome: null };

describe("dias sem aula", () => {
  it("dia de todas as turmas vale para qualquer turma", () => {
    expect(turmaSemAula([feriado], "2026-11-15", "turma-a")).toBe(true);
    expect(turmaSemAula([feriado], "2026-11-15", "turma-b")).toBe(true);
    expect(turmaSemAula([feriado], "2026-11-16", "turma-a")).toBe(false);
  });

  it("aula cancelada de uma turma não afeta as outras", () => {
    expect(turmaSemAula([cancelada], "2026-11-10", "turma-a")).toBe(true);
    expect(turmaSemAula([cancelada], "2026-11-10", "turma-b")).toBe(false);
  });

  it("na Presença, com turmas escolhidas, mostra só os que valem para elas", () => {
    expect(diasSemAulaNaData([cancelada], "2026-11-10", ["turma-b"])).toEqual([]);
    expect(diasSemAulaNaData([cancelada], "2026-11-10", ["turma-a"])).toEqual([cancelada]);
    expect(diasSemAulaNaData([cancelada], "2026-11-10")).toEqual([cancelada]);
  });

  it("lista os próximos a partir de hoje, em ordem", () => {
    expect(proximosDiasSemAula([feriado, cancelada], "2026-11-11")).toEqual([feriado]);
    expect(proximosDiasSemAula([feriado, cancelada], "2026-11-01").map((d) => d.id)).toEqual(["2", "1"]);
  });
});
