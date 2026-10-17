import { describe, it, expect } from "vitest";
import { calcularRelatorioIA, estatisticasIdadeIA, type AlunoRelatorioIA, type PlanoRelatorioIA } from "./relatorio-ia";
const aluno = (id: string, idade: number | null, ativo = true): AlunoRelatorioIA => ({ id, idade, ativo, data_nascimento: null, sexo: "Feminino", pcd: false, rede_ensino: null, escola: null });
const grupo = { rotulo: "Ativos", situacao: ["Ativos"], faixa: [], sexo: [], modalidade: [], horario: [], dias: [], turno: [], pcd: [], rede: null, escola: null, idade_minima: null, idade_maxima: null };
describe("relatórios complexos da IA", () => {
  it("calcula média com idades válidas sem converter ausentes em zero", () => {
    expect(estatisticasIdadeIA([aluno("a", 18), aluno("b", 60), aluno("c", null)])).toMatchObject({ total_alunos: 3, media_idade: 39, mediana_idade: 39, idades_informadas: 2, idades_nao_informadas: 1 });
  });
  it("cruza modalidade e turno na mesma matrícula e conta uma vez", () => {
    const plano: PlanoRelatorioIA = { grupos: [{ ...grupo, modalidade: ["Natação"], turno: ["Matutino"] }], agrupar_por: "sexo" };
    const turmas = [{ id: "n", modalidade: "Natação", horario: "14:00", dias_semana: [] }, { id: "h", modalidade: "Hidroginástica", horario: "08:00", dias_semana: [] }, { id: "nm", modalidade: "Natação", horario: "08:00", dias_semana: [] }];
    const matriculas = [{ aluno_id: "a", turma_id: "n", modalidade: "Natação", status: "ativa" }, { aluno_id: "a", turma_id: "h", modalidade: "Hidroginástica", status: "ativa" }, { aluno_id: "b", turma_id: "nm", modalidade: "Natação", status: "ativa" }, { aluno_id: "b", turma_id: "nm", modalidade: "Natação", status: "ativa" }];
    expect(calcularRelatorioIA(plano, [aluno("a", 18), aluno("b", 60)], turmas, matriculas, [])[0]).toMatchObject({ total_alunos: 1, media_idade: 60 });
  });
  it("separa ativos e inativos e respeita limites de idade inclusivos", () => {
    expect(calcularRelatorioIA({ grupos: [{ ...grupo, idade_minima: 18, idade_maxima: 60 }], agrupar_por: null }, [aluno("a", 18), aluno("b", 60), aluno("c", 40, false), aluno("d", null)], [], [], [])[0]).toMatchObject({ total_alunos: 2, media_idade: 39 });
  });
});