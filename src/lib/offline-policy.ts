/** Only effect-loaded staff shells: never add a personalized SSR route here. */
export const PAGINAS_OFFLINE = ["/", "/auth", "/alunos", "/presenca"];

export function recusarWorker(hostname: string, producao: boolean, iframe: boolean, desligado: boolean, delegado = "") {
  const host = hostname.toLowerCase();
  if (!producao || iframe || desligado || (delegado && host === delegado)) return true;
  if (["lovableproject.com", "lovableproject-dev.com", "beta.lovable.dev"].some((d) => host === d || host.endsWith(`.${d}`))) return true;
  const dominioLovable = ["lovable.app", "gpt-eng.com", "gptengineer.run"].some((d) => host.endsWith(`.${d}`));
  const rotulo = host.split(".")[0] ?? "";
  return dominioLovable && (/^(?:id-preview|preview)(?:-[a-z0-9]+)?--.+$/.test(rotulo) || /^project--.+-dev$/.test(rotulo));
}

export function pertenceConta(registro: { usuario_id?: string }, usuarioId: string | null) {
  return Boolean(usuarioId && registro.usuario_id === usuarioId);
}

export type MarcacaoSalva = { aluno_id: string; horario: string; status: string; observacoes: string | null; nome: string };
type AcaoChamada = { tipo: string; aluno_id?: string; data?: string; horario?: string; status?: string; observacoes?: string | null };

/** Replays the ordered queue over the last server snapshot, without inventing absences. */
export function aplicarChamadaPendente(base: MarcacaoSalva[], fila: AcaoChamada[], dia: string, nomes: Record<string, string>) {
  const mapa = new Map(base.map((r) => [r.aluno_id, r]));
  for (const op of fila) {
    if (op.data !== dia || !op.aluno_id) continue;
    if (op.tipo === "presenca_remover") mapa.delete(op.aluno_id);
    else if (op.tipo === "presenca" && op.status && op.horario) mapa.set(op.aluno_id, {
      aluno_id: op.aluno_id, horario: op.horario, status: op.status,
      observacoes: op.observacoes ?? null, nome: nomes[op.aluno_id] ?? "Aluno",
    });
  }
  return [...mapa.values()].sort((a, b) => b.horario.localeCompare(a.horario));
}