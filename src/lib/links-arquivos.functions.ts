import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Links temporários (assinados) das fotos e documentos para as exportações da equipe.
 * Expiram após a validade configurada na tela Backup (padrão 24 h).
 */
export const linksArquivosFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Somente a equipe: contas de alunos também são autenticadas e não podem ver documentos de outros.
    const { data: equipe, error } = await context.supabase.rpc("is_staff", { _user_id: context.userId });
    if (error || !equipe) throw new Error("Apenas a equipe pode exportar links de documentos.");
    const { linksArquivosStorage } = await import("@/lib/links-arquivos.server");
    try {
      return await linksArquivosStorage();
    } catch (err) {
      console.error("[planilha] não foi possível gerar os links dos arquivos", err);
      return { links: {} as Record<string, string>, expiraEm: new Date().toISOString(), horas: 0 };
    }
  });
