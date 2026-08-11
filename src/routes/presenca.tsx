import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Camera, CameraOff, Check, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/presenca")({
  component: PresencaPage,
  head: () => ({
    meta: [
      { title: "Registro de presença | Arena Aquática" },
      { name: "description", content: "Registre a presença dos alunos por leitura de QR Code ou pela lista da turma." },
      { property: "og:title", content: "Registro de presença | Arena Aquática" },
      { property: "og:description", content: "Presença por QR Code na Arena Aquática." },
    ],
  }),
});

type Turma = { id: string; nome: string; horario: string | null };
type Aluno = { id: string; nome: string; codigo: string };

function PresencaPage() {
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [turmaId, setTurmaId] = useState("");
  const [scanning, setScanning] = useState(false);
  const [busca, setBusca] = useState("");
  const [presentes, setPresentes] = useState<Set<string>>(new Set());
  const [registros, setRegistros] = useState<{ nome: string; hora: string }[]>([]);
  const scannerRef = useRef<{ stop: () => Promise<void>; clear: () => void } | null>(null);
  const lastRef = useRef<{ code: string; at: number }>({ code: "", at: 0 });

  const hoje = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    void (async () => {
      const [t, a] = await Promise.all([
        supabase.from("turmas").select("id,nome,horario").order("nome"),
        supabase.from("alunos").select("id,nome,codigo").eq("ativo", true).order("nome"),
      ]);
      if (t.data) setTurmas(t.data as Turma[]);
      if (a.data) setAlunos(a.data as Aluno[]);
    })();
  }, []);

  async function carregarPresencasDoDia() {
    const { data } = await supabase
      .from("presencas")
      .select("aluno_id,horario,alunos(nome)")
      .eq("data", hoje)
      .order("horario", { ascending: false });
    if (!data) return;
    setPresentes(new Set(data.map((r) => r.aluno_id as string)));
    setRegistros(
      data.map((r) => ({
        nome: (r.alunos as { nome: string } | null)?.nome ?? "Aluno",
        hora: new Date(r.horario as string).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      })),
    );
  }

  useEffect(() => {
    void carregarPresencasDoDia();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function registrar(aluno: Aluno, metodo: "qrcode" | "manual") {
    const { error } = await supabase.from("presencas").insert({
      aluno_id: aluno.id,
      turma_id: turmaId || null,
      data: hoje,
      metodo,
    });
    if (error) {
      if (error.code === "23505") toast.info(`${aluno.nome} já teve presença registrada hoje.`);
      else toast.error(error.message);
      return;
    }
    toast.success(`Presença registrada: ${aluno.nome}`);
    void carregarPresencasDoDia();
  }

  async function onScan(texto: string) {
    const agora = Date.now();
    if (lastRef.current.code === texto && agora - lastRef.current.at < 4000) return;
    lastRef.current = { code: texto, at: agora };
    const aluno = alunos.find((a) => a.codigo === texto.trim());
    if (!aluno) {
      toast.error("QR Code não reconhecido.");
      return;
    }
    await registrar(aluno, "qrcode");
  }

  async function iniciarScanner() {
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode("leitor-qr");
      scannerRef.current = scanner as unknown as { stop: () => Promise<void>; clear: () => void };
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (texto) => void onScan(texto),
        () => {},
      );
      setScanning(true);
    } catch {
      toast.error("Não foi possível acessar a câmera.");
    }
  }

  async function pararScanner() {
    try {
      await scannerRef.current?.stop();
      scannerRef.current?.clear();
    } catch {
      /* ignora */
    }
    scannerRef.current = null;
    setScanning(false);
  }

  useEffect(() => {
    return () => {
      void scannerRef.current?.stop().catch(() => {});
    };
  }, []);

  const filtrados = alunos.filter((a) => a.nome.toLowerCase().includes(busca.toLowerCase()));

  return (
    <AppShell title="Presença" subtitle={`Registros de hoje · ${new Date().toLocaleDateString("pt-BR")}`}>
      <div className="mb-6 max-w-sm space-y-2">
        <Label>Turma da aula</Label>
        <Select value={turmaId} onValueChange={setTurmaId}>
          <SelectTrigger><SelectValue placeholder="Selecione a turma (opcional)" /></SelectTrigger>
          <SelectContent>
            {turmas.map((t) => (
              <SelectItem key={t.id} value={t.id}>{t.nome}{t.horario ? ` · ${t.horario}` : ""}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <Tabs defaultValue="qr">
          <TabsList>
            <TabsTrigger value="qr">QR Code</TabsTrigger>
            <TabsTrigger value="lista">Lista manual</TabsTrigger>
          </TabsList>

          <TabsContent value="qr" className="pt-4">
            <Card className="border-border/70">
              <CardContent className="space-y-4 pt-6">
                <div id="leitor-qr" className="overflow-hidden rounded-xl bg-secondary [&_video]:w-full" />
                {!scanning ? (
                  <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                    Aponte a câmera para o QR Code da carteirinha do aluno.
                  </div>
                ) : null}
                {scanning ? (
                  <Button variant="outline" className="w-full" onClick={() => void pararScanner()}>
                    <CameraOff className="size-4" /> Parar leitura
                  </Button>
                ) : (
                  <Button className="w-full" onClick={() => void iniciarScanner()}>
                    <Camera className="size-4" /> Iniciar leitura
                  </Button>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="lista" className="pt-4">
            <Card className="border-border/70">
              <CardContent className="space-y-3 pt-6">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input className="pl-9" placeholder="Buscar aluno..." value={busca} onChange={(e) => setBusca(e.target.value)} />
                </div>
                <div className="max-h-96 space-y-2 overflow-y-auto">
                  {filtrados.map((a) => (
                    <div key={a.id} className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2">
                      <span className="text-sm">{a.nome}</span>
                      {presentes.has(a.id) ? (
                        <span className="flex items-center gap-1 text-xs font-medium text-primary"><Check className="size-4" /> Presente</span>
                      ) : (
                        <Button size="sm" variant="secondary" onClick={() => void registrar(a, "manual")}>Marcar</Button>
                      )}
                    </div>
                  ))}
                  {!filtrados.length && <p className="py-6 text-center text-sm text-muted-foreground">Nenhum aluno encontrado.</p>}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Card className="border-border/70">
          <CardHeader><CardTitle className="font-display text-lg">Presenças de hoje ({registros.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {registros.map((r, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg bg-secondary/60 px-3 py-2 text-sm">
                <span>{r.nome}</span>
                <span className="text-muted-foreground">{r.hora}</span>
              </div>
            ))}
            {!registros.length && <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma presença registrada hoje.</p>}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
