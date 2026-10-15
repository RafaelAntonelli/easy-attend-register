import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, ExternalLink, History, RefreshCw, RotateCcw, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { historicoBackupFn, reenviarFalhasBackupFn } from "@/lib/backup.functions";

type Registro = Awaited<ReturnType<typeof historicoBackupFn>>[number];

function duracao(r: Registro) {
  if (!r.concluido_em) return "—";
  const s = Math.max(0, Math.round((new Date(r.concluido_em).getTime() - new Date(r.iniciado_em).getTime()) / 1000));
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}min ${String(s % 60).padStart(2, "0")}s`;
}

/** Histórico das execuções do backup, com detalhes das falhas e reenvio seletivo. */
export function HistoricoBackup({ atualizarEm }: { atualizarEm: string | null }) {
  const ler = useServerFn(historicoBackupFn);
  const reenviar = useServerFn(reenviarFalhasBackupFn);
  const [lista, setLista] = useState<Registro[] | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);
  const [reenviando, setReenviando] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      setLista(await ler({ data: undefined }));
    } catch {
      setLista([]);
    }
  }, [ler]);

  useEffect(() => {
    void carregar();
  }, [carregar, atualizarEm]);

  async function reenviarFalhas(r: Registro) {
    setReenviando(r.id);
    try {
      const res = await reenviar({ data: { id: r.id } });
      if (res.restantes === 0) toast.success(`${res.enviados} arquivo(s) reenviado(s) com sucesso.`);
      else toast.error(`${res.enviados} reenviado(s), ${res.restantes} ainda com falha.`);
      await carregar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível reenviar os arquivos.");
    } finally {
      setReenviando(null);
    }
  }

  return (
    <Card className="mt-4 max-w-2xl">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 font-display text-base">
          <History className="size-4" /> Histórico de backups
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={() => void carregar()}>
          <RefreshCw className="size-4" /> Atualizar
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {lista === null ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : lista.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma execução registrada ainda. Os próximos backups aparecerão aqui.
          </p>
        ) : (
          lista.map((r) => {
            const falhas = Array.isArray(r.falhas) ? r.falhas : [];
            const ok = r.status === "sucesso";
            const linkPlanilha = r.planilha_id
              ? `https://drive.google.com/file/d/${r.planilha_id}/view`
              : r.pasta_planilhas
                ? `https://drive.google.com/drive/folders/${r.pasta_planilhas}`
                : null;
            return (
              <div key={r.id} className="rounded-lg border border-border p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  {ok ? (
                    <CheckCircle2 className="size-4 text-primary" />
                  ) : (
                    <XCircle className="size-4 text-destructive" />
                  )}
                  <span className="font-medium">{new Date(r.iniciado_em).toLocaleString("pt-BR")}</span>
                  <Badge variant="outline">{r.origem === "automatico" ? "Automático" : "Manual"}</Badge>
                  <Badge variant={ok ? "secondary" : "destructive"}>
                    {ok ? "Sucesso" : falhas.length > 0 ? `${falhas.length} falha(s)` : "Falhou"}
                  </Badge>
                </div>
                <div className="mt-1 grid gap-x-4 text-xs text-muted-foreground sm:grid-cols-3">
                  <span>
                    Arquivos: {r.enviados}
                    {r.total ? ` de ${r.total}` : ""}
                  </span>
                  <span>Duração: {duracao(r)}</span>
                  <span>Por: {r.executado_por_nome ?? "—"}</span>
                </div>
                {!ok && falhas.length === 0 && r.resumo ? (
                  <p className="mt-1 text-xs text-destructive">{r.resumo}</p>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-2">
                  {linkPlanilha ? (
                    <Button asChild variant="outline" size="sm">
                      <a href={linkPlanilha} target="_blank" rel="noreferrer">
                        <ExternalLink className="size-4" /> Abrir planilha no Drive
                      </a>
                    </Button>
                  ) : null}
                  {falhas.length > 0 ? (
                    <>
                      <Button variant="outline" size="sm" onClick={() => setAberto(aberto === r.id ? null : r.id)}>
                        {aberto === r.id ? "Esconder falhas" : "Ver falhas"}
                      </Button>
                      <Button
                        size="sm"
                        disabled={reenviando !== null}
                        onClick={() => void reenviarFalhas(r)}
                      >
                        <RotateCcw className="size-4" />
                        {reenviando === r.id ? "Reenviando…" : `Reenviar ${falhas.length} arquivo(s)`}
                      </Button>
                    </>
                  ) : null}
                </div>
                {aberto === r.id && falhas.length > 0 ? (
                  <ul className="mt-2 space-y-1 rounded-md bg-muted/40 p-2 text-xs">
                    {falhas.map((f, i) => (
                      <li key={`${f.nome}-${i}`}>
                        <span className="font-medium">{f.nome}</span>
                        <span className="text-muted-foreground"> — {f.motivo}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
