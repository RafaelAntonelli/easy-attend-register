import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Users, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { HORARIOS_TURMA } from "@/lib/pcd";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/turmas")({
  component: TurmasPage,
  head: () => ({
    meta: [
      { title: "Turmas | Arena Aquática" },
      { name: "description", content: "Organize turmas de natação e hidroginástica com horários e professores." },
      { property: "og:title", content: "Turmas | Arena Aquática" },
      { property: "og:description", content: "Gestão de turmas e horários da Arena Aquática." },
    ],
  }),
});

type Turma = {
  id: string;
  nome: string;
  modalidade: string;
  professor: string | null;
  dias_semana: string[];
  horario: string | null;
  capacidade: number;
  ativa: boolean;
};

const GRUPOS = [
  { label: "Terça e Quinta", dias: ["Ter", "Qui"] },
  { label: "Quarta e Sexta", dias: ["Qua", "Sex"] },
] as const;

function grupoDosDias(dias: string[] | null) {
  const g = GRUPOS.find((x) => x.dias.every((d) => (dias ?? []).includes(d)));
  return g?.label ?? "";
}

type AlunoTurma = { id: string; nome: string; modalidade: string; status: string; pcd: boolean; foto_path: string | null };
type StatusPresenca = "presente" | "falta" | "falta_justificada";

