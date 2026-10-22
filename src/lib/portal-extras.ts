import { z } from 'zod';
export const contatoPortalSchema = z.object({ telefone: z.string().trim().max(20), telefone2: z.string().trim().max(20), email: z.union([z.literal(''), z.string().trim().email().max(254)]) }).strict();
export const fotoPortalSchema = z.object({ tipo: z.enum(['image/jpeg','image/png','image/webp']), base64: z.string().max(7_000_000) }).strict();

/** Antecedência mínima e máxima para agendar um aviso. */
export const AGENDAMENTO_MIN_MINUTOS = 5;
export const AGENDAMENTO_MAX_DIAS = 60;

export const avisoPortalSchema = z.object({
  destino: z.enum(['aluno', 'turma', 'todos']),
  alunoId: z.string().uuid().nullable(),
  turmaId: z.string().uuid().nullable(),
  titulo: z.string().trim().min(1).max(100),
  mensagem: z.string().trim().min(1).max(1000),
  agendadoPara: z.string().datetime({ offset: true }).nullable(),
}).strict().superRefine((v, ctx) => {
  if (v.destino === 'aluno' && !v.alunoId) ctx.addIssue({ code: 'custom', message: 'Escolha o aluno.', path: ['alunoId'] });
  if (v.destino === 'turma' && !v.turmaId) ctx.addIssue({ code: 'custom', message: 'Escolha a turma.', path: ['turmaId'] });
});

/** Confere o horário do agendamento: pelo menos 5 minutos à frente e no máximo 60 dias. */
export function erroAgendamento(agendadoPara: string | null, agora = new Date()): string | null {
  if (!agendadoPara) return null;
  const quando = new Date(agendadoPara).getTime();
  if (Number.isNaN(quando)) return 'Data do agendamento inválida.';
  if (quando < agora.getTime() + AGENDAMENTO_MIN_MINUTOS * 60_000) return `Agende para pelo menos ${AGENDAMENTO_MIN_MINUTOS} minutos a partir de agora.`;
  if (quando > agora.getTime() + AGENDAMENTO_MAX_DIAS * 86_400_000) return `Agende para no máximo ${AGENDAMENTO_MAX_DIAS} dias a partir de hoje.`;
  return null;
}
