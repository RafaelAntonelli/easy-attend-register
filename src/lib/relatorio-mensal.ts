export type RegistroMensal = { aluno_id: string; turma_id: string | null; data: string; status: string };
export type TotaisMensais = { presentes: number; faltas: number; justificadas: number; alunos: number; total: number; frequencia: number };

export function limitesMes(mes: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) throw new Error("Selecione um mês válido.");
  const [anoTexto, mesTexto] = mes.split("-");
  const ano = Number(anoTexto);
  const numero = Number(mesTexto);
  return { inicio: `${mes}-01`, fim: `${numero === 12 ? ano + 1 : ano}-${String(numero === 12 ? 1 : numero + 1).padStart(2, "0")}-01` };
}

export function resumirMes(registros: RegistroMensal[], mes: string, turmaId = "todas"): TotaisMensais {
  const { inicio, fim } = limitesMes(mes);
  const selecionados = registros.filter((r) => r.data >= inicio && r.data < fim && (turmaId === "todas" || r.turma_id === turmaId) && ["presente", "falta", "falta_justificada"].includes(r.status));
  const presentes = selecionados.filter((r) => r.status === "presente").length;
  const faltas = selecionados.filter((r) => r.status === "falta").length;
  const justificadas = selecionados.filter((r) => r.status === "falta_justificada").length;
  return { presentes, faltas, justificadas, total: selecionados.length, alunos: new Set(selecionados.map((r) => r.aluno_id)).size, frequencia: selecionados.length ? Math.round(presentes / selecionados.length * 1000) / 10 : 0 };
}