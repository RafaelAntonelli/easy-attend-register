import { describe, expect, it } from "vitest";
import { descreverUltimoAcesso } from "./ultimo-acesso";

const agora = new Date(2026, 9, 22, 17, 0);

describe("último acesso na Equipe", () => {
  it("destaca quem nunca entrou", () => {
    expect(descreverUltimoAcesso(null, agora)).toEqual({ texto: "nunca entrou", alerta: true });
  });
  it("destaca quem está há mais de 30 dias sem entrar", () => {
    expect(descreverUltimoAcesso(new Date(2026, 8, 21, 10).toISOString(), agora).alerta).toBe(true);
    expect(descreverUltimoAcesso(new Date(2026, 8, 22, 10).toISOString(), agora).alerta).toBe(false);
  });
  it("mostra hoje e ontem de forma simples", () => {
    expect(descreverUltimoAcesso(new Date(2026, 9, 22, 8, 5).toISOString(), agora).texto).toBe("hoje às 08:05");
    expect(descreverUltimoAcesso(new Date(2026, 9, 21, 8, 5).toISOString(), agora).texto).toBe("ontem às 08:05");
  });
});
