import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { portalAlunoSchema, tokenAparelhoSchema } from "@/lib/portal-aluno";

export const consultarPortalAluno = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ aparelho: tokenAparelhoSchema }).strict().parse(d ?? {}))
  .handler(async ({ data: entrada, context }) => {
    const { aparelhoAtual } = await import("./aparelho-aluno.server");
    const aparelho = await aparelhoAtual(entrada.aparelho);
    const { data: vinculo } = await context.supabase.from("acessos_alunos").select("aluno_id").eq("user_id", context.userId).eq("ativo", true).maybeSingle();
    if (!aparelho?.aprovado_em || !vinculo || aparelho.aluno_id !== vinculo.aluno_id) throw new Error("Aparelho não autorizado. Procure a equipe.");
    const { data, error } = await context.supabase.rpc("consultar_portal_aluno");
    if (error) throw new Error("Seu acesso de aluno não está disponível. Procure a equipe.");
    const aluno = portalAlunoSchema.parse(data);
    let fotoUrl: string | null = null;
    if (aluno.foto_path && !/^https?:\/\//i.test(aluno.foto_path)) {
      const { data: foto } = await context.supabase.storage.from("fotos-alunos").createSignedUrl(aluno.foto_path, 300);
      fotoUrl = foto?.signedUrl ?? null;
    }
    return { ...aluno, foto_path: undefined, fotoUrl };
  });

export const buscarAcessosAlunos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ busca: z.string().trim().max(100) }).strict().parse(d))
  .handler(async ({ data, context }) => {
    const { data: admin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!admin) throw new Error("Apenas administradores podem gerenciar acessos de alunos.");
    const termo = data.busca.replace(/[%_,().]/g, " ").trim();
    if (termo.length < 2) return [];
    const { data: alunos, error } = await context.supabase.from("alunos").select("id,nome,codigo,ativo").or(`nome.ilike.%${termo}%,codigo.ilike.%${termo}%`).order("nome").limit(20);
    if (error) throw new Error("Não foi possível buscar alunos.");
    const { data: vinculos, error: ve } = await context.supabase.from("acessos_alunos").select("aluno_id,ativo").in("aluno_id", (alunos ?? []).map(a => a.id));
    if (ve) throw new Error("Não foi possível consultar os acessos.");
    return (alunos ?? []).map(a => ({ ...a, acesso: vinculos?.find(v => v.aluno_id === a.id)?.ativo ?? false }));
  });

export const bloquearAcessoAluno = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ alunoId: z.string().uuid() }).strict().parse(d))
  .handler(async ({ data, context }) => {
    const { data: admin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!admin) throw new Error("Apenas administradores podem bloquear acessos de alunos.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("acessos_alunos").update({ ativo: false }).eq("aluno_id", data.alunoId);
    if (error) throw new Error("Não foi possível bloquear o acesso.");
    const { error: de } = await supabaseAdmin.from("aparelhos_alunos").update({ expires_at: new Date().toISOString() }).eq("aluno_id", data.alunoId);
    if (de) throw new Error("Não foi possível revogar os aparelhos.");
    return { ok: true };
  });