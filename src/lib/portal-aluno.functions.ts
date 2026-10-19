import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { emailContaAluno, liberarAlunoSchema, portalAlunoSchema } from "@/lib/portal-aluno";

export const consultarPortalAluno = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
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

export const liberarAcessoAluno = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => liberarAlunoSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: admin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!admin) throw new Error("Apenas administradores podem liberar acessos de alunos.");
    const { data: aluno, error: ae } = await context.supabase.from("alunos").select("id,codigo").eq("codigo", data.codigo).maybeSingle();
    if (ae || !aluno) throw new Error("Matrícula não encontrada.");
    const { data: vinculo, error: ve } = await context.supabase.from("acessos_alunos").select("user_id").eq("aluno_id", aluno.id).maybeSingle();
    if (ve) throw new Error("Não foi possível consultar o acesso.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (vinculo) {
      const { data: roles, error: re } = await context.supabase.from("user_roles").select("id").eq("user_id", vinculo.user_id);
      if (re || roles?.length) throw new Error("Esta conta não pode ser usada como aluno.");
      const { error } = await supabaseAdmin.auth.admin.updateUserById(vinculo.user_id, { password: data.senha });
      if (error) throw new Error("Não foi possível definir a senha. Escolha uma senha forte e tente novamente.");
      const { error: e } = await supabaseAdmin.from("acessos_alunos").update({ ativo: true }).eq("user_id", vinculo.user_id);
      if (e) throw new Error("Não foi possível liberar o acesso.");
    } else {
      // Account-specific confirmation: no email signup or global auto-confirm setting is changed.
      const { data: conta, error } = await supabaseAdmin.auth.admin.createUser({ email: emailContaAluno(aluno.codigo), password: data.senha, email_confirm: true });
      if (error || !conta.user) throw new Error("Não foi possível criar o acesso. Escolha uma senha forte ou procure o administrador.");
      const { error: e } = await supabaseAdmin.from("acessos_alunos").insert({ user_id: conta.user.id, aluno_id: aluno.id });
      if (e) {
        await supabaseAdmin.auth.admin.deleteUser(conta.user.id);
        throw new Error("Não foi possível vincular a matrícula ao acesso.");
      }
    }
    return { ok: true };
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
    return { ok: true };
  });