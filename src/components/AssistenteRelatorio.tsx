import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, Loader2 } from "lucide-react";
import { assistenciaIA } from "@/lib/ai.functions";
import { useAuth } from "@/lib/auth";
import { permissaoAtiva, usePermissoesProfessor } from "@/lib/permissoes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AssistenteRelatorio() {
  const chamar = useServerFn(assistenciaIA);
  const { isAdmin, isStaff, loading } = useAuth();
  const { mapa, carregando } = usePermissoesProfessor();
  const permitido = !loading && (isAdmin || (isStaff && !carregando && permissaoAtiva(mapa, "relatorios_ver")));
  const [pergunta, setPergunta] = useState(""); const [resposta, setResposta] = useState("");
  const [erro, setErro] = useState(""); const [ocupado, setOcupado] = useState(false); const [atualizado, setAtualizado] = useState("");
  async function consultar() {
    if (!permitido || ocupado || pergunta.trim().length < 3) return;
    setOcupado(true); setErro(""); setResposta("");
    try { const r = await chamar({ data: { acao: "relatorio", pergunta } }); if (!r.ok) setErro(r.erro); else if ("texto" in r) { setResposta(r.texto); setAtualizado("atualizado" in r ? r.atualizado : ""); } }
    catch { setErro("Não foi possível consultar. Verifique sua conexão."); } finally { setOcupado(false); }
  }
  return <section className="mb-6 space-y-3 border-b border-border pb-5" aria-label="Assistente de relatórios">
    <h2 className="flex items-center gap-2 font-display text-base font-semibold"><Sparkles className="size-4 text-primary" /> Assistente de relatórios</h2>
    <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); void consultar(); }}>
      <div className="min-w-0 flex-1 space-y-1"><Label htmlFor="pergunta-relatorio">Pergunta sobre turmas e vagas</Label><Input id="pergunta-relatorio" placeholder="Quais turmas de Natação à tarde têm mais vagas?" maxLength={1500} value={pergunta} disabled={!permitido || ocupado} onChange={(e) => setPergunta(e.target.value)} /></div>
      <Button disabled={!permitido || ocupado || pergunta.trim().length < 3}>{ocupado ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}{ocupado ? "Consultando…" : "Consultar IA"}</Button>
    </form>
    {erro && <p className="text-sm text-destructive" role="alert">{erro}</p>}
    {resposta && <div className="space-y-2"><p className="whitespace-pre-wrap text-sm leading-relaxed" aria-live="polite">{resposta}</p><p className="text-xs text-muted-foreground">Todas as turmas ativas · Dados de {atualizado} · Resposta gerada por IA</p></div>}
  </section>;
}