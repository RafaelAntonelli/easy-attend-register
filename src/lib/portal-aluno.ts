import { z } from "zod";

export const codigoAlunoSchema = z.string().trim().toUpperCase().regex(/^(?=.*[A-Z])(?=.*\d)[A-Z0-9]{7}$/, "Informe a matrícula de 7 caracteres, com letras e números.");
export const senhaAlunoSchema = z.string().min(8, "A senha deve ter pelo menos 8 caracteres.").max(128, "A senha deve ter no máximo 128 caracteres.");
export const loginAlunoSchema = z.object({ codigo: codigoAlunoSchema, senha: z.string().min(1, "Informe a senha.").max(128) }).strict();
export const liberarAlunoSchema = z.object({ codigo: codigoAlunoSchema, senha: senhaAlunoSchema }).strict();
export const tokenAparelhoSchema = z.string().regex(/^[a-f0-9]{64}$/).optional();
export const entradaAparelhoSchema = z.object({ aparelho: tokenAparelhoSchema, identificador: z.string().trim().toUpperCase().transform(v => v.replace(/[.\-\s]/g, "")).refine(v => codigoAlunoSchema.safeParse(v).success || /^\d{11}$/.test(v), "Informe CPF ou matrícula válida."), nascimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data de nascimento.").refine(v => !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v, "Data inválida.") }).strict();
export const aprovarAparelhoSchema = z.object({ codigo: codigoAlunoSchema, aparelho: z.string().trim().toUpperCase().regex(/^[A-F0-9]{12}$/, "Informe o código de 12 caracteres do aparelho.") }).strict();
export function emailContaAluno(codigo: string) {
  return `aluno.${codigoAlunoSchema.parse(codigo).toLowerCase()}@alunos.arena.invalid`;
}

export const portalAlunoSchema = z.object({
  id: z.string().uuid(), nome: z.string(), codigo: codigoAlunoSchema, ativo: z.boolean(), foto_path: z.string().nullable(),
  atestado_entregue: z.boolean(), atestado_data: z.string().nullable(),
  turmas: z.array(z.object({ id: z.string().uuid(), nome: z.string(), modalidade: z.string(), horario: z.string().nullable(), professor: z.string().nullable(), dias_semana: z.array(z.string()) })),
});