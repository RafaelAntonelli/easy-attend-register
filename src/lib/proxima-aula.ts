/** Calcula a próxima aula do aluno a partir dos dias ("Ter", "Qui"...) e do horário ("18:00 às 18:50") das turmas, no horário de Brasília. */
const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"];

function semAcento(t: string) { return t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().slice(0, 3); }

export type TurmaAula = { id: string; nome: string; modalidade?: string | null; horario: string | null; dias_semana: string[] };
export type ProximaAula<T extends TurmaAula> = { turma: T; data: Date; diasAte: number; inicio: string; fim: string | null };

/** "Agora" no relógio de Brasília (UTC-3), como data cujos campos UTC são a hora local. */
function agoraBrasilia(agora: Date) { return new Date(agora.getTime() - 3 * 3600_000); }

export function proximaAula<T extends TurmaAula>(turmas: T[], agora = new Date()): ProximaAula<T> | null {
  const local = agoraBrasilia(agora);
  const minutosAgora = local.getUTCHours() * 60 + local.getUTCMinutes();
  let melhor: (ProximaAula<T> & { chave: number }) | null = null;
  for (const turma of turmas) {
    const m = /(\d{1,2}):(\d{2})(?:\s*(?:às|-|a)\s*(\d{1,2}):(\d{2}))?/.exec(turma.horario ?? "");
    if (!m || !m[1] || !m[2]) continue;
    const [h1, m1, h2, m2] = [m[1], m[2], m[3], m[4]];
    const inicioMin = Number(h1) * 60 + Number(m1);
    const fimMin = h2 ? Number(h2) * 60 + Number(m2) : inicioMin + 50;
    for (const dia of turma.dias_semana) {
      const idx = DIAS.indexOf(semAcento(dia));
      if (idx < 0) continue;
      let diasAte = (idx - local.getUTCDay() + 7) % 7;
      if (diasAte === 0 && fimMin <= minutosAgora) diasAte = 7;
      const chave = diasAte * 1440 + inicioMin;
      if (!melhor || chave < melhor.chave) {
        const data = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + diasAte, 12));
        melhor = { turma, data, diasAte, inicio: `${h1.padStart(2, "0")}:${m1}`, fim: h2 ? `${h2.padStart(2, "0")}:${m2}` : null, chave };
      }
    }
  }
  if (!melhor) return null;
  const { chave: _c, ...resto } = melhor;
  return resto;
}

export function descreverDia(diasAte: number, data: Date) {
  if (diasAte === 0) return "Hoje";
  if (diasAte === 1) return "Amanhã";
  const nome = data.toLocaleDateString("pt-BR", { weekday: "long", timeZone: "UTC" });
  return nome.charAt(0).toUpperCase() + nome.slice(1);
}