function TurmasPage() {
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [contagem, setContagem] = useState<Record<string, number>>({});
  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState<Turma | null>(null);
  const [nome, setNome] = useState("");
  const [modalidade, setModalidade] = useState("Natação");
  const [professor, setProfessor] = useState("");
  const [grupo, setGrupo] = useState("");
  const [horario, setHorario] = useState("");
  const [capacidade, setCapacidade] = useState("40");
  const [filtroModalidade, setFiltroModalidade] = useState("todas");
  const [turmaAberta, setTurmaAberta] = useState<Turma | null>(null);
  const [alunosTurma, setAlunosTurma] = useState<AlunoTurma[] | null>(null);
  const [confirmarExclusao, setConfirmarExclusao] = useState<Turma | null>(null);

  async function carregar() {
    const [t, m] = await Promise.all([
      supabase.from("turmas").select("*").order("nome"),
      supabase.from("matriculas").select("turma_id"),
    ]);
    if (t.data) setTurmas(t.data as Turma[]);
    if (m.data) {
      const c: Record<string, number> = {};
      for (const row of m.data as { turma_id: string }[]) c[row.turma_id] = (c[row.turma_id] ?? 0) + 1;
      setContagem(c);
    }
  }

  useEffect(() => {
    void carregar();
  }, []);

  function abrirNova() {
    setEditando(null);
    setNome("");
    setModalidade("Natação");
    setProfessor("");
    setGrupo("");
    setHorario("");
    setCapacidade("40");
    setAberto(true);
  }

  function abrirEdicao(t: Turma) {
    setEditando(t);
    setNome(t.nome);
    setModalidade(t.modalidade);
    setProfessor(t.professor ?? "");
    setGrupo(grupoDosDias(t.dias_semana));
    setHorario(t.horario ?? "");
    setCapacidade(String(t.capacidade ?? 40));
    setAberto(true);
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const dias = GRUPOS.find((g) => g.label === grupo)?.dias ?? [];
    if (!dias.length) return toast.error("Selecione os dias da semana");
    if (!horario) return toast.error("Selecione o horário");
    const payload = {
      nome,
      modalidade,
      professor: professor || null,
      dias_semana: [...dias],
      horario,
      capacidade: Number(capacidade) || 40,
    };
    const { error } = editando
      ? await supabase.from("turmas").update(payload).eq("id", editando.id)
      : await supabase.from("turmas").insert(payload);
    if (error) return toast.error(error.message);
    toast.success(editando ? "Turma atualizada" : "Turma criada");
    setAberto(false);
    void carregar();
    return;
  }

  async function excluirTurma(t: Turma) {
    const { error: e1 } = await supabase.from("matriculas").delete().eq("turma_id", t.id);
    if (e1) return toast.error(e1.message);
    const { error } = await supabase.from("turmas").delete().eq("id", t.id);
    if (error) return toast.error(error.message);
    toast.success("Turma excluída");
    setConfirmarExclusao(null);
    void carregar();
    return;
  }

  async function abrirTurma(t: Turma) {
    setTurmaAberta(t);
    setAlunosTurma(null);
    const { data, error } = await supabase
      .from("matriculas")
      .select("id,status,modalidade,alunos(id,nome,pcd)")
      .eq("turma_id", t.id);
    if (error) {
      toast.error(error.message);
      setAlunosTurma([]);
      return;
    }
    const lista = (data ?? [])
      .map((m) => {
        const a = m.alunos as { id: string; nome: string; pcd: boolean } | null;
        return a
          ? { id: a.id, nome: a.nome, pcd: a.pcd, modalidade: m.modalidade as string, status: m.status as string }
          : null;
      })
      .filter(Boolean) as AlunoTurma[];
    lista.sort((x, y) => x.nome.localeCompare(y.nome));
    setAlunosTurma(lista);
  }

  const visiveis = turmas.filter((t) => filtroModalidade === "todas" || t.modalidade === filtroModalidade);

  return (
    <AppShell title="Turmas" subtitle="Modalidades, horários e professores">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Select value={filtroModalidade} onValueChange={setFiltroModalidade}>
          <SelectTrigger className="sm:w-60"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as modalidades</SelectItem>
            <SelectItem value="Natação">Natação</SelectItem>
            <SelectItem value="Hidroginástica">Hidroginástica</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={abrirNova}><Plus className="size-4" /> Nova turma</Button>
      </div>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader><DialogTitle className="font-display">{editando ? "Editar turma" : "Nova turma"}</DialogTitle></DialogHeader>
          <form onSubmit={salvar} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome da turma</Label>
              <Input required value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Natação Infantil A" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Modalidade</Label>
                <Select value={modalidade} onValueChange={setModalidade}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Natação">Natação</SelectItem>
                    <SelectItem value="Hidroginástica">Hidroginástica</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Professor(a)</Label>
                <Input value={professor} onChange={(e) => setProfessor(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Dias da semana</Label>
              <Select value={grupo} onValueChange={setGrupo}>
                <SelectTrigger><SelectValue placeholder="Selecione os dias" /></SelectTrigger>
                <SelectContent>
                  {GRUPOS.map((g) => (
                    <SelectItem key={g.label} value={g.label}>{g.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Horário</Label>
                <Select value={horario} onValueChange={setHorario}>
                  <SelectTrigger><SelectValue placeholder="Selecione o horário" /></SelectTrigger>
                  <SelectContent className="max-h-80">
                    {HORARIOS_TURMA.map((h) => (
                      <SelectItem key={h} value={h}>{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Capacidade</Label>
                <Input type="number" value={capacidade} onChange={(e) => setCapacidade(e.target.value)} />
              </div>
            </div>
            <Button type="submit" className="w-full">{editando ? "Salvar alterações" : "Criar turma"}</Button>
          </form>
        </DialogContent>
      </Dialog>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visiveis.map((t) => (
          <Card
            key={t.id}
            role="button"
            tabIndex={0}
            onClick={() => void abrirTurma(t)}
            onKeyDown={(e) => { if (e.key === "Enter") void abrirTurma(t); }}
            className="cursor-pointer overflow-hidden border-border/70 transition hover:border-primary/60 hover:shadow-pool"
          >
            <div className="h-1.5 bg-pool" />
            <CardContent className="space-y-3 pt-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-display text-lg font-semibold">{t.nome}</h3>
                  <p className="text-sm text-muted-foreground">{t.modalidade}{t.professor ? ` · ${t.professor}` : ""}</p>
                </div>
                <Badge variant="secondary">{t.horario ?? "s/ horário"}</Badge>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {t.dias_semana.map((d) => (
                  <span key={d} className="rounded-md bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">{d}</span>
                ))}
              </div>
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="size-4" /> {contagem[t.id] ?? 0} de {t.capacidade} vagas
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Editar turma"
                    onClick={(e) => { e.stopPropagation(); abrirEdicao(t); }}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    title="Excluir turma"
                    onClick={(e) => { e.stopPropagation(); setConfirmarExclusao(t); }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {!visiveis.length && (
          <p className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground md:col-span-2 xl:col-span-3">
            Nenhuma turma para este filtro.
          </p>
        )}
      </div>

      <Dialog open={!!turmaAberta} onOpenChange={(o) => !o && setTurmaAberta(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">{turmaAberta?.nome}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {turmaAberta?.horario ?? "Sem horário"} · {alunosTurma?.length ?? 0} de {turmaAberta?.capacidade ?? 40} vagas
          </p>
          <div className="space-y-2">
            {alunosTurma === null ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Carregando alunos...</p>
            ) : alunosTurma.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Nenhum aluno matriculado nesta turma.</p>
            ) : (
              alunosTurma.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-2 rounded-lg border border-border/70 px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">{a.nome}</p>
                    <p className="text-xs text-muted-foreground">{a.modalidade}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {a.pcd ? <Badge variant="outline">PCD</Badge> : null}
                    <Badge variant={a.status === "ativa" ? "default" : "secondary"}>{a.status}</Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
      <AlertDialog open={!!confirmarExclusao} onOpenChange={(o) => !o && setConfirmarExclusao(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir turma?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmarExclusao?.nome} e as matrículas vinculadas serão removidas. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmarExclusao && void excluirTurma(confirmarExclusao)}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
