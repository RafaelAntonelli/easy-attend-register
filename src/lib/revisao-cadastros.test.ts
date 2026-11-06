import { describe, expect, it } from "vitest";
import { revisarCadastros } from "./revisao-cadastros";

const completo = { id: "1", nome: "Ana Silva", data_nascimento: "2000-01-01", telefone: "71999999999", doc_atestado_path: "a", doc_residencia_path: "r", doc_identidade_path: "i", doc_ficha_path: "f" };
describe("revisão de cadastros", () => {
  it("identifica contato ausente, mas aceita telefone secundário ou email", () => {
    expect(revisarCadastros([{ ...completo, telefone: "" }])[0]?.motivos).toContain("Contato ausente");
    expect(revisarCadastros([{ ...completo, telefone: "", email: "ana@example.org" }])).toEqual([]);
    expect(revisarCadastros([{ ...completo, telefone: "", telefone2: "71999999999" }])).toEqual([]);
  });
  it("identifica documentos não anexados sem exigir matrícula escolar de quem não tem escola", () => {
    expect(revisarCadastros([completo])).toEqual([]);
    expect(revisarCadastros([{ ...completo, escola: "Escola A" }])[0]?.documentos).toEqual(["Comprovante de matrícula escolar"]);
  });
  it("identifica nascimento ausente", () => {
    expect(revisarCadastros([{ ...completo, data_nascimento: null }])[0]?.motivos).toContain("Nascimento ausente");
  });
  it("sinaliza mesmo nome e nascimento, nunca CPF ou telefone compartilhado", () => {
    expect(revisarCadastros([completo, { ...completo, id: "2", nome: " ana silva " }]).every((item) => item.motivos.includes("Possível duplicidade"))).toBe(true);
    expect(revisarCadastros([completo, { ...completo, id: "2", nome: "Bia Silva" }])).toEqual([]);
  });
});