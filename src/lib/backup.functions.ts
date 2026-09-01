import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Executa o backup completo (planilha + fotos/documentos) no Google Drive. Somente administradores. */
export const fazerBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: admin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!admin) throw new Error("Apenas administradores podem executar o backup.");
    const { executarBackupCompleto } = await import("@/lib/backup.server");
    return await executarBackupCompleto();
  });

