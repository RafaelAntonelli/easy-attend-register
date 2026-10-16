import { describe, expect, it } from "vitest";
import { permissaoAtiva } from "./permissoes";

describe("Permissões de professores", () => {
  it.each(["alunos_cadastrar", "alunos_editar", "alunos_reativar", "alunos_inativar", "alunos_excluir", "alunos_exportar_lista", "alunos_exportar_planilha", "alunos_notificacoes"])("bloqueia %s por padrão e permite liberação individual", (chave) => {
    expect(permissaoAtiva({}, chave)).toBe(false);
    expect(permissaoAtiva({ [chave]: false }, chave)).toBe(false);
    expect(permissaoAtiva({ [chave]: true }, chave)).toBe(true);
  });
  it.each(["turmas_criar", "horarios_editar", "dias_editar", "turmas_editar"])("bloqueia %s por padrão", (chave) => {
    expect(permissaoAtiva({}, chave)).toBe(false);
    expect(permissaoAtiva({ [chave]: true }, chave)).toBe(true);
  });
  it("respeita o bloqueio definido pelo administrador", () => {
    expect(permissaoAtiva({ alunos_editar: false }, "alunos_editar")).toBe(false);
  });
});