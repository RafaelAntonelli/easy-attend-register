import { useEffect, useState } from "react";
import { toast } from "sonner";
import { NotebookPen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { permissaoAtiva, usePermissoesProfessor } from "@/lib/permissoes";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Nota = { turma_id: string; texto: string; autor_nome: string | null; updated_at: string };

/** Anotação da aula (ex.: "piscina fria", "aula substituída"), uma por turma e dia. */
function useSemInternet() {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const atualizar = () => setOffline(!navigator.onLine);
    atualizar();
    window.addEventListener("online", atualizar);
    window.addEventListener("offline", atualizar);
    return () => { window.removeEventListener("online", atualizar); window.removeEventListener("offline", atualizar); };
  }, []);
  return offline;
}

export function AnotacaoAula({ turmas, data }: { turmas: { id: string; nome: string }[]; data: string }) {
  const offline = useSemInternet();
  const { isAdmin } = useAuth();
  const { mapa } = usePermissoesProfessor();
  const podeEditar = isAdmin || permissaoAtiva(mapa, "presenca_registrar");
  const [notas, setNotas] = useState<Record<string, Nota>>({});
  const [rascunhos, setRascunhos] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState<string | null>(null);
  const chave = turmas.map((t) => t.id).join(",");

  useEffect(() => {
    setRascunhos({});
    if (!chave || offline) { setNotas({}); return; }
    let ativo = true;
    void supabase.from("anotacoes_aula").select("turma_id,texto,autor_nome,updated_at").eq("data", data).in("turma_id", chave.split(","))
      .then(({ data: linhas, error }) => {
        if (!ativo) return;
        if (error) { toast.error("Não foi possível carregar as anotações da aula."); return; }
        setNotas(Object.fromEntries((linhas ?? []).map((n) => [n.turma_id, n as Nota])));
      });
    return () => { ativo = false; };
  }, [chave, data, offline]);

  async function salvar(turmaId: string) {
    const texto = (rascunhos[turmaId] ?? notas[turmaId]?.texto ?? "").trim();
    setSalvando(turmaId);
    try {
      if (!texto) {
        const { error } = await supabase.from("anotacoes_aula").delete().eq("turma_id", turmaId).eq("data", data);
        if (error) throw error;
        setNotas((n) => { const c = { ...n }; delete c[turmaId]; return c; });
        toast.success("Anotação apagada.");
      } else {
        const { data: salva, error } = await supabase.from("anotacoes_aula").upsert({ turma_id: turmaId, data, texto }, { onConflict: "turma_id,data" }).select("turma_id,texto,autor_nome,updated_at").single();
        if (error) throw error;
        setNotas((n) => ({ ...n, [turmaId]: salva as Nota }));
        toast.success("Anotação da aula salva.");
      }
      setRascunhos((r) => { const c = { ...r }; delete c[turmaId]; return c; });
    } catch {
      toast.error("Não foi possível salvar a anotação.");
    } finally { setSalvando(null); }
  }

  return (
    <Card className="border-border/70">
      <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 font-display text-lg"><NotebookPen className="size-5 text-primary" />Anotação da aula</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {!turmas.length ? <p className="text-sm text-muted-foreground">Escolha a turma da aula nos filtros para anotar algo sobre a aula de hoje, como "piscina fria" ou "aula substituída".</p>
          : offline ? <p className="text-sm text-muted-foreground">Sem internet. As anotações da aula ficam disponíveis quando a conexão voltar.</p>
          : turmas.map((t) => {
            const nota = notas[t.id];
            const valor = rascunhos[t.id] ?? nota?.texto ?? "";
            const alterado = rascunhos[t.id] !== undefined && rascunhos[t.id] !== (nota?.texto ?? "");
            return (
              <div key={t.id} className="space-y-2">
                {turmas.length > 1 && <p className="text-sm font-medium">{t.nome}</p>}
                <Textarea rows={2} maxLength={1000} aria-label={`Anotação da aula da turma ${t.nome}`} placeholder="Ex.: piscina fria, aula substituída pelo professor João" value={valor} disabled={!podeEditar} onChange={(e) => setRascunhos((r) => ({ ...r, [t.id]: e.target.value }))} />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">{nota ? `Salva por ${nota.autor_nome ?? "usuário"} às ${new Date(nota.updated_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : podeEditar ? "Nenhuma anotação nesta aula." : "Você não tem permissão para anotar."}</p>
                  {podeEditar && <Button size="sm" disabled={!alterado || salvando === t.id} onClick={() => void salvar(t.id)}>{salvando === t.id ? "Salvando…" : "Salvar anotação"}</Button>}
                </div>
              </div>
            );
          })}
      </CardContent>
    </Card>
  );
}
