import { useMemo, useState } from "react";
import { ClipboardCheck, Pencil, Search, UserRound } from "lucide-react";
import { MOTIVOS_REVISAO, revisarCadastros } from "@/lib/revisao-cadastros";
import type { AlunoPlanilha } from "@/lib/planilha-alunos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EstadoVazio } from "@/components/EstadoVazio";

export function RevisaoCadastros<T extends AlunoPlanilha>({ alunos, podeEditar, onEditar, onPerfil }: { alunos: T[]; podeEditar: boolean; onEditar: (aluno: T) => void; onPerfil: (id: string) => void }) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [motivo, setMotivo] = useState("todos");
  const revisao = useMemo(() => revisarCadastros(alunos), [alunos]);
  const lista = revisao.filter((item) => (motivo === "todos" || item.motivos.some((m) => m === motivo)) && `${item.aluno.nome} ${item.aluno.codigo ?? ""}`.toLocaleLowerCase("pt-BR").includes(busca.toLocaleLowerCase("pt-BR")));
  return <>
    <Button variant="outline" onClick={() => setAberto(true)}><ClipboardCheck className="size-4" /> Revisão de cadastros <Badge variant="secondary">{revisao.length}</Badge></Button>
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader><DialogTitle>Revisão de cadastros</DialogTitle><DialogDescription>{revisao.length} alunos com itens para conferir. Documentos não anexados não significam que não foram entregues.</DialogDescription></DialogHeader>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1"><Search className="absolute left-3 top-3 size-4 text-muted-foreground" /><Input aria-label="Buscar cadastro para revisão" placeholder="Nome ou matrícula" className="pl-9" value={busca} onChange={(e) => setBusca(e.target.value)} /></div>
          <Select value={motivo} onValueChange={setMotivo}><SelectTrigger className="sm:w-64" aria-label="Motivo da revisão"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todos">Todos os motivos</SelectItem>{MOTIVOS_REVISAO.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select>
        </div>
        <ul className="divide-y divide-border" aria-label="Cadastros para revisão">{lista.map(({ aluno, motivos, documentos, duplicado }) => <li key={aluno.id} className="space-y-2 py-4">
          <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-semibold">{aluno.nome}</p><p className="text-xs text-muted-foreground">{aluno.codigo} · {aluno.ativo === false ? "Inativo" : "Ativo"}</p></div><div className="flex gap-2"><Button size="sm" variant="ghost" onClick={() => { setAberto(false); onPerfil(aluno.id); }}><UserRound className="size-4" /> Ver cadastro</Button>{podeEditar && <Button size="sm" variant="outline" onClick={() => { setAberto(false); onEditar(aluno); }}><Pencil className="size-4" /> Corrigir</Button>}</div></div>
          <div className="flex flex-wrap gap-2">{motivos.map((m) => <Badge key={m} variant="outline">{m}</Badge>)}</div>
          {documentos.length > 0 && <p className="text-xs text-muted-foreground">Sem anexo: {documentos.join(" · ")}</p>}
          {duplicado && <p className="text-xs text-destructive">Mesmo nome e nascimento de {duplicado.nome} ({duplicado.codigo}).</p>}
        </li>)}</ul>
        {!lista.length && <EstadoVazio titulo="Nenhum cadastro nesta seleção" descricao="Não há itens para conferir com os filtros escolhidos." />}
      </DialogContent>
    </Dialog>
  </>;
}