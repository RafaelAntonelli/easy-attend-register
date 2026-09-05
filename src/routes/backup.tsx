import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CalendarClock, CheckCircle2, CloudUpload, FolderCog, FolderTree, KeyRound, ShieldAlert, XCircle } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useConfiguracaoTexto } from "@/lib/configuracoes";
import {
  CHAVE_PASTA_DOCUMENTOS,
  CHAVE_PASTA_IMAGENS,
  CHAVE_PASTA_PLANILHAS,
  TIPOS_DOCUMENTO,
  chaveSubpastaDocumento,
  extrairIdPastaDrive,
  limparNomeSubpasta,
} from "@/lib/configuracoes-chaves";
import { useAuth } from "@/lib/auth";
import {
  validarPastasDriveFn,
  statusBackupFn,
  salvarAgendamentoFn,
} from "@/lib/backup.functions";
import { assinarBackup, estadoBackupAtual, executarBackupGlobal, notificar, type EstadoBackup } from "@/lib/backup-execucao";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/** Dias da semana no formato usado pelo agendador (0 = domingo). */
const DIAS_SEMANA = [
  { valor: 0, rotulo: "Domingo" },
  { valor: 1, rotulo: "Segunda-feira" },
  { valor: 2, rotulo: "Terça-feira" },
  { valor: 3, rotulo: "Quarta-feira" },
  { valor: 4, rotulo: "Quinta-feira" },
  { valor: 5, rotulo: "Sexta-feira" },
  { valor: 6, rotulo: "Sábado" },
] as const;


type ChecagemPasta = {
  chave: string;
  rotulo: string;
  id: string;
  padrao: boolean;
  ok: boolean;
  nome?: string | undefined;
  erro?: string | undefined;
};

