import {useCallback,useEffect,useRef,useState} from 'react';
import {useServerFn} from '@tanstack/react-start';
import {queryOptions,useQuery,useQueryClient} from '@tanstack/react-query';
import {toast} from 'sonner';
import {Bell,BellOff,BellRing,Check,Clock} from 'lucide-react';
import {Switch} from '@/components/ui/switch';
import {listarAvisosPortal,lerAvisoPortal,registrarPushPortal,obterLembretesPortal,salvarLembretesPortal} from '@/lib/portal-extras.functions';
import {tokenAparelhoLocal} from '@/lib/aparelho-local';
import {ativarPushPortal,aoReceberAviso,estadoPushInicial,type EstadoPush} from '@/lib/push-portal';
import {Button} from '@/components/ui/button';

export const avisosPortalConsulta=queryOptions({queryKey:['avisos-portal'],queryFn:()=>listarAvisosPortal({data:{aparelho:tokenAparelhoLocal()}}),refetchInterval:30000,refetchOnWindowFocus:true});

/** Notificações no aparelho: registra em silêncio quando já permitido e expõe o botão de ativação. */
export function usePushAluno(){
 const registrar=useServerFn(registrarPushPortal);const qc=useQueryClient();
 const [estado,setEstado]=useState<EstadoPush>('pendente');const [busy,setBusy]=useState(false);
 const ativar=useCallback(async(silencioso=false)=>{setBusy(true);try{const token=await ativarPushPortal();await registrar({data:{aparelho:tokenAparelhoLocal(),token}});setEstado('ativo');if(!silencioso)toast.success('Notificações ativadas neste aparelho.');}catch(e){const negado=typeof Notification!=='undefined'&&Notification.permission==='denied';setEstado(negado?'negado':estadoPushInicial());if(!silencioso)toast.error(e instanceof Error?e.message:'Falha ao ativar.');}finally{setBusy(false);}},[registrar]);
 useEffect(()=>{const inicial=estadoPushInicial();setEstado(inicial);if(inicial==='pendente'&&Notification.permission==='granted')void ativar(true);},[ativar]);
 useEffect(()=>{aoReceberAviso(()=>{void qc.invalidateQueries({queryKey:['avisos-portal']});});return()=>aoReceberAviso(null);},[qc]);
 return {estado,busy,ativar:()=>ativar(false)};
}
export type PushAluno=ReturnType<typeof usePushAluno>;

/** Mostra um toast quando chega um aviso novo com a área do aluno aberta. */
export function useAvisosNovos(onVer:()=>void){
 const {data:avisos=[]}=useQuery(avisosPortalConsulta);const vistos=useRef<Set<string>|null>(null);
 useEffect(()=>{if(!avisos.length&&vistos.current===null)return;const ids=new Set(avisos.map(a=>a.id));if(vistos.current===null){vistos.current=ids;return;}const novos=avisos.filter(a=>!a.lido_em&&!vistos.current!.has(a.id));vistos.current=ids;if(novos.length)toast(novos.length===1?`Novo aviso: ${novos[0]?.titulo??""}`:`${novos.length} novos avisos`,{icon:<BellRing className="size-4"/>,action:{label:'Ver',onClick:onVer},duration:10000});},[avisos,onVer]);
 return avisos.filter(a=>!a.lido_em).length;
}

