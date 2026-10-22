import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/**
 * Notifica no celular um aviso agendado quando chega o horário marcado.
 * Chamado uma única vez pelo banco para cada envio; os avisos já aparecem
 * na central do aluno pelo horário, então esta rota só cuida do celular.
 */
export const Route = createFileRoute("/api/public/avisos-agendados")({
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
        const corpo = z.object({ envio: z.string().uuid() }).safeParse(await request.json().catch(() => null));
        if (!corpo.success) return Response.json({ ok: false, erro: "Envio inválido" }, { status: 400 });
        const key = process.env["FIREBASE_MESSAGING_API_KEY"];
        const auth = process.env["LOVABLE_API_KEY"];
        if (!key || !auth) {
          console.error("[avisos-agendados] conexão das notificações indisponível");
          return Response.json({ ok: false, erro: "Notificações indisponíveis" }, { status: 503 });
        }
        const { data: pendentes, error } = await supabaseAdmin.rpc("reservar_push_aviso_agendado", { _envio: corpo.data.envio });
        if (error) {
          console.error("[avisos-agendados]", error.message);
          return Response.json({ ok: false }, { status: 500 });
        }
        if (!pendentes?.length) return Response.json({ ok: true, enviados: 0, falhas: 0 });
        const { enviarPush } = await import("@/lib/portal-extras.server");
        try {
          const r = await enviarPush(pendentes.map((p) => p.aluno_id), pendentes[0]!.titulo, pendentes[0]!.mensagem, key, auth);
          return Response.json({ ok: true, ...r });
        } catch (e) {
          console.error("[avisos-agendados] envio", e instanceof Error ? e.message : e);
          return Response.json({ ok: false }, { status: 500 });
        }
      },
    },
  },
});
