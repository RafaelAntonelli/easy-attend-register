import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function garantirAdmin(context: { supabase: any; userId: string }) {
  const { data: admin } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!admin) throw new Error("Apenas administradores podem executar o backup.");
}

/** Executa o backup completo (planilha + fotos/documentos) no Google Drive. Somente administradores. */
export const fazerBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await garantirAdmin(context);
    const { executarBackupCompleto } = await import("@/lib/backup.server");
    return await executarBackupCompleto();
  });

/** Envia a planilha do dia e devolve a fila de fotos/documentos a enviar. */
export const prepararBackupFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await garantirAdmin(context);
    const { prepararBackup } = await import("@/lib/backup.server");
    return await prepararBackup();
  });

const loteSchema = z.object({
  arquivos: z.array(
    z.object({
      caminho: z.string(),
      nome: z.string(),
      destino: z.enum(["fotos", "documentos"]),
    }),
  ),
  existentes: z
    .object({
      fotos: z.record(z.string(), z.string()),
      documentos: z.record(z.string(), z.string()),
    })
    .partial()
    .optional(),
});

/** Envia um lote de fotos/documentos (usado para exibir progresso na tela). */
export const enviarLoteBackupFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => loteSchema.parse(data))
  .handler(async ({ context, data }) => {
    await garantirAdmin(context);
    const { enviarLoteBackup } = await import("@/lib/backup.server");
    const existentes = data.existentes
      ? { fotos: data.existentes.fotos ?? {}, documentos: data.existentes.documentos ?? {} }
      : undefined;
    return await enviarLoteBackup(data.arquivos, existentes);
  });

/** Registra o resultado do último backup manual. */
export const registrarBackupFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ resumo: z.string() }).parse(data))
  .handler(async ({ context, data }) => {
    await garantirAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const quando = new Date().toISOString();
    await supabaseAdmin
      .from("backup_cron")
      .update({ ultimo_backup: quando, ultimo_resultado: data.resumo })
      .eq("id", true);
    return { ultimo_backup: quando };
  });
