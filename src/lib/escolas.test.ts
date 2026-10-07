import { describe, expect, it } from "vitest";
import { escolasDaRede } from "./escolas";

describe("escolas por rede de ensino", () => {
  it("oferece as 44 escolas públicas informadas sem escolas privadas", () => {
    const escolas = escolasDaRede("Pública");
    expect(escolas).toHaveLength(44);
    expect(new Set(escolas).size).toBe(44);
    expect(escolas).toContain("Colégio Estadual Bartolomeu de Gusmão");
    expect(escolas).toContain("Centro Estadual de Educação Profissional em Tecnologia, Informação e Comunicação de Lauro de Freitas");
    expect(escolas).not.toContain("Colégio Perfil");
  });

  it("oferece as 26 escolas privadas informadas sem escolas públicas", () => {
    const escolas = escolasDaRede("Privada");
    expect(escolas).toHaveLength(26);
    expect(new Set(escolas).size).toBe(26);
    expect(escolas).toContain("Colégio Perfil");
    expect(escolas).toContain("Escola Brazílio");
    expect(escolas).not.toContain("Colégio Estadual Bartolomeu de Gusmão");
  });
});