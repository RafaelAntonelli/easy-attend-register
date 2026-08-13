import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Plus, QrCode, Search, Pencil, Image as ImageIcon, AlertTriangle, Bell } from "lucide-react";
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
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

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
  pcd: boolean;
  pcd_descricao: string | null;
  foto_path: string | null;
  atestado_entregue: boolean;
  atestado_data: string | null;
  telefone2: string | null;
  rede_ensino: string | null;
  escola: string | null;
  idade: number | null;
};

function atestadoVencido(data: string | null | undefined) {
  if (!data) return false;
  const limite = new Date(`${data}T00:00:00`);
  limite.setFullYear(limite.getFullYear() + 1);
  return limite < new Date();
}

const CAPACIDADE_TURMA = 40;

const ROTULO_STATUS = {
  presente: "Presenças",
  falta: "Faltas",
  falta_justificada: "Faltas justificadas",
} as const;

type Turma = { id: string; nome: string; horario: string | null; dias_semana: string[] | null };
type Matricula = { id: string; aluno_id: string; turma_id: string; status: string; modalidade: string; data_inicio: string | null };
type Presenca = { id: string; data: string; status: string; turma_id: string | null };


const vazio = {
  nome: "",
  data_nascimento: "",
  telefone: "",
  responsavel: "",
  email: "",
  observacoes: "",
  modalidade: "Natação",
  pcd: false,
  pcd_descricao: "",
  atestado_entregue: false,
  atestado_data: "",
  telefone2: "",
  rede_ensino: "",
  escola: "",
  idade: "",
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
  const [qrAluno, setQrAluno] = useState<Aluno | null>(null);
  const [foto, setFoto] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [fotos, setFotos] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);
  const [detalhe, setDetalhe] = useState<Aluno | null>(null);
  const [historico, setHistorico] = useState<Presenca[] | null>(null);

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
      const comFoto = (a.data as Aluno[]).filter((x) => x.foto_path);
      if (comFoto.length) {
        const { data: signed } = await supabase.storage
          .from("fotos-alunos")
          .createSignedUrls(comFoto.map((x) => x.foto_path as string), 3600);
        const mapa: Record<string, string> = {};
        signed?.forEach((s, i) => {
          const aluno = comFoto[i];
          if (s.signedUrl && aluno) mapa[aluno.id] = s.signedUrl;
        });
        setFotos(mapa);
      }
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
    setFoto(null);
    setFotoPreview(null);
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
      modalidade: "Natação",
      pcd: aluno.pcd ?? false,
      pcd_descricao: aluno.pcd_descricao ?? "",
      atestado_entregue: aluno.atestado_entregue ?? false,
      atestado_data: aluno.atestado_data ?? "",
      telefone2: aluno.telefone2 ?? "",
      rede_ensino: aluno.rede_ensino ?? "",
      escola: aluno.escola ?? "",
      idade: aluno.idade != null ? String(aluno.idade) : "",
    });
    setFoto(null);
    setFotoPreview(fotos[aluno.id] ?? null);
    const m = matriculas.find((x) => x.aluno_id === aluno.id);
    setTurmaId(m?.turma_id ?? "");
    setForm((f) => ({ ...f, modalidade: m?.modalidade ?? "Natação" }));
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
      pcd: form.pcd,
      pcd_descricao: form.pcd ? form.pcd_descricao || null : null,
      atestado_entregue: form.atestado_entregue,
      atestado_data: form.atestado_entregue ? form.atestado_data || null : null,
      telefone2: form.telefone2 || null,
      rede_ensino: form.rede_ensino || null,
      escola: form.escola || null,
      idade: form.idade ? Number(form.idade) : null,
    };

    if (turmaId) {
      const jaMatriculado = matriculas.some((m) => m.aluno_id === editando?.id && m.turma_id === turmaId);
      const ocupadas = matriculas.filter((m) => m.turma_id === turmaId && m.status === "ativa").length;
      if (!jaMatriculado && ocupadas >= CAPACIDADE_TURMA) {
        toast.error(`Turma lotada (${CAPACIDADE_TURMA} vagas por horário).`);
        return;
      }
    }
    setSalvando(true);

    let alunoId = editando?.id;
    try {
      if (editando) {
        const { error } = await supabase.from("alunos").update(payload).eq("id", editando.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("alunos").insert(payload).select("id").single();
        if (error) throw error;
        alunoId = data.id;
      }

      if (foto && alunoId) {
        const ext = foto.name.split(".").pop() ?? "jpg";
        const caminho = `${alunoId}/${Date.now()}.${ext}`;
        const up = await supabase.storage.from("fotos-alunos").upload(caminho, foto, { upsert: true });
        if (up.error) throw up.error;
        const { error } = await supabase.from("alunos").update({ foto_path: caminho }).eq("id", alunoId);
        if (error) throw error;
      }
    } catch (err: any) {
      setSalvando(false);
      toast.error(err?.message ?? "Erro ao salvar");
      return;
    }

    if (turmaId && alunoId) {
      const { error } = await supabase.from("matriculas").upsert(
        { aluno_id: alunoId, turma_id: turmaId, status: "ativa", modalidade: form.modalidade },
        { onConflict: "aluno_id,turma_id" },
      );
      if (error) {
        setSalvando(false);
        return toast.error(error.message);
      }
    }

    setSalvando(false);
    toast.success(editando ? "Aluno atualizado" : "Aluno matriculado com sucesso");
    setAberto(false);
    void carregar();
    return;
  }

  async function abrirDetalhe(aluno: Aluno) {
    setDetalhe(aluno);
    setHistorico(null);
    const { data, error } = await supabase
      .from("presencas")
      .select("id,data,status,turma_id")
      .eq("aluno_id", aluno.id)
      .order("data", { ascending: false });
    if (error) {
      toast.error(error.message);
      setHistorico([]);
      return;
    }
    setHistorico((data ?? []) as Presenca[]);
  }

  function vagasUsadas(id: string) {
    return matriculas.filter((m) => m.turma_id === id && m.status === "ativa").length;
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
                  <Label>Telefone 2</Label>
                  <Input value={form.telefone2} onChange={(e) => setForm({ ...form, telefone2: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Idade</Label>
                  <Input type="number" min={0} max={120} value={form.idade} onChange={(e) => setForm({ ...form, idade: e.target.value })} />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Estuda na rede</Label>
                  <Select value={form.rede_ensino} onValueChange={(v) => setForm({ ...form, rede_ensino: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Pública">Pública</SelectItem>
                      <SelectItem value="Privada">Privada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Nome da escola</Label>
                  <Input value={form.escola} onChange={(e) => setForm({ ...form, escola: e.target.value })} />
                </div>
              </div>
              <div className="space-y-3 rounded-lg border border-border/70 p-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="atestado">Entregou atestado?</Label>
                  <Switch
                    id="atestado"
                    checked={form.atestado_entregue}
                    onCheckedChange={(v) => setForm({ ...form, atestado_entregue: v })}
                  />
                </div>
                {form.atestado_entregue ? (
                  <div className="space-y-2">
                    <Label>Data do atestado</Label>
                    <Input type="date" value={form.atestado_data} onChange={(e) => setForm({ ...form, atestado_data: e.target.value })} />
                    {atestadoVencido(form.atestado_data) ? (
                      <p className="flex items-center gap-1 text-sm font-medium text-destructive">
                        <AlertTriangle className="size-4" /> Atestado vencido!
                      </p>
                    ) : null}
                  </div>
                ) : null}
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
              <div className="space-y-2">
                <Label>Modalidade</Label>
                <Select value={form.modalidade} onValueChange={(v) => setForm({ ...form, modalidade: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione a modalidade" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Natação">Natação</SelectItem>
                    <SelectItem value="Hidroginástica">Hidroginástica</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Turma</Label>
                <Select value={turmaId} onValueChange={setTurmaId} required={!editando}>
                  <SelectTrigger>
                    <SelectValue placeholder={carregando ? "Carregando turmas..." : turmas.length ? "Selecione a turma" : "Nenhuma turma disponível"} />
                  </SelectTrigger>
                  <SelectContent className="max-h-80">
                    {erro ? (
                      <div className="px-3 py-2 text-sm text-destructive">Erro ao carregar turmas</div>
                    ) : turmas.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground">Nenhuma turma cadastrada</div>
                    ) : (
                      <>
                        <SelectItem value="none" disabled>Selecione uma turma</SelectItem>
                        <SelectGroup>
                          <SelectLabel>Terça e Quinta</SelectLabel>
                          {turmas.filter((t) => t.nome.toLowerCase().startsWith("terça e quinta") || t.nome.toLowerCase().startsWith("terca e quinta")).map((t) => (
                            <SelectItem key={t.id} value={t.id} disabled={vagasUsadas(t.id) >= CAPACIDADE_TURMA}>
                              {t.nome.replace("Terça e Quinta - ", "")} · {vagasUsadas(t.id)}/{CAPACIDADE_TURMA}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                        <SelectGroup>
                          <SelectLabel>Quarta e Sexta</SelectLabel>
                          {turmas.filter((t) => t.nome.toLowerCase().startsWith("quarta e sexta")).map((t) => (
                            <SelectItem key={t.id} value={t.id} disabled={vagasUsadas(t.id) >= CAPACIDADE_TURMA}>
                              {t.nome.replace("Quarta e Sexta - ", "")} · {vagasUsadas(t.id)}/{CAPACIDADE_TURMA}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-3 rounded-lg border border-border/70 p-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="pcd">Pessoa com deficiência (PCD)</Label>
                  <Switch id="pcd" checked={form.pcd} onCheckedChange={(v) => setForm({ ...form, pcd: v })} />
                </div>
                {form.pcd ? (
                  <Input
                    placeholder="Descreva a deficiência / necessidades de apoio"
                    value={form.pcd_descricao}
                    onChange={(e) => setForm({ ...form, pcd_descricao: e.target.value })}
                  />
                ) : null}
              </div>
              <div className="space-y-2">
                <Label>Foto do aluno</Label>
                <div className="flex items-center gap-3">
                  {fotoPreview ? (
                    <img src={fotoPreview} alt="Foto do aluno" className="size-16 rounded-full object-cover" />
                  ) : (
                    <div className="grid size-16 place-items-center rounded-full bg-secondary text-muted-foreground">
                      <ImageIcon className="size-5" />
                    </div>
                  )}
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      setFoto(f);
                      setFotoPreview(f ? URL.createObjectURL(f) : null);
                    }}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea rows={2} value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
              </div>
              <Button type="submit" className="w-full" disabled={salvando || carregando || (!editando && !turmaId)}>
                {salvando ? "Salvando..." : "Salvar"}
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
                {fotos[aluno.id] ? (
                  <img src={fotos[aluno.id]} alt={`Foto de ${aluno.nome}`} className="size-11 shrink-0 rounded-full object-cover" />
                ) : (
                  <div className="grid size-11 shrink-0 place-items-center rounded-full bg-pool font-display text-sm font-semibold text-primary-foreground">
                    {aluno.nome.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="min-w-40 flex-1">
                  <button type="button" onClick={() => void abrirDetalhe(aluno)} className="text-left font-medium text-foreground hover:text-primary hover:underline">
                    {aluno.nome}
                  </button>
                  <p className="text-sm text-muted-foreground">
                    {turmasDoAluno.length ? turmasDoAluno.join(", ") : "Sem turma"}
                    {aluno.telefone ? ` · ${aluno.telefone}` : ""}
                  </p>
                </div>
                {aluno.pcd ? <Badge variant="outline">PCD</Badge> : null}
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

      <Dialog open={!!detalhe} onOpenChange={(o) => !o && setDetalhe(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">{detalhe?.nome}</DialogTitle>
          </DialogHeader>
          {detalhe ? (
            <div className="space-y-5">
              <div className="flex items-center gap-4">
                {fotos[detalhe.id] ? (
                  <img src={fotos[detalhe.id]} alt={`Foto de ${detalhe.nome}`} className="size-16 rounded-full object-cover" />
                ) : (
                  <div className="grid size-16 place-items-center rounded-full bg-pool font-display text-primary-foreground">
                    {detalhe.nome.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="text-sm text-muted-foreground">
                  <p>{detalhe.telefone ?? "Sem telefone"}</p>
                  <p>{detalhe.email ?? "Sem e-mail"}</p>
                  <p>{detalhe.responsavel ? `Responsável: ${detalhe.responsavel}` : "Sem responsável"}</p>
                </div>
              </div>

              <div className="rounded-lg border border-border/70 p-3 text-sm">
                <p className="mb-1 font-medium">PCD</p>
                <p className="text-muted-foreground">
                  {detalhe.pcd ? detalhe.pcd_descricao || "Sim (sem descrição)" : "Não"}
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Matrículas</p>
                {matriculas.filter((m) => m.aluno_id === detalhe.id).length ? (
                  matriculas
                    .filter((m) => m.aluno_id === detalhe.id)
                    .map((m) => (
                      <div key={m.id} className="rounded-lg bg-secondary/60 px-3 py-2 text-sm">
                        <p className="font-medium">{turmas.find((t) => t.id === m.turma_id)?.nome ?? "Turma"}</p>
                        <p className="text-xs text-muted-foreground">
                          {m.modalidade} · {m.status}
                          {m.data_inicio ? ` · início ${new Date(`${m.data_inicio}T00:00:00`).toLocaleDateString("pt-BR")}` : ""}
                        </p>
                      </div>
                    ))
                ) : (
                  <p className="text-sm text-muted-foreground">Sem matrícula ativa.</p>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Histórico de frequência</p>
                {historico === null ? (
                  <p className="text-sm text-muted-foreground">Carregando...</p>
                ) : historico.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum registro de frequência.</p>
                ) : (
                  <>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      {(["presente", "falta", "falta_justificada"] as const).map((st) => (
                        <div key={st} className="rounded-lg border border-border/70 py-2">
                          <p className="font-display text-lg">{historico.filter((h) => h.status === st).length}</p>
                          <p className="text-xs text-muted-foreground">{ROTULO_STATUS[st]}</p>
                        </div>
                      ))}
                    </div>
                    <div className="max-h-56 space-y-1 overflow-y-auto">
                      {historico.map((h) => (
                        <div key={h.id} className="flex items-center justify-between rounded-lg bg-secondary/50 px-3 py-1.5 text-sm">
                          <span>{new Date(`${h.data}T00:00:00`).toLocaleDateString("pt-BR")}</span>
                          <span className="text-muted-foreground">{ROTULO_STATUS[h.status as keyof typeof ROTULO_STATUS] ?? h.status}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

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
