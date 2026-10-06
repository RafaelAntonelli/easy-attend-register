import { afterEach, describe, expect, it, vi } from "vitest";
import { notificarAtestadoVencido, notificarAtestadoVencendo } from "./atestado";

afterEach(() => vi.useRealTimers());

describe("notificações de atestado vencido", () => {
  it("remove o aluno da notificação após ser inativado", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-06T12:00:00"));
    const aluno = { ativo: true, atestado_entregue: true, atestado_data: "2024-01-01" };
    expect(notificarAtestadoVencido(aluno)).toBe(true);
    expect(notificarAtestadoVencido({ ...aluno, ativo: false })).toBe(false);
  });
});

describe("notificações de atestado vencendo", () => {
  it("remove o aluno da notificação após ser inativado", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-06T12:00:00"));
    const aluno = { ativo: true, atestado_entregue: true, atestado_data: "2025-10-20" };
    expect(notificarAtestadoVencendo(aluno, 30)).toBe(true);
    expect(notificarAtestadoVencendo({ ...aluno, ativo: false }, 30)).toBe(false);
  });
});