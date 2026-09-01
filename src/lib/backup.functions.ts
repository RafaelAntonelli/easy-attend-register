import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Executa o backup completo (planilha + fotos/documentos) no Google Drive. */
export const fazerBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: staff } = await context.supabase.rpc("is_staff", { _user_id: context.userId });
    if (!staff) throw new Error("Apenas a equipe pode executar o backup.");
    const { executarBackupCompleto } = await import("@/lib/backup.server");
    return await executarBackupCompleto();
  });
