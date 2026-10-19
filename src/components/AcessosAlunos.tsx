import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Search, Smartphone, Lock } from "lucide-react";
import { toast } from "sonner";
import { buscarAcessosAlunos, bloquearAcessoAluno } from "@/lib/portal-aluno.functions";
import { aprovarAparelho } from "@/lib/aparelho-aluno.functions";
import { aprovarAparelhoSchema } from "@/lib/portal-aluno";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Aluno = Awaited<ReturnType<typeof buscarAcessosAlunos>>[number];
export function AcessosAlunos() {
  const buscar = useServerFn(buscarAcessosAlunos), liberar = useServerFn(aprovarAparelho), bloquear = useServerFn(bloquearAcessoAluno);
  const [busca, setBusca] = useState("");
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [selecionado, setSelecionado] = useState<Aluno | null>(null);
  const [codigo, setCodigo] = useState("");
  const [confirmado, setConfirmado] = useState(false);
  const [busy, setBusy] = useState(false);
  const [consultado, setConsultado] = useState(false);
  async function pesquisar(e?: React.FormEvent) {
    e?.preventDefault(); setBusy(true);
    try { setAlunos(await buscar({ data: { busca } })); setConsultado(true); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível buscar."); }
    finally { setBusy(false); }
  }
  async function salvar(e: React.FormEvent) {
    e.preventDefault(); if (!selecionado || !confirmado) return;
    const dados = aprovarAparelhoSchema.safeParse({ codigo: selecionado.codigo, aparelho: codigo });
    if (!dados.success) { toast.error(dados.error.issues[0]?.message); return; }
    setBusy(true);
    try { await liberar({ data: dados.data }); setSelecionado(null); toast.success("Aparelho liberado. O aluno já pode entrar sem senha."); await pesquisar(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível liberar."); }
    finally { setBusy(false); }
  }
  return <section className="space-y-4">
    <h2 className="font-display text-lg font-semibold">Acessos dos alunos</h2>
    <form onSubmit={pesquisar} className="flex max-w-lg gap-2"><Input aria-label="Buscar aluno para liberar acesso" placeholder="Nome ou matrícula" maxLength={100} value={busca} onChange={e => setBusca(e.target.value)} /><Button type="submit" disabled={busy || busca.trim().length < 2}><Search className="mr-2 size-4" />Buscar</Button></form>
    {consultado && !alunos.length && <p className="text-sm text-muted-foreground">Nenhum aluno encontrado.</p>}
    <div className="divide-y divide-border">{alunos.map(a => <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><p className="font-medium">{a.nome}</p><p className="text-sm text-muted-foreground">Matrícula: {a.codigo} · {a.ativo ? "Ativo" : "Inativo"}</p><Badge variant={a.acesso ? "default" : "secondary"}>{a.acesso ? "Acesso liberado" : "Sem acesso"}</Badge></div><div className="flex flex-wrap gap-2"><Button variant="outline" disabled={busy || !a.ativo} onClick={() => { setCodigo(""); setConfirmado(false); setSelecionado(a); }}><Smartphone className="mr-2 size-4" />Liberar aparelho</Button>{a.acesso && <Button variant="outline" disabled={busy} onClick={async () => { setBusy(true); try { await bloquear({ data: { alunoId: a.id } }); toast.success("Acesso e aparelhos bloqueados."); await pesquisar(); } catch (e) { toast.error(e instanceof Error ? e.message : "Falha ao bloquear."); } finally { setBusy(false); } }}><Lock className="mr-2 size-4" />Bloquear</Button>}</div></div>)}</div>
    <Dialog open={!!selecionado} onOpenChange={v => { if (!v && !busy) setSelecionado(null); }}><DialogContent><DialogHeader><DialogTitle>Liberar aparelho do aluno</DialogTitle></DialogHeader><p>{selecionado?.nome} · {selecionado?.codigo}</p><form onSubmit={salvar} className="space-y-4"><div className="space-y-2"><Label htmlFor="codigo-aparelho">Código exibido no aparelho</Label><Input id="codigo-aparelho" maxLength={12} minLength={12} autoComplete="off" required value={codigo} onChange={e => setCodigo(e.target.value.toUpperCase())} /></div><div className="flex items-start gap-2"><Checkbox id="identidade-confirmada" checked={confirmado} onCheckedChange={v => setConfirmado(v === true)} /><Label htmlFor="identidade-confirmada">Confirmei presencialmente a identidade do aluno ou responsável e o aparelho apresentado.</Label></div><Button type="submit" disabled={busy || !confirmado}>{busy ? "Salvando…" : "Confirmar liberação"}</Button></form></DialogContent></Dialog>
  </section>;
}
