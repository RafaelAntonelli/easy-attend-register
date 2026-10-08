import { describe, expect, it } from "vitest";
import { cruzarRelatorio, filtrosRelatorioVazios, registrosRelatorio, type FiltroRelatorioId } from "./relatorio-cruzado";

const alunos = [
  { id: "a", ativo: true, idade: 10, sexo: "Feminino", pcd: true, rede_ensino: "Pública", escola: "Escola A" },
  { id: "b", ativo: true, idade: 16, sexo: "Masculino", pcd: false, rede_ensino: "Privada", escola: "Escola B" },
  { id: "c", ativo: false, idade: 65, sexo: "Feminino", pcd: false, rede_ensino: "Pública", escola: "Escola A" },
];
const turmas = [
  { id: "t1", horario: "08:00 às 08:50", dias_semana: ["Ter", "Qui"], modalidade: "Natação" },
  { id: "t2", horario: "18:00 às 18:50", dias_semana: ["Qua", "Sex"], modalidade: "Hidroginástica" },
];
const matriculas = [
  { aluno_id: "a", turma_id: "t1", modalidade: "Natação", status: "ativa" },
  { aluno_id: "b", turma_id: "t2", modalidade: "Hidroginástica", status: "ativa" },
  { aluno_id: "c", turma_id: "t2", modalidade: "Hidroginástica", status: "ativa" },
];
const registros = registrosRelatorio(alunos, turmas, matriculas);
function ids(id: FiltroRelatorioId, valores: string[]) {
  return cruzarRelatorio(registros, { ...filtrosRelatorioVazios(), [id]: valores }, "todas").alunos.map((a) => a.id);
}
describe("filtros dos alunos por parâmetro", () => {
  it("seleciona somente alunos ativos", () => expect(ids("situacao", ["Ativos"])).toEqual(["a", "b"]));
  it("seleciona somente alunos inativos", () => expect(ids("situacao", ["Inativos"])).toEqual(["c"]));
  it("inclui ativos e inativos ao limpar a situação", () => expect(ids("situacao", [])).toEqual(["a", "b", "c"]));
  it("cruza situação com sexo e rede e mantém os totais do gráfico", () => {
    const resultado = cruzarRelatorio(registros, { ...filtrosRelatorioVazios(), situacao: ["Inativos"], sexo: ["Feminino"] }, "Pública");
    expect(resultado.alunos.map((a) => a.id)).toEqual(["c"]);
    expect(resultado.pontos.map((p) => p.total)).toEqual([1]);
  });
  it("seleciona várias faixas desejadas", () => expect(ids("faixa", ["Criança", "Idoso"])).toEqual(["a", "c"]));
  it("seleciona o sexo desejado", () => expect(ids("sexo", ["Feminino"])).toEqual(["a", "c"]));
  it("seleciona a modalidade desejada", () => expect(ids("modalidade", ["Natação"])).toEqual(["a"]));
  it("seleciona um ou mais horários", () => {
    expect(ids("horario", ["08:00 às 08:50"])).toEqual(["a"]);
    expect(ids("horario", ["08:00 às 08:50", "18:00 às 18:50"])).toEqual(["a", "b", "c"]);
  });
  it("seleciona um dia mesmo em turmas com múltiplos dias", () => expect(ids("dias", ["Qui"])).toEqual(["a"]));
  it("seleciona o turno desejado", () => expect(ids("turno", ["Noturno"])).toEqual(["b", "c"]));
  it("seleciona PCD ou não PCD", () => {
    expect(ids("pcd", ["PCD"])).toEqual(["a"]);
    expect(ids("pcd", ["Não PCD"])).toEqual(["b", "c"]);
  });
  it("cruza todos os filtros e a rede em um único resultado", () => {
    const filtros = { ...filtrosRelatorioVazios(), faixa: ["Criança", "Idoso"], sexo: ["Feminino"], modalidade: ["Natação"], horario: ["08:00 às 08:50"], dias: ["Ter"], turno: ["Matutino"], pcd: ["PCD"] };
    const resultado = cruzarRelatorio(registros, filtros, "Pública");
    expect(resultado.alunos.map((a) => a.id)).toEqual(["a"]);
    expect(resultado.pontos.map((p) => p.total)).toEqual([1]);
    expect(cruzarRelatorio(registros, { ...filtros, sexo: ["Masculino"] }, "Pública").pontos).toEqual([]);
  });
  it("não cruza modalidade de uma matrícula com horário de outra e não duplica alunos", () => {
    const varios = registrosRelatorio(alunos, turmas, [...matriculas, { aluno_id: "a", turma_id: "t2", modalidade: "Hidroginástica", status: "ativa" }]);
    expect(cruzarRelatorio(varios, { ...filtrosRelatorioVazios(), modalidade: ["Natação"], horario: ["18:00 às 18:50"] }, "todas").alunos).toEqual([]);
    const resultado = cruzarRelatorio(varios, filtrosRelatorioVazios(), "todas");
    expect(resultado.alunos).toHaveLength(3);
    expect(resultado.pontos.reduce((total, p) => total + p.total, 0)).toBe(3);
  });
  it("não usa matrículas canceladas para filtrar horários", () => {
    const registros = registrosRelatorio(alunos.slice(0, 1), turmas, [{ aluno_id: "a", turma_id: "t1", modalidade: "Natação", status: "cancelada" }]);
    expect(cruzarRelatorio(registros, { ...filtrosRelatorioVazios(), horario: ["08:00 às 08:50"] }, "todas").alunos).toEqual([]);
  });
});