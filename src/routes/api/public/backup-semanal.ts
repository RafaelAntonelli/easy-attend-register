import { createFileRoute } from "@tanstack/react-router";

/** Backup automático semanal (chamado pelo agendador toda segunda-feira). */
export const Route = createFileRoute("/api/public/backup-semanal")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const enviado = request.headers.get("x-backup-secret") ?? "";
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: cron } = await supabaseAdmin
          .from("backup_cron")
          .select("token")
          .maybeSingle();
        const segredo = cron?.token ?? process.env["BACKUP_CRON_SECRET"];
        if (!segredo || enviado.length !== segredo.length || enviado !== segredo) {
          return new Response("Não autorizado", { status: 401 });
        }
        const iniciado = new Date().toISOString();
        const { registrarHistoricoBackup } = await import("@/lib/backup.server");
        try {
          const { executarBackupCompleto } = await import("@/lib/backup.server");
          const resultado = await executarBackupCompleto();
          await supabaseAdmin
            .from("backup_cron")
            .update({
              ultimo_backup: new Date().toISOString(),
              ultimo_resultado: `${resultado.planilha} · ${resultado.imagens} imagem(ns)`,
              ultimo_status: resultado.falhas.length > 0 ? "falha" : "sucesso",
            })
            .eq("id", true);
          await registrarHistoricoBackup({
            iniciado_em: iniciado,
            origem: "automatico",
            status: resultado.falhas.length > 0 ? "falha" : "sucesso",
            resumo: `${resultado.planilha} · ${resultado.imagens} arquivo(s)${resultado.falhas.length ? ` · ${resultado.falhas.length} falha(s)` : ""}`,
            planilha_nome: resultado.detalhe.nome,
            planilha_id: resultado.detalhe.id,
            pasta_planilhas: resultado.detalhe.pasta,
            enviados: resultado.imagens,
            total: resultado.total,
            falhas: resultado.falhasArquivos,
          }).catch((e) => console.error("[backup-semanal] histórico", e));
          return Response.json({ ok: true, planilha: resultado.planilha, imagens: resultado.imagens, falhas: resultado.falhas });
        } catch (err) {
          const mensagem = err instanceof Error ? err.message : "Falha no backup";
          console.error("[backup-semanal]", mensagem);
          await supabaseAdmin
            .from("backup_cron")
            .update({
              ultimo_backup: new Date().toISOString(),
              ultimo_resultado: mensagem,
              ultimo_status: "falha",
            })
            .eq("id", true);
          await registrarHistoricoBackup({ iniciado_em: iniciado, origem: "automatico", status: "falha", resumo: mensagem }).catch(() => {});
          return Response.json({ ok: false, erro: mensagem }, { status: 500 });
        }

      },
    },
  },
});
