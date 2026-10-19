import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PERMISSOES_PROFESSOR } from "@/lib/permissoes";

export const confirmarSenhaPermissoes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ senha: z.string().min(1).max(256) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: admin, error: roleError } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (roleError || !admin) throw new Error("Apenas administradores podem acessar as permissões.");
    const { data: usuario, error: userError } = await context.supabase.auth.getUser();
    if (userError || !usuario.user?.email) throw new Error("Não foi possível confirmar o administrador.");
    const url = process.env['SUPABASE_URL'];
    const key = process.env['SUPABASE_PUBLISHABLE_KEY'];
    if (!url || !key) throw new Error("Serviço de confirmação indisponível.");
    const resposta = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: "POST", headers: { apikey: key, "Content-Type": "application/json" },
      body: JSON.stringify({ email: usuario.user.email, password: data.senha }),
    });
    if (!resposta.ok) throw new Error(resposta.status === 429 ? "Muitas tentativas. Aguarde antes de tentar novamente." : "Senha incorreta. Tente novamente.");
    const autenticado = await resposta.json() as { user?: { id?: string } };
    if (autenticado.user?.id !== context.userId) throw new Error("Não foi possível confirmar o administrador.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { hashConfirmacao } = await import("@/lib/permissoes-admin.server");
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const { error } = await supabaseAdmin.from("confirmacoes_permissoes_admin").upsert({ user_id: context.userId, token_hash: await hashConfirmacao(token), expires_at: expiresAt });
    if (error) throw new Error("Não foi possível liberar as permissões.");
    return { token, expiresAt };
  });

export const alterarPermissaoProfessor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ token: z.string().uuid(), chave: z.string(), ativo: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: admin, error: roleError } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (roleError || !admin) throw new Error("Apenas administradores podem alterar as permissões.");
    if (!PERMISSOES_PROFESSOR.some((p) => p.chave === data.chave)) throw new Error("Permissão inválida.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { hashConfirmacao, confirmacaoValida } = await import("@/lib/permissoes-admin.server");
    const { data: registro, error: readError } = await supabaseAdmin.from("confirmacoes_permissoes_admin").select("token_hash, expires_at").eq("user_id", context.userId).maybeSingle();
    if (readError || !confirmacaoValida(registro, await hashConfirmacao(data.token))) throw new Error("Confirme novamente a senha do administrador.");
    const { error } = await supabaseAdmin.from("permissoes_professor").upsert({ chave: data.chave, ativo: data.ativo, updated_at: new Date().toISOString() });
    if (error) throw new Error("Não foi possível atualizar a permissão.");
    return { ok: true };
  });

/** Apaga a conta de alguém que ainda aguarda liberação (sem nenhum papel). Só administradores. */
export const removerContaPendente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: ehAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!ehAdmin) throw new Error("Apenas administradores podem remover contas.");
    if (data.userId === context.userId) throw new Error("Você não pode remover a própria conta.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: aluno, error: alunoError } = await context.supabase.from("acessos_alunos").select("user_id").eq("user_id", data.userId).maybeSingle();
    if (alunoError || aluno) throw new Error("Contas de alunos devem ser gerenciadas em Acessos dos alunos.");
    const { count } = await supabaseAdmin
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("user_id", data.userId);
    if (count) throw new Error("Só é possível remover contas que ainda aguardam liberação.");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
