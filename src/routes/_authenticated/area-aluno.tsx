import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import QRCode from "qrcode";
import { LogOut, CalendarDays, FileCheck, UserRound, ArrowUpRight, Download, CreditCard, Clock3, Bell, Waves, ShieldCheck } from "lucide-react";
import { consultarPortalAluno } from "@/lib/portal-aluno.functions";
import { tokenAparelhoLocal } from "@/lib/aparelho-local";
import { supabase } from "@/integrations/supabase/client";
import { vencimentoAtestado, atestadoVencido } from "@/lib/atestado";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AvisosPortal } from "@/components/AvisosPortal";
import { obterPerfilPortal } from "@/lib/portal-extras.functions";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const consulta = queryOptions({ queryKey: ["portal-aluno"], queryFn: () => consultarPortalAluno({ data: { aparelho: tokenAparelhoLocal() } }), staleTime: 0 });
export const Route = createFileRoute("/_authenticated/area-aluno")({
  loader: ({ context }) => context.queryClient.ensureQueryData(consulta),
  head: () => ({ meta: [
    { title: "Área do aluno | Arena Aquática LF" },
    { name: "description", content: "Consulta individual de crachá digital, turmas e situação do atestado na Arena Aquática LF." },
    { property: "og:title", content: "Área do aluno | Arena Aquática LF" },
    { property: "og:description", content: "Acesso privado às informações do próprio aluno." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex,nofollow" },
  ] }),
  component: AreaAluno,
  errorComponent: AcessoIndisponivel,
});

function useSairAluno() {
  const navigate = useNavigate(); const qc = useQueryClient();
  return async () => { await qc.cancelQueries(); qc.clear(); await supabase.auth.signOut(); await navigate({ to: "/auth", replace: true }); };
}
function AcessoIndisponivel() {
  const sair = useSairAluno();
  return <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center"><h1 className="font-display text-xl font-semibold">Acesso indisponível</h1><p className="text-muted-foreground">Procure a equipe para verificar seu acesso de aluno.</p><Button variant="outline" onClick={sair}><LogOut className="mr-2 size-4" />Sair</Button></main>;
}
function AreaAluno() {
  const { data: aluno } = useSuspenseQuery(consulta); const sair = useSairAluno();
  const [qr, setQr] = useState("");
  const [cracha,setCracha]=useState(''); const [gerando,setGerando]=useState(false); const perfilFn=useServerFn(obterPerfilPortal);
  async function gerar(pdf:boolean){setGerando(true);try{const perfil=await perfilFn({data:{aparelho:tokenAparelhoLocal()}});const turma=aluno.turmas[0];const dados={nome:aluno.nome,codigo:aluno.codigo,rg:perfil.rg,cpf:perfil.cpf,responsavel:perfil.responsavel,telefone:perfil.telefone,pcd:perfil.pcd,modalidade:turma?.modalidade??null,horario:turma?.horario??null,dias:turma?.dias_semana??[],fotoUrl:aluno.fotoUrl};const lib=await import('@/lib/cracha');if(pdf)await lib.gerarCrachasPdfFielAoPreview([dados],`cracha-${aluno.codigo}.pdf`);else setCracha(await lib.gerarCrachaPreviewImagem(dados));}catch(e){toast.error(e instanceof Error?e.message:'Não foi possível gerar crachá.');}finally{setGerando(false);}}
  useEffect(() => { let ativo = true; QRCode.toDataURL(aluno.codigo, { width: 320, margin: 2, errorCorrectionLevel: "H" }).then(v => { if (ativo) setQr(v); }).catch(() => { if (ativo) setQr(""); }); return () => { ativo = false; }; }, [aluno.codigo]);
  const validade = vencimentoAtestado(aluno.atestado_data);
  const situacao = !aluno.atestado_entregue ? "Não entregue" : !validade ? "Data não informada" : atestadoVencido(aluno.atestado_data) ? "Vencido" : "Válido";
  return <div className="min-h-screen bg-background">
    <header className="bg-sidebar text-sidebar-foreground">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-5 sm:px-8">
        <div className="flex min-w-0 items-center gap-3"><img src="/icons/icon-192x192.png" alt="Arena Aquática LF" className="size-10 shrink-0 rounded-md"/><div><p className="font-display text-sm font-semibold sm:text-base">Arena Aquática LF</p><p className="text-xs text-sidebar-foreground/65">Portal do aluno</p></div></div>
        <Button variant="ghost" className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground" onClick={sair}><LogOut className="size-4 sm:mr-2"/><span className="hidden sm:inline">Sair</span><span className="sr-only sm:hidden">Sair</span></Button>
      </div>
    </header>
    <section className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-5 px-5 py-8 sm:px-8 sm:py-10">
        {aluno.fotoUrl?<img src={aluno.fotoUrl} alt={`Foto de ${aluno.nome}`} className="size-20 shrink-0 rounded-full object-cover ring-4 ring-secondary sm:size-24"/>:<div className="flex size-20 shrink-0 items-center justify-center rounded-full bg-secondary ring-4 ring-secondary/50 sm:size-24"><UserRound className="size-10 text-secondary-foreground"/></div>}
        <div className="min-w-0 flex-1"><p className="mb-1 text-sm text-muted-foreground">Bom ter você aqui</p><h1 className="break-words font-display text-2xl font-semibold sm:text-3xl">{aluno.nome}</h1><div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2"><p className="text-sm text-muted-foreground">Matrícula <span className="ml-1 font-mono font-semibold text-foreground">{aluno.codigo}</span></p><span className="flex items-center gap-1.5 text-xs font-medium"><span className={`size-2 rounded-full ${aluno.ativo?'bg-success':'bg-destructive'}`}/>{aluno.ativo?'Aluno ativo':'Aluno inativo'}</span></div></div>
        <Button asChild variant="outline" className="ml-auto"><Link to="/perfil-aluno"><UserRound className="mr-2 size-4"/>Meu perfil<ArrowUpRight className="ml-3 size-4"/></Link></Button>
      </div>
    </section>
    <main className="mx-auto max-w-6xl px-5 py-6 sm:px-8 sm:py-8">
      {!aluno.ativo&&<div role="alert" className="mb-6 rounded-md border border-destructive bg-destructive/10 p-4"><h2 className="font-semibold text-destructive">Compareça à administração</h2><p className="mt-1 text-sm">Sua matrícula está inativa. Compareça à administração da Arena Aquática para verificar sua situação.</p></div>}
      <Tabs defaultValue="inicio" className="gap-7">
        <TabsList className="h-auto w-full justify-start gap-1 rounded-none border-b border-border bg-transparent p-0">
          {[['inicio','Meu dia',CalendarDays],['cracha','Crachá',CreditCard],['avisos','Avisos',Bell]].map(([value,label,Icon])=>{const TabIcon=Icon as typeof CalendarDays;return <TabsTrigger key={String(value)} value={String(value)} className="h-12 flex-none rounded-none border-0 border-b-2 border-transparent px-3 text-muted-foreground shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none sm:px-5"><TabIcon className="mr-2 size-4"/>{String(label)}</TabsTrigger>;})}
        </TabsList>
        <TabsContent value="inicio">
          <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-10">
            <section className="min-w-0"><div className="mb-5 flex items-center justify-between"><h2 className="font-display text-xl font-semibold">Minhas turmas</h2><span className="text-sm text-muted-foreground">{aluno.turmas.length} {aluno.turmas.length===1?'turma':'turmas'}</span></div>
              {aluno.turmas.length?<div className="grid gap-4">{aluno.turmas.map(t=><article key={t.id} className="overflow-hidden rounded-lg border border-border bg-card"><div className="flex items-start gap-4 border-b border-border p-5"><div className="flex size-11 shrink-0 items-center justify-center rounded-md bg-secondary text-secondary-foreground"><Waves className="size-6"/></div><div className="min-w-0"><p className="mb-1 text-xs font-semibold uppercase text-primary">{t.modalidade}</p><h3 className="break-words text-base font-semibold">{t.nome}</h3></div></div><dl className="grid gap-5 p-5 sm:grid-cols-2"><div><dt className="mb-2 flex items-center gap-2 text-xs text-muted-foreground"><Clock3 className="size-4"/>Horário da aula</dt><dd className="text-xl font-semibold">{t.horario||'Não informado'}</dd></div><div><dt className="mb-2 flex items-center gap-2 text-xs text-muted-foreground"><CalendarDays className="size-4"/>Dias da semana</dt><dd className="text-sm font-semibold">{t.dias_semana.join(' e ')||'Não informado'}</dd></div>{t.professor&&<div className="sm:col-span-2"><dt className="text-xs text-muted-foreground">Professor</dt><dd className="mt-1 text-sm font-medium">{t.professor}</dd></div>}</dl></article>)}</div>:<div className="border-y border-border py-10 text-sm text-muted-foreground">Nenhuma turma ativa vinculada.</div>}
            </section>
            <aside className="space-y-7 lg:border-l lg:border-border lg:pl-7"><section><div className="mb-4 flex items-center gap-2"><FileCheck className="size-5 text-primary"/><h2 className="font-display text-base font-semibold">Atestado médico</h2></div><Badge variant={situacao==='Vencido'?'destructive':'secondary'} className="rounded-md">{situacao}</Badge>{aluno.atestado_entregue&&validade&&<p className="mt-3 text-sm text-muted-foreground">Validade: <span className="font-medium text-foreground">{validade.toLocaleDateString('pt-BR')}</span></p>}</section><div className="border-t border-border pt-6"><ShieldCheck className="mb-3 size-6 text-primary"/><p className="text-sm font-semibold">Seus dados</p><p className="mt-2 text-sm leading-relaxed text-muted-foreground">Contato e foto no seu perfil.</p><Button asChild variant="link" className="mt-2 h-auto px-0"><Link to="/perfil-aluno">Acessar meu perfil<ArrowUpRight className="ml-2 size-4"/></Link></Button></div></aside>
          </div>
        </TabsContent>
        <TabsContent value="cracha"><section aria-label="Crachá digital" className="grid items-start gap-8 md:grid-cols-[minmax(0,1fr)_240px]"><div><h2 className="font-display text-xl font-semibold">Meu crachá</h2><div className="my-5 flex flex-wrap gap-3"><Button variant="outline" disabled={gerando} onClick={()=>gerar(false)}><CreditCard className="mr-2 size-4"/>{gerando?'Gerando…':'Gerar crachá'}</Button><Button disabled={gerando} onClick={()=>gerar(true)}><Download className="mr-2 size-4"/>Gerar PDF do crachá</Button></div>{cracha?<img src={cracha} alt={`Crachá de ${aluno.nome}`} className="w-full max-w-xl rounded-lg"/>:<div className="flex min-h-40 max-w-xl items-center gap-4 rounded-md border border-dashed border-border p-6 text-muted-foreground"><CreditCard className="size-8 shrink-0"/><div><p className="font-medium text-foreground">{aluno.nome}</p><p className="mt-1 font-mono text-sm">{aluno.codigo}</p></div></div>}</div><div className="border-t border-border pt-6 md:border-l md:border-t-0 md:pl-7 md:pt-0"><p className="mb-4 text-sm font-semibold">Identificação para presença</p><div className="aspect-square w-44">{qr?<img src={qr} alt={`QR Code da matrícula ${aluno.codigo}`} className="h-full w-full rounded-md"/>:<p className="text-sm text-muted-foreground">QR Code indisponível</p>}</div><p className="mt-3 font-mono text-sm font-semibold">{aluno.codigo}</p></div></section></TabsContent>
        <TabsContent value="avisos"><AvisosPortal/></TabsContent>
      </Tabs>
      <footer className="mt-12 flex flex-wrap items-center justify-between gap-2 border-t border-border py-5 text-xs text-muted-foreground"><span>Arena Aquática LF</span><span>Programa Esporte 360</span></footer>
    </main>
  </div>;
}