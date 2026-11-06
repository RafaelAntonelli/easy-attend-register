import { describe, expect, it } from "vitest";
import { limitesMes, resumirMes } from "./relatorio-mensal";

describe("relatório mensal", () => {
  const registros = [
    { aluno_id: "a", turma_id: "t1", data: "2026-11-01", status: "presente" },
    { aluno_id: "a", turma_id: "t2", data: "2026-11-01", status: "falta" },
    { aluno_id: "b", turma_id: "t1", data: "2026-11-30", status: "falta_justificada" },
    { aluno_id: "b", turma_id: "t1", data: "2026-12-01", status: "presente" },
    { aluno_id: "b", turma_id: "t1", data: "2026-10-31", status: "falta" },
  ];
  it("limita o período ao mês escolhido e trata a virada do ano", () => {
    expect(limitesMes("2026-12")).toEqual({ inicio: "2026-12-01", fim: "2027-01-01" });
    expect(resumirMes(registros, "2026-11").total).toBe(3);
  });
  it("conta alunos uma vez e cada marcação na sua categoria", () => {
    expect(resumirMes(registros, "2026-11")).toEqual({ presentes: 1, faltas: 1, justificadas: 1, total: 3, alunos: 2, frequencia: 33.3 });
  });
  it("aplica a turma tanto aos totais quanto à frequência", () => {
    expect(resumirMes(registros, "2026-11", "t1")).toEqual({ presentes: 1, faltas: 0, justificadas: 1, total: 2, alunos: 2, frequencia: 50 });
  });
});