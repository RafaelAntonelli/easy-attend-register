import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { aprovarAparelhoSchema, entradaAparelhoSchema, emailContaAluno } from "./portal-aluno";

export const prepararAparelho = createServerFn({ method: "POST" }).handler(async () => {
  const { aparelhoAtual, gravarAparelho, hashToken, limitarEntrada } = await import("./aparelho-aluno.server");
  await limitarEntrada();
  const atual = await aparelhoAtual();
  if (atual) return { codigo: atual.codigo, aprovado: !!atual.aprovado_em };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, "0")).join("");
  const codigo = crypto.randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase();
  const { error } = await supabaseAdmin.from("aparelhos_alunos").insert({ token_hash: await hashToken(token), codigo });
  if (error) throw new Error("Não foi possível preparar o aparelho.");
  gravarAparelho(token);
  return { codigo, aprovado: false };
});

export const aprovarAparelho = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d: unknown) => aprovarAparelhoSchema.parse(d)).handler(async ({ data, context }) => {
  const { data: admin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (!admin) throw new Error("Apenas administradores podem liberar aparelhos.");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: aluno } = await context.supabase.from("alunos").select("id,codigo,ativo").eq("codigo", data.codigo).maybeSingle();
  if (!aluno?.ativo) throw new Error("Aluno ativo não encontrado.");
  const { data: device } = await supabaseAdmin.from("aparelhos_alunos").select("id").eq("codigo", data.aparelho).is("aprovado_em", null).gt("expires_at", new Date().toISOString()).maybeSingle();
  if (!device) throw new Error("Código inválido, vencido ou já utilizado. Gere outro no aparelho do aluno.");
  const { data: link } = await supabaseAdmin.from("acessos_alunos").select("user_id").eq("aluno_id", aluno.id).maybeSingle();
  const password = crypto.randomUUID() + crypto.randomUUID();
  if (link) {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(link.user_id, { password });
    if (error) throw new Error("Falha ao atualizar acesso.");
    const { error: e } = await supabaseAdmin.from("acessos_alunos").update({ ativo: true }).eq("user_id", link.user_id);
    if (e) throw new Error("Falha ao liberar acesso.");
  } else {
    const { data: conta, error } = await supabaseAdmin.auth.admin.createUser({ email: emailContaAluno(aluno.codigo), password, email_confirm: true });
    if (error || !conta.user) throw new Error("Falha ao liberar acesso.");
    const { error: e } = await supabaseAdmin.from("acessos_alunos").insert({ user_id: conta.user.id, aluno_id: aluno.id });
    if (e) { await supabaseAdmin.auth.admin.deleteUser(conta.user.id); throw new Error("Falha ao vincular acesso."); }
  }
  const { data: aprovado, error } = await supabaseAdmin.from("aparelhos_alunos").update({ aluno_id: aluno.id, aprovado_por: context.userId, aprovado_em: new Date().toISOString(), expires_at: new Date(Date.now() + 180 * 86400000).toISOString() }).eq("id", device.id).is("aprovado_em", null).select("id").maybeSingle();
  if (error || !aprovado) throw new Error("Não foi possível aprovar o aparelho.");
  return { ok: true };
});

export const entrarAparelho = createServerFn({ method: "POST" }).inputValidator((d: unknown) => entradaAparelhoSchema.parse(d)).handler(async ({ data }) => {
  const { aparelhoAtual, limitarEntrada } = await import("./aparelho-aluno.server");
  await limitarEntrada();
  const device = await aparelhoAtual();
  if (!device?.aprovado_em || !device.aluno_id) throw new Error("Este aparelho precisa de liberação presencial pela equipe.");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: aluno } = await supabaseAdmin.from("alunos").select("id,codigo,cpf,data_nascimento,ativo").eq("id", device.aluno_id).maybeSingle();
  if (!aluno?.ativo || aluno.data_nascimento !== data.nascimento || (aluno.codigo !== data.identificador && aluno.cpf?.replace(/\D/g, "") !== data.identificador)) throw new Error("Confira os dados ou procure a equipe.");
  const { data: vinculo } = await supabaseAdmin.from("acessos_alunos").select("user_id").eq("aluno_id", aluno.id).eq("ativo", true).maybeSingle();
  if (!vinculo) throw new Error("Confira os dados ou procure a equipe.");
  const { data: link, error } = await supabaseAdmin.auth.admin.generateLink({ type: "magiclink", email: emailContaAluno(aluno.codigo) });
  if (error || !link.properties?.hashed_token || link.user?.id !== vinculo.user_id) throw new Error("Não foi possível entrar.");
  return { token: link.properties.hashed_token };
});