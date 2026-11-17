import { describe, expect, it } from "vitest";
import { proximaAula } from "./proxima-aula";

const turmas = [
  { id: "a", nome: "Natação", horario: "18:00 às 18:50", dias_semana: ["Ter", "Qui"] },
  { id: "b", nome: "Hidro", horario: "07:00 às 07:50", dias_semana: ["Qua", "Sex"] },
];
// 17/11/2026 é terça-feira.
const brt = (h: string, dia = "17") => new Date(`2026-11-${dia}T${h}:00-03:00`);

describe("proximaAula", () => {
  it("aula de hoje ainda não terminou", () => {
    const r = proximaAula(turmas, brt("10:00"))!;
    expect([r.turma.id, r.diasAte, r.inicio]).toEqual(["a", 0, "18:00"]);
  });
  it("durante a aula ela continua sendo a próxima", () => {
    expect(proximaAula(turmas, brt("18:30"))!.diasAte).toBe(0);
  });
  it("depois da aula de terça passa para quarta 7h", () => {
    const r = proximaAula(turmas, brt("19:00"))!;
    expect([r.turma.id, r.diasAte]).toEqual(["b", 1]);
  });
  it("sem horário retorna nada", () => {
    expect(proximaAula([{ id: "x", nome: "x", horario: null, dias_semana: ["Seg"] }])).toBeNull();
  });
});
