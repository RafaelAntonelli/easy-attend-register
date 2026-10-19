import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import QRCode from "qrcode";
import { LogOut, CalendarDays, FileCheck, UserRound } from "lucide-react";
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
    <header className="border-b border-border bg-card"><div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-5"><div className="flex items-center gap-3"><img src="/icons/icon-192x192.png" alt="Arena Aquática LF" className="size-10 rounded-lg" /><div><h1 className="font-display text-lg font-semibold">Arena Aquática LF</h1><p className="text-sm text-muted-foreground">Área do aluno</p></div></div><Button variant="outline" onClick={sair}><LogOut className="mr-2 size-4" />Sair</Button></div></header>
    <main className="mx-auto grid max-w-5xl gap-8 px-5 py-8 md:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
      {!aluno.ativo&&<div role="alert" className="border border-destructive rounded-md bg-destructive/10 p-4 md:col-span-2"><h2 className="font-semibold text-destructive">Compareça à administração</h2><p className="text-sm">Sua matrícula está inativa. Compareça à administração da Arena Aquática para verificar sua situação.</p></div>}
      <section aria-label="Crachá digital" className="self-start overflow-hidden rounded-lg border border-border bg-card">
        <div className="bg-primary px-5 py-4 text-primary-foreground"><h2 className="font-display font-semibold">Crachá digital</h2><p className="text-xs">Arena Aquática LF</p></div>
        <div className="flex flex-col items-center gap-4 p-6 text-center">{aluno.fotoUrl ? <img src={aluno.fotoUrl} alt={`Foto de ${aluno.nome}`} className="size-28 rounded-lg object-cover" /> : <div className="flex size-28 items-center justify-center rounded-lg bg-muted"><UserRound className="size-14 text-muted-foreground" /></div>}<h3 className="break-words font-display text-xl font-semibold">{aluno.nome}</h3><div><p className="text-xs text-muted-foreground">Matrícula</p><p className="font-mono text-lg font-semibold">{aluno.codigo}</p></div><Badge variant={aluno.ativo ? "default" : "secondary"}>{aluno.ativo ? "Aluno ativo" : "Aluno inativo"}</Badge><div className="flex aspect-square w-52 items-center justify-center">{qr ? <img src={qr} alt={`QR Code da matrícula ${aluno.codigo}`} className="h-full w-full" /> : <p className="text-sm text-muted-foreground">QR Code indisponível</p>}</div></div>
      </section>
      <div className="space-y-8">
        <div className="flex flex-wrap gap-2"><Button asChild variant="outline"><Link to="/perfil-aluno">Meu perfil</Link></Button><Button variant="outline" disabled={gerando} onClick={()=>gerar(false)}>Gerar crachá</Button><Button disabled={gerando} onClick={()=>gerar(true)}>Gerar PDF do crachá</Button></div>
        {cracha&&<img src={cracha} alt={`Crachá de ${aluno.nome}`} className="w-full max-w-xl rounded-md"/>}
        <section><h2 className="mb-4 flex items-center gap-2 font-display text-xl font-semibold"><CalendarDays className="size-5 text-primary" />Minhas turmas</h2>{aluno.turmas.length ? <div className="divide-y divide-border">{aluno.turmas.map(t => <article key={t.id} className="py-4 first:pt-0"><h3 className="font-semibold">{t.nome}</h3><p className="mt-1 text-sm text-muted-foreground">{t.modalidade}</p><dl className="mt-3 grid gap-2 text-sm"><div><dt className="inline text-muted-foreground">Dias: </dt><dd className="inline">{t.dias_semana.join(" e ") || "Não informado"}</dd></div><div><dt className="inline text-muted-foreground">Horário: </dt><dd className="inline">{t.horario || "Não informado"}</dd></div>{t.professor && <div><dt className="inline text-muted-foreground">Professor: </dt><dd className="inline">{t.professor}</dd></div>}</dl></article>)}</div> : <p className="text-sm text-muted-foreground">Nenhuma turma ativa vinculada.</p>}</section>
        <section className="border-t border-border pt-6"><h2 className="mb-4 flex items-center gap-2 font-display text-xl font-semibold"><FileCheck className="size-5 text-primary" />Atestado médico</h2><Badge variant={situacao === "Vencido" ? "destructive" : "secondary"}>{situacao}</Badge>{aluno.atestado_entregue && validade && <p className="mt-3 text-sm text-muted-foreground">Validade: {validade.toLocaleDateString("pt-BR")}</p>}</section>
        <AvisosPortal />
      </div>
    </main>
  </div>;
}