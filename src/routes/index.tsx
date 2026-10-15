import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Users, CalendarDays, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { CONDICOES_PCD } from "@/lib/pcd";
import { useHorarios } from "@/lib/horarios";
import { capitalizarNome, formatarCelular } from "@/lib/formatacao";
import { AppShell } from "@/components/AppShell";
import { PerfilAluno } from "@/components/PerfilAluno";
import { AulasDoDia } from "@/components/painel/AulasDoDia";
import { PainelLicencas } from "@/components/painel/PainelLicencas";
import { BuscaRapida } from "@/components/painel/BuscaRapida";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Fila = {
  id: string;
  nome: string;
  telefone: string | null;
  modalidade: string;
  preferencia_horario: string | null;
  created_at: string;
  idade: number | null;
  pcd: boolean;
  pcd_condicoes: string[] | null;
  pcd_descricao: string | null;
  observacoes: string | null;
};


export const Route = createFileRoute("/")({
  component: Painel,
  head: () => ({
    meta: [
      { title: "Arena Aquática | Matrículas e presença" },
      {
        name: "description",
        content: "Sistema da Arena Aquática para matricular alunos, organizar turmas e registrar presença por QR Code.",
      },
      { property: "og:title", content: "Arena Aquática | Matrículas e presença" },
      { property: "og:description", content: "Matrículas, turmas e presença por QR Code em um só painel." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function Painel() {
  const { lista: listaHorarios } = useHorarios();
  const [stats, setStats] = useState({ alunos: 0, turmas: 0 });
  const [fila, setFila] = useState<Fila[]>([]);
  const [perfilId, setPerfilId] = useState<string | null>(null);
  const filaVazia = {
    nome: "",
    telefone: "",
    modalidade: "Natação",
    preferencia_horario: "",
    idade: "",
    pcd: false,
    pcd_condicoes: [] as string[],
    pcd_descricao: "",
    observacoes: "",
  };
  const [novo, setNovo] = useState(filaVazia);

  async function carregarFila() {
    const { data, error } = await supabase
      .from("fila_espera")
      .select("id,nome,telefone,modalidade,preferencia_horario,created_at,idade,pcd,pcd_condicoes,pcd_descricao,observacoes")
      .order("created_at");
    if (error) return toast.error(error.message);
    const lista = ((data ?? []) as Fila[]).slice().sort((a, b) => {
      if (a.pcd !== b.pcd) return a.pcd ? -1 : 1;
      return a.created_at.localeCompare(b.created_at);
    });
    setFila(lista);
    return;
  }

  useEffect(() => {
    void carregarFila();
  }, []);

  async function adicionarFila(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("fila_espera").insert({
      nome: capitalizarNome(novo.nome),
      telefone: novo.telefone || null,
      modalidade: novo.modalidade,
      preferencia_horario: novo.preferencia_horario || null,
      idade: novo.idade ? Number(novo.idade) : null,
      pcd: novo.pcd,
      pcd_condicoes: novo.pcd ? novo.pcd_condicoes : [],
      pcd_descricao: novo.pcd ? novo.pcd_descricao || null : null,
      observacoes: novo.observacoes || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Adicionado à fila de espera");
    setNovo(filaVazia);
    void carregarFila();
    return;
  }


  async function removerFila(id: string) {
    const { error } = await supabase.from("fila_espera").delete().eq("id", id);
    if (error) return toast.error(error.message);
    void carregarFila();
    return;
  }

  useEffect(() => {
    void (async () => {
      const [alunos, turmas] = await Promise.all([
        supabase.from("alunos").select("id", { count: "exact", head: true }).eq("ativo", true),
        supabase.from("turmas").select("id", { count: "exact", head: true }).eq("ativa", true),
      ]);
      setStats({ alunos: alunos.count ?? 0, turmas: turmas.count ?? 0 });
    })();
  }, []);

  const cards = [
    { label: "Alunos ativos", value: stats.alunos, icon: Users },
    { label: "Turmas abertas", value: stats.turmas, icon: CalendarDays },
  ];

  return (
    <AppShell title="Painel" subtitle="Visão geral da Arena Aquática">
      <BuscaRapida onAbrirPerfil={setPerfilId} />
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        {cards.map((c) => (
          <Card key={c.label} className="border-border/70">
            <CardContent className="flex items-center gap-4 py-6">
              <span className="grid size-11 place-items-center rounded-xl bg-secondary text-primary">
                <c.icon className="size-5" />
              </span>
              <div>
                <p className="font-display text-2xl font-semibold">{c.value}</p>
                <p className="text-sm text-muted-foreground">{c.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden border-none bg-pool text-primary-foreground shadow-pool">
        <CardContent className="space-y-4 py-8">
          <h2 className="font-display text-2xl font-semibold">Comece a aula</h2>
          <p className="text-sm text-primary-foreground/80">
            Abra o leitor de QR Code e registre a entrada dos alunos na borda da piscina, pelo celular ou pelo computador.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="secondary">
              <Link to="/presenca">Registrar presença</Link>
            </Button>
            <Button asChild variant="outline" className="border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10">
              <Link to="/alunos">Nova matrícula</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-6">
        <AulasDoDia />
        <PainelLicencas onAbrirPerfil={setPerfilId} />
      </div>
      <PerfilAluno alunoId={perfilId} onFechar={() => setPerfilId(null)} />

      <Card className="mt-6 border-border/70">
        <CardHeader><CardTitle className="font-display text-lg">Fila de espera</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={adicionarFila} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <Input
                required
                placeholder="Nome"
                value={novo.nome}
                onChange={(e) => setNovo({ ...novo, nome: capitalizarNome(e.target.value) })}
              />
              <Input
                placeholder="Celular (11) 99999-9999"
                inputMode="numeric"
                value={novo.telefone}
                onChange={(e) => setNovo({ ...novo, telefone: formatarCelular(e.target.value) })}
              />
              <Input
                type="number"
                min={0}
                max={120}
                placeholder="Idade"
                value={novo.idade}
                onChange={(e) => setNovo({ ...novo, idade: e.target.value })}
              />
              <Select value={novo.modalidade} onValueChange={(v) => setNovo({ ...novo, modalidade: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Natação">Natação</SelectItem>
                  <SelectItem value="Hidroginástica">Hidroginástica</SelectItem>
                </SelectContent>
              </Select>
              <Select value={novo.preferencia_horario} onValueChange={(v) => setNovo({ ...novo, preferencia_horario: v })}>
                <SelectTrigger><SelectValue placeholder="Horário preferido" /></SelectTrigger>
                <SelectContent className="max-h-80">
                  {listaHorarios.map((h) => (
                    <SelectItem key={h} value={h}>{h}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Textarea
              rows={2}
              placeholder="Observações"
              value={novo.observacoes}
              onChange={(e) => setNovo({ ...novo, observacoes: e.target.value })}
            />
            <div className="space-y-3 rounded-lg border border-border/70 p-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="fila-pcd">Pessoa com deficiência (PCD)</Label>
                <Switch id="fila-pcd" checked={novo.pcd} onCheckedChange={(v) => setNovo({ ...novo, pcd: v })} />
              </div>
              {novo.pcd ? (
                <div className="space-y-3">
                  {CONDICOES_PCD.map((c) => (
                    <label key={c} className="flex items-start gap-2 text-sm">
                      <Checkbox
                        checked={novo.pcd_condicoes.includes(c)}
                        onCheckedChange={(v) =>
                          setNovo((n) => ({
                            ...n,
                            pcd_condicoes: v ? [...n.pcd_condicoes, c] : n.pcd_condicoes.filter((x) => x !== c),
                          }))
                        }
                      />
                      <span>{c}</span>
                    </label>
                  ))}
                  <Input
                    placeholder="Outras observações sobre a deficiência / apoio"
                    value={novo.pcd_descricao}
                    onChange={(e) => setNovo({ ...novo, pcd_descricao: e.target.value })}
                  />
                </div>
              ) : null}
            </div>
            <Button type="submit"><Plus className="size-4" /> Adicionar</Button>
          </form>

          <div className="space-y-2">
            {fila.map((f, i) => (
              <div key={f.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border/70 px-3 py-2 text-sm">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-secondary text-xs">{i + 1}</span>
                <span className="font-medium">{f.nome}</span>
                {f.pcd ? <Badge variant="outline">PCD</Badge> : null}
                <span className="text-muted-foreground">{f.modalidade}</span>
                {f.idade != null ? <span className="text-muted-foreground">· {f.idade} anos</span> : null}
                {f.preferencia_horario ? <span className="text-muted-foreground">· {f.preferencia_horario}</span> : null}
                {f.telefone ? <span className="text-muted-foreground">· {f.telefone}</span> : null}
                {f.pcd && (f.pcd_condicoes ?? []).length ? (
                  <span className="w-full text-xs text-muted-foreground">{(f.pcd_condicoes ?? []).join(" · ")}</span>
                ) : null}
                {f.observacoes ? <span className="w-full text-xs text-muted-foreground">{f.observacoes}</span> : null}
                <Button variant="ghost" size="icon" className="ml-auto text-destructive" title="Remover" onClick={() => void removerFila(f.id)}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}

            {!fila.length && <p className="py-6 text-center text-sm text-muted-foreground">Nenhum aluno na fila de espera.</p>}
          </div>
        </CardContent>
      </Card>
    </AppShell>
  );
}
