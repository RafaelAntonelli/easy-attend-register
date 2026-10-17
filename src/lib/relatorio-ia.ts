import { z } from "zod";
import { cruzarRelatorio, filtrosRelatorioVazios, registrosRelatorio, FILTROS_RELATORIO } from "./relatorio-cruzado";
import { idadePorNascimento } from "./turnos";

const grupoSchema = z.object({
  rotulo: z.string(), situacao: z.array(z.string()), faixa: z.array(z.string()), sexo: z.array(z.string()),
  modalidade: z.array(z.string()), horario: z.array(z.string()), dias: z.array(z.string()), turno: z.array(z.string()),
  pcd: z.array(z.string()), rede: z.string().nullable(), escola: z.string().nullable(),
  idade_minima: z.number().nullable(), idade_maxima: z.number().nullable(),
}).strict();
export const planoRelatorioSchema = z.object({ grupos: z.array(grupoSchema), agrupar_por: z.string().nullable() }).strict();
export type PlanoRelatorioIA = z.infer<typeof planoRelatorioSchema>;
export type AlunoRelatorioIA = { id: string; ativo: boolean; idade: number | null; data_nascimento: string | null; sexo: string | null; pcd: boolean; rede_ensino: string | null; escola: string | null };
export type TurmaRelatorioIA = { id: string; modalidade: string; horario: string | null; dias_semana: string[] };
export type MatriculaRelatorioIA = { aluno_id: string; turma_id: string; modalidade: string; status: string };

export function idadeRelatorioIA(a: AlunoRelatorioIA) {
  const nascimento = idadePorNascimento(a.data_nascimento);
  const idade = nascimento !== "" ? Number(nascimento) : a.idade;
  return idade !== null && Number.isFinite(idade) && idade >= 0 && idade <= 120 ? idade : null;
}
export function estatisticasIdadeIA(alunos: AlunoRelatorioIA[]) {
  const idades = alunos.map(idadeRelatorioIA).filter((i): i is number => i !== null).sort((a, b) => a - b);
  const n = idades.length; const central = Math.floor(n / 2);
  return { total_alunos: alunos.length, idades_informadas: n, idades_nao_informadas: alunos.length - n,
    media_idade: n ? Math.round(idades.reduce((s, i) => s + i, 0) / n * 100) / 100 : null,
    mediana_idade: n ? n % 2 ? idades[central] : ((idades[central - 1] ?? 0) + (idades[central] ?? 0)) / 2 : null,
    menor_idade: idades[0] ?? null, maior_idade: idades[n - 1] ?? null };
}
export function calcularRelatorioIA(plano: PlanoRelatorioIA, alunos: AlunoRelatorioIA[], turmas: TurmaRelatorioIA[], matriculas: MatriculaRelatorioIA[], dias: { label: string; dias: string[] }[]) {
  if (!plano.grupos.length || plano.grupos.length > 6) throw new Error("Faça uma comparação de até seis grupos por pergunta.");
  const registros = registrosRelatorio(alunos, turmas, matriculas, dias);
  const dimensao = FILTROS_RELATORIO.find((f) => f.id === plano.agrupar_por)?.id;
  return plano.grupos.map((grupo) => {
    const filtros = filtrosRelatorioVazios();
    for (const { id } of FILTROS_RELATORIO) filtros[id] = grupo[id].slice(0, 30);
    const rede = grupo.rede === "Pública" || grupo.rede === "Privada" ? grupo.rede : "todas";
    const registrosGrupo = registros.filter(({ aluno }) => {
      const idade = idadeRelatorioIA(aluno);
      return (!grupo.escola || aluno.escola === grupo.escola) &&
        (grupo.idade_minima === null || (idade !== null && idade >= grupo.idade_minima)) &&
        (grupo.idade_maxima === null || (idade !== null && idade <= grupo.idade_maxima));
    });
    const selecionados = cruzarRelatorio(registrosGrupo, filtros, rede).alunos;
    const subdivisoes = dimensao ? [...new Set(registrosGrupo.flatMap((r) => r.valores[dimensao]))].map((valor) => ({
      valor, ...estatisticasIdadeIA(cruzarRelatorio(registrosGrupo, { ...filtros, [dimensao]: filtros[dimensao].length && !filtros[dimensao].includes(valor) ? ["__fora_do_filtro"] : [valor] }, rede).alunos),
    })).filter((g) => g.total_alunos > 0).sort((a, b) => b.total_alunos - a.total_alunos) : [];
    return { grupo: grupo.rotulo, filtros: grupo, ...estatisticasIdadeIA(selecionados), agrupamento: dimensao ?? null,
      subdivisoes: subdivisoes.slice(0, 30), total_subdivisoes: subdivisoes.length };
  });
}