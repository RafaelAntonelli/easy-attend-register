import { faixaEtariaECA, turnoDoHorario } from "./turnos";
import { type FiltroRedeEnsino } from "./escolas";

export const FILTROS_RELATORIO = [
  { id: "faixa", rotulo: "Faixa etária", multiplo: true },
  { id: "sexo", rotulo: "Sexo", multiplo: false },
  { id: "modalidade", rotulo: "Modalidade", multiplo: false },
  { id: "horario", rotulo: "Horários", multiplo: true },
  { id: "dias", rotulo: "Dias", multiplo: false },
  { id: "turno", rotulo: "Turno", multiplo: false },
  { id: "pcd", rotulo: "Alunos PCD", multiplo: false },
  { id: "situacao", rotulo: "Ativos e Inativos", multiplo: false },
] as const;
export type FiltroRelatorioId = (typeof FILTROS_RELATORIO)[number]["id"];
export type FiltrosRelatorio = Record<FiltroRelatorioId, string[]>;
export const filtrosRelatorioVazios = (): FiltrosRelatorio => ({ faixa: [], sexo: [], modalidade: [], horario: [], dias: [], turno: [], pcd: [], situacao: [] });
type AlunoBase = { id: string; ativo?: boolean | null; data_nascimento?: string | null; idade?: string | number | null; faixa_etaria?: string | null; sexo?: string | null; pcd: boolean; rede_ensino?: string | null; escola?: string | null };
type TurmaBase = { id: string; horario: string | null; dias_semana: string[]; modalidade: string };
type MatriculaBase = { aluno_id: string; turma_id: string; modalidade: string; status: string };
export type RegistroRelatorio<T> = { aluno: T; valores: Record<FiltroRelatorioId, string[]> };
/** Same rule as the Alunos day filter: a class belongs to a group when it has every day of that group. */
function diasDaTurma(dias: string[], grupos: { label: string; dias: string[] }[]) {
  if (!grupos.length) return dias.length ? dias : ["Não informado"];
  const nomes = grupos.filter((g) => g.dias.length && g.dias.every((d) => dias.includes(d))).map((g) => g.label);
  return nomes.length ? nomes : ["Outros dias"];
}
const informado = (valor?: string | null) => valor || "Não informado";

export function registrosRelatorio<T extends AlunoBase>(alunos: T[], turmas: TurmaBase[], matriculas: MatriculaBase[], gruposDias: { label: string; dias: string[] }[] = []): RegistroRelatorio<T>[] {
  const mapaTurmas = new Map(turmas.map((t) => [t.id, t]));
  const porAluno = new Map<string, MatriculaBase[]>();
  for (const m of matriculas) {
    if (m.status !== "ativa") continue;
    porAluno.set(m.aluno_id, [...(porAluno.get(m.aluno_id) ?? []), m]);
  }
  return alunos.flatMap((aluno) => {
    const vinculos = porAluno.get(aluno.id) ?? [];
    return (vinculos.length ? vinculos : [undefined]).map((m) => {
      const turma = m ? mapaTurmas.get(m.turma_id) : undefined;
      return { aluno, valores: {
        faixa: [informado(faixaEtariaECA(aluno.data_nascimento, aluno.idade) || aluno.faixa_etaria)],
        sexo: [informado(aluno.sexo)], pcd: [aluno.pcd ? "PCD" : "Não PCD"],
        situacao: [aluno.ativo === false ? "Inativos" : "Ativos"],
        modalidade: [informado(m?.modalidade || turma?.modalidade)],
        horario: [informado(turma?.horario)],
        dias: diasDaTurma(turma?.dias_semana ?? [], gruposDias),
        turno: [informado(turnoDoHorario(turma?.horario))],
      } };
    });
  });
}

export function cruzarRelatorio<T extends AlunoBase>(registros: RegistroRelatorio<T>[], filtros: FiltrosRelatorio, rede: FiltroRedeEnsino) {
  const selecionados = FILTROS_RELATORIO.filter(({ id }) => filtros[id].length);
  const dimensoes: FiltroRelatorioId[] = selecionados.length ? selecionados.map(({ id }) => id) : rede === "todas" ? ["faixa"] : [];
  const compativeis = registros.filter(({ aluno, valores }) =>
    (rede === "todas" || aluno.rede_ensino === rede) && selecionados.every(({ id }) => filtros[id].some((v) => valores[id].includes(v))),
  );
  const unicos = new Map<string, T>();
  const grupos = new Map<string, T[]>();
  // A matching enrollment supplies all class-related dimensions together. Each student is counted once.
  for (const { aluno, valores } of compativeis) {
    if (unicos.has(aluno.id)) continue;
    unicos.set(aluno.id, aluno);
    const partes = dimensoes.map((id) => `${FILTROS_RELATORIO.find((f) => f.id === id)?.rotulo}: ${valores[id].filter((v) => !filtros[id].length || filtros[id].includes(v)).join(" e ")}`);
    if (rede !== "todas") partes.push(aluno.escola?.trim() || "Escola não informada");
    const nome = partes.join(" · ") || "Todos os alunos";
    grupos.set(nome, [...(grupos.get(nome) ?? []), aluno]);
  }
  return {
    alunos: [...unicos.values()],
    pontos: [...grupos].map(([nome, alunos]) => ({ nome, alunos, total: alunos.length })).sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, "pt-BR")),
    resumo: [...selecionados.map(({ id, rotulo }) => `${rotulo}: ${filtros[id].join(", ")}`), `Rede: ${rede === "todas" ? "Todas" : rede}`].join(" · "),
  };
}