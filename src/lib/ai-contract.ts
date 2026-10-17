import { z } from "zod";

export const CAMPOS_FICHA = [
  ["nome", "Nome completo"], ["data_nascimento", "Nascimento"], ["idade", "Idade"],
  ["sexo", "Sexo"], ["cpf", "CPF"], ["rg", "RG"], ["telefone", "Celular"],
  ["telefone2", "Celular 2"], ["email", "E-mail"], ["responsavel", "Responsável"],
  ["rede_ensino", "Rede de ensino"], ["escola", "Escola"], ["modalidade", "Modalidade"],
] as const;
export type CampoFicha = (typeof CAMPOS_FICHA)[number][0];
export type DadosFicha = Partial<Record<CampoFicha, string>>;
export const fichaSchema = z.object({
  campos: z.array(z.object({ campo: z.enum(CAMPOS_FICHA.map(([c]) => c) as [CampoFicha, ...CampoFicha[]]), valor: z.string().nullable() }).strict()),
  avisos: z.array(z.string()),
}).strict();
export const colunasSchema = z.object({
  correspondencias: z.array(z.object({ destino: z.string(), origem: z.string().nullable() }).strict()),
  avisos: z.array(z.string()),
}).strict();
export const textoSchema = z.object({ texto: z.string() }).strict();

/** Reject invented headers and reuse of one source for multiple destinations. */
export function validarMapaIA(pares: { destino: string; origem: string | null }[], origens: readonly string[], destinos: readonly string[]) {
  const mapa: Record<string, string> = {};
  const usados = new Set<string>();
  for (const p of pares) {
    if (!p.origem || !origens.includes(p.origem) || !destinos.includes(p.destino) || usados.has(p.origem) || mapa[p.destino]) continue;
    mapa[p.destino] = p.origem;
    usados.add(p.origem);
  }
  return mapa;
}

export function camposFichaRevisados(campos: { campo: CampoFicha; valor: string | null }[]): DadosFicha {
  return Object.fromEntries(campos.filter((c) => c.valor?.trim()).map((c) => [c.campo, c.valor?.trim() ?? ""]));
}

export function capacidadeAgregada(turmas: { id: string; nome: string; modalidade: string; horario: string | null; capacidade: number; dias_semana: string[] }[], matriculas: { aluno_id: string; turma_id: string }[]) {
  return turmas.map((t) => {
    const ocupadas = new Set(matriculas.filter((m) => m.turma_id === t.id).map((m) => m.aluno_id)).size;
    return { turma: t.nome, modalidade: t.modalidade, horario: t.horario, dias: t.dias_semana, capacidade: t.capacidade, matriculados: ocupadas, vagas_livres: Math.max(0, t.capacidade - ocupadas), ocupacao_percentual: t.capacidade ? Math.round(ocupadas / t.capacidade * 1000) / 10 : 0 };
  });
}