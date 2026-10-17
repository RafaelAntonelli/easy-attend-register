import { describe, expect, it } from "vitest";
import { camposFichaRevisados, capacidadeAgregada, validarMapaIA } from "./ai-contract";
import { linkConversaWhatsApp } from "./whatsapp";

describe("propostas de IA", () => {
  it("não preenche campos ausentes ou incertos da ficha", () => {
    expect(camposFichaRevisados([{ campo: "nome", valor: " Ana " }, { campo: "cpf", valor: null }])).toEqual({ nome: "Ana" });
  });
  it("aceita somente colunas reais e uma origem por destino", () => {
    expect(validarMapaIA([{ destino: "Nome", origem: "Participante" }, { destino: "CPF", origem: "Inexistente" }, { destino: "RG", origem: "Participante" }], ["Participante"], ["Nome", "CPF", "RG"])).toEqual({ Nome: "Participante" });
  });
  it("conta matrículas uma vez e mantém a vaga de quem está em licença", () => {
    const [t] = capacidadeAgregada([{ id: "t", nome: "Natação", modalidade: "Natação", horario: "14:00", capacidade: 40, dias_semana: ["Ter", "Qui"] }], [{ aluno_id: "licenciado", turma_id: "t" }, { aluno_id: "licenciado", turma_id: "t" }]);
    expect(t?.matriculados).toBe(1); expect(t?.vagas_livres).toBe(39); expect(t?.ocupacao_percentual).toBe(2.5);
    expect(JSON.stringify(t)).not.toContain("licenciado");
  });
  it("inclui apenas o rascunho revisado no link do WhatsApp", () => {
    expect(linkConversaWhatsApp("(71) 99999-1234", "Olá! Documentos & retorno")).toBe("https://wa.me/5571999991234?text=Ol%C3%A1!%20Documentos%20%26%20retorno");
  });
});