import { z } from "zod";

export const codigoAlunoSchema = z.string().trim().toUpperCase().regex(/^(?=.*[A-Z])(?=.*\d)[A-Z0-9]{7}$/, "Informe a matrícula de 7 caracteres, com letras e números.");
export const senhaAlunoSchema = z.string().min(8, "A senha deve ter pelo menos 8 caracteres.").max(128, "A senha deve ter no máximo 128 caracteres.");
export const loginAlunoSchema = z.object({ codigo: codigoAlunoSchema, senha: z.string().min(1, "Informe a senha.").max(128) }).strict();
export const liberarAlunoSchema = z.object({ codigo: codigoAlunoSchema, senha: senhaAlunoSchema }).strict();
export function emailContaAluno(codigo: string) {
  return `aluno.${codigoAlunoSchema.parse(codigo).toLowerCase()}@alunos.arena.invalid`;
}

export const portalAlunoSchema = z.object({
  id: z.string().uuid(), nome: z.string(), codigo: codigoAlunoSchema, ativo: z.boolean(), foto_path: z.string().nullable(),
  atestado_entregue: z.boolean(), atestado_data: z.string().nullable(),
  turmas: z.array(z.object({ id: z.string().uuid(), nome: z.string(), modalidade: z.string(), horario: z.string().nullable(), professor: z.string().nullable(), dias_semana: z.array(z.string()) })),
});