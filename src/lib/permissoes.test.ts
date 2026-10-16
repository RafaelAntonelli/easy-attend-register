import { describe, expect, it } from "vitest";
import { permissaoAtiva } from "./permissoes";

describe("Permissões de professores", () => {
  it.each(["alunos_cadastrar", "alunos_editar"])("libera %s por padrão", (chave) => {
    expect(permissaoAtiva({}, chave)).toBe(true);
  });
  it.each(["turmas_criar", "horarios_editar", "dias_editar", "turmas_editar"])("bloqueia %s por padrão", (chave) => {
    expect(permissaoAtiva({}, chave)).toBe(false);
    expect(permissaoAtiva({ [chave]: true }, chave)).toBe(true);
  });
  it("respeita o bloqueio definido pelo administrador", () => {
    expect(permissaoAtiva({ alunos_editar: false }, "alunos_editar")).toBe(false);
  });
});