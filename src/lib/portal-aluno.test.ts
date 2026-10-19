import { describe, expect, it } from "vitest";
import { codigoAlunoSchema, emailContaAluno, liberarAlunoSchema, portalAlunoSchema, entradaAparelhoSchema, aprovarAparelhoSchema } from "./portal-aluno";

describe("login de aluno por matrícula", () => {
  it("entra sem senha com CPF ou matrícula e nascimento válido", () => {
    expect(entradaAparelhoSchema.parse({ identificador: "123.456.789-01", nascimento: "2000-02-29" }).identificador).toBe("12345678901");
    expect(entradaAparelhoSchema.parse({ identificador: "ab12cd3", nascimento: "2000-02-29" }).identificador).toBe("AB12CD3");
    expect(entradaAparelhoSchema.safeParse({ identificador: "AB12CD3", nascimento: "2001-02-29" }).success).toBe(false);
  });
  it("exige código do aparelho para aprovação e rejeita identidade extra", () => {
    expect(aprovarAparelhoSchema.parse({ codigo: "AB12CD3", aparelho: "0123ABCDEF45" }).aparelho).toBe("0123ABCDEF45");
    expect(aprovarAparelhoSchema.safeParse({ codigo: "AB12CD3", aparelho: "" }).success).toBe(false);
    expect(entradaAparelhoSchema.safeParse({ identificador: "AB12CD3", nascimento: "2000-01-01", aluno_id: "outro" }).success).toBe(false);
  });
  it("aceita matrícula alfanumérica de sete caracteres com letra e número", () => {
    expect(codigoAlunoSchema.parse(" ab12cd3 ")).toBe("AB12CD3");
    for (const codigo of ["ABCDEF", "ABCDEFG", "1234567", "AB12CD34", "AB1.CD3"]) expect(codigoAlunoSchema.safeParse(codigo).success).toBe(false);
  });
  it("usa a mesma conta para matrícula normalizada e não aceita conteúdo de endereço", () => {
    expect(emailContaAluno("ab12cd3")).toBe(emailContaAluno("AB12CD3"));
    expect(() => emailContaAluno("a@b.com")).toThrow();
  });
  it("consulta individual não inclui documentos nem permite senha vazia na liberação", () => {
    expect(liberarAlunoSchema.safeParse({ codigo: "AB12CD3", senha: "" }).success).toBe(false);
    const aluno = portalAlunoSchema.parse({ id: "00000000-0000-4000-8000-000000000001", codigo: "AB12CD3", nome: "Aluno", ativo: true, foto_path: null, atestado_data: null, atestado_entregue: false, turmas: [], cpf: "privado", observacoes: "privado", doc_atestado_path: "privado" });
    expect(aluno).not.toHaveProperty("cpf");
    expect(aluno).not.toHaveProperty("observacoes");
    expect(aluno).not.toHaveProperty("doc_atestado_path");
  });
});