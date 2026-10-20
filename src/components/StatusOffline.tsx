import { AlertTriangle, CloudOff, RefreshCw, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useOffline } from "@/hooks/useOffline";
import type { OperacaoFila } from "@/lib/offline";

const DESCRICAO: Record<OperacaoFila["tipo"], string> = {
  aluno_novo: "Novo cadastro de aluno",
  aluno_update: "Alteração de cadastro",
  matricula: "Matrícula em turma",
  presenca: "Registro de presença",
  presenca_remover: "Remoção de presença",
};

export function StatusOffline() {
  const { online, pendentes, sincronizando, sincronizarAgora, bloqueada, descartar } = useOffline();
  const jaSincronizou = useRef(false);

  useEffect(() => {
    if (online && pendentes > 0 && !jaSincronizou.current) {
      jaSincronizou.current = true;
      void sincronizarAgora().then((r) => {
        if (r.enviados) toast.success(`${r.enviados} registro(s) sincronizado(s).`);
        if (r.bloqueada) toast.error("Um registro salvo offline não pôde ser enviado. Veja o aviso no topo da tela.");
      });
    }
    if (!online) jaSincronizou.current = false;
  }, [online, pendentes, sincronizarAgora]);

  if (online && pendentes === 0) return null;

  return (
    <div className="space-y-2 border-b border-border bg-muted/60 px-5 py-2 text-sm md:px-10">
      <div className="flex flex-wrap items-center gap-3">
        {online ? <UploadCloud className="size-4 text-primary" /> : <CloudOff className="size-4 text-destructive" />}
        <span className="text-muted-foreground">
          {online
            ? `${pendentes} registro(s) aguardando envio, na ordem em que foram feitos.`
            : `Modo offline ativo${pendentes ? ` — ${pendentes} registro(s) salvos no aparelho` : ""}. Tudo será enviado na mesma ordem quando a internet voltar.`}
        </span>
        {online && pendentes > 0 ? (
          <Button
            size="sm"
            variant="outline"
            disabled={sincronizando}
            onClick={() =>
              void sincronizarAgora().then((r) => {
                if (r.enviados) toast.success(`${r.enviados} registro(s) sincronizado(s).`);
              })
            }
          >
            <RefreshCw className={`mr-2 size-3.5 ${sincronizando ? "animate-spin" : ""}`} />
            Sincronizar agora
          </Button>
        ) : null}
      </div>
      {online && bloqueada ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-md border border-destructive/40 bg-destructive/10 p-2">
          <AlertTriangle className="size-4 shrink-0 text-destructive" />
          <span className="min-w-0 flex-1">
            <strong>{DESCRICAO[bloqueada.tipo]}</strong> feito em{" "}
            {new Date(bloqueada.criado_em).toLocaleString("pt-BR")} não foi aceito: {bloqueada.erro}. Os registros seguintes
            aguardam para manter a ordem.
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive"
            onClick={() => {
              if (!confirm("Descartar este registro? Ele não será enviado e os próximos seguirão normalmente.")) return;
              void descartar(bloqueada.id).then(() => sincronizarAgora());
            }}
          >
            Descartar este registro
          </Button>
        </div>
      ) : null}
    </div>
  );
}
