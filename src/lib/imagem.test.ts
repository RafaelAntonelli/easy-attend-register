import { describe, expect, it } from "vitest";
import { dimensoesReduzidas, imagemComprimivel } from "./imagem";

describe("otimização de imagens", () => {
  it("limita o lado maior a 1600 px mantendo a proporção", () => {
    expect(dimensoesReduzidas(4000, 3000)).toEqual({ largura: 1600, altura: 1200 });
    expect(dimensoesReduzidas(3000, 4000)).toEqual({ largura: 1200, altura: 1600 });
  });

  it("não aumenta imagens pequenas", () => {
    expect(dimensoesReduzidas(800, 600)).toEqual({ largura: 800, altura: 600 });
  });

  it("não mexe em PDF", () => {
    expect(imagemComprimivel("application/pdf")).toBe(false);
    expect(imagemComprimivel("image/jpeg")).toBe(true);
  });
});
