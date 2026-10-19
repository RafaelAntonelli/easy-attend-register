import { aparelhoAtual } from './aparelho-aluno.server';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
export async function validarPortal(supabase: SupabaseClient<Database>, userId: string, token?: string) {
 const [aparelho, {data:vinculo}] = await Promise.all([aparelhoAtual(token),supabase.from('acessos_alunos').select('aluno_id').eq('user_id',userId).eq('ativo',true).maybeSingle()]);
 if(!aparelho?.aprovado_em || !vinculo || aparelho.aluno_id!==vinculo.aluno_id) throw new Error('Aparelho não autorizado. Procure a equipe.');
 return {alunoId:vinculo.aluno_id,aparelhoId:aparelho.id};
}
export async function enviarPush(alunoIds:string[], titulo:string, mensagem:string, key:string, auth:string) {
 const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
 const tokens=[];
 for(let offset=0;;offset+=500){const {data:rows,error}=await supabaseAdmin.from('push_alunos').select('id,token,aparelho_id,user_id,aluno_id').in('aluno_id',alunoIds).order('id').range(offset,offset+499);if(error)throw new Error('Não foi possível buscar aparelhos para notificar.');tokens.push(...(rows??[]));if((rows??[]).length<500)break;}
 let enviados=0,falhas=0;
 for(const item of tokens??[]) {
 const {data:device}=await supabaseAdmin.from('aparelhos_alunos').select('id').eq('id',item.aparelho_id).eq('aluno_id',item.aluno_id).gt('expires_at',new Date().toISOString()).not('aprovado_em','is',null).maybeSingle();
 const {data:access}=await supabaseAdmin.from('acessos_alunos').select('user_id').eq('user_id',item.user_id).eq('aluno_id',item.aluno_id).eq('ativo',true).maybeSingle();
 if(!device || !access) continue;
 try {const r=await fetch('https://connector-gateway.lovable.dev/firebase_messaging/v1/projects/_/messages:send',{method:'POST',headers:{Authorization:`Bearer ${auth}`,'X-Connection-Api-Key':key,'Content-Type':'application/json'},body:JSON.stringify({message:{token:item.token,notification:{title:titulo,body:mensagem},data:{path:'/area-aluno'},webpush:{fcm_options:{link:'https://arenaaquaticalf.lovable.app/area-aluno'}}}})});
 if(r.ok) enviados++; else {falhas++; const body=await r.text(); console.error('Push delivery',r.status,body); if(body.includes('UNREGISTERED')) await supabaseAdmin.from('push_alunos').delete().eq('id',item.id);}
 }catch {falhas++;}
 }
 return {enviados,falhas};
}
