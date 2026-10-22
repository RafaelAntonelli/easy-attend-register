import { describe, expect, it } from "vitest";
import { isoParaNascimento, mascararNascimento, validarNascimento } from "./data-nascimento";

const hoje = new Date(2026, 9, 22);

describe("data de nascimento no login do aluno", () => {
  it("coloca as barras enquanto digita", () => {
    expect(mascararNascimento("15111990")).toBe("15/11/1990");
    expect(mascararNascimento("151")).toBe("15/1");
  });
  it("aceita dd/mm/aaaa e converte para o formato do sistema", () => {
    expect(validarNascimento("15/11/1990", hoje)).toEqual({ ok: true, iso: "1990-11-15" });
  });
  it("avisa quando o ano tem menos de 4 dígitos", () => {
    const r = validarNascimento("15/11/90", hoje);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toContain("incompleta");
  });
  it("recusa mês 13 e 31 de fevereiro com mensagem específica", () => {
    const mes = validarNascimento("15/13/1990", hoje);
    const dia = validarNascimento("31/02/1990", hoje);
    expect(mes.ok || dia.ok).toBe(false);
    if (!mes.ok) expect(mes.erro).toContain("mês");
    if (!dia.ok) expect(dia.erro).toContain("dia");
  });
  it("recusa data depois de hoje", () => {
    expect(validarNascimento("23/10/2026", hoje).ok).toBe(false);
    expect(validarNascimento("22/10/2026", hoje).ok).toBe(true);
  });
  it("converte login salvo no formato antigo", () => {
    expect(isoParaNascimento("1990-11-15")).toBe("15/11/1990");
  });
});
