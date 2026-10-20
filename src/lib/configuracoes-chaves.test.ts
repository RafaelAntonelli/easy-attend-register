import { describe, expect, it } from "vitest";
import { validadeLinksHoras } from "./configuracoes-chaves";

describe("validade dos links temporários", () => {
  it("usa 24 horas quando não configurado", () => {
    expect(validadeLinksHoras(null)).toBe(24);
    expect(validadeLinksHoras("")).toBe(24);
  });

  it("respeita o valor configurado", () => {
    expect(validadeLinksHoras("6")).toBe(6);
  });

  it("nunca passa de 72 horas", () => {
    expect(validadeLinksHoras("87600")).toBe(72);
  });
});