export function ChamadaAvisos({naoLidos,push,onVer}:{naoLidos:number;push:PushAluno;onVer:()=>void}){
 const pedirPush=push.estado==='pendente';
 if(!naoLidos&&!pedirPush)return null;
 return <div className="mb-6 space-y-3">
  {naoLidos>0&&<div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-primary/40 bg-primary/10 p-4"><div className="flex items-center gap-3"><BellRing className="size-5 shrink-0 text-primary"/><p className="text-sm font-semibold">{naoLidos===1?'Você tem 1 aviso novo da Arena Aquática.':`Você tem ${naoLidos} avisos novos da Arena Aquática.`}</p></div><Button size="sm" onClick={onVer}>Ver avisos</Button></div>}
  {pedirPush&&<div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-card p-4"><div className="flex items-center gap-3"><Bell className="size-5 shrink-0 text-primary"/><div><p className="text-sm font-semibold">Receba os avisos no celular</p><p className="text-xs text-muted-foreground">Ative as notificações para ser avisado mesmo com o app fechado.</p></div></div><Button size="sm" variant="outline" disabled={push.busy} onClick={push.ativar}>{push.busy?'Ativando…':'Ativar notificações'}</Button></div>}
 </div>;
}

function StatusPush({push}:{push:PushAluno}){
 if(push.estado==='ativo')return <p className="flex items-center gap-2 text-sm text-muted-foreground"><BellRing className="size-4 text-primary"/>Notificações ativadas neste aparelho</p>;
 if(push.estado==='negado')return <p className="flex items-center gap-2 text-sm text-muted-foreground"><BellOff className="size-4"/>Notificações bloqueadas. Libere nas configurações do navegador para este site.</p>;
 if(push.estado==='nova-aba')return <p className="text-sm text-muted-foreground">Abra o app em uma aba própria para ativar notificações.</p>;
 if(push.estado==='indisponivel')return <p className="text-sm text-muted-foreground">Este navegador não oferece notificações.</p>;
 return <Button variant="outline" disabled={push.busy} onClick={push.ativar}><Bell className="mr-2 size-4"/>{push.busy?'Ativando…':'Ativar notificações'}</Button>;
}


const lembretesConsulta=queryOptions({queryKey:['lembretes-portal'],queryFn:()=>obterLembretesPortal({data:{aparelho:tokenAparelhoLocal()}})});

/** Liga ou desliga, para este aluno, os lembretes 30 e 15 minutos antes da aula. */
function LembretesAula(){
 const {data,isError}=useQuery(lembretesConsulta);const qc=useQueryClient();const salvar=useServerFn(salvarLembretesPortal);const [busy,setBusy]=useState(false);
 const alterar=async(ativo:boolean)=>{setBusy(true);try{await salvar({data:{aparelho:tokenAparelhoLocal(),ativo}});qc.setQueryData(lembretesConsulta.queryKey,d=>d?{...d,ativo}:d);toast.success(ativo?'Lembretes de aula ativados.':'Lembretes de aula desativados.');}catch(e){toast.error(e instanceof Error?e.message:'Falha ao salvar.');}finally{setBusy(false);}};
 if(isError)return <p role="alert" className="text-sm text-destructive">Não foi possível carregar os lembretes de aula.</p>;
 return <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-card p-4">
  <div className="flex min-w-0 items-start gap-3"><Clock className="mt-0.5 size-5 shrink-0 text-primary"/><div><label htmlFor="lembretes-aula" className="text-sm font-semibold">Lembretes de aula</label><p className="text-xs text-muted-foreground">Aviso 30 e 15 minutos antes de cada aula.</p>{data&&!data.agendados&&<p className="mt-1 text-xs font-medium text-foreground">Os lembretes estão pausados pela administração no momento.</p>}</div></div>
  <div className="flex items-center gap-2"><span className="text-sm text-muted-foreground">{data?.ativo?'Ativado':'Desativado'}</span><Switch id="lembretes-aula" checked={!!data?.ativo} disabled={!data||busy} onCheckedChange={v=>void alterar(v)} aria-label="Ativar ou desativar lembretes de aula"/></div>
 </div>;
}

export function AvisosPortal({push}:{push:PushAluno}){const {data:avisos=[],isError}=useQuery(avisosPortalConsulta);const qc=useQueryClient();const ler=useServerFn(lerAvisoPortal);
return <section className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="flex items-center gap-2 font-display text-xl font-semibold"><Bell className="size-5 text-primary"/>Avisos</h2><StatusPush push={push}/></div><LembretesAula/>{isError?<p role="alert" className="text-sm text-destructive">Não foi possível carregar avisos.</p>:!avisos.length?<p className="text-sm text-muted-foreground">Nenhum aviso recebido.</p>:<div className="divide-y divide-border">{avisos.map(a=><article className="py-4 space-y-2" key={a.id}><div className="flex items-center justify-between gap-3"><h3 className="flex items-center gap-2 font-semibold">{!a.lido_em&&<span className="size-2 shrink-0 rounded-full bg-primary" aria-label="Novo"/>}{a.titulo}</h3>{!a.lido_em&&<Button size="sm" variant="ghost" aria-label={`Marcar aviso ${a.titulo} como lido`} onClick={async()=>{try{await ler({data:{aparelho:tokenAparelhoLocal(),id:a.id}});await qc.invalidateQueries({queryKey:['avisos-portal']});}catch{toast.error('Não foi possível marcar como lido.');}}}><Check className="size-4"/></Button>}</div><p className="whitespace-pre-wrap break-words text-sm">{a.mensagem}</p><p className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString('pt-BR')}{a.lido_em?' · Lido':''}</p></article>)}</div>}</section>;}
