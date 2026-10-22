import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ROTULOS_ACAO, descreverAlteracao, type RegistroHistorico } from "@/lib/historico-aluno";
import { Button } from "@/components/ui/button";

/** Quem alterou o quê e quando na ficha do aluno. */
export function HistoricoAluno({ alunoId }: { alunoId: string }) {
  const [aberto, setAberto] = useState(false);
  const [lista, setLista] = useState<RegistroHistorico[] | null>(null);
  const [erro, setErro] = useState(false);

  useEffect(() => { setLista(null); setErro(false); setAberto(false); }, [alunoId]);
  useEffect(() => {
    if (!aberto || lista) return;
    let ativo = true;
    void supabase.from("historico_alunos").select("id,acao,alteracoes,autor_nome,created_at").eq("aluno_id", alunoId).order("created_at", { ascending: false }).limit(200)
      .then(({ data, error }) => { if (!ativo) return; if (error) setErro(true); else setLista((data ?? []) as unknown as RegistroHistorico[]); });
    return () => { ativo = false; };
  }, [aberto, alunoId, lista]);

  return (
    <div className="space-y-2">
      <Button type="button" variant="ghost" size="sm" className="-ml-2 gap-2 px-2 text-sm font-medium" aria-expanded={aberto} onClick={() => setAberto((v) => !v)}>
        <History className="size-4 text-primary" />Histórico de alterações
        {aberto ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
      </Button>
      {aberto && (erro ? <p role="alert" className="text-sm text-destructive">Não foi possível carregar o histórico.</p>
        : !lista ? <p className="text-sm text-muted-foreground">Carregando…</p>
        : !lista.length ? <p className="text-sm text-muted-foreground">Nenhuma alteração registrada desde que o histórico foi ativado.</p>
        : <ol className="max-h-72 space-y-2 overflow-y-auto rounded-lg border p-2 pr-3 [scrollbar-gutter:stable]">
          {lista.map((h) => (
            <li key={h.id} className="rounded-lg bg-secondary/50 px-3 py-2 text-sm">
              <p className="font-medium">{ROTULOS_ACAO[h.acao] ?? "Alteração"}</p>
              {h.alteracoes.length > 0 && <ul className="mt-1 space-y-0.5 text-xs">{h.alteracoes.map((a, i) => <li key={i} className="break-words">{descreverAlteracao(a)}</li>)}</ul>}
              <p className="mt-1 text-xs text-muted-foreground">
                {new Date(h.created_at).toLocaleDateString("pt-BR")} às {new Date(h.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} · {h.autor_nome ?? "Sistema"}
              </p>
            </li>
          ))}
        </ol>)}
    </div>
  );
}
