import { useEffect, useState } from "react";
import { History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CarregandoLinhas } from "@/components/Carregando";
import { EstadoVazio } from "@/components/EstadoVazio";
import { Badge } from "@/components/ui/badge";

type Acao = { id: string; created_at: string; autor_nome: string | null; acao: string; detalhe: string | null };

/** Lista para administradores de quem alterou permissões, papéis ou excluiu alunos, e quando. */
export function RegistroAcoes() {
  const [lista, setLista] = useState<Acao[] | null>(null);
  const [erro, setErro] = useState("");
  useEffect(() => {
    void supabase.from("registro_acoes").select("id,created_at,autor_nome,acao,detalhe").order("created_at", { ascending: false }).limit(200)
      .then(({ data, error }) => { if (error) setErro(error.message); setLista((data ?? []) as Acao[]); });
  }, []);
  if (!lista) return <CarregandoLinhas linhas={5} />;
  if (erro) return <p className="text-sm text-destructive">Não foi possível carregar o registro: {erro}</p>;
  if (!lista.length) return <EstadoVazio icone={History} titulo="Nenhuma ação registrada ainda" descricao="Exclusões de alunos, mudanças de papéis e de permissões dos professores aparecerão aqui." />;
  return (
    <ul className="divide-y divide-border rounded-xl border border-border bg-card">
      {lista.map((a) => (
        <li key={a.id} className="flex flex-col gap-1 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2"><Badge variant="secondary">{a.acao}</Badge><span className="break-words text-sm font-medium">{a.detalhe}</span></div>
            <p className="mt-1 text-xs text-muted-foreground">Por {a.autor_nome ?? "sistema"}</p>
          </div>
          <time className="shrink-0 text-xs text-muted-foreground" dateTime={a.created_at}>{new Date(a.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</time>
        </li>
      ))}
    </ul>
  );
}
