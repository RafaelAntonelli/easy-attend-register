import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Plus, QrCode, Search, Pencil } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/alunos")({
  component: AlunosPage,
  head: () => ({
    meta: [
      { title: "Alunos e matrículas | Arena Aquática" },
      { name: "description", content: "Cadastre alunos, faça matrículas em turmas e gere o QR Code de presença." },
      { property: "og:title", content: "Alunos e matrículas | Arena Aquática" },
      { property: "og:description", content: "Cadastro de alunos e matrículas da Arena Aquática." },
    ],
  }),
});

type Aluno = {
  id: string;
  nome: string;
  data_nascimento: string | null;
  telefone: string | null;
  responsavel: string | null;
  email: string | null;
  observacoes: string | null;
  codigo: string;
  ativo: boolean;
};

type Turma = { id: string; nome: string; horario: string | null; dias_semana: string[] | null };
type Matricula = { id: string; aluno_id: string; turma_id: string; plano: string; valor_mensal: number; status: string };


const vazio = {
  nome: "",
  data_nascimento: "",
  telefone: "",
  responsavel: "",
  email: "",
  observacoes: "",
};

function AlunosPage() {
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [matriculas, setMatriculas] = useState<Matricula[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState<Aluno | null>(null);
  const [form, setForm] = useState(vazio);
  const [turmaId, setTurmaId] = useState<string>("");
  const [plano, setPlano] = useState("Mensal");
  const [valor, setValor] = useState("0");
  const [qrAluno, setQrAluno] = useState<Aluno | null>(null);

  async function carregar() {
    setCarregando(true);
    setErro(null);
    try {
      const [a, t, m] = await Promise.all([
        supabase.from("alunos").select("*").order("nome"),
        supabase.from("turmas").select("id,nome,horario,dias_semana").order("nome"),
        supabase.from("matriculas").select("*"),
      ]);
      if (a.error) throw a.error;
      if (t.error) throw t.error;
      if (m.error) throw m.error;
      setAlunos(a.data as Aluno[]);
      setTurmas(t.data as Turma[]);
      setMatriculas(m.data as Matricula[]);
    } catch (err: any) {
      setErro(err?.message ?? "Erro ao carregar dados");
      toast.error(err?.message ?? "Erro ao carregar dados");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    void carregar();
  }, []);


  function abrirNovo() {
    setEditando(null);
    setForm(vazio);
    setTurmaId("");
    setPlano("Mensal");
    setValor("0");
    setAberto(true);
  }

  function abrirEdicao(aluno: Aluno) {
    setEditando(aluno);
    setForm({
      nome: aluno.nome,
      data_nascimento: aluno.data_nascimento ?? "",
      telefone: aluno.telefone ?? "",
      responsavel: aluno.responsavel ?? "",
      email: aluno.email ?? "",
      observacoes: aluno.observacoes ?? "",
    });
    const m = matriculas.find((x) => x.aluno_id === aluno.id);
    setTurmaId(m?.turma_id ?? "");
    setPlano(m?.plano ?? "Mensal");
    setValor(String(m?.valor_mensal ?? 0));
    setAberto(true);
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      nome: form.nome,
      data_nascimento: form.data_nascimento || null,
      telefone: form.telefone || null,
      responsavel: form.responsavel || null,
      email: form.email || null,
      observacoes: form.observacoes || null,
    };

    let alunoId = editando?.id;
    if (editando) {
      const { error } = await supabase.from("alunos").update(payload).eq("id", editando.id);
      if (error) return toast.error(error.message);
    } else {
      const { data, error } = await supabase.from("alunos").insert(payload).select("id").single();
      if (error) return toast.error(error.message);
      alunoId = data.id;
    }

    if (turmaId && alunoId) {
      const { error } = await supabase.from("matriculas").upsert(
        { aluno_id: alunoId, turma_id: turmaId, plano, valor_mensal: Number(valor) || 0, status: "ativa" },
        { onConflict: "aluno_id,turma_id" },
      );
      if (error) return toast.error(error.message);
    }

    toast.success(editando ? "Aluno atualizado" : "Aluno matriculado com sucesso");
    setAberto(false);
    void carregar();
    return;
  }

  const filtrados = alunos.filter((a) => a.nome.toLowerCase().includes(busca.toLowerCase()));

  return (
    <AppShell title="Alunos" subtitle="Cadastro e matrículas da Arena Aquática">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar aluno..." value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <Dialog open={aberto} onOpenChange={setAberto}>
          <DialogTrigger asChild>
            <Button onClick={abrirNovo}>
              <Plus className="size-4" /> Nova matrícula
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-display">{editando ? "Editar aluno" : "Nova matrícula"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={salvar} className="space-y-4">
              <div className="space-y-2">
                <Label>Nome completo</Label>
                <Input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Nascimento</Label>
                  <Input type="date" value={form.data_nascimento} onChange={(e) => setForm({ ...form, data_nascimento: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Responsável</Label>
                  <Input value={form.responsavel} onChange={(e) => setForm({ ...form, responsavel: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>E-mail</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2 sm:col-span-3">
                  <Label>Turma</Label>
                  <Select value={turmaId} onValueChange={setTurmaId} required={!editando}>
                    <SelectTrigger>
                      <SelectValue placeholder={carregando ? "Carregando turmas..." : turmas.length ? "Selecione a turma" : "Nenhuma turma disponível"} />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      {erro ? (
                        <div className="px-3 py-2 text-sm text-destructive">Erro ao carregar turmas</div>
                      ) : turmas.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-muted-foreground">Nenhuma turma cadastrada</div>
                      ) : (
                        <>
                          <SelectItem value="none" disabled>Selecione uma turma</SelectItem>
                          {turmas.map((t) => (
                            <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
                          ))}
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Plano</Label>
                  <Select value={plano} onValueChange={setPlano}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Mensal">Mensal</SelectItem>
                      <SelectItem value="Trimestral">Trimestral</SelectItem>
                      <SelectItem value="Semestral">Semestral</SelectItem>
                      <SelectItem value="Anual">Anual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Valor mensal (R$)</Label>
                  <Input type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea rows={2} value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
              </div>
              <Button type="submit" className="w-full" disabled={carregando || (!editando && !turmaId)}>
                Salvar
              </Button>

            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-3">
        {filtrados.map((aluno) => {
          const turmasDoAluno = matriculas
            .filter((m) => m.aluno_id === aluno.id)
            .map((m) => turmas.find((t) => t.id === m.turma_id)?.nome)
            .filter(Boolean);
          return (
            <Card key={aluno.id} className="border-border/70">
              <CardContent className="flex flex-wrap items-center gap-4 py-4">
                <div className="grid size-11 shrink-0 place-items-center rounded-full bg-pool font-display text-sm font-semibold text-primary-foreground">
                  {aluno.nome.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-40 flex-1">
                  <p className="font-medium text-foreground">{aluno.nome}</p>
                  <p className="text-sm text-muted-foreground">
                    {turmasDoAluno.length ? turmasDoAluno.join(", ") : "Sem turma"}
                    {aluno.telefone ? ` · ${aluno.telefone}` : ""}
                  </p>
                </div>
                <Badge variant={aluno.ativo ? "default" : "secondary"}>{aluno.ativo ? "Ativo" : "Inativo"}</Badge>
                <Button variant="ghost" size="icon" onClick={() => abrirEdicao(aluno)}><Pencil className="size-4" /></Button>
                <Button variant="outline" size="icon" onClick={() => setQrAluno(aluno)}><QrCode className="size-4" /></Button>
              </CardContent>
            </Card>
          );
        })}
        {!filtrados.length && (
          <p className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
            Nenhum aluno cadastrado ainda.
          </p>
        )}
      </div>

      <Dialog open={!!qrAluno} onOpenChange={(o) => !o && setQrAluno(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Carteirinha de {qrAluno?.nome}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-2">
            {qrAluno ? (
              <div className="rounded-2xl bg-card p-5 shadow-pool">
                <QRCodeSVG value={qrAluno.codigo} size={200} level="M" />
              </div>
            ) : null}
            <p className="text-center text-xs text-muted-foreground">
              Mostre este QR Code na recepção para registrar a presença.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
