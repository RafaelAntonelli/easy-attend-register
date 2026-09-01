import { createFileRoute } from "@tanstack/react-router";

/** Backup automático semanal (chamado pelo agendador toda segunda-feira). */
export const Route = createFileRoute("/api/public/backup-semanal")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const segredo = process.env["BACKUP_CRON_SECRET"];
        const enviado = request.headers.get("x-backup-secret");
        if (!segredo || enviado !== segredo) {
          return new Response("Não autorizado", { status: 401 });
        }
        try {
          const { executarBackupCompleto } = await import("@/lib/backup.server");
          const resultado = await executarBackupCompleto();
          return Response.json({ ok: true, ...resultado });
        } catch (err) {
          const mensagem = err instanceof Error ? err.message : "Falha no backup";
          console.error("[backup-semanal]", mensagem);
          return Response.json({ ok: false, erro: mensagem }, { status: 500 });
        }
      },
    },
  },
});
