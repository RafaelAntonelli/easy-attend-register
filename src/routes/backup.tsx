import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CloudUpload, FolderCog, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useConfiguracaoTexto } from "@/lib/configuracoes";
import { CHAVE_PASTA_IMAGENS, CHAVE_PASTA_PLANILHAS, extrairIdPastaDrive } from "@/lib/configuracoes-chaves";
import { useAuth } from "@/lib/auth";
import { prepararBackupFn, enviarLoteBackupFn, registrarBackupFn } from "@/lib/backup.functions";

export const Route = createFileRoute("/backup")({
  component: BackupPage,
  head: () => ({
    meta: [
      { title: "Backup no Google Drive | Arena Aquática" },
      {
        name: "description",
        content: "Envie a planilha de alunos e os documentos para o Google Drive. Acesso restrito a administradores.",
      },
      { property: "og:title", content: "Backup no Google Drive | Arena Aquática" },
      { property: "og:description", content: "Backup manual e automático dos dados da Arena Aquática." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const LOTE = 8;

function formatarTempo(segundos: number) {
  if (!Number.isFinite(segundos) || segundos <= 0) return "—";
  const s = Math.round(segundos);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}min ${String(s % 60).padStart(2, "0")}s`;
}

type Progresso = { etapa: string; enviados: number; total: number; falhas: number; restante: number | null };

function BackupPage() {
  const { isAdmin } = useAuth();
  const [backupando, setBackupando] = useState(false);
  const [progresso, setProgresso] = useState<Progresso | null>(null);
  const [ultimo, setUltimo] = useState<{ ultimo_backup: string | null; ultimo_resultado: string | null } | null>(null);
  const preparar = useServerFn(prepararBackupFn);
  const enviarLote = useServerFn(enviarLoteBackupFn);
  const registrar = useServerFn(registrarBackupFn);
  const pastaPlanilhas = useConfiguracaoTexto(CHAVE_PASTA_PLANILHAS);
  const pastaImagens = useConfiguracaoTexto(CHAVE_PASTA_IMAGENS);
  const [formPlanilhas, setFormPlanilhas] = useState("");
  const [formImagens, setFormImagens] = useState("");
  const [salvandoPastas, setSalvandoPastas] = useState(false);

  useEffect(() => {
    if (!pastaPlanilhas.carregando) setFormPlanilhas(pastaPlanilhas.valor);
  }, [pastaPlanilhas.carregando, pastaPlanilhas.valor]);

  useEffect(() => {
    if (!pastaImagens.carregando) setFormImagens(pastaImagens.valor);
  }, [pastaImagens.carregando, pastaImagens.valor]);

  async function salvarPastas() {
    const idPlanilhas = extrairIdPastaDrive(formPlanilhas);
    const idImagens = extrairIdPastaDrive(formImagens);
    if (formPlanilhas.trim() && !idPlanilhas) {
      toast.error("Link ou ID inválido para a pasta da planilha.");
      return;
    }
    if (formImagens.trim() && !idImagens) {
      toast.error("Link ou ID inválido para a pasta das imagens.");
      return;
    }
    setSalvandoPastas(true);
    try {
      await pastaPlanilhas.salvar(idPlanilhas);
      await pastaImagens.salvar(idImagens);
      setFormPlanilhas(idPlanilhas);
      setFormImagens(idImagens);
      toast.success("Pastas de destino atualizadas.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar as pastas.");
    } finally {
      setSalvandoPastas(false);
    }
  }

  useEffect(() => {
    if (!isAdmin) return;
    void supabase
      .from("backup_cron")
      .select("ultimo_backup,ultimo_resultado")
      .maybeSingle()
      .then(({ data }) => setUltimo(data ?? null));
  }, [isAdmin]);

  async function backupAgora() {
    setBackupando(true);
    setProgresso({ etapa: "Gerando e enviando a planilha…", enviados: 0, total: 0, falhas: 0, restante: null });
    try {
      const { planilha, arquivos, existentes } = await preparar({ data: undefined });
      const total = arquivos.length;
      const inicio = Date.now();
      let enviados = 0;
      const falhas: string[] = [];

      setProgresso({ etapa: "Enviando fotos e documentos…", enviados: 0, total, falhas: 0, restante: null });

      for (let i = 0; i < total; i += LOTE) {
        const parte = arquivos.slice(i, i + LOTE);
        const r = await enviarLote({ data: { arquivos: parte, existentes } });
        enviados += r.enviados;
        falhas.push(...r.falhas);
        const processados = Math.min(i + parte.length, total);
        const decorrido = (Date.now() - inicio) / 1000;
        const restante = processados > 0 ? (decorrido / processados) * (total - processados) : null;
        setProgresso({
          etapa: "Enviando fotos e documentos…",
          enviados: processados,
          total,
          falhas: falhas.length,
          restante,
        });
      }

      const resumo = `${planilha} · ${enviados} arquivo(s)${falhas.length ? ` · ${falhas.length} falha(s)` : ""}`;
      await registrar({ data: { resumo } });
      setUltimo({ ultimo_backup: new Date().toISOString(), ultimo_resultado: resumo });
      setProgresso({ etapa: "Backup concluído", enviados: total, total, falhas: falhas.length, restante: 0 });
      toast.success(`Backup concluído: ${resumo}`);
    } catch (err) {
      setProgresso(null);
      toast.error(err instanceof Error ? err.message : "Falha no backup");
    } finally {
      setBackupando(false);
    }
  }

  if (!isAdmin) {
    return (
      <AppShell title="Backup" subtitle="Acesso restrito">
        <Card>
          <CardContent className="flex items-center gap-3 py-8 text-sm text-muted-foreground">
            <ShieldAlert className="size-5 text-destructive" />
            Somente administradores podem acessar e executar o backup.
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  const pct = progresso && progresso.total > 0 ? Math.round((progresso.enviados / progresso.total) * 100) : 0;

  return (
    <AppShell title="Backup" subtitle="Envio da planilha e dos documentos para o Google Drive">
      <Card className="max-w-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 font-display text-base">
            <CloudUpload className="size-4" /> Backup no Google Drive
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            O backup envia a planilha de alunos do dia e todas as fotos e documentos para as pastas configuradas no
            Google Drive. Ele também roda automaticamente toda segunda-feira.
          </p>
          <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
            <p>
              <span className="text-muted-foreground">Último backup: </span>
              {ultimo?.ultimo_backup ? new Date(ultimo.ultimo_backup).toLocaleString("pt-BR") : "—"}
            </p>
            <p>
              <span className="text-muted-foreground">Resultado: </span>
              {ultimo?.ultimo_resultado ?? "—"}
            </p>
          </div>

          {progresso ? (
            <div className="space-y-2 rounded-lg border border-border p-3">
              <div className="flex items-center justify-between text-sm">
                <span>{progresso.etapa}</span>
                <span className="tabular-nums text-muted-foreground">{pct}%</span>
              </div>
              <Progress value={progresso.total > 0 ? pct : undefined} />
              <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
                <span>
                  {progresso.total > 0
                    ? `${progresso.enviados} de ${progresso.total} enviados · faltam ${progresso.total - progresso.enviados}`
                    : "Preparando arquivos…"}
                </span>
                <span>
                  Tempo estimado: {progresso.restante === null ? "calculando…" : formatarTempo(progresso.restante)}
                </span>
              </div>
              {progresso.falhas > 0 && (
                <p className="text-xs text-destructive">{progresso.falhas} arquivo(s) não puderam ser enviados.</p>
              )}
            </div>
          ) : null}

          <Button disabled={backupando} onClick={() => void backupAgora()}>
            <CloudUpload className="size-4" /> {backupando ? "Enviando..." : "Fazer Backup"}
          </Button>
        </CardContent>
      </Card>

      <Card className="mt-4 max-w-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 font-display text-base">
            <FolderCog className="size-4" /> Pastas de destino no Drive
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Cole o link (ou o ID) da pasta do Google Drive. Deixe em branco para usar as pastas padrão.
          </p>
          <div className="space-y-2">
            <Label htmlFor="pasta-planilha">Pasta da planilha</Label>
            <Input
              id="pasta-planilha"
              value={formPlanilhas}
              onChange={(e) => setFormPlanilhas(e.target.value)}
              placeholder="https://drive.google.com/drive/folders/..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pasta-imagens">Pasta das fotos e documentos</Label>
            <Input
              id="pasta-imagens"
              value={formImagens}
              onChange={(e) => setFormImagens(e.target.value)}
              placeholder="https://drive.google.com/drive/folders/..."
            />
          </div>
          <Button variant="secondary" disabled={salvandoPastas} onClick={() => void salvarPastas()}>
            {salvandoPastas ? "Salvando..." : "Salvar pastas"}
          </Button>
        </CardContent>
      </Card>
    </AppShell>
  );
}
