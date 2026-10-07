import { describe, expect, it } from "vitest";
import { linkConversaWhatsApp } from "./whatsapp";

describe("linkConversaWhatsApp", () => {
  it("usa o celular cadastrado com o código do Brasil", () => {
    expect(linkConversaWhatsApp("(71) 99999-1234")).toBe("https://wa.me/5571999991234");
  });
  it("não duplica o código do Brasil", () => {
    expect(linkConversaWhatsApp("+55 (71) 99999-1234")).toBe("https://wa.me/5571999991234");
  });
  it("preserva um DDD 55", () => {
    expect(linkConversaWhatsApp("(55) 99999-1234")).toBe("https://wa.me/5555999991234");
  });
  it("não cria conversa sem um celular completo", () => {
    for (const telefone of [null, "", "(71) 99999", "(00) 99999-1234", "(71) 3333-1234"]) {
      expect(linkConversaWhatsApp(telefone)).toBeNull();
    }
  });
});