/** Campo de subpasta (dentro da pasta de documentos) para um tipo de documento. */
function CampoSubpasta({ campo, rotulo, padrao }: { campo: string; rotulo: string; padrao: string }) {
  const config = useConfiguracaoTexto(chaveSubpastaDocumento(campo));
  const [texto, setTexto] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!config.carregando) setTexto(config.valor);
  }, [config.carregando, config.valor]);

  async function salvar() {
    const limpo = limparNomeSubpasta(texto);
    if (limpo === config.valor) return;
    setSalvando(true);
    try {
      await config.salvar(limpo);
      setTexto(limpo);
      toast.success(`Subpasta de ${rotulo.toLowerCase()} atualizada.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar a subpasta.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={`sub-${campo}`}>{rotulo}</Label>
      <Input
        id={`sub-${campo}`}
        value={texto}
        disabled={salvando}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={() => void salvar()}
        placeholder={`Ex.: ${padrao} (em branco = pasta principal)`}
      />
    </div>
  );
}

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

function formatarTempo(segundos: number) {
  if (!Number.isFinite(segundos) || segundos <= 0) return "—";
  const s = Math.round(segundos);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}min ${String(s % 60).padStart(2, "0")}s`;
}

/** Chave de sessão: a senha só é pedida uma vez por sessão do navegador. */
const CHAVE_LIBERADO = "arena:backup-liberado";

/** Pede a senha do administrador (a mesma do login) antes de liberar a tela. */
function SenhaAdmin({ email, onLiberar }: { email: string; onLiberar: () => void }) {
  const [senha, setSenha] = useState("");
  const [verificando, setVerificando] = useState(false);

  async function conferir() {
    if (!senha) {
      toast.error("Informe a senha de administrador.");
      return;
    }
    setVerificando(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
      if (error) {
        toast.error("Senha incorreta.");
        return;
      }
      sessionStorage.setItem(CHAVE_LIBERADO, "1");
      setSenha("");
      onLiberar();
    } finally {
      setVerificando(false);
    }
  }

  return (
    <AppShell title="Backup" subtitle="Confirmação de segurança">
      <Card className="max-w-md">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 font-display text-base">
            <KeyRound className="size-4" /> Senha de administrador
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Para acessar a tela de Backup, confirme a senha da sua conta de administrador.
          </p>
          <div className="space-y-2">
            <Label htmlFor="senha-backup">Senha</Label>
            <Input
              id="senha-backup"
              type="password"
              value={senha}
              maxLength={128}
              onChange={(e) => setSenha(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void conferir();
              }}
            />
          </div>
          <Button disabled={verificando} onClick={() => void conferir()}>
            {verificando ? "Verificando..." : "Acessar"}
          </Button>
        </CardContent>
      </Card>
    </AppShell>
  );
}

function BackupPage() {
  const { isAdmin, user } = useAuth();
  const [liberado, setLiberado] = useState(false);
  const [backupando, setBackupando] = useState(false);
  const [progresso, setProgresso] = useState<Progresso | null>(null);
  const [ultimo, setUltimo] = useState<{ ultimo_backup: string | null; ultimo_resultado: string | null } | null>(null);
  const preparar = useServerFn(prepararBackupFn);
  const enviarLote = useServerFn(enviarLoteBackupFn);
  const registrar = useServerFn(registrarBackupFn);
  const pastaPlanilhas = useConfiguracaoTexto(CHAVE_PASTA_PLANILHAS);
  const pastaImagens = useConfiguracaoTexto(CHAVE_PASTA_IMAGENS);
  const pastaDocumentos = useConfiguracaoTexto(CHAVE_PASTA_DOCUMENTOS);
  const [formPlanilhas, setFormPlanilhas] = useState("");
  const [formImagens, setFormImagens] = useState("");
  const [formDocumentos, setFormDocumentos] = useState("");
  const [salvandoPastas, setSalvandoPastas] = useState(false);
  const [checagens, setChecagens] = useState<ChecagemPasta[] | null>(null);
  const [verificando, setVerificando] = useState(false);
  const validarPastas = useServerFn(validarPastasDriveFn);

  async function verificarPastas() {
    setVerificando(true);
    try {
      const resultado = (await validarPastas({ data: undefined })) as ChecagemPasta[];
      setChecagens(resultado);
      const ruins = resultado.filter((c) => !c.ok);
      if (ruins.length === 0) toast.success("Todas as pastas do Drive estão acessíveis.");
      else toast.error(`${ruins.length} pasta(s) com problema. Confira os detalhes abaixo.`);
      return resultado;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível verificar as pastas.");
      return null;
    } finally {
      setVerificando(false);
    }
  }

  useEffect(() => {
    if (!pastaPlanilhas.carregando) setFormPlanilhas(pastaPlanilhas.valor);
  }, [pastaPlanilhas.carregando, pastaPlanilhas.valor]);

  useEffect(() => {
    if (!pastaImagens.carregando) setFormImagens(pastaImagens.valor);
  }, [pastaImagens.carregando, pastaImagens.valor]);

  useEffect(() => {
    if (!pastaDocumentos.carregando) setFormDocumentos(pastaDocumentos.valor);
  }, [pastaDocumentos.carregando, pastaDocumentos.valor]);

  async function salvarPastas() {
    const idPlanilhas = extrairIdPastaDrive(formPlanilhas);
    const idImagens = extrairIdPastaDrive(formImagens);
    const idDocumentos = extrairIdPastaDrive(formDocumentos);
    if (formPlanilhas.trim() && !idPlanilhas) {
      toast.error("Link ou ID inválido para a pasta da planilha.");
      return;
    }
    if (formImagens.trim() && !idImagens) {
      toast.error("Link ou ID inválido para a pasta das fotos.");
      return;
    }
    if (formDocumentos.trim() && !idDocumentos) {
      toast.error("Link ou ID inválido para a pasta dos documentos.");
      return;
    }
    setSalvandoPastas(true);
    try {
      await pastaPlanilhas.salvar(idPlanilhas);
      await pastaImagens.salvar(idImagens);
      await pastaDocumentos.salvar(idDocumentos);
      setFormPlanilhas(idPlanilhas);
      setFormImagens(idImagens);
      setFormDocumentos(idDocumentos);
      toast.success("Pastas de destino atualizadas.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar as pastas.");
    } finally {
      setSalvandoPastas(false);
    }
  }

  const lerStatus = useServerFn(statusBackupFn);
  const salvarAgendamento = useServerFn(salvarAgendamentoFn);
  const [agenda, setAgenda] = useState({ dia_semana: 1, hora: 3, minuto: 0, ativo: true });
  const [salvandoAgenda, setSalvandoAgenda] = useState(false);
  const ultimoAvisadoRef = useRef<string | null>(null);

  const atualizarStatus = useCallback(
    async (avisar: boolean) => {
      try {
        const dados = await lerStatus({ data: undefined });
        if (!dados) return;
        setUltimo({ ultimo_backup: dados.ultimo_backup, ultimo_resultado: dados.ultimo_resultado });
        setAgenda({
          dia_semana: dados.dia_semana ?? 1,
          hora: dados.hora ?? 3,
          minuto: dados.minuto ?? 0,
          ativo: dados.ativo ?? true,
        });
        const marca = dados.ultimo_backup ?? "";
        if (!avisar || !marca) {
          ultimoAvisadoRef.current = marca;
          return;
        }
        if (ultimoAvisadoRef.current && marca !== ultimoAvisadoRef.current) {
          notificar(
            dados.ultimo_status === "falha" ? "Backup automático falhou" : "Backup automático concluído",
            dados.ultimo_resultado ?? "",
            dados.ultimo_status === "falha",
          );
        }
        ultimoAvisadoRef.current = marca;
      } catch {
        /* silencioso: apenas leitura de status */
      }
    },
    [lerStatus],
  );

  useEffect(() => {
    if (!isAdmin) return;
    void atualizarStatus(false);
    const t = window.setInterval(() => void atualizarStatus(true), 60_000);
    return () => window.clearInterval(t);
  }, [isAdmin, atualizarStatus]);

  async function gravarAgendamento() {
    setSalvandoAgenda(true);
    try {
      await salvarAgendamento({ data: agenda });
      toast.success(
        agenda.ativo
          ? `Backup automático agendado para ${DIAS_SEMANA[agenda.dia_semana]?.rotulo} às ${String(agenda.hora).padStart(2, "0")}:${String(agenda.minuto).padStart(2, "0")}.`
          : "Backup automático desativado.",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar o agendamento.");
    } finally {
      setSalvandoAgenda(false);
    }
  }


  async function backupAgora() {
    const checagem = await verificarPastas();
    if (!checagem || checagem.some((c) => !c.ok)) {
      toast.error("Corrija as pastas do Google Drive antes de rodar o backup.");
      return;
    }
    setBackupando(true);
    setProgresso({ etapa: "Gerando e enviando a planilha…", enviados: 0, total: 0, falhas: 0, restante: null });
    try {
      const resposta = await preparar({ data: undefined });
      if (!resposta) throw new Error("O servidor não respondeu ao preparar o backup. Tente novamente.");
      if (!resposta.ok) throw new Error(resposta.erro || "Falha ao preparar o backup.");
      const { planilha, arquivos, existentes } = resposta;
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
      const status = falhas.length > 0 ? ("falha" as const) : ("sucesso" as const);
      await registrar({ data: { resumo, status } });
      const quando = new Date().toISOString();
      ultimoAvisadoRef.current = quando;
      setUltimo({ ultimo_backup: quando, ultimo_resultado: resumo });
      setProgresso({ etapa: "Backup concluído", enviados: total, total, falhas: falhas.length, restante: 0 });
      notificar(falhas.length > 0 ? "Backup concluído com falhas" : "Backup concluído", resumo, falhas.length > 0);
    } catch (err) {
      setProgresso(null);
      const mensagem = err instanceof Error ? err.message : "Falha no backup";
      try {
        await registrar({ data: { resumo: mensagem, status: "falha" } });
      } catch {
        /* o erro principal já será exibido */
      }
      notificar("Falha no backup", mensagem, true);
    } finally {
      setBackupando(false);
    }

  }

  const jaLiberado = liberado || (typeof sessionStorage !== "undefined" && sessionStorage.getItem(CHAVE_LIBERADO) === "1");

  if (isAdmin && !jaLiberado) {
    return <SenhaAdmin email={user?.email ?? ""} onLiberar={() => setLiberado(true)} />;
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
            Google Drive. Ele também roda sozinho no dia e horário definidos abaixo.
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

          <div className="flex flex-wrap gap-2">
            <Button disabled={backupando || verificando} onClick={() => void backupAgora()}>
              <CloudUpload className="size-4" /> {backupando ? "Enviando..." : "Fazer Backup"}
            </Button>
            <Button variant="outline" disabled={verificando || backupando} onClick={() => void verificarPastas()}>
              <CheckCircle2 className="size-4" /> {verificando ? "Verificando..." : "Verificar pastas"}
            </Button>
          </div>

          {checagens ? (
            <ul className="space-y-2 rounded-lg border border-border p-3 text-sm">
              {checagens.map((c) => (
                <li key={c.chave} className="flex items-start gap-2">
                  {c.ok ? (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                  ) : (
                    <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                  )}
                  <span>
                    <strong>{c.rotulo}</strong>
                    {c.padrao ? " (padrão)" : ""}:{" "}
                    {c.ok ? `acessível — ${c.nome ?? c.id}` : (c.erro ?? "indisponível")}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </CardContent>
      </Card>

      <Card className="mt-4 max-w-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 font-display text-base">
            <CalendarClock className="size-4" /> Backup automático
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Escolha o dia da semana e o horário (Brasília) em que o backup deve rodar sozinho. Ao terminar, você recebe
            uma notificação com o resultado — inclusive se algo falhar.
          </p>
          <div className="flex items-center gap-3">
            <Switch
              id="backup-ativo"
              checked={agenda.ativo}
              onCheckedChange={(v) => setAgenda((a) => ({ ...a, ativo: v }))}
            />
            <Label htmlFor="backup-ativo">Backup automático ativado</Label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Dia da semana</Label>
              <Select
                value={String(agenda.dia_semana)}
                onValueChange={(v) => setAgenda((a) => ({ ...a, dia_semana: Number(v) }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DIAS_SEMANA.map((d) => (
                    <SelectItem key={d.valor} value={String(d.valor)}>
                      {d.rotulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="backup-hora">Horário</Label>
              <Input
                id="backup-hora"
                type="time"
                value={`${String(agenda.hora).padStart(2, "0")}:${String(agenda.minuto).padStart(2, "0")}`}
                onChange={(e) => {
                  const [h, m] = e.target.value.split(":");
                  setAgenda((a) => ({ ...a, hora: Number(h ?? 0) || 0, minuto: Number(m ?? 0) || 0 }));
                }}
              />
            </div>
          </div>
          <Button variant="secondary" disabled={salvandoAgenda} onClick={() => void gravarAgendamento()}>
            {salvandoAgenda ? "Salvando..." : "Salvar agendamento"}
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
            <Label htmlFor="pasta-imagens">Pasta das fotos dos alunos</Label>
            <Input
              id="pasta-imagens"
              value={formImagens}
              onChange={(e) => setFormImagens(e.target.value)}
              placeholder="https://drive.google.com/drive/folders/..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pasta-documentos">Pasta das imagens dos documentos</Label>
            <Input
              id="pasta-documentos"
              value={formDocumentos}
              onChange={(e) => setFormDocumentos(e.target.value)}
              placeholder="https://drive.google.com/drive/folders/..."
            />
          </div>
          <Button variant="secondary" disabled={salvandoPastas} onClick={() => void salvarPastas()}>
            {salvandoPastas ? "Salvando..." : "Salvar pastas"}
          </Button>
        </CardContent>
      </Card>
      <Card className="mt-4 max-w-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 font-display text-base">
            <FolderTree className="size-4" /> Subpastas por tipo de documento
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Informe o nome da subpasta (dentro da pasta de documentos) para cada tipo. As subpastas são criadas
            automaticamente no backup. Em branco, o arquivo vai direto para a pasta de documentos.
          </p>
          {TIPOS_DOCUMENTO.map((tipo) => (
            <CampoSubpasta key={tipo.campo} campo={tipo.campo} rotulo={tipo.rotulo} padrao={tipo.padrao} />
          ))}
        </CardContent>
      </Card>
    </AppShell>
  );
}
