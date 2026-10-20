import {createServerFn} from '@tanstack/react-start';
import {requireSupabaseAuth} from '@/integrations/supabase/auth-middleware';
import {z} from 'zod';
import {tokenAparelhoSchema} from './portal-aluno';
import {contatoPortalSchema,fotoPortalSchema,avisoPortalSchema} from './portal-extras';
const dispositivo=z.object({aparelho:tokenAparelhoSchema}).strict();
export const obterPerfilPortal=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((d:unknown)=>dispositivo.parse(d)).handler(async({data,context})=>{
 const {validarPortal}=await import('./portal-extras.server'); await validarPortal(context.supabase,context.userId,data.aparelho);
 const {data:perfil,error}=await context.supabase.rpc('perfil_portal_aluno'); if(error || !perfil) throw new Error('Não foi possível carregar o perfil.');
 return z.object({nome:z.string(),codigo:z.string(),data_nascimento:z.string().nullable(),telefone:z.string().nullable(),telefone2:z.string().nullable(),email:z.string().nullable(),responsavel:z.string().nullable(),rg:z.string().nullable(),cpf:z.string().nullable(),pcd:z.boolean()}).parse(perfil);
});
export const salvarContatoPortal=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((d:unknown)=>z.object({aparelho:tokenAparelhoSchema,contato:contatoPortalSchema}).strict().parse(d)).handler(async({data,context})=>{
 const {validarPortal}=await import('./portal-extras.server'); await validarPortal(context.supabase,context.userId,data.aparelho);
 const {error}=await context.supabase.rpc('editar_contato_portal',{_telefone:data.contato.telefone,_telefone2:data.contato.telefone2,_email:data.contato.email}); if(error) throw new Error('Não foi possível salvar o contato.'); return {ok:true};
});
export const salvarFotoPortal=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((d:unknown)=>z.object({aparelho:tokenAparelhoSchema,foto:fotoPortalSchema}).strict().parse(d)).handler(async({data,context})=>{
 const {validarPortal}=await import('./portal-extras.server'); const {alunoId}=await validarPortal(context.supabase,context.userId,data.aparelho);
 let bytes:Uint8Array; try {bytes=Uint8Array.from(atob(data.foto.base64),c=>c.charCodeAt(0));}catch{throw new Error('Foto inválida.');}
 const jpg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255; const png=bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71; const webp=new TextDecoder().decode(bytes.slice(0,4))==='RIFF'&&new TextDecoder().decode(bytes.slice(8,12))==='WEBP';
 if(bytes.length>5*1024*1024 || !(data.foto.tipo==='image/jpeg'?jpg:data.foto.tipo==='image/png'?png:webp)) throw new Error('Use uma foto JPG, PNG ou WebP de até 5 MB.');
 const {supabaseAdmin}=await import('@/integrations/supabase/client.server'); const path=`${alunoId}/perfil-${crypto.randomUUID()}.${jpg?'jpg':png?'png':'webp'}`;
 const {error:upload}=await supabaseAdmin.storage.from('fotos-alunos').upload(path,bytes,{contentType:data.foto.tipo}); if(upload) throw new Error('Não foi possível enviar a foto.');
 const {error}=await supabaseAdmin.from('alunos').update({foto_path:path}).eq('id',alunoId); if(error){await supabaseAdmin.storage.from('fotos-alunos').remove([path]);throw new Error('Não foi possível salvar a foto.');} return {ok:true};
});
export const listarAvisosPortal=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((d:unknown)=>dispositivo.parse(d)).handler(async({data,context})=>{
 const {validarPortal}=await import('./portal-extras.server'); const {alunoId}=await validarPortal(context.supabase,context.userId,data.aparelho);
 const {data:avisos,error}=await context.supabase.from('avisos_alunos').select('id,titulo,mensagem,created_at,lido_em').eq('aluno_id',alunoId).order('created_at',{ascending:false}).limit(100);if(error)throw new Error('Não foi possível carregar avisos.');return avisos??[];
});
export const lerAvisoPortal=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((d:unknown)=>dispositivo.extend({id:z.string().uuid()}).parse(d)).handler(async({data,context})=>{
 const {validarPortal}=await import('./portal-extras.server');await validarPortal(context.supabase,context.userId,data.aparelho);const {error}=await context.supabase.rpc('marcar_aviso_lido',{_id:data.id});if(error)throw new Error('Não foi possível marcar aviso.');return {ok:true};
});
export const registrarPushPortal=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((d:unknown)=>dispositivo.extend({token:z.string().min(20).max(4096)}).parse(d)).handler(async({data,context})=>{
 const {validarPortal}=await import('./portal-extras.server');const {alunoId,aparelhoId}=await validarPortal(context.supabase,context.userId,data.aparelho);const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
 const {error}=await supabaseAdmin.from('push_alunos').upsert({token:data.token,user_id:context.userId,aluno_id:alunoId,aparelho_id:aparelhoId},{onConflict:'token'});if(error)throw new Error('Não foi possível ativar avisos.');return {ok:true};
});
export const enviarAvisoEquipe=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((d:unknown)=>avisoPortalSchema.parse(d)).handler(async({data,context})=>{
 const {data:admin}=await context.supabase.rpc('has_role',{_user_id:context.userId,_role:'admin'});if(!admin)throw new Error('Apenas administradores podem enviar avisos.');
 let query=context.supabase.from('alunos').select('id').order('id');if(data.alunoId)query=query.eq('id',data.alunoId);
 const ids:string[]=[];for(let offset=0;;offset+=500){const {data:rows,error}=await query.range(offset,offset+499);if(error)throw new Error('Não foi possível buscar destinatários.');ids.push(...(rows??[]).map(r=>r.id));if((rows??[]).length<500)break;}
 if(!ids.length)throw new Error('Aluno não encontrado.');const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
 for(let i=0;i<ids.length;i+=500){const {error}=await supabaseAdmin.from('avisos_alunos').insert(ids.slice(i,i+500).map(aluno_id=>({aluno_id,titulo:data.titulo,mensagem:data.mensagem,autor_id:context.userId})));if(error)throw new Error('Não foi possível salvar avisos.');}
 // O aviso já está salvo na central da área do aluno; o celular é um canal extra.
 // Se a notificação no aparelho falhar ou não estiver disponível, o aviso continua garantido no app.
 const key=process.env['FIREBASE_MESSAGING_API_KEY'],auth=process.env['LOVABLE_API_KEY'];
 if(!key||!auth){console.error('[avisos] notificações no celular indisponíveis: conexão não configurada');return {destinatarios:ids.length,enviados:0,falhas:0,pushIndisponivel:true};}
 try{const {enviarPush}=await import('./portal-extras.server');const entrega=await enviarPush(ids,data.titulo,data.mensagem,key,auth);return {destinatarios:ids.length,...entrega,pushIndisponivel:false};}
 catch(err){console.error('[avisos] falha ao enviar notificações no celular',err);return {destinatarios:ids.length,enviados:0,falhas:0,pushIndisponivel:true};}
});
export const obterLembretesPortal=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((d:unknown)=>dispositivo.parse(d)).handler(async({data,context})=>{
 const {validarPortal}=await import('./portal-extras.server');await validarPortal(context.supabase,context.userId,data.aparelho);
 const {data:r,error}=await context.supabase.rpc('lembretes_portal');if(error||!r)throw new Error('Não foi possível carregar os lembretes.');
 return z.object({ativo:z.boolean(),agendados:z.boolean()}).parse(r);
});
export const salvarLembretesPortal=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((d:unknown)=>dispositivo.extend({ativo:z.boolean()}).parse(d)).handler(async({data,context})=>{
 const {validarPortal}=await import('./portal-extras.server');await validarPortal(context.supabase,context.userId,data.aparelho);
 const {error}=await context.supabase.rpc('definir_lembretes_portal',{_ativo:data.ativo});if(error)throw new Error('Não foi possível salvar a preferência.');return {ok:true};
});
