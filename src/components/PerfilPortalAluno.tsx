import {useRef,useState} from 'react';
import {Camera,ImagePlus} from 'lucide-react';
import {useServerFn} from '@tanstack/react-start';
import {queryOptions,useSuspenseQuery,useQueryClient} from '@tanstack/react-query';
import {toast} from 'sonner';
import {obterPerfilPortal,salvarContatoPortal,salvarFotoPortal} from '@/lib/portal-extras.functions';
import {tokenAparelhoLocal} from '@/lib/aparelho-local';
import {Button} from '@/components/ui/button';import {Input} from '@/components/ui/input';import {Label} from '@/components/ui/label';
export const perfilPortalConsulta=queryOptions({queryKey:['perfil-portal'],queryFn:()=>obterPerfilPortal({data:{aparelho:tokenAparelhoLocal()}})});
export function PerfilPortalAluno(){const {data:perfil}=useSuspenseQuery(perfilPortalConsulta);const qc=useQueryClient();const salvar=useServerFn(salvarContatoPortal),foto=useServerFn(salvarFotoPortal);const [contato,setContato]=useState({telefone:perfil.telefone??'',telefone2:perfil.telefone2??'',email:perfil.email??''});const [busy,setBusy]=useState(false);
const cameraRef=useRef<HTMLInputElement>(null),galeriaRef=useRef<HTMLInputElement>(null);
async function enviarFoto(e:React.ChangeEvent<HTMLInputElement>){
  const input=e.currentTarget,file=input.files?.[0];
  if(!file)return;
  if(file.size>5*1024*1024){toast.error('Use uma foto de até 5 MB.');input.value='';return;}
  const tipo=file.type;
  if(tipo!=='image/jpeg'&&tipo!=='image/png'&&tipo!=='image/webp'){toast.error('Use uma foto JPG, PNG ou WebP.');input.value='';return;}
  setBusy(true);
  try{
    const base64=await new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).split(',')[1]??'');r.onerror=()=>reject(new Error('Não foi possível ler a foto.'));r.readAsDataURL(file);});
    await foto({data:{aparelho:tokenAparelhoLocal(),foto:{tipo,base64}}});
    await Promise.all([qc.invalidateQueries({queryKey:['portal-aluno']}),qc.invalidateQueries({queryKey:['perfil-portal']}),qc.invalidateQueries({queryKey:['alunos']})]);
    toast.success('Foto atualizada no cadastro.');
  }catch(e){toast.error(e instanceof Error?e.message:'Falha ao enviar foto.');}finally{setBusy(false);input.value='';}
}
return <section className="max-w-2xl space-y-6"><h2 className="font-display text-xl font-semibold">Meu perfil</h2><dl className="grid gap-4 sm:grid-cols-2">{[['Nome',perfil.nome],['Matrícula',perfil.codigo],['Nascimento',perfil.data_nascimento?.split('-').reverse().join('/')],['Responsável',perfil.responsavel],['CPF / RG',perfil.cpf||perfil.rg]].map(([k,v])=><div key={k}><dt className="text-sm text-muted-foreground">{k}</dt><dd className="break-words font-medium">{v||'Não informado'}</dd></div>)}</dl><form className="space-y-4" onSubmit={async e=>{e.preventDefault();setBusy(true);try{await salvar({data:{aparelho:tokenAparelhoLocal(),contato}});await qc.invalidateQueries({queryKey:['perfil-portal']});toast.success('Contato atualizado no cadastro.');}catch(e){toast.error(e instanceof Error?e.message:'Falha ao salvar.');}finally{setBusy(false);}}}>{([['telefone','Telefone'],['telefone2','Outro telefone'],['email','E-mail']] as const).map(([key,label])=><div className="space-y-2" key={key}><Label htmlFor={`perfil-${key}`}>{label}</Label><Input id={`perfil-${key}`} type={key==='email'?'email':'tel'} maxLength={key==='email'?254:20} value={contato[key]} onChange={e=>setContato(v=>({...v,[key]:e.target.value}))}/></div>)}<Button disabled={busy} type="submit">{busy?'Salvando…':'Salvar contato'}</Button></form><div className="space-y-3 border-t border-border pt-6"><h3 className="text-sm font-medium">Alterar foto do perfil</h3><div className="flex flex-wrap gap-2"><Button type="button" disabled={busy} onClick={()=>cameraRef.current?.click()}><Camera className="mr-2 size-4"/>Tirar foto</Button><Button type="button" variant="outline" disabled={busy} onClick={()=>galeriaRef.current?.click()}><ImagePlus className="mr-2 size-4"/>Escolher foto</Button></div><input ref={cameraRef} id="foto-camera-portal" className="hidden" aria-label="Foto pela câmera" type="file" accept="image/jpeg,image/png,image/webp" capture="user" disabled={busy} onChange={enviarFoto}/><input ref={galeriaRef} id="foto-portal" className="hidden" aria-label="Foto da galeria" type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={enviarFoto}/>{busy&&<p role="status" className="text-sm text-muted-foreground">Salvando…</p>}</div></section>;}
