import { createFileRoute } from "@tanstack/react-router";

/**
 * Entrega no celular os lembretes de aula (30 e 15 minutos antes).
 * Os lembretes são criados no banco a cada minuto; esta rota só envia os ainda não notificados,
 * por isso uma chamada repetida não gera notificações duplicadas.
 */
export const Route = createFileRoute("/api/public/lembretes-aulas")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const enviado = request.headers.get("x-lembretes-secret") ?? "";
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: cron } = await supabaseAdmin.from("lembretes_cron").select("token").maybeSingle();
        const segredo = cron?.token;
        if (!segredo || enviado.length !== segredo.length || enviado !== segredo) {
          return new Response("Não autorizado", { status: 401 });
        }
        const key = process.env["FIREBASE_MESSAGING_API_KEY"];
        const auth = process.env["LOVABLE_API_KEY"];
        if (!key || !auth) {
          console.error("[lembretes-aulas] conexão das notificações indisponível");
          return Response.json({ ok: false, erro: "Notificações indisponíveis" }, { status: 503 });
        }
        const { data: pendentes, error } = await supabaseAdmin.rpc("reservar_push_lembretes");
        if (error) {
          console.error("[lembretes-aulas]", error.message);
          return Response.json({ ok: false }, { status: 500 });
        }
        const grupos = new Map<string, { titulo: string; mensagem: string; alunos: string[] }>();
        for (const p of pendentes ?? []) {
          const chave = `${p.titulo}\n${p.mensagem}`;
          const grupo = grupos.get(chave) ?? { titulo: p.titulo, mensagem: p.mensagem, alunos: [] };
          grupo.alunos.push(p.aluno_id);
          grupos.set(chave, grupo);
        }
        const { enviarPush } = await import("@/lib/portal-extras.server");
        let enviados = 0;
        let falhas = 0;
        for (const grupo of grupos.values()) {
          try {
            const r = await enviarPush(grupo.alunos, grupo.titulo, grupo.mensagem, key, auth);
            enviados += r.enviados;
            falhas += r.falhas;
          } catch (e) {
            falhas += grupo.alunos.length;
            console.error("[lembretes-aulas] envio", e instanceof Error ? e.message : e);
          }
        }
        return Response.json({ ok: true, lembretes: pendentes?.length ?? 0, enviados, falhas });
      },
    },
  },
});
