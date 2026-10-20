import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { TIPOS_ARQUIVO_BACKUP } from "@/lib/backup-nomes";

async function garantirAdmin(context: { supabase: any; userId: string }) {
  const { data: admin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (!admin) throw new Error("Apenas administradores podem restaurar o backup.");
}

const codigoSchema = z.string().regex(/^(?=.*[A-Z])(?=.*[0-9])[A-Z0-9]{7}$/);
const campoSchema = z.enum(TIPOS_ARQUIVO_BACKUP.map((t) => t.campo) as [string, ...string[]]);

/** Prévia da restauração a partir da planilha e das pastas do Drive. Não grava nada. */
export const analisarRestauracaoFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ planilha: z.string().max(500).optional() }).parse(d))
  .handler(async ({ context, data }) => {
    await garantirAdmin(context);
    const { analisarRestauracao } = await import("@/lib/restauracao.server");
    return await analisarRestauracao(context.supabase, data.planilha ?? null);
  });

/** Recria um lote de alunos da planilha (mesmo código de matrícula). */
export const restaurarAlunosFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ planilhaId: z.string().min(10).max(200), codigos: z.array(codigoSchema).min(1).max(50) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await garantirAdmin(context);
    const { restaurarAlunos } = await import("@/lib/restauracao.server");
    return await restaurarAlunos(context.supabase, context.userId, data.planilhaId, data.codigos);
  });

/** Restaura um lote de fotos/documentos do Drive, ligando-os pelo código de matrícula. */
export const restaurarArquivosFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        substituir: z.boolean(),
        arquivos: z
          .array(
            z.object({
              driveId: z.string().min(5).max(200),
              nome: z.string().min(1).max(200),
              codigo: codigoSchema,
              campo: campoSchema,
            }),
          )
          .min(1)
          .max(5),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await garantirAdmin(context);
    const { restaurarArquivos } = await import("@/lib/restauracao.server");
    return await restaurarArquivos(context.supabase, data.arquivos as never, data.substituir);
  });
