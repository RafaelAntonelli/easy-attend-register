import { describe, expect, it } from "vitest";
import { gerarQrAparelho, lerQrAparelho } from "./aparelho-qr";

describe("QR de liberação presencial", () => {
  it("transporta somente o código público do aparelho de 12 caracteres", () => {
    expect(gerarQrAparelho("08EBC1AF8C38")).toBe("arena:liberar-aparelho:v1:08EBC1AF8C38");
    expect(lerQrAparelho(gerarQrAparelho("08EBC1AF8C38"))).toBe("08EBC1AF8C38");
  });
  it("não confunde crachá de matrícula com autorização de aparelho", () => {
    expect(lerQrAparelho("M8E2C6Y")).toBeNull();
    expect(lerQrAparelho("08EBC1AF8C38")).toBeNull();
  });
  it("rejeita QR estranho ou código com tamanho e caracteres inválidos", () => {
    expect(lerQrAparelho("https://example.com/08EBC1AF8C38")).toBeNull();
    expect(lerQrAparelho("arena:liberar-aparelho:v1:08EBC1AF8C38extra")).toBeNull();
    expect(() => gerarQrAparelho("G8EBC1AF8C38")).toThrow();
  });
});