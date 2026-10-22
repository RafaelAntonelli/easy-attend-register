import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { z } from 'zod';
import { fotoPortalSchema } from './portal-extras';

const BUCKET = 'fotos-equipe';

async function exigirEquipe(supabase: { rpc: (fn: 'is_staff', args: { _user_id: string }) => PromiseLike<{ data: boolean | null }> }, userId: string) {
  const { data } = await supabase.rpc('is_staff', { _user_id: userId });
  if (!data) throw new Error('Apenas a equipe pode usar esta tela.');
}

/** Dados do próprio membro da equipe para a tela Meu perfil. */
export const obterMeuPerfil = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  await exigirEquipe(context.supabase, context.userId);
  const { data: perfil, error } = await context.supabase.from('profiles').select('nome,email,telefone,foto_path').eq('id', context.userId).maybeSingle();
  if (error) throw new Error('Não foi possível carregar seu perfil.');
  let fotoUrl: string | null = null;
  if (perfil?.foto_path) {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(perfil.foto_path, 600);
    fotoUrl = data?.signedUrl ?? null;
  }
  return { nome: perfil?.nome ?? '', email: perfil?.email ?? '', telefone: perfil?.telefone ?? '', fotoUrl };
});

export const salvarTelefoneEquipe = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ telefone: z.string().trim().max(20) }).strict().parse(d))
  .handler(async ({ data, context }) => {
    await exigirEquipe(context.supabase, context.userId);
    const { error } = await context.supabase.from('profiles').update({ telefone: data.telefone || null }).eq('id', context.userId);
    if (error) throw new Error('Não foi possível salvar o telefone.');
    return { ok: true };
  });

export const salvarFotoEquipe = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => fotoPortalSchema.parse(d))
  .handler(async ({ data, context }) => {
    await exigirEquipe(context.supabase, context.userId);
    let bytes: Uint8Array;
    try { bytes = Uint8Array.from(atob(data.base64), (c) => c.charCodeAt(0)); } catch { throw new Error('Foto inválida.'); }
    const jpg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    const png = bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71;
    const webp = new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF' && new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP';
    if (bytes.length > 5 * 1024 * 1024 || !(data.tipo === 'image/jpeg' ? jpg : data.tipo === 'image/png' ? png : webp)) throw new Error('Use uma foto JPG, PNG ou WebP de até 5 MB.');
    const { data: atual } = await context.supabase.from('profiles').select('foto_path').eq('id', context.userId).maybeSingle();
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const path = `${context.userId}/perfil-${crypto.randomUUID()}.${jpg ? 'jpg' : png ? 'png' : 'webp'}`;
    const { error: upload } = await supabaseAdmin.storage.from(BUCKET).upload(path, bytes, { contentType: data.tipo });
    if (upload) throw new Error('Não foi possível enviar a foto.');
    const { error } = await context.supabase.from('profiles').update({ foto_path: path }).eq('id', context.userId);
    if (error) { await supabaseAdmin.storage.from(BUCKET).remove([path]); throw new Error('Não foi possível salvar a foto.'); }
    if (atual?.foto_path && atual.foto_path.startsWith(`${context.userId}/`)) await supabaseAdmin.storage.from(BUCKET).remove([atual.foto_path]);
    return { ok: true };
  });

/** Fotos da equipe para a tela Equipe (somente administradores). */
export const fotosEquipe = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data: admin } = await context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'admin' });
  if (!admin) throw new Error('Apenas administradores.');
  const { data: perfis } = await context.supabase.from('profiles').select('id,foto_path').not('foto_path', 'is', null);
  const lista = (perfis ?? []).filter((p): p is { id: string; foto_path: string } => !!p.foto_path);
  if (!lista.length) return {} as Record<string, string>;
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { data } = await supabaseAdmin.storage.from(BUCKET).createSignedUrls(lista.map((p) => p.foto_path), 600);
  const mapa: Record<string, string> = {};
  lista.forEach((p, i) => { const url = data?.[i]?.signedUrl; if (url) mapa[p.id] = url; });
  return mapa;
});
